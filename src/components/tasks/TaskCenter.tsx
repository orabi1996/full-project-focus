import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  Filter,
  UserCheck,
  FileCheck,
  RefreshCw,
  Search,
  Check,
  Eye,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  OperationalTask,
  TaskPriority,
  TaskStatus,
  TaskCategory,
  TASK_CATEGORY_LABELS,
  useOperationalTasks,
  useSlaPolicies,
  useTaskMutations,
  evaluateTaskSlasRecord,
} from "../../lib/domains/tasks";
import { useBootstrapData } from "../../lib/domains/bootstrap/use-bootstrap";
import { toast } from "sonner";

export const TaskCenter: React.FC = () => {
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "sla_policies">("tasks");

  // Selected task for modal actions
  const [selectedTask, setSelectedTask] = useState<OperationalTask | null>(null);
  const [actionType, setActionType] = useState<"complete" | "escalate" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [escalateRole, setEscalateRole] = useState("hr_manager");

  const { data: tasks = [], isLoading, refetch } = useOperationalTasks({
    status: statusFilter,
    priority: priorityFilter,
  });
  const { data: slaPolicies = [] } = useSlaPolicies();
  const { claimTask, completeTask, escalateTask } = useTaskMutations();

  const handleEvaluateSlas = async () => {
    setIsEvaluating(true);
    try {
      const res = await evaluateTaskSlasRecord(companyId);
      toast.success(
        `تم فحص سياسات SLA بنجاح — مهام متجاوزة: ${res.breachedCount}، تنبيهات تحذيرية: ${res.warningCount}`,
      );
      await refetch();
    } catch {
      toast.error("تعذر تقييم SLA حالياً");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!selectedTask) return;
    try {
      if (actionType === "complete") {
        await completeTask(selectedTask.id, actionNote);
        toast.success(`تم إكمال المهمة ${selectedTask.taskNumber} بنجاح`);
      } else if (actionType === "escalate") {
        await escalateTask({
          taskId: selectedTask.id,
          toRole: escalateRole,
          reason: actionNote || "تصعيد إداري لانتهاء مهلة SLA",
        });
        toast.success(`تم تصعيد المهمة ${selectedTask.taskNumber} إلى ${escalateRole}`);
      }
      setSelectedTask(null);
      setActionType(null);
      setActionNote("");
    } catch {
      toast.error("فشل تنفيذ الإجراء");
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive" className="text-[10px] px-2 py-0">عاجل جداً</Badge>;
      case "high":
        return <Badge variant="outline" className="text-[10px] border-rose-500/50 text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-2 py-0">أولوية عالية</Badge>;
      case "medium":
        return <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0">متوسط</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-2 py-0">عادي</Badge>;
    }
  };

  const getStatusBadge = (status: TaskStatus, isBreached: boolean) => {
    if (isBreached || status === "overdue") {
      return <Badge variant="destructive" className="text-[10px] gap-1 px-2 py-0"><AlertTriangle className="h-3 w-3" /> متجاوز SLA</Badge>;
    }
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0">مكتملة</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-2 py-0">قيد التنفيذ</Badge>;
      case "escalated":
        return <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-600 bg-purple-50 dark:bg-purple-950/20 px-2 py-0">مصعدة</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-2 py-0">بانتظار البدء</Badge>;
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.taskNumber.toLowerCase().includes(q) ||
      t.titleAr.toLowerCase().includes(q) ||
      (t.descriptionAr || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-foreground">مركز المهام التشغيلية و SLA</h3>
            <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary">
              {tasks.filter((t) => t.status !== "completed").length} مهام جارية
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            متابعة المهام الإدارية الحساسة، أوقات الاستجابة، وسياسات التصعيد التلقائي
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-muted/70 p-1 text-xs">
            <button
              onClick={() => setActiveTab("tasks")}
              className={`rounded-lg px-3 py-1 font-bold transition-all ${
                activeTab === "tasks" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              المهام التشغيلية
            </button>
            <button
              onClick={() => setActiveTab("sla_policies")}
              className={`rounded-lg px-3 py-1 font-bold transition-all ${
                activeTab === "sla_policies" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              سياسات SLA ({slaPolicies.length})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleEvaluateSlas}
            disabled={isEvaluating}
            className="h-8 text-xs font-bold gap-1 rounded-full border-border/80"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${isEvaluating ? "animate-spin" : ""}`} />
            فحص توافق SLA
          </Button>
        </div>
      </div>

      {activeTab === "tasks" && (
        <>
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث برقم المهمة أو العنوان..."
                className="w-full h-9 rounded-xl border border-border/80 bg-card pr-9 pl-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كافة الحالات</option>
                <option value="pending">بانتظار البدء</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="escalated">مصعدة</option>
                <option value="overdue">متجاوزة المهلة</option>
                <option value="completed">مكتملة</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-9 rounded-xl border border-border/80 bg-card px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">كافة الأولويات</option>
                <option value="urgent">عاجل جداً</option>
                <option value="high">أولوية عالية</option>
                <option value="medium">متوسط</option>
                <option value="low">عادي</option>
              </select>
            </div>
          </div>

          {/* Tasks Table / Cards */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 text-start">رقم المهمة والعنوان</th>
                    <th className="py-3 px-4 text-start">التصنيف</th>
                    <th className="py-3 px-4 text-start">الأولوية</th>
                    <th className="py-3 px-4 text-start">الحالة و SLA</th>
                    <th className="py-3 px-4 text-start">المسؤول المكلف</th>
                    <th className="py-3 px-4 text-start">الموعد النهائي</th>
                    <th className="py-3 px-4 text-end">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        جاري تحميل المهام من المحرك التشغيلي...
                      </td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        لا توجد مهام تشغيلية تطابق خيارات التصفية
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const catLabel = TASK_CATEGORY_LABELS[task.category] || { ar: task.category, en: task.category };
                      const isOverdue = task.isSlaBreached || new Date(task.dueDate) < new Date();

                      return (
                        <tr key={task.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] font-bold text-primary block">
                              {task.taskNumber}
                            </span>
                            <span className="font-bold text-foreground block mt-0.5">
                              {task.titleAr}
                            </span>
                            {task.descriptionAr && (
                              <span className="text-[11px] text-muted-foreground block truncate max-w-xs mt-0.5">
                                {task.descriptionAr}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {catLabel.ar}
                            </Badge>
                          </td>

                          <td className="py-3 px-4">
                            {getPriorityBadge(task.priority)}
                          </td>

                          <td className="py-3 px-4">
                            {getStatusBadge(task.status, isOverdue)}
                            {task.escalationLevel > 0 && (
                              <span className="block text-[10px] text-purple-600 font-bold mt-1">
                                مستوى التصعيد {task.escalationLevel}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-muted-foreground">
                            {task.assignedToRole ? (
                              <span className="font-bold text-foreground block">
                                {task.assignedToRole}
                              </span>
                            ) : (
                              "غير مخصص"
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {new Date(task.dueDate).toLocaleDateString("ar-SA", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>

                          <td className="py-3 px-4 text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              {task.status === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => claimTask(task.id)}
                                  className="h-7 text-[11px] font-bold rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                                >
                                  استلام
                                </Button>
                              )}

                              {task.status !== "completed" && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedTask(task);
                                      setActionType("complete");
                                    }}
                                    className="h-7 text-[11px] font-bold rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                                  >
                                    إكمال
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedTask(task);
                                      setActionType("escalate");
                                    }}
                                    className="h-7 text-[11px] font-bold rounded-lg text-purple-600 hover:bg-purple-50"
                                    title="تصعيد"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "sla_policies" && (
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-4">
          <div>
            <h4 className="text-sm font-black text-foreground">اتفاقيات مستوى الخدمة (SLA Policies)</h4>
            <p className="text-xs text-muted-foreground">
              المدد الزمنية المحددة للاستجابة والحل، ونسب التحذير قبل انقضاء المهلة
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {slaPolicies.map((pol) => (
              <div key={pol.id} className="rounded-xl border border-border/70 p-3.5 bg-muted/20 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{pol.nameAr}</span>
                  {getPriorityBadge(pol.priority)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-card p-2 rounded-lg border border-border/60">
                    <span className="text-muted-foreground block text-[10px]">زمن الاستجابة</span>
                    <span className="font-bold text-foreground">{pol.responseTimeHours} ساعات</span>
                  </div>
                  <div className="bg-card p-2 rounded-lg border border-border/60">
                    <span className="text-muted-foreground block text-[10px]">مهلة الحل</span>
                    <span className="font-bold text-foreground">{pol.resolutionTimeHours} ساعة</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>عتبة التحذير: {pol.warningThresholdPct}%</span>
                  <span className="font-bold text-primary">المصعّد له: {pol.escalationRole}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Action Modal */}
      {selectedTask && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            <h4 className="text-sm font-black text-foreground">
              {actionType === "complete" ? "إكمال المهمة التشغيلية" : "تصعيد المهمة لجهة عليا"}
            </h4>

            <p className="text-xs text-muted-foreground">
              {actionType === "complete"
                ? `يرجى تدوين ملخص الإجراء المتخذ لإغلاق المهمة ${selectedTask.taskNumber}.`
                : `سيتم تصعيد المهمة ${selectedTask.taskNumber} وإشعار المسؤولين المعنيين.`}
            </p>

            {actionType === "escalate" && (
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  الدور الوظيفي للتصعيد:
                </label>
                <select
                  value={escalateRole}
                  onChange={(e) => setEscalateRole(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border/80 bg-background px-3 text-xs font-bold"
                >
                  <option value="hr_manager">مدير الموارد البشرية (HR Manager)</option>
                  <option value="finance_officer">مسؤول المالية (Finance Officer)</option>
                  <option value="super_admin">مدير النظام العام (Super Admin)</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                {actionType === "complete" ? "ملاحظات الإنجاز:" : "سبب التصعيد:"}
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="أدخل التفاصيل..."
                className="w-full h-20 rounded-xl border border-border/80 bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTask(null);
                  setActionType(null);
                }}
                className="h-8 text-xs font-bold rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteAction}
                className="h-8 text-xs font-bold rounded-xl"
              >
                تأكيد الإجراء
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
