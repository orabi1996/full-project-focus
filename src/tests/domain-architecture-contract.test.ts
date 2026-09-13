import { describe, it, expect, beforeEach } from "vitest";
import { queryKeys } from "../lib/query/query-keys";
import { createQueryClient, clearSensitiveQueryCache } from "../lib/query/query-client";
import { demoStore } from "../lib/domains/demo/demo-store";

describe("Domain Architecture Contract Tests", () => {
  describe("Query Keys Architecture", () => {
    it("provides hierarchical, deterministic query keys for all domains", () => {
      expect(queryKeys.bootstrap.all).toEqual(["bootstrap"]);
      expect(queryKeys.bootstrap.core()).toEqual(["bootstrap", "core"]);
      expect(queryKeys.bootstrap.operational()).toEqual(["bootstrap", "operational"]);

      expect(queryKeys.employees.all).toEqual(["employees"]);
      expect(queryKeys.employees.list()).toEqual(["employees", "list"]);
      expect(queryKeys.employees.detail("emp-101")).toEqual(["employees", "detail", "emp-101"]);

      expect(queryKeys.organization.all).toEqual(["organization"]);
      expect(queryKeys.organization.units()).toEqual(["organization", "units"]);
      expect(queryKeys.organization.subsidiaries()).toEqual(["organization", "subsidiaries"]);

      expect(queryKeys.payroll.all).toEqual(["payroll"]);
      expect(queryKeys.payroll.runs()).toEqual(["payroll", "runs"]);
      expect(queryKeys.payroll.run("run-2026-03")).toEqual(["payroll", "runs", "run-2026-03"]);
      expect(queryKeys.payroll.loans()).toEqual(["payroll", "loans"]);
      expect(queryKeys.payroll.settlements()).toEqual(["payroll", "settlements"]);

      expect(queryKeys.attendance.all).toEqual(["attendance"]);
      expect(queryKeys.attendance.records()).toEqual(["attendance", "records"]);

      expect(queryKeys.workflow.all).toEqual(["workflow"]);
      expect(queryKeys.workflow.requests()).toEqual(["workflow", "requests"]);
      expect(queryKeys.workflow.chains()).toEqual(["workflow", "chains"]);

      expect(queryKeys.leaves.all).toEqual(["leaves"]);
      expect(queryKeys.leaves.types()).toEqual(["leaves", "types"]);
      expect(queryKeys.leaves.balances()).toEqual(["leaves", "balances", "all"]);

      expect(queryKeys.expenses.all).toEqual(["expenses"]);
      expect(queryKeys.expenses.categories()).toEqual(["expenses", "categories"]);
      expect(queryKeys.expenses.claims()).toEqual(["expenses", "claims"]);

      expect(queryKeys.audit.all).toEqual(["audit"]);
      expect(queryKeys.notifications.all).toEqual(["notifications"]);
    });
  });

  describe("Query Client Production Defaults", () => {
    it("configures resilient query client defaults with proper staleTime and retry bounds", () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();

      expect(defaultOptions.queries?.staleTime).toBe(2 * 60 * 1000);
      expect(defaultOptions.queries?.gcTime).toBe(10 * 60 * 1000);
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
      expect(defaultOptions.mutations?.retry).toBe(0);
    });

    it("clears sensitive query cache completely on signout", () => {
      const client = createQueryClient();
      client.setQueryData(queryKeys.employees.all, [{ id: "emp-1" }]);
      client.setQueryData(queryKeys.payroll.all, [{ id: "pay-1" }]);
      client.setQueryData(queryKeys.audit.all, [{ id: "aud-1" }]);

      expect(client.getQueryData(queryKeys.employees.all)).toBeDefined();
      expect(client.getQueryData(queryKeys.payroll.all)).toBeDefined();
      expect(client.getQueryData(queryKeys.audit.all)).toBeDefined();

      clearSensitiveQueryCache(client);

      expect(client.getQueryData(queryKeys.employees.all)).toBeUndefined();
      expect(client.getQueryData(queryKeys.payroll.all)).toBeUndefined();
      expect(client.getQueryData(queryKeys.audit.all)).toBeUndefined();
    });
  });

  describe("Demo Store In-Memory Isolation", () => {
    beforeEach(() => {
      demoStore.reset();
    });

    it("maintains isolated state that notifies external listeners upon mutation", () => {
      let notifyCount = 0;
      const unsubscribe = demoStore.subscribe(() => {
        notifyCount++;
      });

      expect(notifyCount).toBe(0);
      const initialEmployeesCount = demoStore.employees.length;

      demoStore.employees = [
        ...demoStore.employees,
        {
          ...demoStore.employees[0],
          id: "emp-test-999",
          employeeNo: "EMP-TEST",
          firstNameAr: "اختبار",
          lastNameAr: "النظام",
          firstNameEn: "Test",
          lastNameEn: "System",
          email: "test@domain.local",
        },
      ];
      demoStore.notify();

      expect(notifyCount).toBe(1);
      expect(demoStore.employees.length).toBe(initialEmployeesCount + 1);

      unsubscribe();
    });

    it("resets back to pristine mock state cleanly", () => {
      const originalCount = demoStore.employees.length;
      demoStore.employees = [];
      demoStore.notify();
      expect(demoStore.employees.length).toBe(0);

      demoStore.reset();
      expect(demoStore.employees.length).toBe(originalCount);
    });
  });
});
