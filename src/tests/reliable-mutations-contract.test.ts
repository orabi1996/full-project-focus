import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  executeReliableMutation,
  isMutationPending,
  clearInFlightMutations,
  AppMutationError,
  normalizeMutationError,
} from "../lib/data/reliable-mutation";
import { demoStore } from "../lib/domains/demo/demo-store";

describe("Reliable Mutations Contract Tests", () => {
  beforeEach(() => {
    clearInFlightMutations();
    demoStore.reset();
  });

  describe("Mode Isolation and Failure Truthfulness", () => {
    it("never executes demoOperation when in live mode, even if operation fails", async () => {
      const demoOperation = vi.fn();
      const operation = vi.fn().mockRejectedValue(new Error("Supabase connection timeout"));
      const onAudit = vi.fn();
      const onRejected = vi.fn();
      const refresh = vi.fn().mockResolvedValue(undefined);

      const result = await executeReliableMutation({
        mode: "live",
        operation,
        demoOperation,
        refresh,
        onAudit,
        onRejected,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(AppMutationError);
      expect(result.error?.kind).toBe("network");
      expect(operation).toHaveBeenCalledTimes(1);
      expect(demoOperation).not.toHaveBeenCalled();
      expect(onAudit).not.toHaveBeenCalled();
      expect(onRejected).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1); // restored authoritative snapshot
    });

    it("never executes network operation when in demo mode", async () => {
      const demoOperation = vi.fn().mockReturnValue({ id: "demo-123" });
      const operation = vi.fn();
      const onAudit = vi.fn();
      const onCommitted = vi.fn();

      const result = await executeReliableMutation({
        mode: "demo",
        operation,
        demoOperation,
        onAudit,
        onCommitted,
      });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ id: "demo-123" });
      expect(operation).not.toHaveBeenCalled();
      expect(demoOperation).toHaveBeenCalledTimes(1);
      expect(onAudit).toHaveBeenCalledTimes(1);
      expect(onCommitted).toHaveBeenCalledTimes(1);
    });
  });

  describe("Duplicate Mutation In-Flight Prevention", () => {
    it("blocks second submission while first mutation is still in flight", async () => {
      let resolveFirst: (val: unknown) => void;
      const firstLivePromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const mutationKey = "payroll-run-lock-2026-03";

      expect(isMutationPending(mutationKey)).toBe(false);

      const firstMutation = executeReliableMutation({
        mode: "live",
        mutationKey,
        operation: () => firstLivePromise,
      });

      expect(isMutationPending(mutationKey)).toBe(true);

      // Attempt second submission with same mutationKey while first is in flight
      const secondResult = await executeReliableMutation({
        mode: "live",
        mutationKey,
        operation: () => Promise.resolve({ ok: true }),
      });

      expect(secondResult.ok).toBe(false);
      expect(secondResult.error).toBeInstanceOf(AppMutationError);
      expect(secondResult.error?.kind).toBe("duplicate");
      expect(secondResult.error?.message).toContain("عملية مماثلة قيد التنفيذ بالفعل");

      // Resolve first
      resolveFirst!({ locked: true });
      const firstResult = await firstMutation;
      expect(firstResult.ok).toBe(true);

      // Verify mutation key is freed after completion
      expect(isMutationPending(mutationKey)).toBe(false);
    });
  });

  describe("Error Classification and Postgres Code Mapping", () => {
    it("classifies unique constraint 23505 as conflict", () => {
      const err = normalizeMutationError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      });
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("conflict");
    });

    it("classifies RLS / 42501 as authorization", () => {
      const err = normalizeMutationError({
        code: "42501",
        message: "new row violates row-level security policy",
      });
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("authorization");
    });

    it("classifies foreign key 23503 as conflict", () => {
      const err = normalizeMutationError({
        code: "23503",
        message: "insert or update on table violates foreign key constraint",
      });
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("conflict");
    });

    it("classifies network errors as network", () => {
      const err = normalizeMutationError(new TypeError("Failed to fetch"));
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("network");
    });
  });

  describe("Static Invariants: Mutation Source Code Audit", () => {
    it("ensures all domain mutation hooks use executeReliableMutation", () => {
      const domains = [
        "employees",
        "payroll",
        "attendance",
        "leaves",
        "workflow",
        "organization",
        "expenses",
        "assets",
        "documents",
        "performance",
        "recruitment",
        "shifts",
        "rbac",
      ];

      for (const domain of domains) {
        const domainIndexPath = path.resolve(__dirname, `../lib/domains/${domain}/index.ts`);
        expect(fs.existsSync(domainIndexPath)).toBe(true);
        const content = fs.readFileSync(domainIndexPath, "utf-8");
        expect(content).toContain("executeReliableMutation");
      }
    });

    it("ensures AppContext delegates mutations with truthful Promise<boolean> and tracks pendingMutationCount", () => {
      const appContextPath = path.resolve(__dirname, "../lib/context/AppContext.tsx");
      const content = fs.readFileSync(appContextPath, "utf-8");

      expect(content).toContain("pendingMutationCount");
      expect(content).toContain("setPendingMutationCount");
      expect(content).toContain("persistLiveChange");
      expect(content).toContain("executeReliableMutation");
    });
  });
});
