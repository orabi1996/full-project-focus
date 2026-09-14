/**
 * Dashboard Analytics — Typed Response Contract
 *
 * Every metric section includes an `available` flag.
 * When `available` is false, the UI must show an honest unavailability state
 * (e.g. "غير متاح") and NEVER substitute zeros or fallback demo data.
 */

export type DashboardPeriodPreset =
  | "today"
  | "last7"
  | "last30"
  | "thisMonth"
  | "prevMonth"
  | "custom";

export interface DashboardFilters {
  preset: DashboardPeriodPreset;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface DashboardHeadcount {
  available: boolean;
  reasonUnavailable?: string;
  activeCount?: number;
  newHires?: number;
  departures?: number;
  prevNewHires?: number;
  /** Saudi nationals — for Saudization %. No Nitaqat band label ever. */
  saudiCount?: number;
}

export interface DashboardAttendance {
  available: boolean;
  reasonUnavailable?: string;
  eligible?: number;
  present?: number;
  late?: number;
  absent?: number;
  onLeave?: number;
}

export interface DashboardPendingApprovals {
  available: true;
  count: number;
}

export interface DashboardPayroll {
  available: boolean;
  reasonUnavailable?: string;
  period?: string;        // "YYYY-MM"
  status?: string;
  employeeCount?: number;
  netTotal?: number;
  /**
   * Only set when real WPS validation data exists in DB.
   * null = not integrated / not validated.
   */
  wpsStatus?: string | null;
}

export interface DashboardDocuments {
  available: boolean;
  expired: number;
  within7d: number;
  within30d: number;
  within60d: number;
}

export interface DashboardRecruitment {
  available: boolean;
  reasonUnavailable?: string;
  openPositions?: number;
  activeCandidates?: number;
}

export interface DashboardLeaveRosterEntry {
  id: string;
  employeeId: string;
  firstNameAr?: string;
  lastNameAr?: string;
  jobTitleAr?: string;
  leaveType: string;
  startDate?: string;
  endDate?: string;
}

export interface DashboardIntegrationPlatform {
  name: string;
  configured: boolean;
  status: string; // online | offline | error | not_configured
  lastSyncAt?: string;
  lastSyncStatus?: string;
}

export interface DashboardIntegrations {
  available: boolean;
  reasonUnavailable?: string;
  platforms: DashboardIntegrationPlatform[];
}

export interface DashboardAttendanceTrendDay {
  date: string;
  dayLabelAr: string;
  present: number;
  late: number;
  absent: number;
}

export interface DashboardAttendanceTrend {
  available: boolean;
  reasonUnavailable?: string;
  anchorDate?: string;
  days?: number;
  trend: DashboardAttendanceTrendDay[];
}

export interface DashboardAnalytics {
  scope: "organization" | "self";
  anchorDate: string;
  startDate: string;
  endDate: string;
  headcount: DashboardHeadcount;
  attendance: DashboardAttendance;
  pendingApprovals: DashboardPendingApprovals;
  payroll: DashboardPayroll;
  documents: DashboardDocuments;
  recruitment: DashboardRecruitment;
  leaveRoster: DashboardLeaveRosterEntry[];
  integrations: DashboardIntegrations;
}

export interface DashboardAnalyticsState {
  data: DashboardAnalytics | undefined;
  trend: DashboardAttendanceTrend | undefined;
  integrationHealth: DashboardIntegrations | undefined;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  isRefreshing: boolean;
  refetch: () => void;
  refetchTrend: () => void;
}