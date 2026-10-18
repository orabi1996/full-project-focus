// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: COUNTRY PACK QUERY KEYS FACTORY
// src/lib/query/country-pack-query-keys.ts
// ============================================================================

export const countryPackQueryKeys = {
  all: ["country_packs"] as const,
  kpis: (companyId: string) => [...countryPackQueryKeys.all, "kpis", companyId] as const,
  catalog: () => [...countryPackQueryKeys.all, "catalog"] as const,
  sources: (countryCode?: string) => [...countryPackQueryKeys.all, "sources", countryCode || "all"] as const,
  ruleSets: (countryCode?: string) => [...countryPackQueryKeys.all, "rule_sets", countryCode || "all"] as const,
  rules: (ruleSetId?: string) => [...countryPackQueryKeys.all, "rules", ruleSetId || "all"] as const,
  socialInsuranceProfiles: (countryCode?: string) => [...countryPackQueryKeys.all, "si_profiles", countryCode || "all"] as const,
  taxBrackets: (countryCode?: string) => [...countryPackQueryKeys.all, "tax_brackets", countryCode || "all"] as const,
  wpsBatches: (companyId: string, countryCode?: string) =>
    [...countryPackQueryKeys.all, "wps_batches", companyId, countryCode || "all"] as const,
  wpsBatchRecords: (batchId: string) => [...countryPackQueryKeys.all, "wps_records", batchId] as const,
  publicHolidays: (countryCode?: string, year?: number) =>
    [...countryPackQueryKeys.all, "holidays", countryCode || "all", year || "current"] as const,
  complianceChecks: (companyId: string, payrollRunId?: string) =>
    [...countryPackQueryKeys.all, "compliance_checks", companyId, payrollRunId || "latest"] as const,
  govConnectors: (companyId: string, countryCode?: string) =>
    [...countryPackQueryKeys.all, "gov_connectors", companyId, countryCode || "all"] as const,
  govSubmissions: (companyId: string, countryCode?: string) =>
    [...countryPackQueryKeys.all, "gov_submissions", companyId, countryCode || "all"] as const,
};
