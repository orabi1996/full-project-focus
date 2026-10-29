// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// OPERATIONAL END-TO-END INTEGRATION TEST SUITE (7 GCC/MENA COUNTRIES)
// src/tests/operational-e2e-integration-flow.test.ts
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  COUNTRY_PACK_CATALOG,
  COUNTRY_LEAVE_POLICIES,
  validateNationalIdFormat,
  validateIbanFormat,
  validateCountryLeaveEntitlement,
  validateCountryProbationPeriod,
  validateWeeklyWorkingHours,
  calculateEOSByCountry,
  simulateCountryEOS,
  getStatutoryOvertimeMultiplier,
  calculateEgyptSocialInsurance,
  calculateEgyptPayrollTax,
  calculateSaudiSocialInsurance,
  calculateQatarSocialInsurance,
  calculateOmanSocialInsurance,
  calculateBahrainSocialInsurance,
  calculateUaeSocialInsurance,
  calculateKuwaitSocialInsurance,
  generateCountryWpsPackage,
  roundByCountryCurrency,
  type CountryCode,
  type WpsEmployerMetadata,
  type WpsEmployeeRecordInput,
} from "../lib/domains/country-packs";
import {
  executeAutomatedMonthlyLeaveAccrual,
  executeAutomatedDailyAttendanceRollup,
  processQueuedBackgroundJobs,
} from "../lib/business/cron.functions";

const SAMPLE_EMPLOYER: WpsEmployerMetadata = {
  employerId: "ORG-ENTERPRISE-01",
  employerName: "MadarX Global Holding",
  establishmentNumber: "7009876543",
  payerIban: "SA0380000000608010167519",
  payerBankCode: "RJHI",
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  valueDate: "2026-06-28",
};

describe("MadarX Operational End-to-End Integration Flow", () => {
  describe("1. Multi-Country Statutory Employee Identity & Verification", () => {
    it("validates national statutory IDs and IBANs across all 7 supported jurisdictions", () => {
      const sampleEntities: Array<{
        country: CountryCode;
        validId: string;
        invalidId: string;
        validIban: string;
        invalidIban: string;
      }> = [
        {
          country: "EG",
          validId: "29501011234567",
          invalidId: "123456",
          validIban: "EG380019000500000000263180002",
          invalidIban: "EG123",
        },
        {
          country: "SA",
          validId: "1087654321",
          invalidId: "3087654321",
          validIban: "SA0380000000608010167519",
          invalidIban: "SA123",
        },
        {
          country: "QA",
          validId: "29563401234",
          invalidId: "1234",
          validIban: "QA58DOHB00001234567890ABCDEFG",
          invalidIban: "QA123",
        },
        {
          country: "OM",
          validId: "12345678",
          invalidId: "12",
          validIban: "OM120010000001234567890",
          invalidIban: "OM123",
        },
        {
          country: "BH",
          validId: "850123456",
          invalidId: "123",
          validIban: "BH67BMAG00001299123456",
          invalidIban: "BH123",
        },
        {
          country: "AE",
          validId: "784199012345671",
          invalidId: "123",
          validIban: "AE070331234567890123456",
          invalidIban: "AE123",
        },
        {
          country: "KW",
          validId: "295010112345",
          invalidId: "123",
          validIban: "KW81NBOK0000000000001234567890",
          invalidIban: "KW123",
        },
      ];

      for (const item of sampleEntities) {
        expect(validateNationalIdFormat(item.country, item.validId).valid).toBe(true);
        expect(validateNationalIdFormat(item.country, item.invalidId).valid).toBe(false);
        expect(validateIbanFormat(item.country, item.validIban).valid).toBe(true);
        expect(validateIbanFormat(item.country, item.invalidIban).valid).toBe(false);
      }
    });

    it("verifies statutory probation bounds according to national labor laws", () => {
      // Egypt: max 3 months (90 days)
      expect(validateCountryProbationPeriod("EG", 90).valid).toBe(true);
      expect(validateCountryProbationPeriod("EG", 120).valid).toBe(false);

      // Saudi Arabia: 90 days standard, extendable to 180 with written consent
      expect(validateCountryProbationPeriod("SA", 90, false).valid).toBe(true);
      expect(validateCountryProbationPeriod("SA", 150, false).valid).toBe(false);
      expect(validateCountryProbationPeriod("SA", 150, true).valid).toBe(true);
      expect(validateCountryProbationPeriod("SA", 200, true).valid).toBe(false);

      // Kuwait: max 100 working days
      expect(validateCountryProbationPeriod("KW", 100).valid).toBe(true);
      expect(validateCountryProbationPeriod("KW", 120).valid).toBe(false);

      // UAE: max 180 days (6 months)
      expect(validateCountryProbationPeriod("AE", 180).valid).toBe(true);
      expect(validateCountryProbationPeriod("AE", 200).valid).toBe(false);
    });
  });

  describe("2. Leave Entitlements & Automated Accrual Engine", () => {
    it("validates statutory annual leave policies per country", () => {
      // Saudi Arabia: 21 days for < 5 years, 30 days thereafter
      expect(validateCountryLeaveEntitlement("SA", 2, 21).valid).toBe(true);
      expect(validateCountryLeaveEntitlement("SA", 2, 15).valid).toBe(false);
      expect(validateCountryLeaveEntitlement("SA", 6, 30).valid).toBe(true);
      expect(validateCountryLeaveEntitlement("SA", 6, 21).valid).toBe(false);

      // Oman: 30 days statutory minimum from year 1
      expect(validateCountryLeaveEntitlement("OM", 1, 30).valid).toBe(true);
      expect(validateCountryLeaveEntitlement("OM", 1, 25).valid).toBe(false);

      // UAE: 30 days statutory minimum
      expect(validateCountryLeaveEntitlement("AE", 1, 30).valid).toBe(true);
      expect(validateCountryLeaveEntitlement("AE", 1, 20).valid).toBe(false);

      // Kuwait: 30 days statutory minimum
      expect(validateCountryLeaveEntitlement("KW", 1, 30).valid).toBe(true);
      expect(validateCountryLeaveEntitlement("KW", 1, 21).valid).toBe(false);
    });

    it("executes automated monthly leave accrual with idempotency and statutory caps", async () => {
      const companies = [{ id: "comp-1", name_ar: "شركة التقنية" }];
      const leaveTypes = [
        { id: "lt-annual", code: "annual", name_ar: "إجازة سنوية", annual_days: 30, accrual_method: "monthly_accrual" },
      ];
      const employees = [{ id: "emp-101", user_id: "usr-101", status: "active" }];
      const balance = {
        id: "bal-101",
        annual_entitlement: 30,
        accrued_days: 5.0,
        used_days: 1.0,
        reserved_days: 0.0,
        carried_over_days: 5.0,
      };

      const insertedRuns: any[] = [];
      const updatedBalances: any[] = [];

      const mockSupabase = {
        from: (table: string) => {
          if (table === "companies") {
            return {
              select: () => ({
                eq: () => Promise.resolve({ data: companies, error: null }),
                data: companies,
                error: null,
              }),
            };
          }
          if (table === "leave_types") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ data: leaveTypes, error: null }),
                }),
              }),
            };
          }
          if (table === "leave_accrual_runs") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      eq: () => ({
                        maybeSingle: () => Promise.resolve({ data: insertedRuns.length > 0 ? insertedRuns[0] : null }),
                      }),
                    }),
                  }),
                }),
              }),
              insert: (record: any) => {
                insertedRuns.push(record);
                return Promise.resolve({ error: null });
              },
            };
          }
          if (table === "employees") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => Promise.resolve({ data: employees, error: null }),
                }),
              }),
            };
          }
          if (table === "leave_balances") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: balance }),
                  }),
                }),
              }),
              update: (updates: any) => {
                updatedBalances.push(updates);
                return {
                  eq: () => Promise.resolve({ error: null }),
                };
              },
            };
          }
          if (table === "leave_balance_transactions" || table === "audit_events") {
            return {
              insert: () => Promise.resolve({ error: null }),
            };
          }
          return { select: () => ({}) };
        },
      };

      const results = await executeAutomatedMonthlyLeaveAccrual(mockSupabase, {
        companyId: "comp-1",
        year: 2026,
        month: 6,
      });

      expect(results).toHaveLength(1);
      expect(results[0].employeesProcessed).toBe(1);
      expect(results[0].totalDaysAccrued).toBe(2.5);
      expect(updatedBalances).toHaveLength(1);
      expect(updatedBalances[0].accrued_days).toBe(7.5); // 5 + 2.5

      // Re-run should skip due to idempotency
      const rerunResults = await executeAutomatedMonthlyLeaveAccrual(mockSupabase, {
        companyId: "comp-1",
        year: 2026,
        month: 6,
      });

      expect(rerunResults[0].alreadyProcessed).toBe(true);
      expect(rerunResults[0].employeesProcessed).toBe(1);
      expect(updatedBalances).toHaveLength(1); // No new balance updates performed
    });
  });

  describe("3. Attendance Recompute & Overtime Multipliers", () => {
    it("evaluates Ramadan and standard weekly working hour limitations", () => {
      // Saudi Arabia: 48h standard, 36h in Ramadan
      const standard = validateWeeklyWorkingHours("SA", 45, false);
      expect(standard.valid).toBe(true);
      expect(standard.excessOvertimeHours).toBe(0);

      const ramadan = validateWeeklyWorkingHours("SA", 45, true);
      expect(ramadan.valid).toBe(false);
      expect(ramadan.excessOvertimeHours).toBe(9); // 45 - 36
    });

    it("applies statutory overtime multipliers across jurisdictions", () => {
      expect(getStatutoryOvertimeMultiplier("SA", "weekday")).toBe(1.5);
      expect(getStatutoryOvertimeMultiplier("EG", "night")).toBe(1.7);
      expect(getStatutoryOvertimeMultiplier("EG", "public_holiday")).toBe(2.0);
      expect(getStatutoryOvertimeMultiplier("OM", "public_holiday")).toBe(2.0);
      expect(getStatutoryOvertimeMultiplier("AE", "weekday")).toBe(1.25);
      expect(getStatutoryOvertimeMultiplier("AE", "night")).toBe(1.5);
      expect(getStatutoryOvertimeMultiplier("KW", "public_holiday")).toBe(2.0);
    });
  });

  describe("4. End of Service Gratuity & Indemnity Lifecycle", () => {
    it("calculates exact EOS for all 7 countries for identical 4-year tenure and 10,000 monthly wage", () => {
      const startDate = "2022-01-01";
      const endDate = "2026-01-01";
      const wage = 10000;

      // Saudi Arabia: 4 years * (10000 * 0.5) = 20,000
      const saEOS = calculateEOSByCountry("SA", startDate, endDate, wage);
      expect(saEOS.finalEOSAmount).toBe(20000);

      // Egypt: 4 years * (10000 * 0.5) = 20,000
      const egEOS = calculateEOSByCountry("EG", startDate, endDate, wage);
      expect(egEOS.finalEOSAmount).toBe(20000);

      // Qatar: 4 years * (10000 * 21/30) = 28,000
      const qaEOS = calculateEOSByCountry("QA", startDate, endDate, wage);
      expect(qaEOS.finalEOSAmount).toBe(28000);

      // Oman: 4 years * 10000 = 40,000
      const omEOS = calculateEOSByCountry("OM", startDate, endDate, wage);
      expect(omEOS.finalEOSAmount).toBe(40000);

      // Bahrain: 3 years * 0.5 + 1 year * 1 = 2.5 months * 10000 = 25,000
      const bhEOS = calculateEOSByCountry("BH", startDate, endDate, wage);
      expect(bhEOS.finalEOSAmount).toBe(25000);

      // UAE: 4 years * (10000 * 21/30) = 28,000
      const aeEOS = calculateEOSByCountry("AE", startDate, endDate, wage);
      expect(aeEOS.finalEOSAmount).toBe(28000);

      // Kuwait: 4 years * (10000 * 15/30) = 20,000
      const kwEOS = calculateEOSByCountry("KW", startDate, endDate, wage);
      expect(kwEOS.finalEOSAmount).toBe(20000);
    });

    it("verifies resignation tiers in Saudi Arabia and Kuwait", () => {
      // Saudi Arabia resignation after 3 years (between 2 and 5 years): 1/3 (0.3333) of base EOS
      const saResign = calculateEOSByCountry("SA", "2023-01-01", "2026-01-01", 10000, "resignation");
      // Base: 3 * 5000 = 15000 * 0.3333 = 4999.5
      expect(saResign.resignationMultiplier).toBe(0.3333);
      expect(saResign.finalEOSAmount).toBe(4999.5);

      // Kuwait resignation after 4 years (between 3 and 5 years): 50% (0.5) of base EOS
      const kwResign = calculateEOSByCountry("KW", "2022-01-01", "2026-01-01", 1000, "resignation");
      // Base: 4 * 500 = 2000 * 0.5 = 1000
      expect(kwResign.resignationMultiplier).toBe(0.5);
      expect(kwResign.finalEOSAmount).toBe(1000);
    });

    it("produces simulation results with watermark and non-persistence indicator", () => {
      const sim = simulateCountryEOS("AE", "2020-01-01", "2026-01-01", 15000);
      expect(sim.simulationMode).toBe(true);
      expect(sim.watermark).toBe("ESTIMATE / SIMULATION");
      expect(sim.persistedToPayrollOrSettlement).toBe(false);
    });
  });

  describe("5. Multi-Country Social Insurance & WPS Payroll Packages", () => {
    it("generates and validates compliant WPS packages for all 7 countries", () => {
      const testCases: Array<{
        country: CountryCode;
        expectedAdapter: string;
        expectedFormat: string;
        expectedPrecision: number;
        empRecord: WpsEmployeeRecordInput;
      }> = [
        {
          country: "EG",
          expectedAdapter: "EG_CBE_PAYROLL",
          expectedFormat: "cbe_card",
          expectedPrecision: 2,
          empRecord: {
            employeeId: "emp-eg-1",
            employeeNo: "EG-101",
            employeeName: "محمود حسن",
            nationalOrResidentId: "29501011234567",
            iban: "EG380019000500000000263180002",
            bankCode: "NBEG",
            basicSalary: 12000,
            housingAllowance: 3000,
            otherAllowances: 1000,
            deductions: 1386,
            netSalary: 14614,
          },
        },
        {
          country: "SA",
          expectedAdapter: "SA_MUDAD_WPS",
          expectedFormat: "txt",
          expectedPrecision: 2,
          empRecord: {
            employeeId: "emp-sa-1",
            employeeNo: "SA-101",
            employeeName: "سلمان الدوسري",
            nationalOrResidentId: "1087654321",
            iban: "SA0380000000608010167519",
            bankCode: "RJHI",
            basicSalary: 15000,
            housingAllowance: 3750,
            otherAllowances: 1250,
            deductions: 1462.5,
            netSalary: 18537.5,
          },
        },
        {
          country: "QA",
          expectedAdapter: "QA_QCB_SIF",
          expectedFormat: "sif",
          expectedPrecision: 2,
          empRecord: {
            employeeId: "emp-qa-1",
            employeeNo: "QA-101",
            employeeName: "حمد الكعبي",
            nationalOrResidentId: "29563401234",
            iban: "QA58DOHB00001234567890ABCDEFG",
            bankCode: "QNBA",
            basicSalary: 18000,
            housingAllowance: 4500,
            otherAllowances: 1500,
            deductions: 1260,
            netSalary: 22740,
          },
        },
        {
          country: "OM",
          expectedAdapter: "OM_CBO_WPS",
          expectedFormat: "csv",
          expectedPrecision: 3,
          empRecord: {
            employeeId: "emp-om-1",
            employeeNo: "OM-101",
            employeeName: "طارق البوسعيدي",
            nationalOrResidentId: "12345678",
            iban: "OM120010000001234567890",
            bankCode: "BMUS",
            basicSalary: 1200.5,
            housingAllowance: 300.25,
            otherAllowances: 100.125,
            deductions: 96.04,
            netSalary: 1504.835,
          },
        },
        {
          country: "BH",
          expectedAdapter: "BH_LMRA_WPS",
          expectedFormat: "csv",
          expectedPrecision: 3,
          empRecord: {
            employeeId: "emp-bh-1",
            employeeNo: "BH-101",
            employeeName: "علي آل خليفة",
            nationalOrResidentId: "850123456",
            iban: "BH67BMAG00001299123456",
            bankCode: "NBOB",
            basicSalary: 1400.25,
            housingAllowance: 350.5,
            otherAllowances: 100.125,
            deductions: 112.02,
            netSalary: 1738.855,
          },
        },
        {
          country: "AE",
          expectedAdapter: "AE_CBUAE_WPS",
          expectedFormat: "sif",
          expectedPrecision: 2,
          empRecord: {
            employeeId: "emp-ae-1",
            employeeNo: "AE-101",
            employeeName: "سلطان الشامسي",
            nationalOrResidentId: "784199012345671",
            iban: "AE070331234567890123456",
            bankCode: "FABE",
            basicSalary: 22000,
            housingAllowance: 5500,
            otherAllowances: 2500,
            deductions: 2420,
            netSalary: 27580,
          },
        },
        {
          country: "KW",
          expectedAdapter: "KW_CBK_WPS",
          expectedFormat: "sif",
          expectedPrecision: 3,
          empRecord: {
            employeeId: "emp-kw-1",
            employeeNo: "KW-101",
            employeeName: "بدر العازمي",
            nationalOrResidentId: "295010112345",
            iban: "KW81NBOK0000000000001234567890",
            bankCode: "NBOK",
            basicSalary: 1500.5,
            housingAllowance: 375.25,
            otherAllowances: 125.125,
            deductions: 157.552,
            netSalary: 1843.323,
          },
        },
      ];

      for (const tc of testCases) {
        const pkg = generateCountryWpsPackage(tc.country, SAMPLE_EMPLOYER, [tc.empRecord]);
        expect(pkg.validationPassed).toBe(true);
        expect(pkg.blockedRecordCount).toBe(0);
        expect(pkg.adapterCode).toBe(tc.expectedAdapter);
        expect(pkg.fileFormat).toBe(tc.expectedFormat);
        expect(pkg.decimalPrecision).toBe(tc.expectedPrecision);
        expect(pkg.checksumHash).toHaveLength(16);
        expect(pkg.fileContent).toContain(tc.empRecord.employeeNo);
        expect(pkg.fileContent).toContain(tc.empRecord.nationalOrResidentId);
      }
    });

    it("blocks WPS generation when statutory ID or IBAN is invalid or net salary has math discrepancy", () => {
      const corruptRecord: WpsEmployeeRecordInput = {
        employeeId: "emp-bad-1",
        employeeNo: "BAD-01",
        employeeName: "مجهول",
        nationalOrResidentId: "999", // invalid
        iban: "SA00", // invalid
        bankCode: "TEST",
        basicSalary: 1000,
        housingAllowance: 200,
        otherAllowances: 100,
        deductions: 50,
        netSalary: 99999, // mismatch (expected 1250)
      };

      const result = generateCountryWpsPackage("SA", SAMPLE_EMPLOYER, [corruptRecord]);
      expect(result.validationPassed).toBe(false);
      expect(result.blockedRecordCount).toBe(1);
      expect(result.status).toBe("draft");
      expect(result.recordValidations[0].status).toBe("blocked");
      expect(result.recordValidations[0].messages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("6. Background Worker & Dead-Letter Job Escalation", () => {
    it("dequeues queued jobs and safely routes failed attempts to dead-letter storage", async () => {
      const queuedJobs = [
        {
          id: "job-1",
          company_id: "comp-1",
          job_type: "evaluate_task_slas",
          payload: {},
          priority: 1,
          attempts: 0,
          max_attempts: 3,
        },
        {
          id: "job-2",
          company_id: "comp-fail",
          job_type: "evaluate_task_slas",
          payload: {},
          priority: 2,
          attempts: 2, // will reach max_attempts 3 on failure -> dead letter
          max_attempts: 3,
        },
      ];

      const deadLetterInserts: any[] = [];
      const updatedJobStatuses: any[] = [];

      const mockSupabase = {
        from: (table: string) => {
          if (table === "background_jobs") {
            return {
              select: () => ({
                eq: () => ({
                  lte: () => ({
                    order: () => ({
                      order: () => ({
                        limit: () => ({
                          eq: () => Promise.resolve({ data: queuedJobs, error: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
              update: (updates: any) => {
                updatedJobStatuses.push(updates);
                return { eq: () => Promise.resolve({ error: null }) };
              },
            };
          }
          if (table === "dead_letter_jobs") {
            return {
              insert: (record: any) => {
                deadLetterInserts.push(record);
                return Promise.resolve({ error: null });
              },
            };
          }
          return {};
        },
        rpc: (_fnName: string, args: any) => {
          if (args?.p_company_id === "comp-fail") {
            throw new Error("Simulation failure in RPC");
          }
          return Promise.resolve({ data: { evaluated_count: 5 }, error: null });
        },
      };

      const result = await processQueuedBackgroundJobs(mockSupabase as any, {
        companyId: "comp-1",
        batchSize: 10,
      });

      expect(result.ok).toBe(true);
      expect(result.jobsProcessed).toBe(2);
      expect(result.completedCount).toBe(1);
      expect(result.failedCount).toBe(0); // Exhausted retries escalate directly to deadLetterCount
      expect(result.deadLetterCount).toBe(1);
      expect(deadLetterInserts).toHaveLength(1);
      expect(deadLetterInserts[0].job_id).toBe("job-2");
    });
  });
});
