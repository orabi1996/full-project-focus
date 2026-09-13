import { describe, expect, it, vi } from "vitest";

import { executeReliableMutation, normalizeMutationError } from "./reliable-mutation";

describe("reliable mutation coordinator", () => {
  it("keeps demo mutations local and skips network work", async () => {
    const operation = vi.fn(async () => undefined);
    const refresh = vi.fn(async () => undefined);
    const onCommitted = vi.fn();

    const result = await executeReliableMutation({
      mode: "demo",
      operation,
      refresh,
      onCommitted,
    });

    expect(result).toEqual({ ok: true });
    expect(operation).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(onCommitted).toHaveBeenCalledOnce();
  });

  it("commits only after the write and confirmation refresh succeed", async () => {
    const events: string[] = [];

    const result = await executeReliableMutation({
      mode: "live",
      operation: async () => {
        events.push("write");
      },
      refresh: async () => {
        events.push("refresh");
      },
      onPendingChange: (pending) => {
        events.push(pending ? "pending" : "settled");
      },
      onCommitted: () => {
        events.push("committed");
      },
    });

    expect(result).toEqual({ ok: true });
    expect(events).toEqual(["pending", "write", "refresh", "committed", "settled"]);
  });

  it("restores the confirmed snapshot and reports rejected writes", async () => {
    const writeError = new Error("RLS denied the update");
    const refresh = vi.fn(async () => undefined);
    const onRejected = vi.fn();
    const pendingStates: boolean[] = [];

    const result = await executeReliableMutation({
      mode: "live",
      operation: async () => {
        throw writeError;
      },
      refresh,
      onPendingChange: (pending) => pendingStates.push(pending),
      onRejected,
    });

    expect(result).toEqual({ ok: false, error: writeError });
    expect(refresh).toHaveBeenCalledOnce();
    expect(onRejected).toHaveBeenCalledWith(writeError);
    expect(pendingStates).toEqual([true, false]);
  });

  it("does not hide the original error when rollback refresh also fails", async () => {
    const onRejected = vi.fn();
    const result = await executeReliableMutation({
      mode: "live",
      operation: async () => {
        throw new Error("write failed");
      },
      refresh: async () => {
        throw new Error("refresh failed");
      },
      onRejected,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("write failed");
    expect(onRejected).toHaveBeenCalledWith(expect.objectContaining({ message: "write failed" }));
  });

  it("treats an unconfirmed refresh as a failed mutation", async () => {
    const onCommitted = vi.fn();
    const onRejected = vi.fn();

    const result = await executeReliableMutation({
      mode: "live",
      operation: async () => undefined,
      refresh: async () => {
        throw new Error("confirmation failed");
      },
      onCommitted,
      onRejected,
    });

    expect(result.ok).toBe(false);
    expect(onCommitted).not.toHaveBeenCalled();
    expect(onRejected).toHaveBeenCalledWith(
      expect.objectContaining({ message: "confirmation failed" }),
    );
  });

  it("normalizes non-error failures into safe user-facing errors", () => {
    expect(normalizeMutationError("network unavailable").message).toBe("network unavailable");
    expect(normalizeMutationError(null).message).toBe("تعذر حفظ التغييرات");
  });

  it("blocks rapid concurrent submissions with the same mutationKey", async () => {
    let resolveFirst: () => void = () => {};
    const firstOp = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    // Start first mutation
    const firstPromise = executeReliableMutation({
      mode: "live",
      mutationKey: "emp-create-race",
      operation: () => firstOp,
    });

    // Attempt second mutation with the exact same key while first is pending
    const secondResult = await executeReliableMutation({
      mode: "live",
      mutationKey: "emp-create-race",
      operation: async () => undefined,
    });

    // Second should be blocked immediately as duplicate
    expect(secondResult.ok).toBe(false);
    expect(secondResult.error?.kind).toBe("duplicate");

    // Resolve first
    resolveFirst();
    const firstResult = await firstPromise;
    expect(firstResult.ok).toBe(true);

    // After first settles, subsequent mutation with same key is allowed
    const thirdResult = await executeReliableMutation({
      mode: "live",
      mutationKey: "emp-create-race",
      operation: async () => undefined,
    });
    expect(thirdResult.ok).toBe(true);
  });

  it("executes onAudit only after write succeeds", async () => {
    const onAudit = vi.fn();

    // 1. Success case
    await executeReliableMutation({
      mode: "live",
      operation: async () => ({ id: "123" }),
      onAudit,
    });
    expect(onAudit).toHaveBeenCalledWith({ id: "123" });

    // 2. Failure case: onAudit must NOT be called
    onAudit.mockClear();
    await executeReliableMutation({
      mode: "live",
      operation: async () => {
        throw new Error("server failed");
      },
      onAudit,
    });
    expect(onAudit).not.toHaveBeenCalled();
  });

  it("classifies postgres constraint errors into structured kinds", () => {
    const uniqueErr = normalizeMutationError({ code: "23505", message: "duplicate key" });
    expect(uniqueErr.kind).toBe("conflict");

    const fkErr = normalizeMutationError({ code: "23503", message: "foreign key violation" });
    expect(fkErr.kind).toBe("conflict");

    const rlsErr = normalizeMutationError({ code: "42501", message: "new row violates row-level security" });
    expect(rlsErr.kind).toBe("authorization");
  });
});
