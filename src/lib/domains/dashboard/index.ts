import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../../integrations/supabase/client";
import { queryKeys } from "../../query/query-keys";
import type {
  DashboardFilters,
  DashboardAnalytics,
  DashboardAttendanceTrend,
  DashboardIntegrations,
  DashboardAnalyticsState,
} from "./dashboard-types";

// ─── Timezone-Aware Business Date Helpers ─────────────────────────────────────
export function getCompanyToday(timezone: string = "Asia/Riyadh"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0]!;
  }
}

export function getDefaultDashboardFilters(timezone: string = "Asia/Riyadh"): DashboardFilters {
  const todayStr = getCompanyToday(timezone);
  const today = new Date(todayStr + "T00:00:00Z");
  const last7Start = new Date(today);
  last7Start.setUTCDate(today.getUTCDate() - 6);
  return {
    preset: "last7",
    startDate: last7Start.toISOString().split("T")[0]!,
    endDate: todayStr,
  };
}

// ─── Live RPC Callers ──────────────────────────────────────────────────────────
async function fetchDashboardSummary(
  startDate: string,
  endDate: string,
): Promise<DashboardAnalytics> {
  const { data, error } = await supabase.rpc("get_dashboard_summary", {
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw new Error(error.message);
  return data as unknown as DashboardAnalytics;
}

async function fetchAttendanceTrend(
  anchorDate: string,
  days: number,
): Promise<DashboardAttendanceTrend> {
  const { data, error } = await supabase.rpc("get_dashboard_attendance_trend", {
    p_anchor_date: anchorDate,
    p_days: days,
  });
  if (error) throw new Error(error.message);
  return data as unknown as DashboardAttendanceTrend;
}

async function fetchIntegrationHealth(): Promise<DashboardIntegrations> {
  const { data, error } = await supabase.rpc("get_dashboard_integration_health");
  if (error) throw new Error(error.message);
  return data as unknown as DashboardIntegrations;
}

// ─── Public Hook ───────────────────────────────────────────────────────────────
export function useDashboardAnalytics(
  filters: DashboardFilters,
  companyTimezone: string = "Asia/Riyadh",
): DashboardAnalyticsState {
  const { session } = useAuth();
  const isLive = Boolean(session);
  const queryClient = useQueryClient();

  const summaryQuery = useQuery<DashboardAnalytics, Error>({
    queryKey: queryKeys.dashboard.summary({ start: filters.startDate, end: filters.endDate }),
    queryFn: () => fetchDashboardSummary(filters.startDate, filters.endDate),
    enabled: isLive,
    staleTime: 2 * 60 * 1000,
  });

  const trendDays =
    filters.preset === "last30" || filters.preset === "thisMonth" || filters.preset === "prevMonth"
      ? 30
      : 7;

  const trendQuery = useQuery<DashboardAttendanceTrend, Error>({
    queryKey: queryKeys.dashboard.attendance({ anchor: filters.endDate, days: trendDays }),
    queryFn: () => fetchAttendanceTrend(filters.endDate, trendDays),
    enabled: isLive,
    staleTime: 2 * 60 * 1000,
  });

  const integrationQuery = useQuery<DashboardIntegrations, Error>({
    queryKey: queryKeys.dashboard.integrations(),
    queryFn: fetchIntegrationHealth,
    enabled: isLive,
    staleTime: 5 * 60 * 1000,
  });

  const refetch = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  };

  const refetchTrend = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.attendance({ anchor: filters.endDate, days: trendDays }),
    });
  };

  const isLoading = summaryQuery.isLoading || trendQuery.isLoading || integrationQuery.isLoading;
  const isError = summaryQuery.isError || trendQuery.isError || integrationQuery.isError;
  const error =
    summaryQuery.error?.message ??
    trendQuery.error?.message ??
    integrationQuery.error?.message ??
    null;

  const isRefreshing =
    summaryQuery.isFetching || trendQuery.isFetching || integrationQuery.isFetching;

  return {
    data: summaryQuery.data,
    trend: trendQuery.data,
    integrationHealth: integrationQuery.data ?? undefined,
    isLoading,
    isError,
    error,
    isRefreshing,
    refetch,
    refetchTrend,
  };
}
