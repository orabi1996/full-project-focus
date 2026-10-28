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
  COUNTRY_LEAVE_POLICIES,
  COUNTRY_PACK_PERMISSIONS,
  VERSIONED_STATUTORY_RULE_REGISTRY,
  resolveStatutoryRuleSet,
  roundByCountryCurrency,
  validateNationalIdFormat,
  validateIbanFormat,
  validateCountryLeaveEntitlement,
  validateCountryProbationPeriod,
  validateWeeklyWorkingHours,
  calculateEOSByCountry,
  simulateCountryEOS,
  getStatutoryOvertimeMultiplier,
  calculateEgyptPayrollTax,
  calculateEgyptSocialInsurance,
  calculateSaudiSocialInsurance,
  calculateQatarSocialInsurance,
  calculateOmanSocialInsurance,
  calculateBahrainSocialInsurance,
  generateCountryWpsPackage,
  regenerateCountryWpsPackage,
  createImmutablePayrollStatutorySnapshot,
  validateFourEyesRuleActivation,
  simulateRuleVersionImpact,
  createRetroactiveStatutoryAdjustmentProposal,
  transferEmployeeBetweenCountries,
  resolveEmployeeCountryPackForPeriod,
  maskStatutoryIdentifier,
  sanitizeStatutoryLogPayload,
  EGYPT_SOURCES,
  SAUDI_SOURCES,
  QATAR_SOURCES,
  OMAN_SOURCES,
  BAHRAIN_SOURCES,
  UAE_SOURCES,
  KUWAIT_SOURCES,
  calculateUaeSocialInsurance,
  calculateKuwaitSocialInsurance,
  type EmployeeLocalizationSlice,
  type WpsEmployerMetadata,
  type WpsEmployeeRecordInput,
} from "../lib/domains/country-packs";
import { METRIC_CATALOG, REPORT_CATALOG } from "../lib/data/reports-repository";

const SAMPLE_EMPLOYER: WpsEmployerMetadata = {
  employerId: "EMP-ORG-001",
  employerName: "MadarX Regional Enterprise",
  establishmentNumber: "7001234567",
  payerIban: "SA0380000000608010167519",
  payerBankCode: "RJHI",
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  valueDate: "2026-06-28",
};

describe("Prompt 34: Multi-Country Statutory Policy & Legal Source Registry", () => {
  it("registers all 7 target country packs with correct ISO codes, currencies, and decimal precision", () => {
    const countries = Object.keys(COUNTRY_PACK_CATALOG);
    expect(countries).toHaveLength(7);
    expect(countries).toEqual(["EG", "SA", "QA", "OM", "BH", "AE", "KW"]);

    expect(COUNTRY_PACK_CATALOG.EG.currencyCode).toBe("EGP");
    expect(COUNTRY_PACK_CATALOG.EG.decimalPrecision).toBe(2);

    expect(COUNTRY_PACK_CATALOG.SA.currencyCode).toBe("SAR");
    expect(COUNTRY_PACK_CATALOG.SA.decimalPrecision).toBe(2);

    expect(COUNTRY_PACK_CATALOG.QA.currencyCode).toBe("QAR");
    expect(COUNTRY_PACK_CATALOG.QA.decimalPrecision).toBe(2);

    expect(COUNTRY_PACK_CATALOG.OM.currencyCode).toBe("OMR");
    expect(COUNTRY_PACK_CATALOG.OM.decimalPrecision).toBe(3);

    expect(COUNTRY_PACK_CATALOG.BH.currencyCode).toBe("BHD");
    expect(COUNTRY_PACK_CATALOG.BH.decimalPrecision).toBe(3);

    expect(COUNTRY_PACK_CATALOG.AE.currencyCode).toBe("AED");
    expect(COUNTRY_PACK_CATALOG.AE.decimalPrecision).toBe(2);

    expect(COUNTRY_PACK_CATALOG.KW.currencyCode).toBe("KWD");
    expect(COUNTRY_PACK_CATALOG.KW.decimalPrecision).toBe(3);

    // Verify currency rounding helper
    expect(roundByCountryCurrency("EG", 123.456)).toBe(123.46);
    expect(roundByCountryCurrency("OM", 123.4567)).toBe(123.457);
    expect(roundByCountryCurrency("BH", 99.1234)).toBe(99.123);
    expect(roundByCountryCurrency("AE", 123.456)).toBe(123.46);
    expect(roundByCountryCurrency("KW", 99.1234)).toBe(99.123);
  });

  it("verifies authoritative legal sources for all 7 jurisdictions without orphan rules", () => {
    expect(EGYPT_SOURCES.socialInsurance.sourceAuthority).toContain("NOSI");
    expect(EGYPT_SOURCES.incomeTax.sourceAuthority).toContain("ETA");
    expect(EGYPT_SOURCES.laborLaw.publicationRef).toContain("2003");

    expect(SAUDI_SOURCES.socialInsurance.sourceAuthority).toContain("GOSI");
    expect(SAUDI_SOURCES.laborLaw.sourceAuthority).toContain("MHRSD");
    expect(SAUDI_SOURCES.wps.sourceAuthority).toContain("مدد");

    expect(QATAR_SOURCES.socialInsurance.sourceAuthority).toContain("GRSIA");
    expect(QATAR_SOURCES.laborLaw.publicationRef).toContain("2004");
    expect(QATAR_SOURCES.wps.sourceAuthority).toContain("مصرف قطر المركزي");

    expect(OMAN_SOURCES.socialInsurance.sourceAuthority).toContain("الحماية الاجتماعية");
    expect(OMAN_SOURCES.laborLaw.publicationRef).toContain("53/2023");

    expect(BAHRAIN_SOURCES.socialInsurance.sourceAuthority).toContain("SIO");
    expect(BAHRAIN_SOURCES.laborLaw.sourceAuthority).toContain("LMRA");

    expect(UAE_SOURCES.socialInsurance.sourceAuthority).toContain("GPSSA");
    expect(UAE_SOURCES.laborLaw.sourceAuthority).toContain("MOHRE");
    expect(UAE_SOURCES.wps.sourceAuthority).toContain("CBUAE");

    expect(KUWAIT_SOURCES.socialInsurance.sourceAuthority).toContain("PIFSS");
    expect(KUWAIT_SOURCES.laborLaw.sourceAuthority).toContain("PAM");
    expect(KUWAIT_SOURCES.wps.sourceAuthority).toContain("CBK");

    for (const src of Object.values(EGYPT_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(SAUDI_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(QATAR_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(OMAN_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(BAHRAIN_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(UAE_SOURCES)) expect(src.verifiedAt).toBeTruthy();
    for (const src of Object.values(KUWAIT_SOURCES)) expect(src.verifiedAt).toBeTruthy();
  });
});

describe("Prompt 34 (Sections 87–91): 5-Country Social Insurance, Tax, EOS, Overtime, Leave & WPS", () => {
  it("Section 87 — Egypt: National ID, progressive tax bracket slices, NOSI floor/ceiling, overtime, leave, EOS & CBE payroll export", () => {
    // 1. National ID
    expect(validateNationalIdFormat("EG", "29501011234567").valid).toBe(true);
    expect(validateNationalIdFormat("EG", "12345").valid).toBe(false);

    // 2. Social insurance floor (2,000 EGP) & ceiling (12,600 EGP)
    const low = calculateEgyptSocialInsurance(1500);
    expect(low.insurableWage).toBe(2000);
    expect(low.employeeContribution).toBe(220);
    expect(low.employerContribution).toBe(375);
    expect(low.martyrsFund).toBe(1);
    expect(low.emergencyFund).toBe(20);

    const high = calculateEgyptSocialInsurance(20000);
    expect(high.insurableWage).toBe(12600);
    expect(high.employeeContribution).toBe(1386);
    expect(high.employerContribution).toBe(2362.5);
    expect(high.martyrsFund).toBe(6.3);
    expect(high.totalEmployeeDeduction).toBe(1392.3);

    // 3. Progressive tax with bracket slice breakdown
    const taxExempt = calculateEgyptPayrollTax(1500);
    expect(taxExempt.annualTax).toBe(0);
    expect(taxExempt.monthlyTax).toBe(0);
    expect(taxExempt.bracketBreakdown).toHaveLength(0);

    const taxMid = calculateEgyptPayrollTax(10000);
    expect(taxMid.taxableNetAnnual).toBe(100000);
    expect(taxMid.annualTax).toBe(9750);
    expect(taxMid.monthlyTax).toBe(812.5);
    expect(taxMid.bracketBreakdown).toHaveLength(4);
    expect(taxMid.bracketBreakdown[0].annualSliceTax).toBe(0);
    expect(taxMid.bracketBreakdown[1].annualSliceTax).toBe(1500);
    expect(taxMid.bracketBreakdown[2].annualSliceTax).toBe(2250);
    expect(taxMid.bracketBreakdown[3].annualSliceTax).toBe(6000);

    // 4. Overtime multipliers (1.35x day, 1.7x night, 2.0x holiday)
    expect(getStatutoryOvertimeMultiplier("EG", "weekday")).toBe(1.35);
    expect(getStatutoryOvertimeMultiplier("EG", "night")).toBe(1.7);
    expect(getStatutoryOvertimeMultiplier("EG", "public_holiday")).toBe(2.0);

    // 5. Leave minimums (21 days standard, 30 days >= 10 yrs)
    expect(validateCountryLeaveEntitlement("EG", 3, 21).valid).toBe(true);
    expect(validateCountryLeaveEntitlement("EG", 3, 15).valid).toBe(false);
    expect(validateCountryLeaveEntitlement("EG", 12, 21).valid).toBe(false);
    expect(validateCountryLeaveEntitlement("EG", 12, 30).valid).toBe(true);

    // 6. Egypt EOS
    const egEos = calculateEOSByCountry("EG", "2018-01-01", "2024-01-01", 10000);
    expect(egEos.finalEOSAmount).toBe(35000);
    expect(egEos.calculationTrace.countryCode).toBe("EG");

    // 7. Egypt Bank/CBE Payroll Export
    const egWps = generateCountryWpsPackage("EG", SAMPLE_EMPLOYER, [
      {
        employeeId: "emp-eg-1",
        employeeNo: "EG-001",
        employeeName: "أحمد محمود",
        nationalOrResidentId: "29501011234567",
        iban: "EG120002000100000000012345678",
        bankCode: "NBEG",
        basicSalary: 10000,
        housingAllowance: 2000,
        otherAllowances: 1000,
        deductions: 1500,
        netSalary: 11500,
      },
    ]);
    expect(egWps.validationPassed).toBe(true);
    expect(egWps.adapterCode).toBe("EG_CBE_PAYROLL");
    expect(egWps.currencyCode).toBe("EGP");
  });

  it("Section 88 — Saudi Arabia: National ID vs Iqama, GOSI + SANED + hazards, 45k cap, EOS Articles 84/85, Ramadan & Mudad WPS", () => {
    expect(validateNationalIdFormat("SA", "1087654321").valid).toBe(true);
    expect(validateNationalIdFormat("SA", "2087654321").valid).toBe(true);
    expect(validateNationalIdFormat("SA", "5087654321").valid).toBe(false);

    const saudi = calculateSaudiSocialInsurance(10000, true);
    expect(saudi.employeeContribution).toBe(975);
    expect(saudi.employerContribution).toBe(1175);

    const expat = calculateSaudiSocialInsurance(10000, false);
    expect(expat.employeeContribution).toBe(0);
    expect(expat.employerContribution).toBe(200);

    const capped = calculateSaudiSocialInsurance(60000, true);
    expect(capped.insurableWage).toBe(45000);
    expect(capped.employeeContribution).toBe(4387.5);
    expect(capped.employerContribution).toBe(5287.5);

    // EOS termination vs resignation scaling (<2 yrs = 0, 2-5 yrs = 1/3, 5-10 yrs = 2/3, 10+ = full)
    const term = calculateEOSByCountry("SA", "2018-01-01", "2024-01-01", 10000, "termination_by_employer");
    expect(term.finalEOSAmount).toBe(35000);

    const resignShort = calculateEOSByCountry("SA", "2023-01-01", "2024-01-01", 10000, "resignation");
    expect(resignShort.finalEOSAmount).toBe(0);

    const resignMid = calculateEOSByCountry("SA", "2021-01-01", "2024-01-01", 10000, "resignation");
    expect(resignMid.resignationMultiplier).toBe(0.3333);
    expect(resignMid.finalEOSAmount).toBe(4999.5);

    // Working hours & Ramadan (48h standard, 36h Ramadan) + Probation (90 days / 180 extended)
    expect(validateWeeklyWorkingHours("SA", 48, false).valid).toBe(true);
    expect(validateWeeklyWorkingHours("SA", 42, true).excessOvertimeHours).toBe(6);
    expect(validateCountryProbationPeriod("SA", 90, false).valid).toBe(true);
    expect(validateCountryProbationPeriod("SA", 120, false).valid).toBe(false);
    expect(validateCountryProbationPeriod("SA", 180, true).valid).toBe(true);

    // Saudi Mudad WPS package
    const saWps = generateCountryWpsPackage("SA", SAMPLE_EMPLOYER, [
      {
        employeeId: "emp-sa-1",
        employeeNo: "SA-001",
        employeeName: "سعد القحطاني",
        nationalOrResidentId: "1087654321",
        iban: "SA0380000000608010167519",
        bankCode: "RJHI",
        basicSalary: 12000,
        housingAllowance: 3000,
        otherAllowances: 1000,
        deductions: 1170,
        netSalary: 14830,
      },
    ]);
    expect(saWps.validationPassed).toBe(true);
    expect(saWps.adapterCode).toBe("SA_MUDAD_WPS");
  });

  it("Section 89 — Qatar: 11-digit QID, GRSIA pension (7%/14% national, 0% expat), Article 54 EOS, SIF WPS", () => {
    expect(validateNationalIdFormat("QA", "29563401234").valid).toBe(true);
    expect(validateNationalIdFormat("QA", "12345").valid).toBe(false);

    const qatari = calculateQatarSocialInsurance(20000, true);
    expect(qatari.employeeContribution).toBe(1400);
    expect(qatari.employerContribution).toBe(2800);

    const nonQatari = calculateQatarSocialInsurance(20000, false);
    expect(nonQatari.employeeContribution).toBe(0);
    expect(nonQatari.employerContribution).toBe(0);

    const qaEos = calculateEOSByCountry("QA", "2020-01-01", "2024-01-01", 10000);
    expect(qaEos.finalEOSAmount).toBe(28000);

    const qaWps = generateCountryWpsPackage("QA", SAMPLE_EMPLOYER, [
      {
        employeeId: "emp-qa-1",
        employeeNo: "QA-001",
        employeeName: "جاسم الكواري",
        nationalOrResidentId: "29563401234",
        iban: "QA58DOHB00001234567890ABCDEFG",
        bankCode: "QNBA",
        basicSalary: 15000,
        housingAllowance: 4000,
        otherAllowances: 1000,
        deductions: 1050,
        netSalary: 18950,
      },
    ]);
    expect(qaWps.validationPassed).toBe(true);
    expect(qaWps.adapterCode).toBe("QA_QCB_SIF");
    expect(qaWps.fileFormat).toBe("sif");
  });

  it("Section 90 — Oman: Civil Number, SPF (8%/14% Omani, 1% expat, 3,000 OMR cap), RD 53/2023 EOS, 3-decimal OMR WPS", () => {
    expect(validateNationalIdFormat("OM", "12345678").valid).toBe(true);

    const omani = calculateOmanSocialInsurance(1500, true);
    expect(omani.employeeContribution).toBe(120);
    expect(omani.employerContribution).toBe(210);

    const capped = calculateOmanSocialInsurance(5000, true);
    expect(capped.insurableWage).toBe(3000);
    expect(capped.employeeContribution).toBe(240);
    expect(capped.employerContribution).toBe(420);

    const expat = calculateOmanSocialInsurance(1000, false);
    expect(expat.employeeContribution).toBe(0);
    expect(expat.employerContribution).toBe(10);

    const omEos = calculateEOSByCountry("OM", "2019-01-01", "2024-01-01", 1000.125);
    expect(omEos.decimalPrecision).toBe(3);
    expect(omEos.finalEOSAmount).toBe(5000.625);

    const omWps = generateCountryWpsPackage("OM", SAMPLE_EMPLOYER, [
      {
        employeeId: "emp-om-1",
        employeeNo: "OM-001",
        employeeName: "سالم الحارثي",
        nationalOrResidentId: "12345678",
        iban: "OM120010000001234567890",
        bankCode: "BMUS",
        basicSalary: 1000.5,
        housingAllowance: 250.25,
        otherAllowances: 50.125,
        deductions: 80.0,
        netSalary: 1220.875,
      },
    ]);
    expect(omWps.validationPassed).toBe(true);
    expect(omWps.decimalPrecision).toBe(3);
    expect(omWps.fileContent).toContain("1220.875");
  });

  it("Section 91 — Bahrain: 9-digit CPR, SIO (8%/16% Bahraini, 1%/3% expat, 4,000 BHD cap), Article 116 EOS, 3-decimal BHD WPS", () => {
    expect(validateNationalIdFormat("BH", "850123456").valid).toBe(true);
    expect(validateNationalIdFormat("BH", "1234").valid).toBe(false);

    const bahraini = calculateBahrainSocialInsurance(2000, true);
    expect(bahraini.employeeContribution).toBe(160);
    expect(bahraini.employerContribution).toBe(320);

    const expat = calculateBahrainSocialInsurance(2000, false);
    expect(expat.employeeContribution).toBe(20);
    expect(expat.employerContribution).toBe(60);

    const bhEos = calculateEOSByCountry("BH", "2019-01-01", "2024-01-01", 1000);
    expect(bhEos.finalEOSAmount).toBe(3500);
    expect(bhEos.decimalPrecision).toBe(3);

    const bhWps = generateCountryWpsPackage("BH", SAMPLE_EMPLOYER, [
      {
        employeeId: "emp-bh-1",
        employeeNo: "BH-001",
        employeeName: "راشد آل خليفة",
        nationalOrResidentId: "850123456",
        iban: "BH67BMAG00001299123456",
        bankCode: "NBOB",
        basicSalary: 1500.25,
        housingAllowance: 300.5,
        otherAllowances: 100.125,
        deductions: 120.0,
        netSalary: 1780.875,
      },
    ]);
    expect(bhWps.validationPassed).toBe(true);
    expect(bhWps.adapterCode).toBe("BH_LMRA_WPS");
    expect(bhWps.decimalPrecision).toBe(3);
  });

  it("Section 91.1 — UAE: 15-digit EID, GPSSA pension (11%/15% Emirati, 0% expat, 70k AED cap), Decree-Law 33/2021 EOS, CBUAE WPS SIF", () => {
    // 1. National ID (Emirates ID)
    expect(validateNationalIdFormat("AE", "784199012345671").valid).toBe(true);
    expect(validateNationalIdFormat("AE", "12345").valid).toBe(false);

    // 2. IBAN
    expect(validateIbanFormat("AE", "AE070331234567890123456").valid).toBe(true);
    expect(validateIbanFormat("AE", "AE07").valid).toBe(false);

    // 3. GPSSA Social Insurance
    const emirati = calculateUaeSocialInsurance(20000, true);
    expect(emirati.employeeContribution).toBe(2200); // 11%
    expect(emirati.employerContribution).toBe(3000); // 15%

    const capped = calculateUaeSocialInsurance(80000, true);
    expect(capped.insurableWage).toBe(70000);
    expect(capped.employeeContribution).toBe(7700);
    expect(capped.employerContribution).toBe(10500);

    const expat = calculateUaeSocialInsurance(25000, false);
    expect(expat.employeeContribution).toBe(0);
    expect(expat.employerContribution).toBe(0);

    // 4. EOS (Article 51 Decree-Law 33/2021)
    const uaeEos = calculateEOSByCountry("AE", "2020-01-01", "2024-01-01", 10000);
    // 4 years * 10000 * (21/30) = 28000
    expect(uaeEos.finalEOSAmount).toBe(28000);
    expect(uaeEos.decimalPrecision).toBe(2);

    // 5. CBUAE WPS SIF
    const uaeWps = generateCountryWpsPackage("AE", SAMPLE_EMPLOYER, [
      {
        employeeId: "emp-ae-1",
        employeeNo: "AE-001",
        employeeName: "منصور المزروعي",
        nationalOrResidentId: "784199012345671",
        iban: "AE070331234567890123456",
        bankCode: "ENBD",
        basicSalary: 20000,
        housingAllowance: 5000,
        otherAllowances: 2000,
        deductions: 2200,
        netSalary: 24800,
      },
    ]);
    expect(uaeWps.validationPassed).toBe(true);
    expect(uaeWps.adapterCode).toBe("AE_CBUAE_WPS");
    expect(uaeWps.fileFormat).toBe("sif");
  });

  it("Section 91.2 — Kuwait: 12-digit Civil ID, PIFSS pension (10.5%/11.5% Kuwaiti, 2,750 KWD cap), Law 6/2010 EOS, 3-decimal KWD WPS SIF", () => {
    // 1. Civil ID
    expect(validateNationalIdFormat("KW", "295010112345").valid).toBe(true);
    expect(validateNationalIdFormat("KW", "123").valid).toBe(false);

    // 2. IBAN (30 chars)
    expect(validateIbanFormat("KW", "KW81NBOK0000000000001234567890").valid).toBe(true);
    expect(validateIbanFormat("KW", "KW81").valid).toBe(false);

    // 3. PIFSS Social Insurance
    const kuwaiti = calculateKuwaitSocialInsurance(1500, true);
    expect(kuwaiti.employeeContribution).toBe(157.5); // 10.5%
    expect(kuwaiti.employerContribution).toBe(172.5); // 11.5%

    const capped = calculateKuwaitSocialInsurance(3500, true);
    expect(capped.insurableWage).toBe(2750);
    expect(capped.employeeContribution).toBe(288.75); // 2750 * 0.105
    expect(capped.employerContribution).toBe(316.25); // 2750 * 0.115

    const expat = calculateKuwaitSocialInsurance(2000, false);
    expect(expat.employeeContribution).toBe(0);
    expect(expat.employerContribution).toBe(0);

    // 4. EOS (Articles 51 & 53 Law 6/2010)
    const kwEos = calculateEOSByCountry("KW", "2020-01-01", "2024-01-01", 1000);
    // 4 years * 1000 * (15/30) = 2000
    expect(kwEos.finalEOSAmount).toBe(2000);
    expect(kwEos.decimalPrecision).toBe(3);

    // Resignation after 4 years: 50%
    const kwEosResign = calculateEOSByCountry("KW", "2020-01-01", "2024-01-01", 1000, "resignation");
    expect(kwEosResign.finalEOSAmount).toBe(1000);

    // 5. CBK WPS SIF
    const kwWps = generateCountryWpsPackage("KW", SAMPLE_EMPLOYER, [
      {
        employeeId: "emp-kw-1",
        employeeNo: "KW-001",
        employeeName: "عبدالله الصباح",
        nationalOrResidentId: "295010112345",
        iban: "KW81NBOK0000000000001234567890",
        bankCode: "NBOK",
        basicSalary: 1200.5,
        housingAllowance: 300.25,
        otherAllowances: 100.125,
        deductions: 126.052,
        netSalary: 1474.823,
      },
    ]);
    expect(kwWps.validationPassed).toBe(true);
    expect(kwWps.adapterCode).toBe("KW_CBK_WPS");
    expect(kwWps.decimalPrecision).toBe(3);
    expect(kwWps.fileFormat).toBe("sif");
  });
});

describe("Prompt 34 (Sections 92–97): Cross-Country Boundaries, Transfers, Immutability, Four-Eyes, Simulation, WPS Regeneration & Security", () => {
  it("Section 92 — Cross-Country Boundary Isolation: never applies Egypt tax to GCC countries or Saudi GOSI to Egypt", () => {
    const saSnapshot = createImmutablePayrollStatutorySnapshot({
      snapshotId: "snap-sa-1",
      payrollRunId: "run-2026-06-sa",
      employeeId: "emp-sa-1",
      countryCode: "SA",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      grossWage: 15000,
      isNational: true,
    });
    expect(saSnapshot.incomeTaxMonthly).toBe(0);
    expect(saSnapshot.currencyCode).toBe("SAR");
    expect(saSnapshot.countryPackVersion).toBe("SA-2024-V1");

    const egSnapshot = createImmutablePayrollStatutorySnapshot({
      snapshotId: "snap-eg-1",
      payrollRunId: "run-2026-06-eg",
      employeeId: "emp-eg-1",
      countryCode: "EG",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      grossWage: 15000,
      isNational: true,
    });
    expect(egSnapshot.incomeTaxMonthly).toBeGreaterThan(0);
    expect(egSnapshot.currencyCode).toBe("EGP");
    expect(egSnapshot.countryPackVersion).toBe("EG-2024-V1");
  });

  it("Section 93 — Cross-Country Employee Transfer: Egypt (Jan-Jun) -> Saudi Arabia (Jul-Dec) preserves historical localization", () => {
    const initialHistory: EmployeeLocalizationSlice[] = [
      {
        employeeId: "emp-transfer-01",
        countryCode: "EG",
        currencyCode: "EGP",
        countryPackVersion: "EG-2024-V1",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
      },
    ];

    const updatedHistory = transferEmployeeBetweenCountries(initialHistory, {
      employeeId: "emp-transfer-01",
      newCountryCode: "SA",
      effectiveDate: "2026-07-01",
      transferReason: "Regional transfer from Cairo entity to Riyadh HQ",
    });

    expect(updatedHistory).toHaveLength(2);
    expect(updatedHistory[0].countryCode).toBe("EG");
    expect(updatedHistory[0].effectiveTo).toBe("2026-06-30");
    expect(updatedHistory[1].countryCode).toBe("SA");
    expect(updatedHistory[1].effectiveFrom).toBe("2026-07-01");
    expect(updatedHistory[1].effectiveTo).toBeNull();

    // Historical period lookup for March 2026 still resolves Egypt EGP
    const marchPack = resolveEmployeeCountryPackForPeriod(updatedHistory, "emp-transfer-01", "2026-03-15");
    expect(marchPack?.countryCode).toBe("EG");
    expect(marchPack?.currencyCode).toBe("EGP");

    // August 2026 resolves Saudi Arabia SAR
    const augustPack = resolveEmployeeCountryPackForPeriod(updatedHistory, "emp-transfer-01", "2026-08-15");
    expect(augustPack?.countryCode).toBe("SA");
    expect(augustPack?.currencyCode).toBe("SAR");
  });

  it("Section 94 — Historical Payroll Immutability: 2026 payroll snapshot remains unchanged when 2027 statutory rules are resolved", () => {
    const snap2026 = createImmutablePayrollStatutorySnapshot({
      snapshotId: "snap-2026-eg",
      payrollRunId: "run-2026-06",
      employeeId: "emp-eg-100",
      countryCode: "EG",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      grossWage: 14000,
      isNational: true,
    });

    const snap2027 = createImmutablePayrollStatutorySnapshot({
      snapshotId: "snap-2027-eg",
      payrollRunId: "run-2027-01",
      employeeId: "emp-eg-100",
      countryCode: "EG",
      periodStart: "2027-01-01",
      periodEnd: "2027-01-31",
      grossWage: 14000,
      isNational: true,
    });

    // 2026 uses EG-2024-V1 (12,600 cap -> 1392.30 SI deduction)
    expect(snap2026.countryPackVersion).toBe("EG-2024-V1");
    expect(snap2026.socialInsuranceEmployee).toBe(1392.3);
    expect(Object.isFrozen(snap2026)).toBe(true);

    // 2027 uses EG-2027-V1 (14,500 cap -> 14,000 insurable wage -> 1547.00 SI deduction)
    expect(snap2027.countryPackVersion).toBe("EG-2027-V1");
    expect(snap2027.socialInsuranceEmployee).toBe(1547);

    // Verify 2026 snapshot remained 100% untouched
    expect(snap2026.socialInsuranceEmployee).toBe(1392.3);
  });

  it("Section 95 — Four-Eyes Rule Activation, Rule Simulation, EOS Simulation Watermark & Retroactive Legislation", () => {
    // 1. Four-eyes blocks self-approval
    const selfApproval = validateFourEyesRuleActivation({
      ruleVersion: "EG-2027-V1",
      proposedByUserId: "user-admin-1",
      approvedByUserId: "user-admin-1",
    });
    expect(selfApproval.allowed).toBe(false);
    expect(selfApproval.reason).toContain("Four-eyes");

    const validApproval = validateFourEyesRuleActivation({
      ruleVersion: "EG-2027-V1",
      proposedByUserId: "user-admin-1",
      approvedByUserId: "user-compliance-2",
    });
    expect(validApproval.allowed).toBe(true);
    expect(validApproval.status).toBe("active");

    // 2. Rule simulation compares Current Version vs New Version without mutating payroll
    const sim = simulateRuleVersionImpact("SA", "SA-2024-V1", "SA-2027-V1", [
      { employeeId: "sa-1", grossWage: 10000, isNational: true },
      { employeeId: "sa-2", grossWage: 20000, isNational: true },
    ]);
    expect(sim.mutatedLivePayroll).toBe(false);
    expect(sim.affectedEmployeesCount).toBe(2);
    expect(sim.employerCostDelta).toBe(150); // +0.5% on 30,000 = 150 SAR
    expect(sim.employeeDeductionDelta).toBe(150);
    expect(sim.netPayDelta).toBe(-150);

    // 3. EOS simulation carries ESTIMATE / SIMULATION watermark
    const eosSim = simulateCountryEOS("SA", "2020-01-01", "2026-01-01", 12000, "resignation");
    expect(eosSim.simulationMode).toBe(true);
    expect(eosSim.watermark).toBe("ESTIMATE / SIMULATION");
    expect(eosSim.persistedToPayrollOrSettlement).toBe(false);

    // 4. Retroactive legislation adjustment proposal
    const closed2026 = createImmutablePayrollStatutorySnapshot({
      snapshotId: "snap-closed-01",
      payrollRunId: "run-closed-2026-05",
      employeeId: "sa-1",
      countryCode: "SA",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      grossWage: 10000,
      isNational: true,
      explicitRuleVersion: "SA-2024-V1",
    });
    const retroProposal = createRetroactiveStatutoryAdjustmentProposal({
      closedSnapshot: closed2026,
      retroactiveRuleVersion: "SA-2027-V1",
      targetOpenPayrollRunId: "run-open-2026-06",
      grossWage: 10000,
      isNational: true,
    });
    expect(retroProposal.historicalSnapshotMutated).toBe(false);
    expect(retroProposal.status).toBe("proposed");
    expect(retroProposal.employeeDeductionDelta).toBe(50);
    expect(retroProposal.employerContributionDelta).toBe(50);
    expect(retroProposal.netAdjustmentAmount).toBe(-50);
  });

  it("Section 96 — WPS Regeneration: marks v1 superseded and creates v2 when employee IBAN is corrected", () => {
    const recordsV1: WpsEmployeeRecordInput[] = [
      {
        employeeId: "emp-sa-99",
        employeeNo: "SA-099",
        employeeName: "خالد العتيبي",
        nationalOrResidentId: "1087654321",
        iban: "INVALID_IBAN",
        bankCode: "RJHI",
        basicSalary: 8000,
        housingAllowance: 2000,
        otherAllowances: 0,
        deductions: 780,
        netSalary: 9220,
      },
    ];

    const pkgV1 = generateCountryWpsPackage("SA", SAMPLE_EMPLOYER, recordsV1);
    expect(pkgV1.fileVersion).toBe(1);
    expect(pkgV1.validationPassed).toBe(false);
    expect(pkgV1.blockedRecordCount).toBe(1);

    const recordsV2: WpsEmployeeRecordInput[] = [
      {
        ...recordsV1[0],
        iban: "SA0380000000608010167519",
      },
    ];

    const { supersededPackage, newPackage } = regenerateCountryWpsPackage(
      pkgV1,
      SAMPLE_EMPLOYER,
      recordsV2,
      "Corrected employee IBAN after bank verification"
    );

    expect(supersededPackage.status).toBe("superseded");
    expect(newPackage.fileVersion).toBe(2);
    expect(newPackage.supersedesBatchReference).toBe(pkgV1.batchReference);
    expect(newPackage.validationPassed).toBe(true);
    expect(newPackage.blockedRecordCount).toBe(0);
    expect(newPackage.status).toBe("validated");
  });

  it("Section 97 — RBAC Permissions, Sensitive Field Masking, Log Sanitization & Governed Metrics", () => {
    expect(COUNTRY_PACK_PERMISSIONS).toHaveLength(12);
    expect(COUNTRY_PACK_PERMISSIONS).toContain("statutory_rules.activate");
    expect(COUNTRY_PACK_PERMISSIONS).toContain("wps.export");

    expect(maskStatutoryIdentifier("29501011234567", false)).toBe("**********4567");
    expect(maskStatutoryIdentifier("29501011234567", true)).toBe("29501011234567");
    expect(maskStatutoryIdentifier("SA0380000000608010167519", false)).toBe("********************7519");

    const rawLog = {
      event: "wps_validation",
      employeeNo: "EMP-101",
      nationalId: "1087654321",
      iban: "SA0380000000608010167519",
      socialInsuranceNumber: "9988776655",
    };
    const safeLog = sanitizeStatutoryLogPayload(rawLog);
    expect(safeLog.employeeNo).toBe("EMP-101");
    expect(safeLog.nationalId).toBe("******4321");
    expect(safeLog.iban).toBe("********************7519");
    expect(safeLog.socialInsuranceNumber).toBe("******6655");

    // Verify all 7 governed metrics from Section 86 exist in METRIC_CATALOG
    const requiredMetrics = [
      "STATUTORY_COMPLIANCE_RATE",
      "WPS_VALIDATION_SUCCESS_RATE",
      "MISSING_IDENTIFIER_RATE",
      "EXPIRED_DOCUMENT_RATE",
      "STATUTORY_EMPLOYER_COST",
      "STATUTORY_EMPLOYEE_DEDUCTION",
      "LOCALIZATION_EXCEPTION_COUNT",
    ];
    for (const code of requiredMetrics) {
      expect(METRIC_CATALOG.some((m) => m.metricCode === code)).toBe(true);
    }

    // Verify all 10 localization reports from Section 85 exist in REPORT_CATALOG
    const requiredReports = [
      "COUNTRY_WORKFORCE_SUMMARY",
      "STATUTORY_CONTRIBUTION_SUMMARY",
      "EGYPT_TAX_REGISTER",
      "SOCIAL_INSURANCE_REGISTER",
      "WPS_READINESS_BATCH_STATUS",
      "MISSING_STATUTORY_IDS",
      "EXPIRING_RESIDENCY_WORK_PERMITS",
      "EOS_LIABILITY_BY_COUNTRY",
      "STATUTORY_OVERRIDE_AUDIT",
      "MULTI_COUNTRY_PAYROLL_COMPARISON",
    ];
    for (const repCode of requiredReports) {
      expect(REPORT_CATALOG.some((r) => r.code === repCode)).toBe(true);
    }
  });
});

describe("Prompt 34: In-Memory PostgreSQL Migrations (20261016000000 & 20261021000000) & RPC Verification", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();

    await pg.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT);

      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        legal_name_ar TEXT NOT NULL,
        code TEXT NOT NULL
      );

      CREATE OR REPLACE FUNCTION public.current_company_id()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT id FROM public.companies LIMIT 1;
      $$;

      CREATE TABLE IF NOT EXISTS legal_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id),
        name_ar TEXT
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

    const migration1Path = path.resolve(
      __dirname,
      "../../supabase/migrations/20261016000000_production_multi_country_statutory_country_packs.sql"
    );
    const migration2Path = path.resolve(
      __dirname,
      "../../supabase/migrations/20261021000000_production_multi_country_localization_statutory_country_packs.sql"
    );
    await pg.exec(fs.readFileSync(migration1Path, "utf-8"));
    await pg.exec(fs.readFileSync(migration2Path, "utf-8"));
  });

  it("verifies 5 seeded country packs with decimal precision (2 for EGP/SAR/QAR, 3 for OMR/BHD) and RLS enabled", async () => {
    const packsRes = await pg.query<{ country_code: string; decimal_precision: number; verification_status: string }>(
      "SELECT country_code, decimal_precision, verification_status FROM country_packs ORDER BY country_code;"
    );
    expect(packsRes.rows).toHaveLength(5);
    const byCode = Object.fromEntries(packsRes.rows.map((r) => [r.country_code, r]));
    expect(byCode.EG.decimal_precision).toBe(2);
    expect(byCode.SA.decimal_precision).toBe(2);
    expect(byCode.QA.decimal_precision).toBe(2);
    expect(byCode.OM.decimal_precision).toBe(3);
    expect(byCode.BH.decimal_precision).toBe(3);
    expect(byCode.SA.verification_status).toBe("production_active");
  });

  it("executes calculate_statutory_social_insurance_atomic, income_tax_atomic, and eos_atomic RPCs", async () => {
    const siRes = await pg.query<{ result: any }>(
      "SELECT calculate_statutory_social_insurance_atomic('SA', true, 10000, 10000) as result;"
    );
    expect(Number(siRes.rows[0].result.employee_contribution)).toBe(975.0);
    expect(Number(siRes.rows[0].result.employer_contribution)).toBe(1175.0);

    const taxRes = await pg.query<{ result: any }>(
      "SELECT calculate_statutory_income_tax_atomic('EG', 10000) as result;"
    );
    expect(Number(taxRes.rows[0].result.annual_tax)).toBe(9750.0);
    expect(Number(taxRes.rows[0].result.monthly_tax)).toBe(812.5);

    const eosRes = await pg.query<{ result: any }>(
      "SELECT calculate_statutory_eos_atomic('SA', '2018-01-01', '2024-01-01', 0, 10000, 'termination_by_employer') as result;"
    );
    expect(Number(eosRes.rows[0].result.final_eos_amount)).toBe(35000.0);
  });

  it("enforces four-eyes rule activation, immutable payroll snapshots, cross-country transfers, and WPS regeneration in PostgreSQL", async () => {
    const u1 = (await pg.query<{ id: string }>("INSERT INTO auth.users (email) VALUES ('maker@madarx.io') RETURNING id;")).rows[0].id;
    const u2 = (await pg.query<{ id: string }>("INSERT INTO auth.users (email) VALUES ('checker@madarx.io') RETURNING id;")).rows[0].id;
    const companyId = (await pg.query<{ id: string }>("INSERT INTO companies (legal_name_ar, code) VALUES ('شركة مدار', 'MDX') RETURNING id;")).rows[0].id;
    const empId = (
      await pg.query<{ id: string }>(
        `INSERT INTO employees (company_id, employee_number, first_name_ar, last_name_ar, national_id, iban, bank_name, basic_salary)
         VALUES ('${companyId}', 'EMP-500', 'طارق', 'حسن', '1087654321', 'SA0380000000608010167519', 'RJHI', 10000) RETURNING id;`
      )
    ).rows[0].id;
    const runId = (
      await pg.query<{ id: string }>(
        `INSERT INTO payroll_runs (company_id, period_start, period_end, currency, status)
         VALUES ('${companyId}', '2026-06-01', '2026-06-30', 'SAR', 'locked') RETURNING id;`
      )
    ).rows[0].id;
    await pg.query(
      `INSERT INTO payroll_details (payroll_run_id, employee_id, basic_salary, housing_allowance, net_salary)
       VALUES ('${runId}', '${empId}', 10000, 2500, 11525);`
    );

    // 1. Four-eyes rule set activation
    const rsId = (
      await pg.query<{ id: string }>(
        `INSERT INTO statutory_rule_sets (country_code, version_code, version_name_ar, version_name_en, effective_from, status, proposed_by)
         VALUES ('SA', 'SA-2027-V1', 'تحديث 2027', 'SA 2027 Pack', '2027-01-01', 'verified', '${u1}') RETURNING id;`
      )
    ).rows[0].id;

    // Self-approval must fail
    await expect(
      pg.query(`SELECT activate_statutory_rule_set_four_eyes_atomic('${rsId}', '${u1}', 'Self approve');`)
    ).rejects.toThrow(/Four-eyes/);

    // Second-person approval succeeds
    const actRes = await pg.query<{ res: any }>(
      `SELECT activate_statutory_rule_set_four_eyes_atomic('${rsId}', '${u2}', 'Approved by compliance officer') as res;`
    );
    expect(actRes.rows[0].res.status).toBe("active");

    // 2. Immutable payroll statutory snapshot cannot be mutated once locked
    const snapId = (
      await pg.query<{ id: string }>(
        `INSERT INTO payroll_statutory_snapshots (
           company_id, payroll_run_id, employee_id, country_code, currency_code,
           decimal_precision, period_start, period_end, country_pack_version,
           gross_wage, insurable_wage, employee_social_insurance, employer_social_insurance, is_locked
         ) VALUES (
           '${companyId}', '${runId}', '${empId}', 'SA', 'SAR',
           2, '2026-06-01', '2026-06-30', 'SA-2024-V1',
           12500, 12500, 975, 1175, true
         ) RETURNING id;`
      )
    ).rows[0].id;

    await expect(
      pg.query(`UPDATE payroll_statutory_snapshots SET employee_social_insurance = 500 WHERE id = '${snapId}';`)
    ).rejects.toThrow(/Cannot mutate or delete a locked historical payroll statutory snapshot/);

    // 3. Cross-country transfer RPC
    await pg.query(
      `SELECT transfer_employee_country_pack_atomic('${companyId}', '${empId}', 'EG', '2026-01-01', 'Initial Cairo hire', '${u1}');`
    );
    const transferRes = await pg.query<{ res: any }>(
      `SELECT transfer_employee_country_pack_atomic('${companyId}', '${empId}', 'SA', '2026-07-01', 'Transfer to Riyadh', '${u1}') as res;`
    );
    expect(transferRes.rows[0].res.new_country_code).toBe("SA");

    const histRows = await pg.query<{ country_code: string; effective_from: string; effective_to: string | null }>(
      `SELECT country_code, effective_from::TEXT, effective_to::TEXT FROM employee_localization_history WHERE employee_id = '${empId}' ORDER BY effective_from ASC;`
    );
    expect(histRows.rows).toHaveLength(2);
    expect(histRows.rows[0].country_code).toBe("EG");
    expect(histRows.rows[0].effective_to).toBe("2026-06-30");
    expect(histRows.rows[1].country_code).toBe("SA");
    expect(histRows.rows[1].effective_to).toBeNull();

    // 4. WPS batch generation & regeneration RPC
    const wpsV1 = await pg.query<{ res: any }>(
      `SELECT generate_wps_batch_atomic('${companyId}', '${runId}', 'SA', 'txt', '${u1}') as res;`
    );
    const batchV1Id = wpsV1.rows[0].res.batch_id;
    expect(wpsV1.rows[0].res.validation_passed).toBe(true);

    const wpsV2 = await pg.query<{ res: any }>(
      `SELECT regenerate_wps_batch_atomic('${companyId}', '${batchV1Id}', 'Regenerated after bank code update', '${u2}') as res;`
    );
    expect(wpsV2.rows[0].res.file_version).toBe(2);
    expect(wpsV2.rows[0].res.prior_status).toBe("superseded");
  });
});
