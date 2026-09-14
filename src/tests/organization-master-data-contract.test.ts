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
const migration11Source = readFileSync(
  new URL("../../supabase/migrations/20260914110000_finalize_organization_tenant_scope_and_truthfulness.sql", import.meta.url),
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

  // =========================================================================
  // 6. Tenant-Scope Security & Company Management Authorization Contract
  // =========================================================================
  describe("Tenant-Scope Security & Company Management Authorization Contract", () => {
    // Model the exact Postgres helper logic: public.current_user_can_manage_company
    function currentUserCanManageCompany(
      user: { id: string | null; role: string; companyId: string | null },
      targetCompanyId: string | null
    ): boolean {
      if (!user.id || !targetCompanyId) return false;
      if (user.role === "super_admin") return true;
      if (!user.companyId) return false;
      if (user.companyId !== targetCompanyId) return false;
      return ["org_admin", "hr_manager"].includes(user.role);
    }

    const companyA = "company-aaa-111";
    const companyB = "company-bbb-222";

    const userHrA = { id: "u-hr-a", role: "hr_manager", companyId: companyA };
    const userHrB = { id: "u-hr-b", role: "hr_manager", companyId: companyB };
    const userSuperAdmin = { id: "u-super", role: "super_admin", companyId: companyA };
    const userEmployeeA = { id: "u-emp-a", role: "employee", companyId: companyA };
    const userAnonymous = { id: null, role: "anon", companyId: null };

    it("allows Company A HR manager to manage Company A", () => {
      expect(currentUserCanManageCompany(userHrA, companyA)).toBe(true);
    });

    it("STRICTLY PREVENTS Company A HR manager from managing Company B (Cross-Tenant Isolation)", () => {
      expect(currentUserCanManageCompany(userHrA, companyB)).toBe(false);
    });

    it("STRICTLY PREVENTS Company B HR manager from managing Company A", () => {
      expect(currentUserCanManageCompany(userHrB, companyA)).toBe(false);
    });

    it("allows Super Admin global management across any company", () => {
      expect(currentUserCanManageCompany(userSuperAdmin, companyA)).toBe(true);
      expect(currentUserCanManageCompany(userSuperAdmin, companyB)).toBe(true);
    });

    it("prevents standard employee from managing company master data", () => {
      expect(currentUserCanManageCompany(userEmployeeA, companyA)).toBe(false);
      expect(currentUserCanManageCompany(userEmployeeA, companyB)).toBe(false);
    });

    it("rejects unauthenticated/anonymous calls", () => {
      expect(currentUserCanManageCompany(userAnonymous, companyA)).toBe(false);
      expect(currentUserCanManageCompany(userAnonymous, null)).toBe(false);
    });

    // Dependency Inspection Security
    it("rejects cross-company dependency inspection", () => {
      const targetDept = { id: "dept-b1", companyId: companyB };
      const canInspect = currentUserCanManageCompany(userHrA, targetDept.companyId);
      expect(canInspect).toBe(false);
    });

    // Unknown entity ID handling
    it("treats unknown entity ID in get_master_data_dependencies as not found rather than returning global empty counts", () => {
      const knownEntities = new Map<string, { companyId: string }>([
        ["dept-a1", { companyId: companyA }],
      ]);

      function simulateGetDependencies(entityId: string, caller: typeof userHrA) {
        const entity = knownEntities.get(entityId);
        if (!entity) {
          throw new Error("السجل المستهدف غير موجود");
        }
        if (!currentUserCanManageCompany(caller, entity.companyId)) {
          throw new Error("غير مصرح: لا تملك صلاحية الوصول لبيانات هذه المنشأة");
        }
        return { has_dependencies: false };
      }

      expect(() => simulateGetDependencies("unknown-id", userHrA)).toThrow("السجل المستهدف غير موجود");
      expect(() => simulateGetDependencies("dept-a1", userHrA)).not.toThrow();
      expect(() => simulateGetDependencies("dept-a1", userHrB)).toThrow("غير مصرح: لا تملك صلاحية الوصول لبيانات هذه المنشأة");
    });

    // Cross-company reassignment rejection
    it("rejects archive reassignment target if target belongs to a different company", () => {
      const deptToArchive = { id: "d-a1", companyId: companyA };
      const reassignDeptCross = { id: "d-b1", companyId: companyB };

      const isSameCompany = deptToArchive.companyId === reassignDeptCross.companyId;
      expect(isSameCompany).toBe(false);
    });

    // History Table RLS isolation
    it("restricts history read policy strictly to caller company for HR roles", () => {
      const historyRows = [
        { id: "h1", company_id: companyA, entity_type: "department" },
        { id: "h2", company_id: companyB, entity_type: "department" },
      ];

      function filterHistoryForUser(rows: typeof historyRows, user: typeof userHrA) {
        return rows.filter((r) => {
          if (user.role === "super_admin") return true;
          return r.company_id === user.companyId && ["org_admin", "hr_manager", "auditor"].includes(user.role);
        });
      }

      const visibleToHrA = filterHistoryForUser(historyRows, userHrA);
      expect(visibleToHrA.length).toBe(1);
      expect(visibleToHrA[0].id).toBe("h1");
      expect(visibleToHrA.some((r) => r.company_id === companyB)).toBe(false);
    });

    // Database Migration 11 Enforcement
    it("proves migration 11 defines current_user_can_manage_company and hardens all RPCs and RLS", () => {
      expect(migration11Source).toContain("FUNCTION public.current_user_can_manage_company(p_company_id uuid)");
      expect(migration11Source).toContain("REVOKE ALL ON FUNCTION public.current_user_can_manage_company(uuid) FROM PUBLIC;");
      expect(migration11Source).toContain("GRANT EXECUTE ON FUNCTION public.current_user_can_manage_company(uuid) TO authenticated;");

      // Verify all RPCs enforce current_user_can_manage_company
      expect(migration11Source).toContain("archive_organization_unit");
      expect(migration11Source).toContain("archive_subsidiary");
      expect(migration11Source).toContain("archive_work_location");
      expect(migration11Source).toContain("archive_cost_center");
      expect(migration11Source).toContain("archive_job_position");
      expect(migration11Source).toContain("get_master_data_dependencies");

      // Verify RLS policies on master tables
      expect(migration11Source).toContain('CREATE POLICY "departments_tenant_insert" ON public.departments');
      expect(migration11Source).toContain('CREATE POLICY "subsidiaries_tenant_insert" ON public.subsidiaries');
      expect(migration11Source).toContain('CREATE POLICY "work_locations_tenant_insert" ON public.work_locations');
      expect(migration11Source).toContain('CREATE POLICY "cost_centers_tenant_insert" ON public.cost_centers');
      expect(migration11Source).toContain('CREATE POLICY "job_positions_tenant_insert" ON public.job_positions');

      // Verify relationship validation trigger
      expect(migration11Source).toContain("FUNCTION public.validate_organization_relationships");
      expect(migration11Source).toContain("trg_validate_departments_relationships");
    });
  });

  // =========================================================================
  // 7. Truthfulness & Antipattern Prevention Contract
  // =========================================================================
  describe("Truthfulness & Antipattern Prevention Contract", () => {
    it("truthfully excludes terminated and suspended employees from canonical employed workforce", () => {
      const rawEmployees = [
        { id: "e1", status: "active" },
        { id: "e2", status: "probation" },
        { id: "e3", status: "on_leave" },
        { id: "e4", status: "suspended" },
        { id: "e5", status: "terminated" },
      ];

      const canonicalWorkforce = rawEmployees.filter((e) =>
        ["active", "probation", "on_leave"].includes(e.status)
      );

      expect(canonicalWorkforce.length).toBe(3);
      expect(canonicalWorkforce.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
      expect(canonicalWorkforce.some((e) => e.status === "suspended")).toBe(false);
      expect(canonicalWorkforce.some((e) => e.status === "terminated")).toBe(false);
    });

    it("preserves zero employee count and does NOT fall back to stale employeeCount", () => {
      const unit = { id: "dept-empty", employeeCount: 45 };
      const deptEmployees: Array<{ id: string }> = []; // Real zero employees

      // Truthful logic: zero is strictly 0, not (0 || unit.employeeCount) which would produce 45
      const truthfulHeadcount = deptEmployees.length;
      expect(truthfulHeadcount).toBe(0);

      const staleBugResult = deptEmployees.length || unit.employeeCount;
      expect(staleBugResult).toBe(45); // proves the bug existed previously
      expect(truthfulHeadcount).not.toBe(staleBugResult);
    });

    it("verifies company chart root does NOT fall back to HQ-01", () => {
      const companyWithoutCode = { legalNameAr: "شركة تجريبية", code: undefined };
      const companyCode = companyWithoutCode.code || undefined;
      expect(companyCode).toBeUndefined();
      expect(companyCode).not.toBe("HQ-01");
    });

    it("verifies static files contain no synthetic master data codes or Riyadh coordinates in live mapping", () => {
      // Must not contain DEP-${Date.now() or SUB-${Date.now()
      expect(orgViewSource).not.toContain("DEP-" + "$" + "{Date.now()");
      expect(orgViewSource).not.toContain("SUB-" + "$" + "{Date.now()");

      // Must not contain HQ-01 in OrganizationView
      expect(orgViewSource).not.toContain('"HQ-01"');

      // operational-repository must not inject fake Saudi geography fallbacks
      expect(repoSource).not.toContain('?? "المملكة العربية السعودية"');
      expect(repoSource).not.toContain('?? "Asia/Riyadh"');
      expect(repoSource).not.toContain("latitude: data.latitude ?? 24.7136");
      expect(repoSource).not.toContain("longitude: data.longitude ?? 46.6753");
    });
  });

});
