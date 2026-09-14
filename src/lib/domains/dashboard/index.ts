import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../../integrations/supabase/client";
import { queryKeys } from "../../query/query-keys";
import { demoStore, useDemoStore } from "../demo/demo-store";
type DemoStore = typeof demoStore;
import type {
  Employee,
  ServiceRequest,
  DailyAttendanceRecord,
  EmployeeDocument,
  JobOpening,
  Candidate,
} from "../../../types";
import type {
  DashboardFilters,
  DashboardAnalytics,
  DashboardAttendanceTrend,
  DashboardIntegrations,
  DashboardAnalyticsState,
  DashboardPendingApprovalItem,
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

// ─── Demo Analytics Builder ────────────────────────────────────────────────────
function buildDemoAnalytics(demoData: DemoStore, timezone: string = "Asia/Riyadh"): DashboardAnalytics {
  const employees: Employee[] = demoData.employees;
  const requests: ServiceRequest[] = demoData.requests;
  const attendanceRecords: DailyAttendanceRecord[] = demoData.attendanceRecords;
  const payrollRuns = demoData.payrollRuns;
  const employeeDocs: EmployeeDocument[] = demoData.employeeDocs;
  const today = getCompanyToday(timezone);

  // Active workforce definition: active, probation, on_leave (excludes suspended, terminated)
  const activeEmployees = employees.filter(
    (e: Employee) => e.status === "active" || e.status === "probation" || e.status === "on_leave",
  );

  // Authoritative Saudization: Based purely on nationality field
  const saudiCount = activeEmployees.filter(
    (e: Employee) =>
      e.nationality?.includes("سعود") ||
      e.nationality?.toLowerCase().includes("saudi"),
  ).length;

  const nonSaudiCount = activeEmployees.filter(
    (e: Employee) =>
      e.nationality &&
      !e.nationality.includes("سعود") &&
      !e.nationality.toLowerCase().includes("saudi"),
  ).length;

  const unknownNationalityCount = activeEmployees.filter(
    (e: Employee) => !e.nationality || e.nationality.trim() === "",
  ).length;

  const pendingReqs = requests.filter((r: ServiceRequest) => r.status === "pending_approval");
  const pendingItems: DashboardPendingApprovalItem[] = pendingReqs.slice(0, 10).map((r) => ({
    id: r.id,
    referenceNo: r.referenceNo,
    type: r.type,
    requesterId: r.requesterId,
    requesterName: r.requesterName,
    departmentName: r.departmentName,
    submittedAt: r.submittedAt,
    reason: String(
      (r.payload as Record<string, unknown> | undefined)?.["reason"] ||
      (r.payload as Record<string, unknown> | undefined)?.["notes"] ||
      "طلب معتمد في مسار الخدمة",
    ),
  }));

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
    timezone,
    anchorDate: today,
    startDate: today,
    endDate: today,
    headcount: {
      available: true,
      activeCount: activeEmployees.length,
      newHires: 0,
      prevNewHires: 0,
      saudiCount,
      nonSaudiCount,
      unknownNationalityCount,
      turnoverRate: null,
      reasonTurnoverUnavailable: "termination_date_not_available",
    },
    attendance: {
      available: true,
      eligible: activeEmployees.length,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      onLeave: onLeaveRequests.length,
    },
    pendingApprovals: {
      available: true,
      count: pendingReqs.length,
      items: pendingItems,
    },
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
  };
}

function buildDemoAttendanceTrend(
  demoData: DemoStore,
  days: number,
  timezone: string = "Asia/Riyadh",
): DashboardAttendanceTrend {
  const employees: Employee[] = demoData.employees;
  const activeCount = employees.filter(
    (e: Employee) => e.status === "active" || e.status === "probation" || e.status === "on_leave",
  ).length;
  const records: DailyAttendanceRecord[] = demoData.attendanceRecords;
  const todayStr = getCompanyToday(timezone);
  const today = new Date(todayStr + "T00:00:00Z");
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  const trend = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - (days - 1 - i));
    const dateStr = d.toISOString().split("T")[0]!;
    const dayLabel = dayNames[d.getUTCDay()] ?? "يوم";
    const dayRecs = records.filter((a: DailyAttendanceRecord) => {
      if ("workDate" in a) return (a as { workDate?: string }).workDate === dateStr;
      return false;
    });
    const present = dayRecs.filter((a: DailyAttendanceRecord) => a.status === "present").length;
    const late = dayRecs.filter((a: DailyAttendanceRecord) => a.status === "late").length;
    const absent = dayRecs.filter((a: DailyAttendanceRecord) => a.status === "absent").length;
    const hasData = present + late + absent > 0;
    const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
    return {
      date: dateStr,
      dayLabelAr: dayLabel,
      present: hasData ? present : isWeekend ? 0 : Math.round(activeCount * 0.92),
      late: hasData ? late : isWeekend ? 0 : Math.round(activeCount * 0.03),
      absent: hasData ? absent : isWeekend ? 0 : Math.round(activeCount * 0.05),
    };
  });

  return {
    available: true,
    timezone,
    anchorDate: todayStr,
    days,
    trend,
  };
}

// ─── Public Hook ───────────────────────────────────────────────────────────────
export function useDashboardAnalytics(
  filters: DashboardFilters,
  companyTimezone: string = "Asia/Riyadh",
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
    if (isLive) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    }
  };

  const refetchTrend = () => {
    if (isLive) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.attendance({ anchor: filters.endDate, days: trendDays }),
      });
    }
  };

  if (!isLive) {
    const demoAnalytics = buildDemoAnalytics(demoState, companyTimezone);
    const demoTrend = buildDemoAttendanceTrend(demoState, trendDays, companyTimezone);
    return {
      data: demoAnalytics,
      trend: demoTrend,
      integrationHealth: {
        available: true,
        platforms: [
          { name: "منصة قوى (Qiwa)", configured: false, status: "not_configured" },
          { name: "منصة مقيم (Muqeem)", configured: false, status: "not_configured" },
          { name: "منصة مَدَد (Mudad)", configured: false, status: "not_configured" },
          { name: "التأمينات (GOSI)", configured: false, status: "not_configured" },
          { name: "هيئة الزكاة (ZATCA)", configured: false, status: "not_configured" },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      isRefreshing: false,
      refetch: () => {},
      refetchTrend: () => {},
    };
  }

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
