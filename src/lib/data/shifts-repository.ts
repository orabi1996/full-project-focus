import { supabase } from "@/integrations/supabase/client";
const db = supabase as any;

import type {
  ShiftDefinition,
  ShiftSegment,
  RosterPeriod,
  ScheduleAssignment,
  RosterTemplate,
  RotationPattern,
  RosterCoverageRequirement,
  RosterException,
  ShiftSwapRequest,
  WorkweekConfig,
} from "../../types";
import { AppMutationError } from "./reliable-mutation";

function mapError(error: any, defaultMsg: string): AppMutationError {
  const code = (error as { code?: string })?.code ?? "";
  const msg = error?.message || defaultMsg;
  if (code === "23505" || code === "P0002") {
    return new AppMutationError(msg, "conflict", { details: error });
  }
  if (code === "42501") {
    return new AppMutationError(msg, "authorization", { details: error });
  }
  if (code === "22023" || code === "P0001") {
    return new AppMutationError(msg, "validation", { details: error });
  }
  return new AppMutationError(msg, "backend", { details: error });
}

// ----------------------------------------------------------------------------
// Entity Mappers
// ----------------------------------------------------------------------------

export function mapShiftSegment(row: any): ShiftSegment {
  return {
    id: row.id,
    shiftId: row.shift_id,
    segmentOrder: Number(row.segment_order ?? 1),
    startTime: (row.start_time || "").substring(0, 5),
    endTime: (row.end_time || "").substring(0, 5),
    segmentType: row.segment_type || "work",
    isOvernight: Boolean(row.is_overnight),
    paid: Boolean(row.paid),
  };
}

export function mapShiftDefinition(row: any, segments: ShiftSegment[] = []): ShiftDefinition {
  return {
    id: row.id,
    companyId: row.company_id ?? undefined,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en || row.name_ar,
    color: row.color || "#0284c7",
    type: row.type || "fixed",
    startTime: (row.start_time || "").substring(0, 5),
    endTime: (row.end_time || "").substring(0, 5),
    flexibleHours: row.flexible_hours != null ? Number(row.flexible_hours) : undefined,
    splitSecondStartTime: row.split_second_start_time ? row.split_second_start_time.substring(0, 5) : undefined,
    splitSecondEndTime: row.split_second_end_time ? row.split_second_end_time.substring(0, 5) : undefined,
    graceMinutesArrival: Number(row.grace_minutes_arrival ?? 15),
    graceMinutesDeparture: Number(row.grace_minutes_departure ?? 15),
    allowSinglePunch: Boolean(row.allow_single_punch),
    overtimeEligible: Boolean(row.overtime_eligible),
    version: Number(row.version ?? 1),
    status: row.status || "active",
    effectiveFrom: row.effective_from || undefined,
    effectiveTo: row.effective_to || undefined,
    breakType: row.break_type || "none",
    autoDeductBreaks: Boolean(row.auto_deduct_breaks),
    minRestHoursAfter: row.min_rest_hours_after != null ? Number(row.min_rest_hours_after) : 11,
    createdBy: row.created_by || undefined,
    segments: segments.length > 0 ? segments : undefined,
  };
}

export function mapRosterPeriod(row: any): RosterPeriod {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    startDate: row.period_start || row.start_date || "",
    endDate: row.period_end || row.end_date || "",
    timezone: row.timezone || "Asia/Riyadh",
    status: row.status || "draft",
    version: Number(row.version ?? 1),
    publishedAt: row.published_at || null,
    publishedBy: row.published_by || null,
    lockedAt: row.locked_at || null,
    createdBy: row.created_by || null,
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapScheduleAssignment(row: any): ScheduleAssignment {
  return {
    id: row.id,
    companyId: row.company_id ?? undefined,
    employeeId: row.employee_id,
    rosterPeriodId: row.roster_period_id ?? undefined,
    rosterVersion: Number(row.roster_version ?? 1),
    date: row.work_date || row.date || "",
    shiftId: row.shift_id,
    shiftVersion: Number(row.shift_version ?? 1),
    shiftNameAr: row.shift_name_ar || "",
    shiftColor: row.shift_color || "#0284c7",
    workLocationId: row.work_location_id ?? null,
    isRestDay: Boolean(row.is_rest_day),
    status: row.status || "draft",
    source: row.source || "direct",
    createdBy: row.created_by || undefined,
    publishedAt: row.published_at || undefined,
    notes: row.notes || undefined,
  };
}

export function mapRosterException(row: any): RosterException {
  return {
    id: row.id,
    companyId: row.company_id,
    rosterPeriodId: row.roster_period_id,
    assignmentId: row.assignment_id ?? null,
    employeeId: row.employee_id ?? null,
    exceptionType: row.exception_type,
    severity: row.severity,
    message: row.message,
    conflictDetails: row.conflict_details || {},
    resolved: Boolean(row.resolved),
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
  };
}

export function mapShiftSwapRequest(row: any): ShiftSwapRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    requesterId: row.requester_id,
    requesterAssignmentId: row.requester_assignment_id,
    targetEmployeeId: row.target_employee_id,
    targetAssignmentId: row.target_assignment_id,
    reason: row.reason || null,
    status: row.status,
    approvedBy: row.approved_by || null,
    approvalNotes: row.approval_notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requesterName: row.requester
      ? `${row.requester.first_name_ar || ""} ${row.requester.last_name_ar || ""}`.trim()
      : undefined,
    targetEmployeeName: row.target
      ? `${row.target.first_name_ar || ""} ${row.target.last_name_ar || ""}`.trim()
      : undefined,
    requesterDate: row.requester_assignment?.work_date || row.requester_assignment?.date,
    targetDate: row.target_assignment?.work_date || row.target_assignment?.date,
    requesterShiftName: row.requester_assignment?.shift_name_ar,
    targetShiftName: row.target_assignment?.shift_name_ar,
  };
}

export function mapRosterTemplate(row: any): RosterTemplate {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description || undefined,
    patternType: row.pattern_type || "weekly",
    cycleDays: Number(row.cycle_days ?? 7),
    templateData: row.template_data || {},
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRotationPattern(row: any): RotationPattern {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    cycleDays: Number(row.cycle_days ?? 7),
    patternSequence: row.pattern_sequence || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRosterCoverageRequirement(row: any): RosterCoverageRequirement {
  return {
    id: row.id,
    companyId: row.company_id,
    rosterPeriodId: row.roster_period_id,
    departmentId: row.department_id ?? null,
    shiftId: row.shift_id ?? null,
    dayOfWeek: Number(row.day_of_week ?? 0),
    minStaff: Number(row.min_staff ?? 1),
    maxStaff: row.max_staff != null ? Number(row.max_staff) : null,
    createdAt: row.created_at,
  };
}

// ----------------------------------------------------------------------------
// Shift Master Repository Functions
// ----------------------------------------------------------------------------

export async function fetchShiftDefinitions(companyId?: string): Promise<ShiftDefinition[]> {
  let query = db
    .from("shifts")
    .select(`
      *,
      shift_segments (*)
    `)
    .order("code", { ascending: true });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر تحميل تعريفات الورديات");

  return ((data as any[]) || []).map((row) => {
    const rawSegments = row.shift_segments || [];
    const segments = rawSegments.map(mapShiftSegment);
    return mapShiftDefinition(row, segments);
  });
}

export async function fetchShiftDefinitionById(id: string): Promise<ShiftDefinition> {
  const { data, error } = await db
    .from("shifts")
    .select(`
      *,
      shift_segments (*)
    `)
    .eq("id", id)
    .single();

  if (error) throw mapError(error, "تعذر تحميل بيانات الوردية المطلوبة");
  const rawSegments = data.shift_segments || [];
  const segments = rawSegments.map(mapShiftSegment);
  return mapShiftDefinition(data, segments);
}

export async function generateShiftCode(companyId?: string): Promise<string> {
  const { data, error } = await db.rpc("generate_shift_code", {
    p_company_id: companyId || null,
  });

  if (error) throw mapError(error, "تعذر توليد كود الوردية الجديد");
  return data as string;
}

export async function createShiftDefinition(
  payload: Partial<ShiftDefinition>,
): Promise<ShiftDefinition> {
  const rpcPayload: Record<string, any> = {
    company_id: payload.companyId || null,
    code: payload.code || null,
    name_ar: payload.nameAr,
    name_en: payload.nameEn || payload.nameAr,
    color: payload.color || "#0284c7",
    type: payload.type || "fixed",
    start_time: payload.startTime,
    end_time: payload.endTime,
    flexible_hours: payload.flexibleHours ?? null,
    split_second_start_time: payload.splitSecondStartTime ?? null,
    split_second_end_time: payload.splitSecondEndTime ?? null,
    grace_minutes_arrival: payload.graceMinutesArrival ?? 15,
    grace_minutes_departure: payload.graceMinutesDeparture ?? 15,
    allow_single_punch: Boolean(payload.allowSinglePunch),
    overtime_eligible: Boolean(payload.overtimeEligible),
    effective_from: payload.effectiveFrom || null,
    effective_to: payload.effectiveTo || null,
    break_type: payload.breakType || "none",
    auto_deduct_breaks: Boolean(payload.autoDeductBreaks),
    min_rest_hours_after: payload.minRestHoursAfter ?? 11,
    segments: (payload.segments || []).map((seg, idx) => ({
      segment_order: seg.segmentOrder ?? idx + 1,
      start_time: seg.startTime,
      end_time: seg.endTime,
      segment_type: seg.segmentType || "work",
      is_overnight: Boolean(seg.isOvernight),
      paid: Boolean(seg.paid),
    })),
  };

  const { data, error } = await db.rpc("create_shift_definition", {
    p_payload: rpcPayload,
  });

  if (error) throw mapError(error, "تعذر إنشاء تعريف الوردية");
  return fetchShiftDefinitionById(data);
}

export async function updateShiftDefinition(
  shiftId: string,
  payload: Partial<ShiftDefinition>,
): Promise<ShiftDefinition> {
  const rpcPayload: Record<string, any> = {
    name_ar: payload.nameAr,
    name_en: payload.nameEn,
    color: payload.color,
    type: payload.type,
    start_time: payload.startTime,
    end_time: payload.endTime,
    flexible_hours: payload.flexibleHours ?? null,
    split_second_start_time: payload.splitSecondStartTime ?? null,
    split_second_end_time: payload.splitSecondEndTime ?? null,
    grace_minutes_arrival: payload.graceMinutesArrival,
    grace_minutes_departure: payload.graceMinutesDeparture,
    allow_single_punch: payload.allowSinglePunch,
    overtime_eligible: payload.overtimeEligible,
    effective_from: payload.effectiveFrom ?? null,
    effective_to: payload.effectiveTo ?? null,
    break_type: payload.breakType,
    auto_deduct_breaks: payload.autoDeductBreaks,
    min_rest_hours_after: payload.minRestHoursAfter,
    segments: payload.segments
      ? payload.segments.map((seg, idx) => ({
          segment_order: seg.segmentOrder ?? idx + 1,
          start_time: seg.startTime,
          end_time: seg.endTime,
          segment_type: seg.segmentType || "work",
          is_overnight: Boolean(seg.isOvernight),
          paid: Boolean(seg.paid),
        }))
      : undefined,
  };

  const { data, error } = await db.rpc("update_shift_definition", {
    p_shift_id: shiftId,
    p_payload: rpcPayload,
  });

  if (error) throw mapError(error, "تعذر تحديث تعريف الوردية");
  return fetchShiftDefinitionById(data);
}

export async function archiveShiftDefinition(shiftId: string): Promise<boolean> {
  const { data, error } = await db.rpc("archive_shift_definition", {
    p_shift_id: shiftId,
  });

  if (error) throw mapError(error, "تعذر أرشفة تعريف الوردية");
  return Boolean(data);
}

// ----------------------------------------------------------------------------
// Roster Periods Repository Functions
// ----------------------------------------------------------------------------

export async function fetchRosterPeriods(
  companyId?: string,
  status?: string,
): Promise<RosterPeriod[]> {
  let query = db
    .from("roster_periods")
    .select("*")
    .order("period_start", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر تحميل فترات الجدولة");
  return ((data as any[]) || []).map(mapRosterPeriod);
}

export async function fetchRosterPeriodById(id: string): Promise<RosterPeriod> {
  const { data, error } = await db
    .from("roster_periods")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw mapError(error, "تعذر تحميل بيانات فترة الجدولة");
  return mapRosterPeriod(data);
}

export async function createRosterPeriod(
  period: Partial<RosterPeriod>,
): Promise<RosterPeriod> {
  const payload = {
    company_id: period.companyId,
    name: period.name,
    period_start: period.startDate,
    period_end: period.endDate,
    timezone: period.timezone || "Asia/Riyadh",
    status: period.status || "draft",
    notes: period.notes || null,
  };

  const { data, error } = await db
    .from("roster_periods")
    .insert(payload)
    .select()
    .single();

  if (error) throw mapError(error, "تعذر إنشاء فترة جدولة جديدة");
  return mapRosterPeriod(data);
}

export async function updateRosterPeriod(
  id: string,
  updates: Partial<RosterPeriod>,
): Promise<RosterPeriod> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.startDate !== undefined) payload.period_start = updates.startDate;
  if (updates.endDate !== undefined) payload.period_end = updates.endDate;
  if (updates.timezone !== undefined) payload.timezone = updates.timezone;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.notes !== undefined) payload.notes = updates.notes;

  const { data, error } = await db
    .from("roster_periods")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw mapError(error, "تعذر تحديث فترة الجدولة");
  return mapRosterPeriod(data);
}

// ----------------------------------------------------------------------------
// Schedule Assignments Repository Functions
// ----------------------------------------------------------------------------

export async function fetchScheduleAssignments(
  rosterPeriodId?: string,
  filters?: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    companyId?: string;
    status?: "draft" | "published";
  },
): Promise<ScheduleAssignment[]> {
  let query = db.from("schedule_assignments").select("*");

  if (rosterPeriodId) {
    query = query.eq("roster_period_id", rosterPeriodId);
  }
  if (filters?.companyId) {
    query = query.eq("company_id", filters.companyId);
  }
  if (filters?.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }
  if (filters?.startDate) {
    query = query.gte("work_date", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("work_date", filters.endDate);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  query = query.order("work_date", { ascending: true });

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر تحميل إسنادات الورديات");
  return ((data as any[]) || []).map(mapScheduleAssignment);
}

export async function upsertScheduleAssignment(
  assignment: Partial<ScheduleAssignment>,
): Promise<ScheduleAssignment> {
  const payload: Record<string, any> = {
    employee_id: assignment.employeeId,
    work_date: assignment.date,
    shift_id: assignment.shiftId,
    shift_name_ar: assignment.shiftNameAr,
    shift_color: assignment.shiftColor,
    is_rest_day: Boolean(assignment.isRestDay),
    status: assignment.status || "draft",
    roster_version: assignment.rosterVersion ?? 1,
    shift_version: assignment.shiftVersion ?? 1,
  };

  if (assignment.companyId) payload.company_id = assignment.companyId;
  if (assignment.rosterPeriodId) payload.roster_period_id = assignment.rosterPeriodId;
  if (assignment.workLocationId !== undefined) payload.work_location_id = assignment.workLocationId;
  if (assignment.source) payload.source = assignment.source;
  if (assignment.notes !== undefined) payload.notes = assignment.notes;

  const { data, error } = await db
    .from("schedule_assignments")
    .upsert(payload, {
      onConflict: "employee_id,work_date,roster_version",
    })
    .select()
    .single();

  if (error) throw mapError(error, "تعذر حفظ إسناد الوردية");
  return mapScheduleAssignment(data);
}

export async function batchUpsertScheduleAssignments(
  assignments: Partial<ScheduleAssignment>[],
): Promise<void> {
  if (assignments.length === 0) return;

  const rows = assignments.map((a) => ({
    company_id: a.companyId,
    employee_id: a.employeeId,
    roster_period_id: a.rosterPeriodId,
    roster_version: a.rosterVersion ?? 1,
    work_date: a.date,
    shift_id: a.shiftId,
    shift_version: a.shiftVersion ?? 1,
    shift_name_ar: a.shiftNameAr,
    shift_color: a.shiftColor,
    work_location_id: a.workLocationId ?? null,
    is_rest_day: Boolean(a.isRestDay),
    status: a.status || "draft",
    source: a.source || "direct",
    notes: a.notes ?? null,
  }));

  const { error } = await db.from("schedule_assignments").upsert(rows, {
    onConflict: "employee_id,work_date,roster_version",
  });

  if (error) throw mapError(error, "تعذر حفظ حزمة إسنادات الورديات");
}

export async function deleteScheduleAssignment(id: string): Promise<void> {
  const { error } = await db.from("schedule_assignments").delete().eq("id", id);
  if (error) throw mapError(error, "تعذر حذف إسناد الوردية");
}

// ----------------------------------------------------------------------------
// Conflict Detection & Atomic Publishing
// ----------------------------------------------------------------------------

export interface ConflictDetectionResult {
  ok: boolean;
  conflictCount: number;
  errorsCount: number;
  warningsCount: number;
  exceptions: RosterException[];
}

export async function detectRosterConflicts(
  rosterPeriodId: string,
): Promise<ConflictDetectionResult> {
  const { data, error } = await db.rpc("detect_roster_conflicts", {
    p_roster_id: rosterPeriodId,
  });

  if (error) throw mapError(error, "تعذر فحص تعارضات الجدول");
  const res = data as any;
  const rawExceptions = res?.exceptions || [];
  return {
    ok: Boolean(res?.ok),
    conflictCount: Number(res?.conflict_count ?? 0),
    errorsCount: Number(res?.errors_count ?? 0),
    warningsCount: Number(res?.warnings_count ?? 0),
    exceptions: rawExceptions.map(mapRosterException),
  };
}

export interface PublishRosterResult {
  ok: boolean;
  publishedAssignments: number;
  rosterVersion: number;
  message: string;
}

export async function publishRosterPeriod(
  rosterPeriodId: string,
): Promise<PublishRosterResult> {
  const { data, error } = await db.rpc("publish_roster", {
    p_roster_id: rosterPeriodId,
  });

  if (error) throw mapError(error, "تعذر نشر جدول الورديات");
  const res = data as any;
  return {
    ok: Boolean(res?.ok),
    publishedAssignments: Number(res?.published_assignments ?? 0),
    rosterVersion: Number(res?.roster_version ?? 1),
    message: String(res?.message || ""),
  };
}

export async function copyRosterPeriod(
  sourcePeriodId: string,
  newStartDate: string,
  newEndDate: string,
  newName?: string,
): Promise<{ ok: boolean; newRosterPeriodId: string; copiedAssignmentsCount: number }> {
  const { data, error } = await db.rpc("copy_roster_period", {
    p_source_period_id: sourcePeriodId,
    p_target_start: newStartDate,
    p_target_end: newEndDate,
    p_name: newName || null,
  });

  if (error) throw mapError(error, "تعذر نسخ فترة الجدولة");
  const res = data as any;
  return {
    ok: Boolean(res?.ok),
    newRosterPeriodId: res?.new_roster_period_id,
    copiedAssignmentsCount: Number(res?.copied_assignments_count ?? 0),
  };
}

// ----------------------------------------------------------------------------
// Roster Exceptions
// ----------------------------------------------------------------------------

export async function fetchRosterExceptions(
  rosterPeriodId?: string,
  unresolvedOnly: boolean = false,
): Promise<RosterException[]> {
  let query = db.from("roster_exceptions").select("*");

  if (rosterPeriodId) {
    query = query.eq("roster_period_id", rosterPeriodId);
  }
  if (unresolvedOnly) {
    query = query.eq("resolved", false);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر تحميل تعارضات الجدول");
  return ((data as any[]) || []).map(mapRosterException);
}

export async function resolveRosterException(exceptionId: string): Promise<void> {
  const { error } = await db
    .from("roster_exceptions")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", exceptionId);

  if (error) throw mapError(error, "تعذر تحديث حالة التعارض");
}

// ----------------------------------------------------------------------------
// Shift Swap Requests
// ----------------------------------------------------------------------------

export async function fetchShiftSwapRequests(
  companyId?: string,
  filters?: { status?: string; employeeId?: string },
): Promise<ShiftSwapRequest[]> {
  let query = db.from("shift_swap_requests").select(`
    *,
    requester:requester_employee_id (first_name_ar, last_name_ar),
    target:target_employee_id (first_name_ar, last_name_ar),
    requester_assignment:requester_assignment_id (work_date, shift_name_ar),
    target_assignment:target_assignment_id (work_date, shift_name_ar)
  `);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.employeeId) {
    query = query.or(`requester_employee_id.eq.${filters.employeeId},target_employee_id.eq.${filters.employeeId}`);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر تحميل طلبات تبديل الورديات");
  return ((data as any[]) || []).map(mapShiftSwapRequest);
}

export async function createShiftSwapRequest(
  payload: Partial<ShiftSwapRequest>,
): Promise<ShiftSwapRequest> {
  const { data, error } = await db
    .from("shift_swap_requests")
    .insert({
      company_id: payload.companyId,
      requester_employee_id: payload.requesterId,
      requester_assignment_id: payload.requesterAssignmentId,
      target_employee_id: payload.targetEmployeeId,
      target_assignment_id: payload.targetAssignmentId,
      reason: payload.reason || "طلب تبديل وردية",
      status: "pending_approval",
    })
    .select()
    .single();

  if (error) throw mapError(error, "تعذر إنشاء طلب تبديل الوردية");
  return mapShiftSwapRequest(data);
}

export async function approveShiftSwap(
  swapRequestId: string,
  notes?: string,
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await db.rpc("approve_shift_swap", {
    p_swap_request_id: swapRequestId,
    p_notes: notes || null,
  });

  if (error) throw mapError(error, "تعذر اعتماد طلب تبديل الوردية");
  const res = data as any;
  return {
    ok: Boolean(res?.ok),
    message: String(res?.message || ""),
  };
}

export async function rejectShiftSwap(
  swapRequestId: string,
  notes?: string,
): Promise<void> {
  const { error } = await db
    .from("shift_swap_requests")
    .update({
      status: "rejected",
      review_notes: notes || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", swapRequestId);

  if (error) throw mapError(error, "تعذر رفض طلب تبديل الوردية");
}

// ----------------------------------------------------------------------------
// Workweek Configuration (companies.workweek_config)
// ----------------------------------------------------------------------------

export const DEFAULT_WORKWEEK_CONFIG: WorkweekConfig = {
  weekendDays: [5, 6], // Friday & Saturday
  maxConsecutiveWorkDays: 6,
  minWeeklyRestHours: 24,
  defaultDailyHours: 8,
};

export async function fetchCompanyWorkweek(companyId?: string): Promise<WorkweekConfig> {
  if (!companyId) return DEFAULT_WORKWEEK_CONFIG;

  const { data, error } = await db
    .from("companies")
    .select("workweek_config")
    .eq("id", companyId)
    .single();

  if (error || !data?.workweek_config) {
    return DEFAULT_WORKWEEK_CONFIG;
  }

  const cfg = data.workweek_config as any;
  return {
    weekendDays: Array.isArray(cfg.weekendDays) ? cfg.weekendDays : DEFAULT_WORKWEEK_CONFIG.weekendDays,
    maxConsecutiveWorkDays: Number(cfg.maxConsecutiveWorkDays ?? DEFAULT_WORKWEEK_CONFIG.maxConsecutiveWorkDays),
    minWeeklyRestHours: Number(cfg.minWeeklyRestHours ?? DEFAULT_WORKWEEK_CONFIG.minWeeklyRestHours),
    defaultDailyHours: Number(cfg.defaultDailyHours ?? DEFAULT_WORKWEEK_CONFIG.defaultDailyHours),
  };
}

export async function updateCompanyWorkweek(
  companyId: string,
  config: WorkweekConfig,
): Promise<void> {
  const { error } = await db
    .from("companies")
    .update({
      workweek_config: config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  if (error) throw mapError(error, "تعذر تحديث إعدادات أسبوع العمل");
}

// ----------------------------------------------------------------------------
// Templates & Rotation Patterns
// ----------------------------------------------------------------------------

export async function fetchRosterTemplates(companyId?: string): Promise<RosterTemplate[]> {
  let query = db.from("roster_templates").select("*").order("name");
  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر استرجاع قوالب الجداول");
  return ((data as any[]) || []).map(mapRosterTemplate);
}

export async function fetchRotationPatterns(companyId?: string): Promise<RotationPattern[]> {
  let query = db.from("rotation_patterns").select("*").order("name");
  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر استرجاع نماذج الدوران");
  return ((data as any[]) || []).map(mapRotationPattern);
}
