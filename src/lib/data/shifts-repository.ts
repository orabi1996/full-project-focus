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
  EffectivePublishedSchedule,
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
    type: row.type,
    startTime: (row.start_time || "").substring(0, 5),
    endTime: (row.end_time || "").substring(0, 5),
    flexibleHours: row.flexible_hours != null ? Number(row.flexible_hours) : undefined,
    splitSecondStartTime: row.split_second_start_time ? row.split_second_start_time.substring(0, 5) : undefined,
    splitSecondEndTime: row.split_second_end_time ? row.split_second_end_time.substring(0, 5) : undefined,
    graceMinutesArrival: row.grace_minutes_arrival != null ? Number(row.grace_minutes_arrival) : 0,
    graceMinutesDeparture: row.grace_minutes_departure != null ? Number(row.grace_minutes_departure) : 0,
    allowSinglePunch: Boolean(row.allow_single_punch),
    overtimeEligible: Boolean(row.overtime_eligible),
    version: Number(row.version ?? 1),
    status: row.status || "active",
    effectiveFrom: row.effective_from || undefined,
    effectiveTo: row.effective_to || undefined,
    breakType: row.break_type || "unpaid",
    autoDeductBreaks: Boolean(row.auto_deduct_breaks),
    minRestHoursAfter: row.min_rest_hours_after != null ? Number(row.min_rest_hours_after) : undefined,
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
    timezone: row.timezone || "",
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
  const reqId = row.requester_employee_id || row.requester_id || "";
  const revBy = row.reviewed_by || row.approved_by || null;
  const revNotes = row.review_notes || row.approval_notes || null;
  return {
    id: row.id,
    companyId: row.company_id,
    requesterId: reqId,
    requesterEmployeeId: reqId,
    requesterAssignmentId: row.requester_assignment_id,
    targetEmployeeId: row.target_employee_id,
    targetAssignmentId: row.target_assignment_id,
    reason: row.reason || null,
    status: row.status,
    reviewedBy: revBy,
    approvedBy: revBy,
    reviewNotes: revNotes,
    approvalNotes: revNotes,
    reviewedAt: row.reviewed_at || null,
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
  const tType = row.template_type || row.pattern_type || "weekly";
  const pat = row.pattern || row.template_data || {};
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description || undefined,
    templateType: tType,
    patternType: tType,
    cycleDays: Number(row.cycle_days ?? 7),
    pattern: pat,
    templateData: pat,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRotationPattern(row: any): RotationPattern {
  const pat = row.pattern || row.pattern_sequence || [];
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description || undefined,
    cycleDays: Number(row.cycle_days ?? 7),
    pattern: pat,
    patternSequence: pat,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRosterCoverageRequirement(row: any): RosterCoverageRequirement {
  const minCount = Number(row.min_headcount ?? row.min_staff ?? 1);
  return {
    id: row.id,
    companyId: row.company_id,
    rosterPeriodId: row.roster_period_id ?? undefined,
    name: row.name || "معيار التغطية",
    workLocationId: row.work_location_id ?? null,
    departmentId: row.department_id ?? null,
    jobPositionId: row.job_position_id ?? null,
    shiftId: row.shift_id ?? null,
    dayOfWeek: row.day_of_week != null ? Number(row.day_of_week) : null,
    minHeadcount: minCount,
    minStaff: minCount,
    maxStaff: row.max_staff != null ? Number(row.max_staff) : null,
    isMandatory: Boolean(row.is_mandatory),
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
    type: payload.type,
    start_time: payload.startTime,
    end_time: payload.endTime,
    flexible_hours: payload.flexibleHours ?? null,
    split_second_start_time: payload.splitSecondStartTime ?? null,
    split_second_end_time: payload.splitSecondEndTime ?? null,
    grace_minutes_arrival: payload.graceMinutesArrival ?? 0,
    grace_minutes_departure: payload.graceMinutesDeparture ?? 0,
    allow_single_punch: Boolean(payload.allowSinglePunch),
    overtime_eligible: Boolean(payload.overtimeEligible),
    effective_from: payload.effectiveFrom || null,
    effective_to: payload.effectiveTo || null,
    break_type: payload.breakType || null,
    auto_deduct_breaks: payload.autoDeductBreaks != null ? Boolean(payload.autoDeductBreaks) : null,
    min_rest_hours_after: payload.minRestHoursAfter ?? null,
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
  const shiftId = typeof data === "object" && data !== null ? data.id : String(data);
  return fetchShiftDefinitionById(shiftId);
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
  const updatedId = typeof data === "object" && data !== null ? data.id : String(data);
  return fetchShiftDefinitionById(updatedId);
}

export async function archiveShiftDefinition(shiftId: string): Promise<boolean> {
  const { data, error } = await db.rpc("archive_shift_definition", {
    p_shift_id: shiftId,
  });

  if (error) throw mapError(error, "تعذر أرشفة تعريف الوردية");
  const res = data as any;
  return Boolean(res?.ok && res?.status === "archived");
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
    startDate: period.startDate,
    endDate: period.endDate,
    timezone: period.timezone,
    notes: period.notes || null,
  };

  const { data, error } = await db.rpc("create_roster_period", {
    p_payload: payload,
  });

  if (error) throw mapError(error, "تعذر إنشاء فترة جدولة جديدة");
  const createdId = typeof data === "object" && data !== null ? data.id : String(data);
  return fetchRosterPeriodById(createdId);
}

export async function updateRosterPeriod(
  id: string,
  updates: Partial<RosterPeriod>,
): Promise<RosterPeriod> {
  const { error } = await db.rpc("update_roster_period", {
    p_roster_id: id,
    p_payload: updates,
  });

  if (error) throw mapError(error, "تعذر تحديث فترة الجدولة");
  return fetchRosterPeriodById(id);
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
  const payload = {
    company_id: assignment.companyId,
    roster_period_id: assignment.rosterPeriodId,
    employee_id: assignment.employeeId,
    work_date: assignment.date,
    shift_id: assignment.shiftId,
    is_rest_day: Boolean(assignment.isRestDay),
    work_location_id: assignment.workLocationId ?? null,
    source: assignment.source || "manual",
    notes: assignment.notes ?? null,
  };

  const { data, error } = await db.rpc("set_roster_assignment", {
    p_payload: payload,
  });

  if (error) throw mapError(error, "تعذر حفظ إسناد الوردية");
  const asgId = typeof data === "object" && data !== null ? data.id : String(data);
  const { data: asgRow, error: fetchErr } = await db
    .from("schedule_assignments")
    .select("*")
    .eq("id", asgId)
    .single();
  if (fetchErr || !asgRow) {
    return mapScheduleAssignment({ ...payload, id: asgId, status: "draft" });
  }
  return mapScheduleAssignment(asgRow);
}

export async function batchUpsertScheduleAssignments(
  assignments: Partial<ScheduleAssignment>[],
): Promise<void> {
  for (const a of assignments) {
    await upsertScheduleAssignment(a);
  }
}

export async function deleteScheduleAssignment(id: string): Promise<void> {
  const { error } = await db.rpc("delete_roster_assignment", {
    p_assignment_id: id,
  });
  if (error) throw mapError(error, "تعذر حذف إسناد الوردية");
}

export async function createRosterAmendment(
  rosterPeriodId: string,
  reason?: string,
): Promise<{ ok: boolean; newRosterPeriodId: string; newVersion: number; message: string }> {
  const { data, error } = await db.rpc("create_roster_amendment", {
    p_roster_period_id: rosterPeriodId,
    p_reason: reason || "ملحق تعديل رسمي لجدول العمل",
  });

  if (error) throw mapError(error, "تعذر إنشاء ملحق تعديل لجدول العمل");
  const res = data as any;
  return {
    ok: Boolean(res?.ok),
    newRosterPeriodId: String(res?.new_roster_period_id || ""),
    newVersion: Number(res?.new_version ?? 1),
    message: String(res?.message || "تم إنشاء مسودة ملحق التعديل بنجاح"),
  };
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

export async function resolveRosterException(
  exceptionId: string,
  resolutionNote?: string,
): Promise<void> {
  const { error } = await db.rpc("resolve_roster_exception", {
    p_exception_id: exceptionId,
    p_resolution_note: resolutionNote || "تمت معالجة التعارض واعتماده",
  });

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
  const reqEmpId = payload.requesterEmployeeId || payload.requesterId;
  const { data, error } = await db.rpc("create_shift_swap_request", {
    p_requester_assignment_id: payload.requesterAssignmentId,
    p_target_employee_id: payload.targetEmployeeId,
    p_target_assignment_id: payload.targetAssignmentId,
    p_reason: payload.reason || "طلب تبديل وردية",
    p_requester_employee_id: reqEmpId || null,
  });

  if (error) {
    // Fallback if RPC is not found in schema cache
    const insertRes = await db
      .from("shift_swap_requests")
      .insert({
        company_id: payload.companyId,
        requester_employee_id: reqEmpId,
        requester_assignment_id: payload.requesterAssignmentId,
        target_employee_id: payload.targetEmployeeId,
        target_assignment_id: payload.targetAssignmentId,
        reason: payload.reason || "طلب تبديل وردية",
        status: "pending_approval",
      })
      .select()
      .single();

    if (insertRes.error) throw mapError(insertRes.error, "تعذر إنشاء طلب تبديل الوردية");
    return mapShiftSwapRequest(insertRes.data);
  }

  const res = data as any;
  const swapId = res?.swap_request_id;
  if (swapId) {
    const { data: row } = await db
      .from("shift_swap_requests")
      .select("*")
      .eq("id", swapId)
      .single();
    if (row) return mapShiftSwapRequest(row);
  }

  return {
    id: swapId || `swap-${Date.now()}`,
    companyId: payload.companyId || "",
    requesterId: reqEmpId || "",
    requesterEmployeeId: reqEmpId,
    requesterAssignmentId: payload.requesterAssignmentId || "",
    targetEmployeeId: payload.targetEmployeeId || "",
    targetAssignmentId: payload.targetAssignmentId || "",
    status: "pending_approval",
    reason: payload.reason,
  } as ShiftSwapRequest;
}

export async function approveShiftSwap(
  swapRequestId: string,
  _notes?: string,
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await db.rpc("approve_shift_swap", {
    p_swap_request_id: swapRequestId,
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
  const { error } = await db.rpc("reject_shift_swap", {
    p_swap_request_id: swapRequestId,
    p_rejection_reason: notes || "تم رفض طلب التبادل",
  });

  if (error) throw mapError(error, "تعذر رفض طلب تبديل الوردية");
}

// ----------------------------------------------------------------------------
// Workweek Configuration (companies.workweek_config)
// ----------------------------------------------------------------------------

export async function fetchCompanyWorkweek(companyId?: string): Promise<WorkweekConfig | null> {
  if (!companyId) return null;

  const { data, error } = await db
    .from("companies")
    .select("workweek_config")
    .eq("id", companyId)
    .single();

  if (error || !data?.workweek_config) {
    return null;
  }

  const cfg = data.workweek_config as any;
  const rawWeekends = Array.isArray(cfg.weekendDays)
    ? cfg.weekendDays
    : Array.isArray(cfg.weekend_days)
    ? cfg.weekend_days
    : Array.isArray(cfg.rest_days)
    ? cfg.rest_days
    : [];

  return {
    weekendDays: rawWeekends,
    maxConsecutiveWorkDays: Number(cfg.maxConsecutiveWorkDays ?? cfg.max_consecutive_work_days ?? 0),
    minWeeklyRestHours: Number(cfg.minWeeklyRestHours ?? cfg.min_weekly_rest_hours ?? 0),
    defaultDailyHours: Number(cfg.defaultDailyHours ?? cfg.default_daily_hours ?? 0),
  };
}

export async function updateCompanyWorkweek(
  companyId: string,
  config: WorkweekConfig,
): Promise<void> {
  const { error } = await db.rpc("save_workweek_config", {
    p_company_id: companyId,
    p_config: config,
  });

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

export async function saveRosterTemplate(
  template: Partial<RosterTemplate>,
): Promise<RosterTemplate> {
  const payload: Record<string, any> = {
    company_id: template.companyId,
    name: template.name,
    description: template.description ?? null,
    cycle_days: template.cycleDays ?? 7,
    pattern: template.pattern || template.templateData || {},
  };

  let res;
  if (template.id) {
    res = await db.from("roster_templates").update(payload).eq("id", template.id).select().single();
  } else {
    res = await db.from("roster_templates").insert(payload).select().single();
  }

  if (res.error) throw mapError(res.error, "تعذر حفظ قالب الجدول");
  return mapRosterTemplate(res.data);
}

export async function deleteRosterTemplate(id: string): Promise<void> {
  const { error: rpcError } = await db.rpc("archive_roster_template", {
    p_template_id: id,
  });
  if (rpcError) {
    const { error: updError } = await db.from("roster_templates").update({ is_active: false }).eq("id", id);
    if (updError) {
      const { error: delError } = await db.from("roster_templates").delete().eq("id", id);
      if (delError) throw mapError(delError, "تعذر أرشفة أو حذف قالب الجدول");
    }
  }
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

export async function saveRotationPattern(
  pattern: Partial<RotationPattern>,
): Promise<RotationPattern> {
  const payload: Record<string, any> = {
    company_id: pattern.companyId,
    name: pattern.name,
    description: pattern.description ?? null,
    cycle_days: pattern.cycleDays ?? 7,
    pattern: pattern.pattern || pattern.patternSequence || [],
  };

  let res;
  if (pattern.id) {
    res = await db.from("rotation_patterns").update(payload).eq("id", pattern.id).select().single();
  } else {
    res = await db.from("rotation_patterns").insert(payload).select().single();
  }

  if (res.error) throw mapError(res.error, "تعذر حفظ نموذج الدوران");
  return mapRotationPattern(res.data);
}

export async function deleteRotationPattern(id: string): Promise<void> {
  const { error: rpcError } = await db.rpc("archive_rotation_pattern", {
    p_rotation_id: id,
  });
  if (rpcError) {
    const { error: updError } = await db.from("rotation_patterns").update({ is_active: false }).eq("id", id);
    if (updError) {
      const { error: delError } = await db.from("rotation_patterns").delete().eq("id", id);
      if (delError) throw mapError(delError, "تعذر أرشفة أو حذف نمط التدوير");
    }
  }
}

export async function generateRosterFromTemplate(
  rosterPeriodId: string,
  templateId: string,
  employeeIds: string[],
): Promise<{ ok: boolean; createdCount: number; skippedCount: number; message: string }> {
  const { data, error } = await db.rpc("generate_roster_from_template", {
    p_roster_period_id: rosterPeriodId,
    p_template_id: templateId,
    p_employee_ids: employeeIds,
  });

  if (error) throw mapError(error, "تعذر تطبيق قالب الجدول");
  const res = data as any;
  return {
    ok: Boolean(res?.ok),
    createdCount: Number(res?.created_count ?? 0),
    skippedCount: Number(res?.skipped_count ?? 0),
    message: String(res?.message || ""),
  };
}

// ----------------------------------------------------------------------------
// Roster Coverage Requirements
// ----------------------------------------------------------------------------

export async function fetchRosterCoverageRequirements(
  companyId?: string,
  rosterPeriodId?: string,
): Promise<RosterCoverageRequirement[]> {
  let query = db.from("roster_coverage_requirements").select("*").order("day_of_week");
  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  if (rosterPeriodId) {
    query = query.eq("roster_period_id", rosterPeriodId);
  }
  const { data, error } = await query;
  if (error) throw mapError(error, "تعذر استرجاع معايير تغطية الجدول");
  return ((data as any[]) || []).map(mapRosterCoverageRequirement);
}

export async function saveRosterCoverageRequirement(
  req: Partial<RosterCoverageRequirement>,
): Promise<RosterCoverageRequirement> {
  const payload: Record<string, any> = {
    company_id: req.companyId,
    name: req.name || "معيار تغطية وردية",
    work_location_id: req.workLocationId ?? null,
    department_id: req.departmentId ?? null,
    job_position_id: req.jobPositionId ?? null,
    shift_id: req.shiftId ?? null,
    day_of_week: req.dayOfWeek ?? null,
    min_headcount: req.minHeadcount ?? req.minStaff ?? 1,
    is_mandatory: Boolean(req.isMandatory),
  };

  let res;
  if (req.id) {
    res = await db.from("roster_coverage_requirements").update(payload).eq("id", req.id).select().single();
  } else {
    res = await db.from("roster_coverage_requirements").insert(payload).select().single();
  }

  if (res.error) throw mapError(res.error, "تعذر حفظ معيار التغطية");
  return mapRosterCoverageRequirement(res.data);
}

export async function deleteRosterCoverageRequirement(id: string): Promise<void> {
  const { error } = await db.from("roster_coverage_requirements").delete().eq("id", id);
  if (error) throw mapError(error, "تعذر حذف معيار التغطية");
}

export async function fetchEffectivePublishedSchedule(
  employeeId: string,
  workDate: string,
): Promise<EffectivePublishedSchedule | null> {
  const { data, error } = await db.rpc("get_effective_published_schedule", {
    p_employee_id: employeeId,
    p_work_date: workDate,
  });

  if (!error && data) {
    const d = data as any;
    return {
      assignmentId: d.assignment_id,
      companyId: d.company_id,
      rosterPeriodId: d.roster_period_id,
      rosterVersion: d.roster_version,
      employeeId: d.employee_id,
      workDate: d.work_date,
      shiftId: d.shift_id,
      shiftVersion: d.shift_version,
      isRestDay: d.is_rest_day,
      workLocationId: d.work_location_id,
      shiftCode: d.shift_code,
      shiftNameAr: d.shift_name_ar,
      shiftNameEn: d.shift_name_en,
      startTime: d.start_time,
      endTime: d.end_time,
      graceMinutesArrival: d.grace_minutes_arrival,
      graceMinutesDeparture: d.grace_minutes_departure,
      overtimeEligible: d.overtime_eligible,
      breakType: d.break_type,
      breakMinutes: d.break_minutes,
      isOvernight: d.is_overnight,
      shiftType: d.shift_type,
      flexibleHours: d.flexible_hours,
    };
  }

  // Fallback to view
  const { data: viewData, error: viewError } = await db
    .from("vw_effective_published_schedules")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (viewError || !viewData) return null;
  const v = viewData as any;
  return {
    assignmentId: v.assignment_id,
    companyId: v.company_id,
    rosterPeriodId: v.roster_period_id,
    rosterVersion: v.roster_version,
    employeeId: v.employee_id,
    workDate: v.work_date,
    shiftId: v.shift_id,
    shiftVersion: v.shift_version,
    isRestDay: v.is_rest_day,
    workLocationId: v.work_location_id,
    shiftCode: v.shift_code,
    shiftNameAr: v.shift_name_ar,
    shiftNameEn: v.shift_name_en,
    startTime: v.start_time,
    endTime: v.end_time,
    graceMinutesArrival: v.grace_minutes_arrival,
    graceMinutesDeparture: v.grace_minutes_departure,
    overtimeEligible: v.overtime_eligible,
    breakType: v.break_type,
    breakMinutes: v.break_minutes,
    isOvernight: v.is_overnight,
    shiftType: v.shift_type,
    flexibleHours: v.flexible_hours,
  };
}
