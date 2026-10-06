import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useBootstrapData } from "../domains/bootstrap/use-bootstrap";
import { taskQueryKeys } from "../query/tasks-query-keys";

const db = supabase as any;

export type TaskCategory =
  | "approvals"
  | "compliance"
  | "payroll"
  | "onboarding"
  | "offboarding"
  | "incident"
  | "audit_review"
  | "general";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "escalated"
  | "overdue"
  | "cancelled";

export interface OperationalTask {
  id: string;
  companyId: string;
  taskNumber: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assignedToUserId?: string;
  assignedToRole?: string;
  dueDate: string;
  workflowInstanceId?: string;
  entityType: string;
  entityId: string;
  slaPolicyId?: string;
  slaWarningAt?: string;
  slaBreachAt?: string;
  isSlaBreached: boolean;
  breachedAt?: string;
  claimedAt?: string;
  claimedBy?: string;
  completedAt?: string;
  completedBy?: string;
  escalationLevel: number;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlaPolicy {
  id: string;
  companyId: string;
  nameAr: string;
  nameEn: string;
  entityType: string;
  priority: TaskPriority;
  responseTimeHours: number;
  resolutionTimeHours: number;
  warningThresholdPct: number;
  escalationRole: string;
  escalationUserId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEscalation {
  id: string;
  taskId: string;
  fromUserId?: string;
  toUserId?: string;
  toRole?: string;
  escalationLevel: number;
  reason: string;
  escalatedAt: string;
}

export interface SlaEvent {
  id: string;
  taskId: string;
  eventType: "started" | "warning_reached" | "breached" | "resolved" | "escalated";
  details: Record<string, unknown>;
  triggeredAt: string;
}

export const TASK_CATEGORY_LABELS: Record<TaskCategory, { ar: string; en: string }> = {
  approvals: { ar: "اعتماد إداري", en: "Administrative Approval" },
  compliance: { ar: "امتثال قانوني وحكومي", en: "Compliance & Government" },
  payroll: { ar: "مراجعة رواتب وبنوك", en: "Payroll Review" },
  onboarding: { ar: "تأهيل موظف جديد", en: "Onboarding" },
  offboarding: { ar: "مخالصة نهاية خدمة", en: "Offboarding" },
  incident: { ar: "معالجة بلاغ أو خلل", en: "Incident" },
  audit_review: { ar: "مراجعة تدقيق", en: "Audit Review" },
  general: { ar: "مهمة تشغيلية عامة", en: "General Operational" },
};

// ============================================================================
// DEMO FALLBACK DATA
// ============================================================================
const DEMO_SLA_POLICIES: SlaPolicy[] = [
  {
    id: "sla-01",
    companyId: "demo-company",
    nameAr: "سياسة اعتماد الإجازات والطلبات العادية",
    nameEn: "Standard Leave Approvals SLA",
    entityType: "leave_request",
    priority: "medium",
    responseTimeHours: 4,
    resolutionTimeHours: 24,
    warningThresholdPct: 75,
    escalationRole: "line_manager",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sla-02",
    companyId: "demo-company",
    nameAr: "سياسة اعتماد مسير الرواتب الشهري",
    nameEn: "Monthly Payroll Run SLA",
    entityType: "payroll_run",
    priority: "urgent",
    responseTimeHours: 2,
    resolutionTimeHours: 8,
    warningThresholdPct: 80,
    escalationRole: "finance_officer",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sla-03",
    companyId: "demo-company",
    nameAr: "سياسة فحص وثائق الموظفين المنتهية",
    nameEn: "Expired Document Renewal SLA",
    entityType: "document_renewal",
    priority: "high",
    responseTimeHours: 8,
    resolutionTimeHours: 48,
    warningThresholdPct: 70,
    escalationRole: "hr_manager",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEMO_OPERATIONAL_TASKS: OperationalTask[] = [
  {
    id: "tsk-01",
    companyId: "demo-company",
    taskNumber: "TSK-2026-0001",
    titleAr: "اعتماد طلب الإجازة السنوية #LR-2026-089",
    titleEn: "Approve Annual Leave #LR-2026-089",
    descriptionAr: "طلب إجازة اعتيادية لمدة 5 أيام مقدم من أحمد بن سالم",
    descriptionEn: "5-day annual leave submitted by Ahmed Bin Salem",
    category: "approvals",
    priority: "high",
    status: "in_progress",
    assignedToRole: "hr_manager",
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    entityType: "leave_request",
    entityId: "req-01",
    slaWarningAt: new Date(Date.now() + 43200000).toISOString(),
    slaBreachAt: new Date(Date.now() + 86400000).toISOString(),
    isSlaBreached: false,
    escalationLevel: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tsk-02",
    companyId: "demo-company",
    taskNumber: "TSK-2026-0002",
    titleAr: "إغلاق مخالصة نهاية الخدمة واسترداد الأجهزة",
    titleEn: "Complete Asset Clearance for Settlement #SET-044",
    descriptionAr: "استلام الحاسب المحمول وبطاقة الدخول من الموظف المستقيل",
    descriptionEn: "Retrieve laptop and access badge from resigning employee",
    category: "offboarding",
    priority: "urgent",
    status: "pending",
    assignedToRole: "hr_manager",
    dueDate: new Date(Date.now() + 14400000).toISOString(),
    entityType: "settlement",
    entityId: "set-044",
    slaWarningAt: new Date(Date.now() - 3600000).toISOString(),
    slaBreachAt: new Date(Date.now() + 7200000).toISOString(),
    isSlaBreached: false,
    escalationLevel: 0,
    createdAt: new Date(Date.now() - 10000000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tsk-03",
    companyId: "demo-company",
    taskNumber: "TSK-2026-0003",
    titleAr: "مراجعة وتوثيق عقود منصة قوى للموظفين الجدد",
    titleEn: "Verify Qiwa Electronic Contracts for New Joiners",
    descriptionAr: "مراجعة رفع 3 عقود عمل للموظفين الجدد على منصة قوى",
    descriptionEn: "Review submission of 3 employment contracts on Qiwa platform",
    category: "compliance",
    priority: "medium",
    status: "completed",
    assignedToRole: "hr_manager",
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    entityType: "contract",
    entityId: "qiwa-batch-01",
    isSlaBreached: false,
    completedAt: new Date(Date.now() - 40000000).toISOString(),
    resolutionNote: "تم التحقق من تطابق العقود بنجاح",
    escalationLevel: 0,
    createdAt: new Date(Date.now() - 150000000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mapping DB row to domain task
export function mapTaskRow(row: Record<string, any>): OperationalTask {
  return {
    id: row.id,
    companyId: row.company_id,
    taskNumber: row.task_number || `TSK-${row.id.slice(0, 8)}`,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    descriptionAr: row.description_ar || undefined,
    descriptionEn: row.description_en || undefined,
    category: (row.category || "general") as TaskCategory,
    priority: (row.priority || "medium") as TaskPriority,
    status: (row.status || "pending") as TaskStatus,
    assignedToUserId: row.assigned_to_user_id || undefined,
    assignedToRole: row.assigned_to_role || undefined,
    dueDate: row.due_date || new Date().toISOString(),
    workflowInstanceId: row.workflow_instance_id || undefined,
    entityType: row.entity_type || "general",
    entityId: row.entity_id || "",
    slaPolicyId: row.sla_policy_id || undefined,
    slaWarningAt: row.sla_warning_at || undefined,
    slaBreachAt: row.sla_breach_at || undefined,
    isSlaBreached: Boolean(row.is_sla_breached),
    breachedAt: row.breached_at || undefined,
    claimedAt: row.claimed_at || undefined,
    claimedBy: row.claimed_by || undefined,
    completedAt: row.completed_at || undefined,
    completedBy: row.completed_by || undefined,
    escalationLevel: Number(row.escalation_level || 0),
    resolutionNote: row.resolution_note || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// ============================================================================
// SERVER FETCHERS
// ============================================================================
export async function fetchTasksServer(companyId: string, filters?: {
  status?: string;
  category?: string;
  priority?: string;
  assignedToUser?: string;
}): Promise<OperationalTask[]> {
  let query = db
    .from("operational_tasks")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters?.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.assignedToUser) {
    query = query.eq("assigned_to_user_id", filters.assignedToUser);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[TasksRepo] fetch error:", error.message);
    throw error;
  }
  return (data || []).map(mapTaskRow);
}

export async function fetchSlaPoliciesServer(companyId: string): Promise<SlaPolicy[]> {
  const { data, error } = await db
    .from("sla_policies")
    .select("*")
    .eq("company_id", companyId)
    .order("priority");

  if (error) {
    console.warn("[TasksRepo] sla policies fetch error:", error.message);
    return DEMO_SLA_POLICIES;
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    entityType: r.entity_type,
    priority: r.priority as TaskPriority,
    responseTimeHours: Number(r.response_time_hours || 4),
    resolutionTimeHours: Number(r.resolution_time_hours || 24),
    warningThresholdPct: Number(r.warning_threshold_pct || 75),
    escalationRole: r.escalation_role || "hr_manager",
    escalationUserId: r.escalation_user_id || undefined,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ============================================================================
// MUTATIONS
// ============================================================================
export async function claimOperationalTaskRecord(taskId: string, userId: string): Promise<void> {
  const { error } = await db.rpc("claim_operational_task", {
    p_task_id: taskId,
    p_user_id: userId,
  });
  if (error) {
    await db
      .from("operational_tasks")
      .update({
        status: "in_progress",
        claimed_at: new Date().toISOString(),
        claimed_by: userId,
        assigned_to_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  }
}

export async function completeOperationalTaskRecord(
  taskId: string,
  userId: string,
  note?: string,
): Promise<void> {
  const { error } = await db.rpc("complete_operational_task", {
    p_task_id: taskId,
    p_user_id: userId,
    p_note: note || null,
  });
  if (error) {
    await db
      .from("operational_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: userId,
        resolution_note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  }
}

export async function escalateOperationalTaskRecord(payload: {
  taskId: string;
  fromUserId?: string;
  toUserId?: string;
  toRole?: string;
  reason: string;
}): Promise<void> {
  const { error } = await db.rpc("escalate_operational_task", {
    p_task_id: payload.taskId,
    p_from_user_id: payload.fromUserId || null,
    p_to_user_id: payload.toUserId || null,
    p_to_role: payload.toRole || "hr_manager",
    p_reason: payload.reason,
  });
  if (error) {
    await db
      .from("operational_tasks")
      .update({
        status: "escalated",
        assigned_to_role: payload.toRole || "hr_manager",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.taskId);
  }
}

export async function evaluateTaskSlasRecord(companyId: string): Promise<{
  breachedCount: number;
  warningCount: number;
}> {
  const { data, error } = await db.rpc("evaluate_task_slas", {
    p_company_id: companyId,
  });
  if (error) return { breachedCount: 0, warningCount: 0 };
  return {
    breachedCount: Number(data?.breached_count || 0),
    warningCount: Number(data?.warning_count || 0),
  };
}

// ============================================================================
// REACT HOOKS
// ============================================================================
export function useOperationalTasks(filters?: {
  status?: string;
  category?: string;
  priority?: string;
}) {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company";

  return useQuery<OperationalTask[]>({
    queryKey: taskQueryKeys.list(companyId, filters),
    queryFn: async () => {
      if (!isLive) {
        let tasks = [...DEMO_OPERATIONAL_TASKS];
        if (filters?.status && filters.status !== "all") {
          tasks = tasks.filter((t) => t.status === filters.status);
        }
        if (filters?.category && filters.category !== "all") {
          tasks = tasks.filter((t) => t.category === filters.category);
        }
        if (filters?.priority && filters.priority !== "all") {
          tasks = tasks.filter((t) => t.priority === filters.priority);
        }
        return tasks;
      }
      return fetchTasksServer(companyId, filters);
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useSlaPolicies() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company";

  return useQuery<SlaPolicy[]>({
    queryKey: taskQueryKeys.slaPolicies(companyId),
    queryFn: async () => {
      if (!isLive) return DEMO_SLA_POLICIES;
      return fetchSlaPoliciesServer(companyId);
    },
  });
}

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const userId = session?.user?.id || "demo-user";

  const claimTask = useCallback(
    async (taskId: string) => {
      if (!isLive) {
        const found = DEMO_OPERATIONAL_TASKS.find((t) => t.id === taskId);
        if (found) {
          found.status = "in_progress";
          found.claimedAt = new Date().toISOString();
        }
        await queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
        return;
      }
      await claimOperationalTaskRecord(taskId, userId);
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
    [isLive, queryClient, userId],
  );

  const completeTask = useCallback(
    async (taskId: string, note?: string) => {
      if (!isLive) {
        const found = DEMO_OPERATIONAL_TASKS.find((t) => t.id === taskId);
        if (found) {
          found.status = "completed";
          found.completedAt = new Date().toISOString();
          found.resolutionNote = note;
        }
        await queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
        return;
      }
      await completeOperationalTaskRecord(taskId, userId, note);
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
    [isLive, queryClient, userId],
  );

  const escalateTask = useCallback(
    async (payload: { taskId: string; toRole?: string; reason: string }) => {
      if (!isLive) {
        const found = DEMO_OPERATIONAL_TASKS.find((t) => t.id === payload.taskId);
        if (found) {
          found.status = "escalated";
          found.escalationLevel = (found.escalationLevel || 0) + 1;
        }
        await queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
        return;
      }
      await escalateOperationalTaskRecord({
        taskId: payload.taskId,
        fromUserId: userId,
        toRole: payload.toRole,
        reason: payload.reason,
      });
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    },
    [isLive, queryClient, userId],
  );

  return {
    claimTask,
    completeTask,
    escalateTask,
  };
}
