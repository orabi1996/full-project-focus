import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  validateEnvironment,
  assertProductionReadiness,
  validateServerSecretKey,
  isNewSupabaseApiKey,
} from "../lib/config/env-validator";
import { calculateEmployeePayroll } from "../lib/utils/payroll-calculator";

describe("Prompt 26: Final Core Release — Production Readiness & Go-Live Certification", () => {
  // ==========================================================================
  // PART 1: ENVIRONMENT CONFIGURATION & SECURITY GATE TESTS
  // ==========================================================================
  describe("1. Environment Configuration & Pre-Flight Gate", () => {
    it("1.1 should approve valid production configuration", () => {
      const validProdEnv = {
        NODE_ENV: "production",
        VITE_SUPABASE_URL: "https://enterprise-prod.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_prod_valid_token_12345",
        VITE_ENABLE_DEMO_MODE: "false",
      };

      const result = validateEnvironment(validProdEnv);
      expect(result.isValid).toBe(true);
      expect(result.mode).toBe("production");
      expect(result.issues).toHaveLength(0);
      expect(result.configSummary.httpsEnforced).toBe(true);
      expect(result.configSummary.demoModeActive).toBe(false);
    });

    it("1.2 should block production deployment if Supabase URL is not HTTPS", () => {
      const insecureEnv = {
        NODE_ENV: "production",
        VITE_SUPABASE_URL: "http://enterprise-prod.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_prod_token",
        VITE_ENABLE_DEMO_MODE: "false",
      };

      const result = validateEnvironment(insecureEnv);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("VITE_SUPABASE_URL must use secure HTTPS in production environment.");
      expect(() => assertProductionReadiness(insecureEnv)).toThrow(/Startup Blocked/);
    });

    it("1.3 should block production deployment if service-role key is provided", () => {
      const dangerousEnv = {
        NODE_ENV: "production",
        VITE_SUPABASE_URL: "https://enterprise-prod.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "service_role_secret_dummy_test_token",
      };

      const result = validateEnvironment(dangerousEnv);
      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes("service-role or secret key"))).toBe(true);
      expect(() => assertProductionReadiness(dangerousEnv)).toThrow(/CRITICAL SECURITY DEFECT/);
    });

    it("1.4 should block production deployment if demo mode is enabled", () => {
      const demoProdEnv = {
        NODE_ENV: "production",
        VITE_SUPABASE_URL: "https://enterprise-prod.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_prod_token",
        VITE_ENABLE_DEMO_MODE: "true",
      };

      const result = validateEnvironment(demoProdEnv);
      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes("VITE_ENABLE_DEMO_MODE cannot be enabled in production"))).toBe(true);
    });

    it("1.5 should reject placeholder URLs in production", () => {
      const placeholderEnv = {
        NODE_ENV: "production",
        VITE_SUPABASE_URL: "https://your-project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_prod_token",
      };

      const result = validateEnvironment(placeholderEnv);
      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes("invalid placeholder hostname"))).toBe(true);
    });

    it("1.6 should validate modern SUPABASE_SECRET_KEY server-side", () => {
      const serverEnv = {
        SUPABASE_SECRET_KEY: "sb_secret_privileged_production_admin_key_12345",
      };

      const result = validateServerSecretKey(serverEnv);
      expect(result.isValid).toBe(true);
      expect(result.keyType).toBe("new_secret");
      expect(result.issues).toHaveLength(0);
    });

    it("1.7 should support backward-compatible fallback to SUPABASE_SERVICE_ROLE_KEY", () => {
      const legacyServerEnv = {
        SUPABASE_SERVICE_ROLE_KEY: "legacy_service_role_key_format_token",
      };

      const result = validateServerSecretKey(legacyServerEnv);
      expect(result.isValid).toBe(true);
      expect(result.keyType).toBe("legacy_service_role");
    });

    it("1.8 should reject publishable key passed as server secret key", () => {
      const invalidServerEnv = {
        SUPABASE_SECRET_KEY: "sb_publishable_wrongly_placed_as_secret",
      };

      const result = validateServerSecretKey(invalidServerEnv);
      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes("publishable key was provided as SUPABASE_SECRET_KEY"))).toBe(true);
    });

    it("1.9 should correctly classify new opaque key formats", () => {
      expect(isNewSupabaseApiKey("sb_publishable_test_token")).toBe(true);
      expect(isNewSupabaseApiKey("sb_secret_test_token")).toBe(true);
      expect(isNewSupabaseApiKey("eyJhbGciOi...legacy_jwt")).toBe(false);
      expect(isNewSupabaseApiKey("")).toBe(false);
    });
  });

  // ==========================================================================
  // PART 2: SOURCE CODE INTEGRITY & ANTI-PATTERN DEFENSES
  // ==========================================================================
  describe("2. Static Code Integrity & Anti-Pattern Defenses", () => {
    it("2.1 EssMobileView MUST NOT use employees[0] or mock fallbacks", () => {
      const essViewPath = path.resolve(__dirname, "../components/ess/EssMobileView.tsx");
      const essSource = fs.readFileSync(essViewPath, "utf-8");

      expect(essSource).not.toContain("employees[0]");
      expect(essSource).not.toContain("emps[0]");
      expect(essSource).not.toContain("Phone Speaker & Dynamic Island Notch");
    });

    it("2.2 AppHeader and AppContext MUST NOT use employees[0] as authenticated identity", () => {
      const appHeaderPath = path.resolve(__dirname, "../components/layout/AppHeader.tsx");
      const appHeaderSource = fs.readFileSync(appHeaderPath, "utf-8");
      expect(appHeaderSource).not.toContain("employees[0]");

      const appContextPath = path.resolve(__dirname, "../lib/context/AppContext.tsx");
      const appContextSource = fs.readFileSync(appContextPath, "utf-8");
      expect(appContextSource).not.toContain('bootstrap.dataMode === "demo" && emps[0]');
    });

    it("2.3 EmployeesView MUST NOT contain mock nationality calculation or sensitive ID in CSV export", () => {
      const empViewPath = path.resolve(__dirname, "../components/employees/EmployeesView.tsx");
      const empViewSource = fs.readFileSync(empViewPath, "utf-8");

      expect(empViewSource).not.toContain("gosiDeductionPercentage: isSaudi ? 9.75 : 0");
      expect(empViewSource).not.toContain("isGosiEnrolled: isSaudi");
      expect(empViewSource).not.toContain('"الهوية / الإقامة":');
    });

    it("2.4 Verify no accidental alert() calls remain in core operational views", () => {
      const coreViews = [
        "../components/attendance/AttendanceView.tsx",
        "../components/dashboard/DashboardView.tsx",
        "../components/documents/DocumentVaultView.tsx",
        "../components/employees/EmployeesView.tsx",
        "../components/expenses/ExpensesView.tsx",
        "../components/leaves/LeavesView.tsx",
        "../components/organization/OrganizationView.tsx",
        "../components/payroll/PayrollView.tsx",
        "../components/rbac/RbacView.tsx",
        "../components/recruitment/RecruitmentView.tsx",
        "../components/shifts/ShiftsView.tsx",
        "../components/workflow/WorkflowView.tsx",
      ];

      for (const relPath of coreViews) {
        const fullPath = path.resolve(__dirname, relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Match alert(...) but not comments or toast.alert
          const matches = content.match(/(?<![a-zA-Z0-9_.])alert\s*\(/g);
          expect(matches, `Found unexpected alert() in ${relPath}`).toBeNull();
        }
      }
    });
  });

  // ==========================================================================
  // PART 3: DATABASE MIGRATION INTEGRITY & SECURITY DEFINER SAFEGUARDS
  // ==========================================================================
  describe("3. Database Migration Integrity & Search Path Safeguards", () => {
    const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

    it("3.1 should contain required sequential migrations through prompt 25", () => {
      expect(migrationFiles.length).toBeGreaterThanOrEqual(15);
      const hasEssMigration = migrationFiles.some((f) =>
        f.includes("production_employee_manager_self_service_mobile")
      );
      const hasNotificationMigration = migrationFiles.some((f) =>
        f.includes("notifications_tasks_sla_audit_observability")
      );
      expect(hasEssMigration).toBe(true);
      expect(hasNotificationMigration).toBe(true);
    });

    it("3.2 all SECURITY DEFINER functions in Prompt 24 and 25 migrations must set search_path = public", () => {
      const targetMigrations = migrationFiles.filter(
        (f) =>
          f.includes("notifications_tasks_sla_audit_observability") ||
          f.includes("production_employee_manager_self_service_mobile")
      );

      for (const mFile of targetMigrations) {
        const sql = fs.readFileSync(path.join(migrationsDir, mFile), "utf-8");
        const secDefinerCount = (sql.match(/SECURITY\s+DEFINER/gi) || []).length;
        const searchPathCount = (sql.match(/SET\s+search_path\s*=\s*public/gi) || []).length;

        expect(
          searchPathCount,
          `File ${mFile} has ${secDefinerCount} SECURITY DEFINER functions but only ${searchPathCount} explicit search_path setters`
        ).toBeGreaterThanOrEqual(secDefinerCount);
      }
    });

    it("3.3 core production migrations must avoid destructive table drops", () => {
      const coreMigrations = migrationFiles.filter((f) => f >= "20260915");
      for (const mFile of coreMigrations) {
        const sql = fs.readFileSync(path.join(migrationsDir, mFile), "utf-8");
        // Ensure no unconditional DROP TABLE
        const dropMatches = sql.match(/DROP\s+TABLE\s+(?!IF\s+EXISTS)[a-zA-Z0-9_.]+/gi);
        expect(dropMatches, `Found destructive table drop in ${mFile}`).toBeNull();
      }
    });
  });

  // ==========================================================================
  // PART 4: FINANCIAL & SAUDI STATUTORY CALCULATIONS ACCURACY
  // ==========================================================================
  describe("4. Financial & Saudi Statutory Calculation Accuracy", () => {
    it("4.1 GOSI: Saudi National Contribution calculation conforms to statutory rules", () => {
      const result = calculateEmployeePayroll({
        basicSalary: 10000,
        housingAllowance: 2500,
        transportAllowance: 1000,
        calculationBasis: "fixed_30_days",
        daysInMonth: 30,
        isSaudiNational: true,
      });

      // Contributory amount = 10,000 + 2,500 = 12,500
      // Employee share (9% pension + 0.75% SANED) = 9.75% -> 12,500 * 0.0975 = 1218.75
      // Employer share (9% pension + 0.75% SANED + 2% Hazards) = 11.75% -> 12,500 * 0.1175 = 1468.75
      expect(result.gosiEmployee).toBe(1218.75);
      expect(result.gosiEmployer).toBe(1468.75);
    });

    it("4.2 GOSI: Expatriate Contribution calculation conforms to statutory rules", () => {
      const result = calculateEmployeePayroll({
        basicSalary: 8000,
        housingAllowance: 2000,
        transportAllowance: 800,
        calculationBasis: "fixed_30_days",
        daysInMonth: 30,
        isSaudiNational: false,
      });

      // Contributory amount = 8,000 + 2,000 = 10,000
      // Employee share = 0
      // Employer share = 2% occupational hazards -> 200
      expect(result.gosiEmployee).toBe(0);
      expect(result.gosiEmployer).toBe(200);
    });

    it("4.3 GOSI: Contributory wage is capped at 45,000 SAR statutory ceiling", () => {
      const result = calculateEmployeePayroll({
        basicSalary: 40000,
        housingAllowance: 15000, // total 55,000 > 45,000
        transportAllowance: 2000,
        calculationBasis: "fixed_30_days",
        daysInMonth: 30,
        isSaudiNational: true,
      });

      // Capped at 45,000 SAR
      // Employee share = 45,000 * 0.0975 = 4387.50
      // Employer share = 45,000 * 0.1175 = 5287.50
      expect(result.gosiEmployee).toBe(4387.5);
      expect(result.gosiEmployer).toBe(5287.5);
    });

    it("4.4 Overtime conforms to Saudi Labor Law Article 107 (hourly rate + 50% basic rate)", () => {
      const result = calculateEmployeePayroll({
        basicSalary: 12000,
        housingAllowance: 3000,
        transportAllowance: 1000, // total monthly = 16,000
        calculationBasis: "fixed_30_days",
        daysInMonth: 30,
        overtimeHours: 10,
      });

      // hourlyRate = 16,000 / 240 = 66.67
      // basicHourlyRate = 12,000 / 240 = 50.00
      // overtimeRate = 66.67 + (50.00 * 0.5) = 66.67 + 25.00 = 91.67
      // 10 hours * 91.67 = 916.7
      expect(result.overtimeAmount).toBe(916.7);
    });
  });
});
