// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION MULTI-COUNTRY STATUTORY & COMPLIANCE TEST SUITE
// src/tests/country-packs-statutory-compliance.test.ts
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  COUNTRY_PACK_CATALOG,
  validateNationalIdFormat,
  validateIbanFormat,
  calculateEOSByCountry,
  getStatutoryOvertimeMultiplier,
  calculateEgyptPayrollTax,
  calculateEgyptSocialInsurance,
  calculateSaudiSocialInsurance,
  calculateQatarSocialInsurance,
  calculateOmanSocialInsurance,
  calculateBahrainSocialInsurance,
  EGYPT_SOURCES,
  SAUDI_SOURCES,
  QATAR_SOURCES,
  OMAN_SOURCES,
  BAHRAIN_SOURCES,
} from "../lib/domains/country-packs";

describe("Prompt 34: Multi-Country Statutory Policy & Legal Source Registry", () => {
  it("registers all 5 target country packs with correct ISO codes and currencies", () => {
    const countries = Object.keys(COUNTRY_PACK_CATALOG);
    expect(countries).toHaveLength(5);
    expect(countries).toContain("EG");
    expect(countries).toContain("SA");
    expect(countries).toContain("QA");
    expect(countries).toContain("OM");
    expect(countries).toContain("BH");

    expect(COUNTRY_PACK_CATALOG.EG.currencyCode).toBe("EGP");
    expect(COUNTRY_PACK_CATALOG.SA.currencyCode).toBe("SAR");
    expect(COUNTRY_PACK_CATALOG.QA.currencyCode).toBe("QAR");
    expect(COUNTRY_PACK_CATALOG.OM.currencyCode).toBe("OMR");
    expect(COUNTRY_PACK_CATALOG.BH.currencyCode).toBe("BHD");
  });

  it("verifies authoritative legal sources for all 5 jurisdictions without orphan rules", () => {
    // Egypt
    expect(EGYPT_SOURCES.socialInsurance.sourceAuthority).toContain("NOSI");
    expect(EGYPT_SOURCES.incomeTax.sourceAuthority).toContain("ETA");
    expect(EGYPT_SOURCES.laborLaw.publicationRef).toContain("2003");

    // Saudi Arabia
    expect(SAUDI_SOURCES.socialInsurance.sourceAuthority).toContain("GOSI");
    expect(SAUDI_SOURCES.laborLaw.sourceAuthority).toContain("MHRSD");
    expect(SAUDI_SOURCES.wps.sourceAuthority).toContain("مدد");

    // Qatar
    expect(QATAR_SOURCES.socialInsurance.sourceAuthority).toContain("GRSIA");
    expect(QATAR_SOURCES.laborLaw.publicationRef).toContain("2004");
    expect(QATAR_SOURCES.wps.sourceAuthority).toContain("مصرف قطر المركزي");

    // Oman
    expect(OMAN_SOURCES.socialInsurance.sourceAuthority).toContain("الحماية الاجتماعية");
    expect(OMAN_SOURCES.laborLaw.publicationRef).toContain("53/2023");

    // Bahrain
    expect(BAHRAIN_SOURCES.socialInsurance.sourceAuthority).toContain("SIO");
    expect(BAHRAIN_SOURCES.laborLaw.sourceAuthority).toContain("LMRA");

    // Every rule has verification date
    for (const src of Object.values(EGYPT_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(SAUDI_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(QATAR_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(OMAN_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(BAHRAIN_SOURCES)) expect(src.verifiedAt).toBeTruthy();
  });
});

describe("Prompt 34: Social Insurance Calculation Engine", () => {
  it("calculates Egyptian social insurance with 2,000 floor and 12,600 cap plus Martyrs fund", () => {
    // Below floor (1,500 EGP) -> clamped to 2,000 EGP
    const low = calculateEgyptSocialInsurance(1500);
    expect(low.insurableWage).toBe(2000);
    expect(low.employeeContribution).toBe(220); // 11% of 2000
    expect(low.employerContribution).toBe(375); // 18.75% of 2000
    expect(low.martyrsFund).toBe(1); // 0.05% of 2000
    expect(low.emergencyFund).toBe(20); // 1% of 2000

    // Above ceiling (20,000 EGP) -> clamped to 12,600 EGP
    const high = calculateEgyptSocialInsurance(20000);
    expect(high.insurableWage).toBe(12600);
    expect(high.employeeContribution).toBe(1386); // 11% of 12600
    expect(high.employerContribution).toBe(2362.5); // 18.75% of 12600
    expect(high.martyrsFund).toBe(6.3); // 0.05% of 12600
    expect(high.totalEmployeeDeduction).toBe(1392.3);
  });

  it("calculates Saudi GOSI & SANED for Saudis and non-Saudis with 45,000 cap", () => {
    // Saudi national: 9.75% emp (9% + 0.75%), 11.75% emplyr (9% + 0.75% + 2%)
    const saudi = calculateSaudiSocialInsurance(10000, true);
    expect(saudi.insurableWage).toBe(10000);
    expect(saudi.employeeContribution).toBe(975);
    expect(saudi.employerContribution).toBe(1175);
    expect(saudi.pensionEmployee).toBe(900);
    expect(saudi.sanedEmployee).toBe(75);
    expect(saudi.hazardsEmployer).toBe(200);

    // Non-Saudi: 0% employee, 2% employer hazards
    const expat = calculateSaudiSocialInsurance(10000, false);
    expect(expat.employeeContribution).toBe(0);
    expect(expat.totalEmployeeDeduction).toBe(0);
    expect(expat.employerContribution).toBe(200);
    expect(expat.hazardsEmployer).toBe(200);

    // Saudi capped at 45,000 SAR
    const capped = calculateSaudiSocialInsurance(60000, true);
    expect(capped.insurableWage).toBe(45000);
    expect(capped.employeeContribution).toBe(4387.5);
    expect(capped.employerContribution).toBe(5287.5);
  });

  it("calculates Qatar GRSIA pension (7% national emp, 14% emplyr; 0% non-Qatari)", () => {
    const qatari = calculateQatarSocialInsurance(20000, true);
    expect(qatari.employeeContribution).toBe(1400); // 7%
    expect(qatari.employerContribution).toBe(2800); // 14%
    expect(qatari.totalEmployeeDeduction).toBe(1400);

    const nonQatari = calculateQatarSocialInsurance(20000, false);
    expect(nonQatari.employeeContribution).toBe(0);
    expect(nonQatari.employerContribution).toBe(0);
  });

  it("calculates Oman SPF (8% Omani emp, 14% emplyr; cap 3,000 OMR)", () => {
    const omani = calculateOmanSocialInsurance(1500, true);
    expect(omani.insurableWage).toBe(1500);
    expect(omani.employeeContribution).toBe(120); // 8%
    expect(omani.employerContribution).toBe(210); // 14%

    // Capped at 3,000 OMR
    const high = calculateOmanSocialInsurance(5000, true);
    expect(high.insurableWage).toBe(3000);
    expect(high.employeeContribution).toBe(240); // 8% of 3000
    expect(high.employerContribution).toBe(420); // 14% of 3000

    // Non-Omani (1% work injury employer)
    const expat = calculateOmanSocialInsurance(1000, false);
    expect(expat.employeeContribution).toBe(0);
    expect(expat.employerContribution).toBe(10); // 1%
  });

  it("calculates Bahrain SIO (8% Bahraini emp, 16% emplyr; cap 4,000 BHD; Non-Bahraini 1% / 3%)", () => {
    const bahraini = calculateBahrainSocialInsurance(2000, true);
    expect(bahraini.insurableWage).toBe(2000);
    expect(bahraini.employeeContribution).toBe(160); // 8%
    expect(bahraini.employerContribution).toBe(320); // 16%

    const nonBahraini = calculateBahrainSocialInsurance(2000, false);
    expect(nonBahraini.employeeContribution).toBe(20); // 1%
    expect(nonBahraini.employerContribution).toBe(60); // 3%
  });
});

describe("Prompt 34: Progressive Payroll Income Tax Engine (Egypt)", () => {
  it("exempts earners within the 20,000 annual personal exemption", () => {
    const low = calculateEgyptPayrollTax(1500); // 18,000 annual < 20,000 exemption
    expect(low.annualTax).toBe(0);
    expect(low.monthlyTax).toBe(0);
    expect(low.taxableNetAnnual).toBe(0);
  });

  it("calculates progressive brackets accurately for middle earner without float drift", () => {
    // 10,000 EGP/month -> 120,000 annual gross
    // Less 20,000 personal exemption = 100,000 net annual taxable
    // 0 to 40,000 @ 0% = 0
    // 40,000 to 55,000 (15,000) @ 10% = 1,500
    // 55,000 to 70,000 (15,000) @ 15% = 2,250
    // 70,000 to 100,000 (30,000) @ 20% = 6,000
    // Total annual tax = 9,750 EGP
    // Monthly tax = 9,750 / 12 = 812.50 EGP
    const res = calculateEgyptPayrollTax(10000);
    expect(res.taxableNetAnnual).toBe(100000);
    expect(res.annualTax).toBe(9750);
    expect(res.monthlyTax).toBe(812.5);
  });
});

describe("Prompt 34: Statutory End of Service (EOS) Across 5 Jurisdictions", () => {
  it("calculates Saudi EOS according to Articles 84 and 85 with resignation scaling", () => {
    // Termination by employer after 6 years: (5 * 0.5 * 10000) + (1 * 10000) = 25000 + 10000 = 35000
    const term = calculateEOSByCountry("SA", "2018-01-01", "2024-01-01", 10000, "termination_by_employer");
    expect(term.serviceYearsDecimal).toBeCloseTo(6.0, 1);
    expect(term.finalEOSAmount).toBe(35000);

    // Resignation after 3 years (between 2 and 5 years -> 1/3 entitlement)
    // Base: 3 * 5000 = 15000; Multiplier: 0.3333 -> 4999.5
    const resign = calculateEOSByCountry("SA", "2021-01-01", "2024-01-01", 10000, "resignation");
    expect(resign.resignationMultiplier).toBe(0.3333);
    expect(resign.finalEOSAmount).toBe(4999.5);
  });

  it("calculates Qatar EOS (min 3 weeks salary per year under Article 54)", () => {
    // 4 years service @ 10,000 basic -> 4 * (10000 * 21/30) = 4 * 7000 = 28000
    const qa = calculateEOSByCountry("QA", "2020-01-01", "2024-01-01", 10000);
    expect(qa.finalEOSAmount).toBe(28000);
  });

  it("calculates Oman EOS (1 full month basic salary per year under RD 53/2023)", () => {
    // 5 years service @ 1,000 OMR -> 5 * 1000 = 5000 OMR
    const om = calculateEOSByCountry("OM", "2019-01-01", "2024-01-01", 1000);
    expect(om.finalEOSAmount).toBe(5000);
  });

  it("calculates Bahrain EOS (0.5 month first 3 yrs, 1 month thereafter under Article 116)", () => {
    // 5 years service @ 1,000 BHD: (3 * 500) + (2 * 1000) = 1500 + 2000 = 3500 BHD
    const bh = calculateEOSByCountry("BH", "2019-01-01", "2024-01-01", 1000);
    expect(bh.finalEOSAmount).toBe(3500);
  });
});

describe("Prompt 34: Statutory Identifiers & IBAN Validation", () => {
  it("validates national ID formats per country standards", () => {
    expect(validateNationalIdFormat("EG", "29501011234567").valid).toBe(true); // 14 digits
    expect(validateNationalIdFormat("EG", "12345").valid).toBe(false);

    expect(validateNationalIdFormat("SA", "1087654321").valid).toBe(true); // 10 digits starting with 1
    expect(validateNationalIdFormat("SA", "2087654321").valid).toBe(true); // 10 digits starting with 2
    expect(validateNationalIdFormat("SA", "5087654321").valid).toBe(false);

    expect(validateNationalIdFormat("QA", "29563401234").valid).toBe(true); // 11 digits
    expect(validateNationalIdFormat("QA", "12345").valid).toBe(false);

    expect(validateNationalIdFormat("BH", "850123456").valid).toBe(true); // 9 digits
    expect(validateNationalIdFormat("BH", "1234").valid).toBe(false);

    expect(validateNationalIdFormat("OM", "12345678").valid).toBe(true); // 7-10 digits
  });

  it("validates country-specific IBAN prefixes and length requirements", () => {
    // Saudi: SA + 22 chars = 24 total
    expect(validateIbanFormat("SA", "SA0380000000608010167519").valid).toBe(true);
    expect(validateIbanFormat("SA", "EG0380000000608010167519").valid).toBe(false);

    // Egypt: EG + 27 chars = 29 total
    expect(validateIbanFormat("EG", "EG120002000100000000012345678").valid).toBe(true);
    expect(validateIbanFormat("EG", "SA120002000100000000012345678").valid).toBe(false);
  });
});

describe("Prompt 34: In-Memory PostgreSQL Migration & Stored Procedure Verification", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();

    // 1. Core prerequisites (auth, companies, employees, payroll_runs, payroll_details)
    await pg.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT);

      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        legal_name_ar TEXT NOT NULL,
        code TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        employee_number TEXT,
        first_name_ar TEXT,
        last_name_ar TEXT,
        national_id TEXT,
        iban TEXT,
        bank_name TEXT,
        basic_salary NUMERIC DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS payroll_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        period_start DATE,
        period_end DATE,
        currency VARCHAR(3) DEFAULT 'SAR',
        status TEXT DEFAULT 'draft'
      );

      CREATE TABLE IF NOT EXISTS payroll_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payroll_run_id UUID,
        employee_id UUID,
        basic_salary NUMERIC DEFAULT 0,
        housing_allowance NUMERIC DEFAULT 0,
        transport_allowance NUMERIC DEFAULT 0,
        other_allowances NUMERIC DEFAULT 0,
        total_deductions NUMERIC DEFAULT 0,
        net_salary NUMERIC DEFAULT 0
      );
    `);

    // 2. Read and apply Prompt 34 migration SQL
    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20261016000000_production_multi_country_statutory_country_packs.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");
    await pg.exec(sql);
  });

  it("verifies 5 seeded country packs and verified legal sources in database", async () => {
    const packsRes = await pg.query<{ count: string }>("SELECT COUNT(*) as count FROM country_packs;");
    expect(Number(packsRes.rows[0].count)).toBe(5);

    const sourcesRes = await pg.query<{ count: string }>("SELECT COUNT(*) as count FROM statutory_rule_sources;");
    expect(Number(sourcesRes.rows[0].count)).toBeGreaterThanOrEqual(10);
  });

  it("executes calculate_statutory_social_insurance_atomic via PostgreSQL stored procedure", async () => {
    // Saudi national GOSI in DB: 9.75% emp, 11.75% emplyr on 10,000 wage
    const res = await pg.query<{ result: any }>(
      "SELECT calculate_statutory_social_insurance_atomic('SA', true, 10000, 10000) as result;"
    );
    const result = res.rows[0].result;
    expect(result.ok).toBe(true);
    expect(result.country_code).toBe("SA");
    expect(Number(result.employee_contribution)).toBe(975.0);
    expect(Number(result.employer_contribution)).toBe(1175.0);
  });

  it("executes calculate_statutory_income_tax_atomic via PostgreSQL stored procedure", async () => {
    // Egypt: 10,000 EGP/mo -> 100,000 net annual taxable -> 812.50 monthly tax
    const res = await pg.query<{ result: any }>(
      "SELECT calculate_statutory_income_tax_atomic('EG', 10000) as result;"
    );
    const result = res.rows[0].result;
    expect(result.ok).toBe(true);
    expect(result.country_code).toBe("EG");
    expect(Number(result.annual_tax)).toBe(9750.0);
    expect(Number(result.monthly_tax)).toBe(812.5);
  });

  it("executes calculate_statutory_eos_atomic via PostgreSQL stored procedure", async () => {
    // Saudi EOS: 6 years service, 10000 wage -> 35,000 SAR
    const res = await pg.query<{ result: any }>(
      "SELECT calculate_statutory_eos_atomic('SA', '2018-01-01', '2024-01-01', 0, 10000, 'termination_by_employer') as result;"
    );
    const result = res.rows[0].result;
    expect(result.ok).toBe(true);
    expect(Number(result.final_eos_amount)).toBe(35000.0);
  });

  it("executes get_country_pack_dashboard_kpis_atomic via PostgreSQL stored procedure", async () => {
    const companyRes = await pg.query<{ id: string }>(
      "INSERT INTO companies (legal_name_ar, code) VALUES ('شركة التجربة', 'TEST') RETURNING id;"
    );
    const companyId = companyRes.rows[0].id;

    const res = await pg.query<{ result: any }>(
      `SELECT get_country_pack_dashboard_kpis_atomic('${companyId}') as result;`
    );
    const kpis = res.rows[0].result;
    expect(kpis.active_country_packs).toBe(5);
    expect(kpis.active_rule_sets).toBe(5);
    expect(kpis.current_year_public_holidays).toBeGreaterThanOrEqual(15);
  });
});
