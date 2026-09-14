import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../../integrations/supabase/client";
import { queryKeys } from "../../query/query-keys";
import { demoStore, useDemoStore } from "../demo/demo-store";
type DemoStore = typeof demoStore;
import type { Employee, ServiceRequest, DailyAttendanceRecord, EmployeeDocument, JobOpening, Candidate } from "../../../types";
import type {
  DashboardFilters,
  DashboardAnalytics,
  DashboardAttendanceTrend,
  DashboardIntegrations,
  DashboardAnalyticsState,
} from "./dashboard-types";

// ─── Default Period Filter ─────────────────────────────────────────────────────
export function getDefaultDashboardFilters(): DashboardFilters {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]!;
  const last7Start = new Date(today);
  last7Start.setDate(today.getDate() - 6);
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

// ─── Demo Analytics Builder ────────────────────────────────────────────────────
// Uses existing demo store data to synthesize a typed DashboardAnalytics object.
function buildDemoAnalytics(demoData: DemoStore): DashboardAnalytics {
  const employees: Employee[] = demoData.employees;
  const requests: ServiceRequest[] = demoData.requests;
  const attendanceRecords: DailyAttendanceRecord[] = demoData.attendanceRecords;
  const payrollRuns = demoData.payrollRuns;
  const employeeDocs: EmployeeDocument[] = demoData.employeeDocs;
  const today = new Date().toISOString().split("T")[0]!;

  const activeEmployees = employees.filter((e: Employee) => e.status === "active");
  const saudiCount = activeEmployees.filter(
    (e: Employee) =>
      e.nationality?.includes("سعود") ||
      e.nationality?.toLowerCase().includes("saudi") ||
      e.nationalIdOrIqama?.startsWith("1"),
  ).length;

  const pendingReqs = requests.filter((r: ServiceRequest) => r.status === "pending_approval");
  const todayRecs = attendanceRecords.filter((a: DailyAttendanceRecord) => {
    if ("workDate" in a) return (a as { workDate?: string }).workDate === today;
    return false;
  });
  const presentCount = todayRecs.filter(
    (a: DailyAttendanceRecord) => a.status === "present" || a.status === "late",
  ).length;
  const lateCount = todayRecs.filter((a: DailyAttendanceRecord) => a.status === "late").length;
  const absentCount = todayRecs.filter((a: DailyAttendanceRecord) => a.status === "absent").length;

  const onLeaveRequests = requests.filter(
    (r: ServiceRequest) =>
      r.type === "leave" &&
      r.status === "approved" &&
      r.payload &&
      (r.payload as { startDate?: string; endDate?: string }).startDate != null &&
      (r.payload as { startDate?: string; endDate?: string }).endDate != null &&
      ((r.payload as { startDate?: string; endDate?: string }).startDate ?? "") <= today &&
      ((r.payload as { startDate?: string; endDate?: string }).endDate ?? "") >= today,
  );

  const latestRun = payrollRuns[0];

  const now = new Date();
  const expiredDocs = employeeDocs.filter(
    (d: EmployeeDocument) => d.expiryDate && new Date(d.expiryDate) < now,
  ).length;
  const within7dDocs = employeeDocs.filter((d: EmployeeDocument) => {
    if (!d.expiryDate) return false;
    const exp = new Date(d.expiryDate);
    const diff = (exp.getTime() - now.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;
  const within30dDocs = employeeDocs.filter((d: EmployeeDocument) => {
    if (!d.expiryDate) return false;
    const exp = new Date(d.expiryDate);
    const diff = (exp.getTime() - now.getTime()) / 86400000;
    return diff > 7 && diff <= 30;
  }).length;
  const within60dDocs = employeeDocs.filter((d: EmployeeDocument) => {
    if (!d.expiryDate) return false;
    const exp = new Date(d.expiryDate);
    const diff = (exp.getTime() - now.getTime()) / 86400000;
    return diff > 30 && diff <= 60;
  }).length;

  const leaveRoster = onLeaveRequests.slice(0, 10).map((r: ServiceRequest) => {
    const emp = employees.find((e: Employee) => e.id === r.requesterId);
    return {
      id: r.id,
      employeeId: r.requesterId,
      firstNameAr: emp?.firstNameAr,
      lastNameAr: emp?.lastNameAr,
      jobTitleAr: emp?.jobTitleAr,
      leaveType:
        (r.payload as { leaveType?: string } | undefined)?.leaveType ?? "إجازة",
      startDate: (r.payload as { startDate?: string } | undefined)?.startDate,
      endDate: (r.payload as { endDate?: string } | undefined)?.endDate,
    };
  });

  return {
    scope: "organization",
    anchorDate: today,
    startDate: today,
    endDate: today,
    headcount: {
      available: true,
      activeCount: activeEmployees.length,
      newHires: 0,
      departures: 0,
      prevNewHires: 0,
      saudiCount,
    },
    attendance: {
      available: true,
      eligible: activeEmployees.length,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      onLeave: onLeaveRequests.length,
    },
    pendingApprovals: { available: true, count: pendingReqs.length },
    payroll: {
      available: true,
      period: latestRun
        ? `${latestRun.periodYear}-${String(latestRun.periodMonth).padStart(2, "0")}`
        : undefined,
      status: latestRun?.status,
      employeeCount: latestRun?.totalEmployees,
      netTotal: latestRun?.totalNetSalary,
      wpsStatus: null,
    },
    documents: {
      available: true,
      expired: expiredDocs,
      within7d: within7dDocs,
      within30d: within30dDocs,
      within60d: within60dDocs,
    },
    recruitment: {
      available: true,
      openPositions: demoData.jobOpenings.filter(
        (j: JobOpening) => j.publishedStatus === "published" && j.filledCount < j.openingsCount,
      ).length,
      activeCandidates: demoData.candidates.filter(
        (c: Candidate) => !["hired", "rejected"].includes(c.stage),
      ).length,
    },
    leaveRoster,
    integrations: {
      available: true,
      platforms: [
        { name: "منصة قوى (Qiwa)", configured: false, status: "not_configured" },
        { name: "منصة مقيم (Muqeem)", configured: false, status: "not_configured" },
        { name: "منصة مَدَد (Mudad)", configured: false, status: "not_configured" },
        { name: "التأمينات (GOSI)", configured: false, status: "not_configured" },
        { name: "هيئة الزكاة (ZATCA)", configured: false, status: "not_configured" },
      ],
    },
  };
}

function buildDemoAttendanceTrend(
  demoData: DemoStore,
  days: number,
): DashboardAttendanceTrend {
  const employees: Employee[] = demoData.employees;
  const activeCount = employees.filter((e: Employee) => e.status === "active").length;
  const records: DailyAttendanceRecord[] = demoData.attendanceRecords;
  const today = new Date();
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  const trend = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().split("T")[0]!;
    const dayLabel = dayNames[d.getDay()] ?? d.toLocaleDateString("ar-SA", { weekday: "short" });
    const dayRecs = records.filter((a: DailyAttendanceRecord) => {
      if ("workDate" in a) return (a as { workDate?: string }).workDate === dateStr;
      return false;
    });
    const present = dayRecs.filter((a: DailyAttendanceRecord) => a.status === "present").length;
    const late = dayRecs.filter((a: DailyAttendanceRecord) => a.status === "late").length;
    const absent = dayRecs.filter((a: DailyAttendanceRecord) => a.status === "absent").length;
    const hasData = present + late + absent > 0;
    return {
      date: dateStr,
      dayLabelAr: dayLabel,
      present: hasData ? present : d.getDay() === 5 || d.getDay() === 6 ? 0 : Math.round(activeCount * 0.92),
      late: hasData ? late : d.getDay() === 5 || d.getDay() === 6 ? 0 : Math.round(activeCount * 0.03),
      absent: hasData ? absent : d.getDay() === 5 || d.getDay() === 6 ? 0 : Math.round(activeCount * 0.05),
    };
  });

  return {
    available: true,
    anchorDate: today.toISOString().split("T")[0]!,
    days,
    trend,
  };
}

// ─── Public Hooks ──────────────────────────────────────────────────────────────

export function useDashboardAnalytics(
  filters: DashboardFilters,
): DashboardAnalyticsState {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const demoState = useDemoStore((s: DemoStore) => s);

  const summaryQuery = useQuery<DashboardAnalytics, Error>({
    queryKey: queryKeys.dashboard.summary({ start: filters.startDate, end: filters.endDate }),
    queryFn: () => fetchDashboardSummary(filters.startDate, filters.endDate),
    enabled: isLive,
    staleTime: 2 * 60 * 1000,
  });

  const trendDays = filters.preset === "last30" || filters.preset === "thisMonth" || filters.preset === "prevMonth" ? 30 : 7;
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
    if (isLive) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    }
  };
  const refetchTrend = () => {
    if (isLive) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.attendance({ anchor: filters.endDate, days: trendDays }) });
    }
  };

  if (!isLive) {
    const demoAnalytics = buildDemoAnalytics(demoState);
    const demoTrend = buildDemoAttendanceTrend(demoState, trendDays);
    return {
      data: demoAnalytics,
      trend: demoTrend,
      integrationHealth: demoAnalytics.integrations,
      isLoading: false,
      isError: false,
      error: null,
      isRefreshing: false,
      refetch: () => {},
      refetchTrend: () => {},
    };
  }

  const isLoading = summaryQuery.isLoading || trendQuery.isLoading;
  const isError = summaryQuery.isError || trendQuery.isError;
  const error =
    summaryQuery.error?.message ??
    trendQuery.error?.message ??
    null;

  return {
    data: summaryQuery.data,
    trend: trendQuery.data,
    integrationHealth: integrationQuery.data ?? undefined,
    isLoading,
    isError,
    error,
    isRefreshing: summaryQuery.isFetching || trendQuery.isFetching,
    refetch,
    refetchTrend,
  };
}
