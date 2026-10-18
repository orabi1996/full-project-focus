// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 37: UNIFIED GOVERNMENT REGULATORY CONNECTOR REGISTRY
// src/lib/integrations/government/index.ts
// ============================================================================

import type { CountryCode } from "../../domains/country-packs";
import {
  type GovernmentConnectorAdapter,
  type GovernmentProviderCode,
  type PreflightEmployeeRecord,
} from "./connector-contract";
import { SAUDI_GOVERNMENT_ADAPTERS } from "./sa";
import { EGYPT_GOVERNMENT_ADAPTERS } from "./eg";
import { QATAR_GOVERNMENT_ADAPTERS } from "./qa";
import { OMAN_GOVERNMENT_ADAPTERS } from "./om";
import { BAHRAIN_GOVERNMENT_ADAPTERS } from "./bh";

export * from "./connector-contract";
export * from "./sa";
export * from "./eg";
export * from "./qa";
export * from "./om";
export * from "./bh";
export * from "./activation-engine";

export const GOVERNMENT_CONNECTOR_REGISTRY: Record<
  GovernmentProviderCode,
  GovernmentConnectorAdapter
> = {
  ...SAUDI_GOVERNMENT_ADAPTERS,
  ...EGYPT_GOVERNMENT_ADAPTERS,
  ...QATAR_GOVERNMENT_ADAPTERS,
  ...OMAN_GOVERNMENT_ADAPTERS,
  ...BAHRAIN_GOVERNMENT_ADAPTERS,
};

export const ALL_GOVERNMENT_PROVIDER_CODES: GovernmentProviderCode[] = [
  "GOSI",
  "MUDAD",
  "QIWA",
  "MUQEEM",
  "NOSI",
  "ETA",
  "GRSIA",
  "MADLSA",
  "SPF",
  "CBO",
  "SIO",
  "LMRA",
];

export function getGovernmentAdaptersByCountry(
  countryCode?: string
): GovernmentConnectorAdapter[] {
  const all = ALL_GOVERNMENT_PROVIDER_CODES.map((code) => GOVERNMENT_CONNECTOR_REGISTRY[code]);
  if (!countryCode || countryCode === "all") {
    return all;
  }
  return all.filter((adapter) => adapter.spec.countryCode === countryCode);
}

export function getGovernmentAdapter(
  provider: GovernmentProviderCode
): GovernmentConnectorAdapter {
  return GOVERNMENT_CONNECTOR_REGISTRY[provider];
}

export function buildCanonicalStatutorySampleRecords(
  countryCode: CountryCode
): PreflightEmployeeRecord[] {
  switch (countryCode) {
    case "SA":
      return [
        {
          employeeId: "emp-sa-01",
          employeeNameAr: "فهد بن عبد العزيز العتيبي",
          nationalId: "1087654321",
          iban: "SA4420000001234567891234",
          basicSalary: 12000,
          netSalary: 14820,
          socialInsuranceEmployeeShare: 1170,
          socialInsuranceEmployerShare: 1410,
        },
        {
          employeeId: "emp-sa-02",
          employeeNameAr: "محمد محمود الشناوي",
          nationalId: "2456789123",
          iban: "SA5580000009876543214321",
          basicSalary: 8500,
          netSalary: 10500,
          socialInsuranceEmployeeShare: 0,
          socialInsuranceEmployerShare: 170,
        },
      ];
    case "EG":
      return [
        {
          employeeId: "emp-eg-01",
          employeeNameAr: "أحمد طارق عبد الرحمن",
          nationalId: "29205150101234",
          iban: "EG380019000500000000263180002",
          basicSalary: 12600,
          netSalary: 15200,
          socialInsuranceEmployeeShare: 1386,
          socialInsuranceEmployerShare: 2362.5,
          incomeTaxAmount: 1411.5,
        },
      ];
    case "QA":
      return [
        {
          employeeId: "emp-qa-01",
          employeeNameAr: "جاسم بن حمد آل ثاني",
          nationalId: "28963401234",
          iban: "QA58DOHB00001234567890ABCDEFG",
          basicSalary: 18000,
          netSalary: 23740,
          socialInsuranceEmployeeShare: 1260,
          socialInsuranceEmployerShare: 2520,
        },
      ];
    case "OM":
      return [
        {
          employeeId: "emp-om-01",
          employeeNameAr: "سالم بن سعيد البوسعيدي",
          nationalId: "12345678",
          iban: "OM120120000012345678901",
          basicSalary: 1200,
          netSalary: 1404,
          socialInsuranceEmployeeShare: 96,
          socialInsuranceEmployerShare: 153,
        },
      ];
    case "BH":
      return [
        {
          employeeId: "emp-bh-01",
          employeeNameAr: "خالد بن عيسى الدوسري",
          nationalId: "880412345",
          iban: "BH67BMAG00001299123456",
          basicSalary: 950,
          netSalary: 1104,
          socialInsuranceEmployeeShare: 76,
          socialInsuranceEmployerShare: 161.5,
        },
      ];
  }
}
