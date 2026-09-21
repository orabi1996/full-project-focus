import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// ============================================================================
// Source files under test
// ============================================================================
const migrationSource = readFileSync(
  new URL(
    "../../supabase/migrations/20260915030000_remove_employee_master_implicit_defaults.sql",
    import.meta.url,
  ),
  "utf8",
);
const repoSource = readFileSync(
  new URL("../lib/data/hrms-repository.ts", import.meta.url),
  "utf8",
);
const employeesViewSource = readFileSync(
  new URL("../components/employees/EmployeesView.tsx", import.meta.url),
  "utf8",
);
const domainSource = readFileSync(
  new URL("../lib/domains/employees/index.ts", import.meta.url),
  "utf8",
);

// ============================================================================
// Tests
// ============================================================================
describe("Employee Master Truthfulness Contract (Prompt 09 Final Closure)", () => {
  // --------------------------------------------------------------------------
  // 1-5: Server-side default fabrication removal (SQL migration)
  // --------------------------------------------------------------------------
  describe("1. Server — missing gender is not stored as male", () => {
    it("migration does not COALESCE gender to 'male'", () => {
      expect(migrationSource).not.toContain("'male'::public.employee_gender");
    });
    it("migration passes gender as-is (NULLIF allows NULL)", () => {
      expect(migrationSource).toContain("NULLIF(btrim(COALESCE(p_gender, '')), '')::public.employee_gender");
    });
  });

  describe("2. Server — missing marital_status is not stored as single", () => {
    it("migration does not COALESCE marital_status to 'single'", () => {
      expect(migrationSource).not.toContain("'single'::public.employee_marital_status");
    });
    it("migration passes marital_status as-is (NULLIF allows NULL)", () => {
      expect(migrationSource).toContain("NULLIF(btrim(COALESCE(p_marital_status, '')), '')::public.employee_marital_status");
    });
  });

  describe("3. Server — missing contract_type is rejected, not stored as full_time", () => {
    it("migration raises exception when contract_type is NULL or empty", () => {
      expect(migrationSource).toContain("IF p_contract_type IS NULL OR btrim(p_contract_type) = '' THEN");
      expect(migrationSource).toContain("\u0646\u0648\u0639 \u0627\u0644\u0639\u0642\u062f \u0625\u0644\u0632\u0627\u0645\u064a \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0631\u0643 \u0647\u0630\u0627 \u0627\u0644\u062d\u0642\u0644 \u0641\u0627\u0631\u063a\u0627\u064b.");
    });
    it("migration does not use COALESCE with 'full_time' literal", () => {
      expect(migrationSource).not.toMatch(/COALESCE\([^)]*'full_time'/);
    });
    it("migration does not use DEFAULT 'full_time' for p_contract_type parameter", () => {
      expect(migrationSource).not.toMatch(/p_contract_type\s+text\s+DEFAULT\s+'full_time'/);
    });
  });

  describe("4. Server — missing hire_date is rejected, not stored as current_date", () => {
    it("migration raises exception when hire_date is NULL", () => {
      expect(migrationSource).toContain("IF p_hire_date IS NULL THEN");
      expect(migrationSource).toContain("\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0639\u064a\u064a\u0646 \u0625\u0644\u0632\u0627\u0645\u064a \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0631\u0643 \u0647\u0630\u0627 \u0627\u0644\u062d\u0642\u0644 \u0641\u0627\u0631\u063a\u0627\u064b.");
    });
    it("migration does not COALESCE hire_date to current_date", () => {
      expect(migrationSource).not.toContain("COALESCE(p_hire_date, current_date)");
    });
    it("migration does not use DEFAULT current_date for p_hire_date parameter", () => {
      expect(migrationSource).not.toMatch(/p_hire_date\s+date\s+DEFAULT\s+current_date/);
    });
  });

  describe("5. Server — missing work_type is rejected, not stored as on_site", () => {
    it("migration raises exception when work_type is NULL or empty", () => {
      expect(migrationSource).toContain("IF p_work_type IS NULL OR btrim(p_work_type) = '' THEN");
      expect(migrationSource).toContain("\u0646\u0645\u0637 \u0627\u0644\u0639\u0645\u0644 \u0625\u0644\u0632\u0627\u0645\u064a \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0631\u0643 \u0647\u0630\u0627 \u0627\u0644\u062d\u0642\u0644 \u0641\u0627\u0631\u063a\u0627\u064b.");
    });
    it("migration does not COALESCE work_type to 'on_site'", () => {
      expect(migrationSource).not.toContain("COALESCE(p_work_type, 'on_site')");
    });
    it("migration does not use DEFAULT 'on_site' for p_work_type parameter", () => {
      expect(migrationSource).not.toMatch(/p_work_type\s+text\s+DEFAULT\s+'on_site'/);
    });
  });

  // --------------------------------------------------------------------------
  // 6-10: mapEmployee fabrication removal (TypeScript repository)
  // --------------------------------------------------------------------------
  describe("6. mapEmployee does not fabricate 'male' for missing gender", () => {
    it("repo does not use || \"male\" for gender", () => {
      expect(repoSource).not.toMatch(/gender:\s*\(row\.gender.*\)\s*\|\|\s*["']male["']/);
    });
    it("repo uses null-safe gender mapping", () => {
      expect(repoSource).toContain('gender: (row.gender as Gender | null) ?? null');
    });
  });

  describe("7. mapEmployee does not fabricate 'single' for missing marital_status", () => {
    it("repo does not use the whitelist-or-single fabrication pattern", () => {
      expect(repoSource).not.toContain(': "single"');
    });
    it("repo uses null-safe marital status mapping", () => {
      expect(repoSource).toContain("maritalStatus: (row.marital_status as MaritalStatus | null) ?? null");
    });
  });

  describe("8. mapEmployee does not fabricate 'full_time' for missing contract_type", () => {
    it("repo does not use the whitelist-or-full_time fabrication pattern", () => {
      expect(repoSource).not.toContain(': "full_time"');
    });
    it("repo uses null-safe contract type mapping", () => {
      expect(repoSource).toContain("contractType: (row.contract_type as ContractType | null) ?? null");
    });
  });

  describe("9. mapEmployee does not fabricate 'active' for missing status", () => {
    it("repo does not use || \"active\" for status", () => {
      expect(repoSource).not.toMatch(/status:\s*\(row\.status.*\)\s*\|\|\s*["']active["']/);
    });
    it("repo uses draft as the truthful initial-state fallback", () => {
      expect(repoSource).toContain('status: (row.status as Employee["status"]) ?? "draft"');
    });
  });

  describe("10. mapEmployee does not fabricate 'on_site' for missing work_type", () => {
    it("repo does not use || \"on_site\" for workType", () => {
      expect(repoSource).not.toMatch(/workType:.*\|\|\s*["']on_site["']/);
    });
    it("repo uses null-safe work type mapping", () => {
      expect(repoSource).toContain('workType: (row.work_type as "on_site" | "hybrid" | "remote" | null) ?? null');
    });
  });

  // --------------------------------------------------------------------------
  // 11: contractStartDate does not fall back to hireDate
  // --------------------------------------------------------------------------
  describe("11. contractStartDate does not fall back to hireDate", () => {
    it("repo does not use || row.hire_date as contractStartDate fallback", () => {
      expect(repoSource).not.toContain("row.contract_start_date || row.hire_date");
    });
    it("repo maps contractStartDate only from contract_start_date column", () => {
      expect(repoSource).toContain("contractStartDate: row.contract_start_date ?? undefined");
    });
  });

  // --------------------------------------------------------------------------
  // 12: EmployeesView consumes totalEmployed
  // --------------------------------------------------------------------------
  describe("12. EmployeesView consumes totalEmployed KPI", () => {
    it("EmployeesView declares totalEmployed local variable from kpis", () => {
      expect(employeesViewSource).toContain("totalEmployed");
      expect(employeesViewSource).toMatch(/const totalEmployed\s*=/);
    });
    it("EmployeesView renders totalEmployed in the primary KPI card", () => {
      expect(employeesViewSource).toContain("{totalEmployed}");
    });
  });

  // --------------------------------------------------------------------------
  // 13: Workforce percentage excludes terminated/draft/preboarding/suspended
  // --------------------------------------------------------------------------
  describe("13. Workforce percentage uses correct denominator (active+probation+on_leave)", () => {
    it("domain hook computes totalEmployed as active+probation+on_leave in demo mode", () => {
      expect(domainSource).toContain('["active", "probation", "on_leave"].includes(e.status)');
    });
    it("domain hook does not use all employees as the employed denominator", () => {
      expect(domainSource).not.toMatch(/totalEmployed\s*=\s*demoEmployees\.length/);
    });
    it("EmployeesView uses totalEmployed (not totalEmployees) as the KPI card primary number", () => {
      // Primary KPI card should show totalEmployed, not totalEmployees, in the h4
      expect(employeesViewSource).toContain("{totalEmployed}");
      // The workforce percentage should divide by totalEmployed
      expect(employeesViewSource).toContain("kpis.activeEmployees / totalEmployed");
    });
  });

  // --------------------------------------------------------------------------
  // 14: CSV does not attempt salary/National-ID fields when projection lacks them
  // --------------------------------------------------------------------------
  describe("14. CSV does not attempt salary/National-ID fields when projection lacks them", () => {
    it("CSV export checks e.nationalIdOrIqama before attempting to include National ID", () => {
      expect(employeesViewSource).toContain("if (canViewSensitive && e.nationalIdOrIqama)");
    });
    it("CSV export checks e.basicSalary before attempting to include salary", () => {
      expect(employeesViewSource).toContain("if (e.basicSalary !== undefined && e.basicSalary !== null)");
    });
  });

  // --------------------------------------------------------------------------
  // 15: Export wording reflects current-result scope
  // --------------------------------------------------------------------------
  describe("15. Export button label reflects current page/filter scope", () => {
    it("EmployeesView contains the truthful export label", () => {
      expect(employeesViewSource).toContain("\u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0646\u062a\u0627\u0626\u062c \u0627\u0644\u062d\u0627\u0644\u064a\u0629 (CSV)");
    });
  });

  // --------------------------------------------------------------------------
  // 16: createEmployeeRecord passes null not fabricated defaults
  // --------------------------------------------------------------------------
  describe("16. createEmployeeRecord passes null instead of fabricated defaults", () => {
    it("repo does not pass 'male' as p_gender default", () => {
      expect(repoSource).not.toMatch(/p_gender:\s*employee\.gender\s*\|\|\s*["']male["']/);
    });
    it("repo does not pass 'single' as p_marital_status default", () => {
      expect(repoSource).not.toMatch(/p_marital_status:\s*employee\.maritalStatus\s*\|\|\s*["']single["']/);
    });
    it("repo does not pass 'full_time' as p_contract_type default", () => {
      expect(repoSource).not.toMatch(/p_contract_type:\s*employee\.contractType\s*\|\|\s*["']full_time["']/);
    });
    it("repo does not fabricate today's date as p_hire_date fallback", () => {
      expect(repoSource).not.toMatch(/p_hire_date:\s*employee\.hireDate\s*\|\|\s*new Date\(\)/);
    });
    it("repo does not pass 'on_site' as p_work_type default", () => {
      expect(repoSource).not.toMatch(/p_work_type:\s*employee\.workType\s*\|\|\s*["']on_site["']/);
    });
    it("repo passes null for gender, marital, hire, contract, and work_type when empty", () => {
      expect(repoSource).toContain("p_gender: employee.gender || null");
      expect(repoSource).toContain("p_marital_status: employee.maritalStatus || null");
      expect(repoSource).toContain("p_hire_date: employee.hireDate || null");
      expect(repoSource).toContain("p_contract_type: employee.contractType || null");
      expect(repoSource).toContain("p_work_type: employee.workType || null");
    });
  });
});
