import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import { fetchCoreSnapshot, type CoreSnapshot } from "../../data/hrms-repository";
import { fetchOperationalSnapshot, type OperationalSnapshot } from "../../data/operational-repository";
import { queryKeys } from "../../query/query-keys";
import type { CompanyProfile } from "../../../types";
import { useCallback } from "react";

export function useBootstrapData() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isLive = Boolean(session);
  const dataMode: "live" | "demo" = "live";

  // Live Core Snapshot Query
  const coreQuery = useQuery<CoreSnapshot, Error>({
    queryKey: queryKeys.bootstrap.core(),
    queryFn: async () => {
      return await fetchCoreSnapshot();
    },
    enabled: isLive,
    staleTime: 2 * 60 * 1000,
  });

  // Live Operational Snapshot Query (depends on core data for counts & employee lookups)
  const operationalQuery = useQuery<OperationalSnapshot, Error>({
    queryKey: queryKeys.bootstrap.operational(),
    queryFn: async () => {
      if (!coreQuery.data) {
        throw new Error("بيانات النظام الأساسية غير متوفرة بعد");
      }
      return await fetchOperationalSnapshot(coreQuery.data.employees, coreQuery.data.orgUnits);
    },
    enabled: isLive && Boolean(coreQuery.data),
    staleTime: 2 * 60 * 1000,
  });

  const refreshCoreData = useCallback(async () => {
    if (isLive) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
    }
  }, [isLive, queryClient]);

  // Live Mode:
  const isLoading = isLive
    ? coreQuery.isLoading || (Boolean(coreQuery.data) && operationalQuery.isLoading)
    : false;
  const error = coreQuery.error || operationalQuery.error;
  const isError = coreQuery.isError || operationalQuery.isError;

  return {
    dataMode,
    isLoading,
    isError,
    error: error ? error.message : null,
    refreshCoreData,
    company: (operationalQuery.data?.company as CompanyProfile | undefined) ?? {
      id: "",
      legalNameAr: "الأندلس",
      legalNameEn: "",
      code: "AL-ANDALUS",
      entityType: "limited_liability",
      unifiedNumber: "",
      taxNumber: "",
      crNumber: "",
      gosiNumber: "",
      laborOfficeNumber: "",
      industry: "",
      email: "",
      phone: "",
      website: "",
      country: "المملكة العربية السعودية",
      currency: "SAR",
      timezone: "Asia/Riyadh",
      headquartersAddress: "",
      fiscalYearStartMonth: 1,
      setupStatus: "incomplete",
    },
    subsidiaries: operationalQuery.data?.subsidiaries ?? [],
    orgUnits: coreQuery.data?.orgUnits ?? [],
    workLocations: operationalQuery.data?.workLocations ?? [],
    costCenters: operationalQuery.data?.costCenters ?? [],
    jobPositions: operationalQuery.data?.jobPositions ?? [],
    employees: coreQuery.data?.employees ?? [],
    roles: operationalQuery.data?.roles ?? [],
    approvalChains: operationalQuery.data?.approvalChains ?? [],
    delegationRules: operationalQuery.data?.delegationRules ?? [],
    requests: coreQuery.data?.requests ?? [],
    leaveTypes: operationalQuery.data?.leaveTypes ?? [],
    leaveBalances: operationalQuery.data?.leaveBalances ?? [],
    shifts: operationalQuery.data?.shifts ?? [],
    attendanceRecords: coreQuery.data?.attendanceRecords ?? [],
    overtimeRecords: operationalQuery.data?.overtimeRecords ?? [],
    attendanceCorrections: operationalQuery.data?.attendanceCorrections ?? [],
    payrollGroups: operationalQuery.data?.payrollGroups ?? [],
    payrollRuns: operationalQuery.data?.payrollRuns ?? [],
    payrollDetails: operationalQuery.data?.payrollDetails ?? [],
    loans: operationalQuery.data?.loans ?? [],
    settlements: operationalQuery.data?.settlements ?? [],
    expenseCategories: operationalQuery.data?.expenseCategories ?? [],
    expenseClaims: operationalQuery.data?.expenseClaims ?? [],
    performanceCycles: operationalQuery.data?.performanceCycles ?? [],
    evaluations: operationalQuery.data?.evaluations ?? [],
    workforcePlans: operationalQuery.data?.workforcePlans ?? [],
    jobOpenings: operationalQuery.data?.jobOpenings ?? [],
    candidates: operationalQuery.data?.candidates ?? [],
    jobOffers: operationalQuery.data?.jobOffers ?? [],
    assets: operationalQuery.data?.assets ?? [],
    companyDocs: operationalQuery.data?.companyDocs ?? [],
    employeeDocs: operationalQuery.data?.employeeDocs ?? [],
    auditLogs: operationalQuery.data?.auditLogs ?? [],
    notifications: operationalQuery.data?.notifications ?? [],
    accountingJournals: operationalQuery.data?.accountingJournals ?? [],
  };
}
