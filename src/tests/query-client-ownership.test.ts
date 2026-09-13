import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import { createQueryClient, clearSensitiveQueryCache } from "../lib/query/query-client";
import * as queryClientModule from "../lib/query/query-client";
import { queryKeys } from "../lib/query/query-keys";

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("QueryClient Ownership & Cache Clearance Architecture", () => {
  describe("Single Authoritative QueryClient Architecture", () => {
    it("does not export or instantiate a duplicate global appQueryClient", () => {
      // Proves requirement 1 & 2: No duplicate authoritative QueryClient
      expect((queryClientModule as Record<string, unknown>).appQueryClient).toBeUndefined();
      expect(typeof queryClientModule.createQueryClient).toBe("function");
      expect(typeof queryClientModule.clearSensitiveQueryCache).toBe("function");
    });

    it("verifies router.tsx creates the authoritative QueryClient using createQueryClient and injects it into context", () => {
      const routerSource = source("../router.tsx");
      expect(routerSource).toContain('import { createQueryClient } from "./lib/query/query-client";');
      expect(routerSource).toContain("const queryClient = createQueryClient();");
      expect(routerSource).toContain("context: { queryClient }");
    });

    it("enforces correct provider hierarchy in __root.tsx (QueryClientProvider wraps AuthProvider)", () => {
      const rootSource = source("../routes/__root.tsx");

      // Verify QueryClient is retrieved from Route.useRouteContext()
      expect(rootSource).toContain("const { queryClient } = Route.useRouteContext();");

      // Verify QueryClientProvider wraps AuthProvider
      const qcpIndex = rootSource.indexOf("<QueryClientProvider client={queryClient}>");
      const authProviderIndex = rootSource.indexOf("<AuthProvider>");
      const closingAuthProviderIndex = rootSource.indexOf("</AuthProvider>");
      const closingQcpIndex = rootSource.indexOf("</QueryClientProvider>");

      expect(qcpIndex).toBeGreaterThan(-1);
      expect(authProviderIndex).toBeGreaterThan(qcpIndex);
      expect(closingAuthProviderIndex).toBeGreaterThan(authProviderIndex);
      expect(closingQcpIndex).toBeGreaterThan(closingAuthProviderIndex);
    });

    it("verifies AuthContext uses useQueryClient() and passes that client to clearSensitiveQueryCache", () => {
      const authSource = source("../lib/auth/AuthContext.tsx");

      // Verify useQueryClient is imported and invoked
      expect(authSource).toContain('import { useQueryClient } from "@tanstack/react-query";');
      expect(authSource).toContain("const queryClient = useQueryClient();");

      // Verify clearSensitiveQueryCache is always called with the active queryClient instance
      expect(authSource).toContain("clearSensitiveQueryCache(queryClient);");
      // Must not call clearSensitiveQueryCache without arguments
      expect(authSource).not.toMatch(/clearSensitiveQueryCache\(\s*\)/);
    });
  });

  describe("Authoritative QueryClient Cache Clearance on Logout", () => {
    let appQueryClient: ReturnType<typeof createQueryClient>;

    beforeEach(() => {
      // Instantiate the authoritative QueryClient using the exact factory used by router.tsx
      appQueryClient = createQueryClient();
    });

    it("clears sensitive employee, payroll, audit, and leave data from the authoritative QueryClient", () => {
      // 1. Seed sensitive operational and employee data into the QueryClient
      appQueryClient.setQueryData(queryKeys.employees.all, [
        { id: "emp-01", nameAr: "أحمد علي", basicSalary: 15000 },
      ]);
      appQueryClient.setQueryData(queryKeys.employees.detail("emp-01"), {
        id: "emp-01",
        iban: "SA0380000000608010167519",
        basicSalary: 15000,
      });
      appQueryClient.setQueryData(queryKeys.payroll.runs(), [
        { id: "run-2026-03", totalNetSalary: 250000 },
      ]);
      appQueryClient.setQueryData(queryKeys.payroll.run("run-2026-03"), {
        id: "run-2026-03",
        totalNetSalary: 250000,
      });
      appQueryClient.setQueryData(queryKeys.leaves.balances("emp-01"), [
        { leaveTypeId: "lt-annual", availableBalance: 21 },
      ]);
      appQueryClient.setQueryData(queryKeys.audit.all, [
        { id: "aud-01", action: "export_wps_file" },
      ]);

      // Seed harmless public/static configuration
      appQueryClient.setQueryData(["public_config"], {
        appName: "Classera Pulse HCM",
        version: "2026.3",
      });

      // Verify data is currently populated in the client
      expect(appQueryClient.getQueryData(queryKeys.employees.all)).toBeDefined();
      expect(appQueryClient.getQueryData(queryKeys.employees.detail("emp-01"))).toBeDefined();
      expect(appQueryClient.getQueryData(queryKeys.payroll.runs())).toBeDefined();
      expect(appQueryClient.getQueryData(queryKeys.payroll.run("run-2026-03"))).toBeDefined();
      expect(appQueryClient.getQueryData(queryKeys.leaves.balances("emp-01"))).toBeDefined();
      expect(appQueryClient.getQueryData(queryKeys.audit.all)).toBeDefined();
      expect(appQueryClient.getQueryData(["public_config"])).toBeDefined();

      // 2. Trigger the exact cache-clear path used during logout
      clearSensitiveQueryCache(appQueryClient);

      // 3. Verify ALL sensitive data is purged from the QueryClient
      expect(appQueryClient.getQueryData(queryKeys.employees.all)).toBeUndefined();
      expect(appQueryClient.getQueryData(queryKeys.employees.detail("emp-01"))).toBeUndefined();
      expect(appQueryClient.getQueryData(queryKeys.payroll.runs())).toBeUndefined();
      expect(appQueryClient.getQueryData(queryKeys.payroll.run("run-2026-03"))).toBeUndefined();
      expect(appQueryClient.getQueryData(queryKeys.leaves.balances("emp-01"))).toBeUndefined();
      expect(appQueryClient.getQueryData(queryKeys.audit.all)).toBeUndefined();

      // 4. Verify harmless public/static configuration is intentionally preserved
      expect(appQueryClient.getQueryData(["public_config"])).toEqual({
        appName: "Classera Pulse HCM",
        version: "2026.3",
      });
    });

    it("cancels active in-flight sensitive queries when clearing cache", async () => {
      let aborted = false;

      // Start an in-flight query listening to TanStack Query's abort signal
      void appQueryClient.prefetchQuery({
        queryKey: queryKeys.employees.detail("emp-slow"),
        queryFn: ({ signal }) => {
          signal?.addEventListener("abort", () => {
            aborted = true;
          });
          return new Promise((resolve) => {
            signal?.addEventListener("abort", () => resolve(null));
          });
        },
      });

      // Clear sensitive cache while query is in-flight
      clearSensitiveQueryCache(appQueryClient);

      // Verify the query was aborted and removed from cache
      expect(aborted).toBe(true);
      expect(appQueryClient.getQueryData(queryKeys.employees.detail("emp-slow"))).toBeUndefined();
    });
  });

  describe("Authenticated Identity Transition (User A -> User B)", () => {
    it("clears User A's sensitive HR cache before User B's queries execute", () => {
      const appQueryClient = createQueryClient();

      // Simulate User A active session
      let previousUserId: string | null = "usr-alice-111";

      appQueryClient.setQueryData(queryKeys.employees.detail("emp-alice"), {
        id: "emp-alice",
        nameAr: "أليس",
        salary: 18000,
      });
      appQueryClient.setQueryData(queryKeys.payroll.run("run-alice"), {
        id: "run-alice",
        netSalary: 18000,
      });

      expect(appQueryClient.getQueryData(queryKeys.employees.detail("emp-alice"))).toBeDefined();

      // Simulate transition to User B (e.g., identity change in same browser session)
      const nextUserId = "usr-bob-222";

      // The exact check performed inside AuthContext onAuthStateChange:
      if (previousUserId && nextUserId && previousUserId !== nextUserId) {
        clearSensitiveQueryCache(appQueryClient);
      }
      previousUserId = nextUserId;

      // Verify User A's data is completely purged
      expect(appQueryClient.getQueryData(queryKeys.employees.detail("emp-alice"))).toBeUndefined();
      expect(appQueryClient.getQueryData(queryKeys.payroll.run("run-alice"))).toBeUndefined();

      // User B now populates their cache
      appQueryClient.setQueryData(queryKeys.employees.detail("emp-bob"), {
        id: "emp-bob",
        nameAr: "بوب",
        salary: 14000,
      });

      expect(appQueryClient.getQueryData(queryKeys.employees.detail("emp-bob"))).toEqual({
        id: "emp-bob",
        nameAr: "بوب",
        salary: 14000,
      });
      // User A's data remains non-existent
      expect(appQueryClient.getQueryData(queryKeys.employees.detail("emp-alice"))).toBeUndefined();
    });
  });
});
