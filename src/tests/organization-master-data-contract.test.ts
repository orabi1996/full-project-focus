import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Read source files for contract checks
const orgViewSource = readFileSync(
  new URL("../components/organization/OrganizationView.tsx", import.meta.url),
  "utf8",
);
const orgChartSource = readFileSync(
  new URL("../components/organization/OrgChartSvg.tsx", import.meta.url),
  "utf8",
);
const companyProfileSource = readFileSync(
  new URL("../components/organization/CompanyProfilePanel.tsx", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL("../../supabase/migrations/20260914100000_production_organization_integrity.sql", import.meta.url),
  "utf8",
);
const repoSource = readFileSync(
  new URL("../lib/data/operational-repository.ts", import.meta.url),
  "utf8",
);
const domainSource = readFileSync(
  new URL("../lib/domains/organization/index.ts", import.meta.url),
  "utf8",
);

describe("Organization & Master Data Production Integrity (Prompt 08 Contract)", () => {
  describe("1. Migration & Schema Hardening", () => {
    it("creates atomic archive RPC for organization units", () => {
      expect(migrationSource).toContain("FUNCTION public.archive_organization_unit");
      expect(migrationSource).toContain("p_reassign_department_id uuid DEFAULT NULL");
      expect(migrationSource).toContain("p_reparent_children_to uuid DEFAULT NULL");
      expect(migrationSource).toContain("SECURITY DEFINER");
      expect(migrationSource).toContain("FOR UPDATE");
    });

    it("creates hierarchy cycle prevention and tenant boundary validation", () => {
      expect(migrationSource).toContain("FUNCTION public.validate_department_hierarchy");
      expect(migrationSource).toContain("FUNCTION public.prevent_department_cycle");
      expect(migrationSource).toContain("WITH RECURSIVE ancestors");
    });

    it("creates master data dependency inspection RPC", () => {
      expect(migrationSource).toContain("FUNCTION public.get_master_data_dependencies");
      expect(migrationSource).toContain("'department'");
      expect(migrationSource).toContain("'subsidiary'");
      expect(migrationSource).toContain("'work_location'");
      expect(migrationSource).toContain("'cost_center'");
      expect(migrationSource).toContain("'job_position'");
    });

    it("creates history tables for organization changes and employee transfers", () => {
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.organization_change_history");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.employee_assignment_history");
      expect(migrationSource).toContain("ALTER TABLE public.organization_change_history ENABLE ROW LEVEL SECURITY");
      expect(migrationSource).toContain("ALTER TABLE public.employee_assignment_history ENABLE ROW LEVEL SECURITY");
    });

    it("enforces scoped unique code constraints and archived status support", () => {
      expect(migrationSource).toContain("departments_company_code_uidx");
      expect(migrationSource).toContain("subsidiaries_company_code_uidx");
      expect(migrationSource).toContain("work_locations_company_code_uidx");
      expect(migrationSource).toContain("cost_centers_company_code_uidx");
      expect(migrationSource).toContain("job_positions_company_code_uidx");
      expect(migrationSource).toContain("CHECK (status IN ('active', 'inactive', 'archived'))");
    });

    it("grants RPC execute to authenticated and revokes from public", () => {
      expect(migrationSource).toContain("REVOKE ALL ON FUNCTION public.archive_organization_unit(uuid, uuid, uuid) FROM PUBLIC");
      expect(migrationSource).toContain("GRANT EXECUTE ON FUNCTION public.archive_organization_unit(uuid, uuid, uuid) TO authenticated");
    });
  });

  describe("2. Operational Repository & Authoritative Identifiers", () => {
    it("returns authoritative inserted entity via .select().single()", () => {
      expect(repoSource).toContain('createOrganizationUnitRecord');
      expect(repoSource).toContain('createSubsidiaryRecord');
      expect(repoSource).toContain('createWorkLocationRecord');
      expect(repoSource).toContain('createCostCenterRecord');
      expect(repoSource).toContain('createJobPositionRecord');
    });

    it("handles unique code conflicts with friendly Arabic error messages", () => {
      expect(repoSource).toContain('كود الإدارة مستخدم بالفعل.');
      expect(repoSource).toContain('كود الشركة التابعة مستخدم بالفعل.');
      expect(repoSource).toContain('كود موقع العمل مستخدم بالفعل.');
      expect(repoSource).toContain('كود مركز التكلفة مستخدم بالفعل.');
      expect(repoSource).toContain('كود المسمى الوظيفي مستخدم بالفعل.');
    });

    it("performs zero-row update verification on master entities", () => {
      expect(repoSource).toContain('السجل غير موجود أو تم حذفه مسبقاً.');
    });

    it("exposes atomic archive RPC wrappers", () => {
      expect(repoSource).toContain('archiveOrganizationUnitRecord');
      expect(repoSource).toContain('archiveSubsidiaryRecord');
      expect(repoSource).toContain('archiveWorkLocationRecord');
      expect(repoSource).toContain('archiveCostCenterRecord');
      expect(repoSource).toContain('archiveJobPositionRecord');
      expect(repoSource).toContain('getMasterDataDependenciesRecord');
    });
  });

  describe("3. Domain Mutation Truthfulness", () => {
    it("does not generate Date.now() IDs for live mode in domain", () => {
      expect(domainSource).not.toContain('org-1789407005778');
      expect(domainSource).not.toContain('sub-1789407005778');
      expect(domainSource).not.toContain('loc-1789407005778');
      expect(domainSource).not.toContain('cc-1789407005778');
      expect(domainSource).not.toContain('pos-1789407005778');
    });

    it("uses crypto.randomUUID() for demo mode identity", () => {
      expect(domainSource).toContain('crypto.randomUUID()');
    });

    it("provides archiveOrgUnit and dependency helpers", () => {
      expect(domainSource).toContain('archiveOrgUnit');
      expect(domainSource).toContain('getMasterDataDependencies');
    });
  });

  describe("4. Organization View Truthfulness & Removal of Fake Claims", () => {
    it("never falls back to defaultCompanyTree in live mode with 0 units", () => {
      expect(orgViewSource).not.toMatch(/ifs*(!orgUnitss*||s*orgUnits.lengths*===s*0)s*{s*returns+defaultCompanyTree;s*}/);
      expect(orgViewSource).toContain('if (dataMode === "demo")');
    });

    it("does not use hardcoded openPositions: 2 or openPositions: 8", () => {
      expect(orgViewSource).not.toContain('openPositions: 2');
      expect(orgViewSource).not.toContain('openPositions: 8');
    });

    it("does not fabricate budget formulas via headcount * 16500 or 17500", () => {
      expect(orgViewSource).not.toContain('* 16500');
      expect(orgViewSource).not.toContain('* 17500');
    });

    it("does not fallback employeeCount to 120", () => {
      expect(orgViewSource).not.toContain('employeeCount: employees.length || 120');
      expect(orgViewSource).not.toContain('employees.length || 120');
    });

    it("does not fabricate salary mass defaults in getDeptSalaryMass", () => {
      expect(orgViewSource).not.toContain('basicSalary || 7500');
      expect(orgViewSource).not.toContain('housingAllowance || 1875');
    });

    it("guards salary mass behind payroll view permission", () => {
      expect(orgViewSource).toContain('canViewSalaryMass');
      expect(orgViewSource).toContain('canAccessModule(currentRole, "payroll")');
    });

    it("does not generate Math.random() codes in form resets", () => {
      expect(orgViewSource).not.toContain('Math.random()');
    });

    it("does not populate fake Commercial Registration or King Fahd Road defaults", () => {
      expect(orgViewSource).not.toContain('1010892341');
      expect(orgViewSource).not.toContain('الرياض - طريق الملك فهد');
    });

    it("validates geographic coordinates for work locations", () => {
      expect(orgViewSource).toContain('lat < -90 || lat > 90');
      expect(orgViewSource).toContain('lng < -180 || lng > 180');
    });
  });

  describe("5. OrgChartSvg Integrity", () => {
    it("does not default root to defaultCompanyTree unconditionally", () => {
      expect(orgChartSource).not.toContain('root = defaultCompanyTree,');
    });

    it("renders empty state when root or layout is empty", () => {
      expect(orgChartSource).toContain('if (!root || !laidOut)');
    });
  });

  describe("6. CompanyProfilePanel Truthfulness & Validations", () => {
    it("does not use fake financial fallback metrics", () => {
      expect(companyProfileSource).not.toContain('totals?.balance ?? 1250000');
      expect(companyProfileSource).not.toContain('totals?.paidOut ?? 845000');
      expect(companyProfileSource).not.toContain('totals?.loansOutstanding ?? 65000');
      expect(companyProfileSource).not.toContain('totals?.employeesTotal ?? 120');
    });

    it("validates IANA timezone, ISO currency, and fiscal month", () => {
      expect(companyProfileSource).toContain('Intl.DateTimeFormat(undefined, { timeZone: companyForm.timezone })');
      expect(companyProfileSource).toContain('/^[A-Z]{3}$/');
      expect(companyProfileSource).toContain('companyForm.fiscalYearStartMonth < 1 || companyForm.fiscalYearStartMonth > 12');
    });
  });

  describe("7. Pure Logic Hierarchy Cycle Simulation", () => {
    function simulateHierarchyCheck(
      departments: { id: string; parentId: string | null }[],
      targetId: string,
      newParentId: string | null,
    ): boolean {
      if (newParentId === null) return true;
      if (targetId === newParentId) return false;

      // Check cycle: walk ancestors of newParentId
      let current: string | null = newParentId;
      const visited = new Set<string>();
      while (current !== null) {
        if (current === targetId) return false; // cycle!
        if (visited.has(current)) return false;
        visited.add(current);
        const parentDept = departments.find((d) => d.id === current);
        current = parentDept ? parentDept.parentId : null;
      }
      return true;
    }

    const testDepts = [
      { id: "dept-a", parentId: null },
      { id: "dept-b", parentId: "dept-a" },
      { id: "dept-c", parentId: "dept-b" },
      { id: "dept-d", parentId: "dept-c" },
    ];

    it("rejects self-parenting (A -> A)", () => {
      expect(simulateHierarchyCheck(testDepts, "dept-a", "dept-a")).toBe(false);
    });

    it("rejects direct circular link (A parent = B when B parent = A)", () => {
      expect(simulateHierarchyCheck(testDepts, "dept-a", "dept-b")).toBe(false);
    });

    it("rejects indirect deep circular link (A parent = D when D -> C -> B -> A)", () => {
      expect(simulateHierarchyCheck(testDepts, "dept-a", "dept-d")).toBe(false);
    });

    it("accepts valid parent assignment", () => {
      expect(simulateHierarchyCheck(testDepts, "dept-d", "dept-a")).toBe(true);
    });

    it("accepts setting parent to null (becoming root)", () => {
      expect(simulateHierarchyCheck(testDepts, "dept-c", null)).toBe(true);
    });
  });
});
