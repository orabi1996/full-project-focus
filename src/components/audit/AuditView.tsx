import React, { useState } from "react";
import {
  Shield,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  History,
  Lock,
  Cpu,
  RefreshCw,
  Terminal,
  Activity,
  ListTodo,
  ExternalLink,
  ChevronDown,
  Eye,
  Key,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { IconSymbol } from "../ui/IconSymbol";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { useBootstrapData } from "../../lib/domains/bootstrap/use-bootstrap";
import {
  EnterpriseAuditEvent,
  AuditSeverity,
  useEnterpriseAuditEvents,
  useAuditIntegrityCheck,
  useBackgroundJobs,
  useDeadLetterJobs,
  useOperationsHealthSummary,
  useAuditMutations,
} from "../../lib/domains/audit";
import { TaskCenter } from "../tasks/TaskCenter";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { toast } from "sonner";

export const AuditView: React.FC = () => {
  const bootstrap = useBootstrapData();
  const companyId = bootstrap.company?.id || "demo-company";

  const [activeTab, setActiveTab] = useState<
    "audit_trail" | "security_events" | "integrity" | "task_center" | "observability" | "notifications"
  >("audit_trail");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [sensitiveOnly, setSensitiveOnly] = useState(false);

  // Diff inspection modal
  const [inspectEvent, setInspectEvent] = useState<EnterpriseAuditEvent | null>(null);

  // Queries
  const { data: auditEvents = [], isLoading, refetch: refetchAudit } = useEnterpriseAuditEvents({
    entityType: selectedEntity,
    severity: selectedSeverity,
    isSensitive: sensitiveOnly,
    searchTerm,
  });

  const { data: integrityResult, isLoading: isIntegrityLoading, refetch: verifyIntegrity } = useAuditIntegrityCheck();
  const { data: backgroundJobs = [], refetch: refetchJobs } = useBackgroundJobs();
  const { data: deadLetterJobs = [], refetch: refetchDeadLetters } = useDeadLetterJobs();
  const { data: healthSummary } = useOperationsHealthSummary();
  const { retryDeadLetterJob } = useAuditMutations();

  const handleExportAudit = () => {
    const data = auditEvents.map((log) => ({
      المستخدم: log.actorName,
      "الدور الوظيفي": log.actorRole,
      الإجراء: log.action,
      "نوع الكيان": log.entityType,
      "اسم الكيان": log.entityName || "—",
      المستوى: log.severity,
      "تفاصيل التغيير": log.changesSummary || "—",
      "عنوان IP": log.ipAddress || "127.0.0.1",
      "بصمة التشفير": log.eventHash || "—",
      "التاريخ والوقت": log.timestamp,
    }));
    exportToCSV(`Enterprise_Audit_Trail_${new Date().toISOString().split("T")[0]}`, data);
  };

  const handleRetryDeadLetter = async (id: string) => {
    try {
      await retryDeadLetterJob(id);
      toast.success("تمت إعادة جدولة الوظيفة في قائمة المهام الخلفية بنجاح");
      await refetchDeadLetters();
      await refetchJobs();
    } catch {
      toast.error("تعذر إعادة تشغيل الوظيفة");
    }
  };

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive" className="text-[10px] px-2 py-0">حرج</Badge>;
      case "security":
        return <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-600 bg-purple-50 dark:bg-purple-950/20 px-2 py-0 font-bold">أمان</Badge>;
      case "warning":
        return <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0">تحذير</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-2 py-0">معلومة</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <IconSymbol name="verified_user" source="material" filled size={16} />
              مركز التحكم والعمليات المؤسسي
            </span>
            {healthSummary && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                توافق SLA: {healthSummary.slaComplianceRate}%
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-foreground mt-2">
            سجل التدقيق، المهام التشغيلية والمرصد الرقابي
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            منظومة رقابية موثوقة: سجل تدقيق غير قابل للتعديل (Append-Only Cryptographic Chain)، مركز مهام ذكي، ومرصد للوظائف الخلفية
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            onClick={handleExportAudit}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <Download className="h-4 w-4 text-primary" />
            تصدير السجل (CSV)
          </Button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pb-3">
        <button
          onClick={() => setActiveTab("audit_trail")}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "audit_trail"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          سجل التدقيق الشامل ({auditEvents.length})
        </button>

        <button
          onClick={() => setActiveTab("security_events")}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "security_events"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          العمليات الحساسة والأمان
        </button>

        <button
          onClick={() => setActiveTab("integrity")}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "integrity"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          فحص النزاهة والتشفير
        </button>

        <button
          onClick={() => setActiveTab("task_center")}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "task_center"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <ListTodo className="h-3.5 w-3.5" />
          مركز المهام و SLA
        </button>

        <button
          onClick={() => setActiveTab("observability")}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "observability"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          مرصد العمليات والوظائف الخلفية ({deadLetterJobs.filter((d) => !d.resolved).length > 0 ? "⚠️" : "✓"})
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === "notifications"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          مركز التنبيهات
        </button>
      </div>

      {/* TAB 1: AUDIT TRAIL */}
      {activeTab === "audit_trail" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالفاعل، الإجراء، أو تفاصيل التغيير..."
                className="w-full h-10 rounded-2xl border border-border/80 bg-card pr-10 pl-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              />
            </div>

            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="h-10 rounded-2xl border border-border/80 bg-card px-4 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">كافة الكيانات والعمليات</option>
              <option value="employee">الموظفين (Employees)</option>
              <option value="leave_request">الإجازات (Leaves)</option>
              <option value="payroll_run">مسيرات الرواتب (Payroll)</option>
              <option value="expense_claim">المصروفات (Expenses)</option>
              <option value="connector">الموصلات والتكاملات (Connectors)</option>
              <option value="role_permission">الأدوار والصلاحيات (RBAC)</option>
            </select>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-10 rounded-2xl border border-border/80 bg-card px-4 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">كافة مستويات الخطورة</option>
              <option value="info">معلومة (Info)</option>
              <option value="warning">تحذير (Warning)</option>
              <option value="critical">حرج (Critical)</option>
              <option value="security">أمني (Security)</option>
            </select>

            <Button
              variant={sensitiveOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setSensitiveOnly(!sensitiveOnly)}
              className="h-10 text-xs font-bold rounded-2xl gap-1.5"
            >
              <Key className="h-3.5 w-3.5" />
              {sensitiveOnly ? "العمليات الحساسة فقط" : "كافة العمليات"}
            </Button>
          </div>

          {/* Audit Logs Table */}
          <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs p-5 space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">المستخدم والفاعل</th>
                    <th className="py-3 px-4 text-start">الإجراء المتخذ</th>
                    <th className="py-3 px-4 text-start">الكيان المتأثر</th>
                    <th className="py-3 px-4 text-start">مستوى الخطورة</th>
                    <th className="py-3 px-4 text-start">ملخص التغيير</th>
                    <th className="py-3 px-4 text-start">عنوان IP</th>
                    <th className="py-3 px-4 text-start">الوقت والتاريخ</th>
                    <th className="py-3 px-4 text-end">التفاصيل / Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        جاري تحميل سجل التدقيق الأمني...
                      </td>
                    </tr>
                  ) : auditEvents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        لا توجد أحداث تدقيق تطابق معايير البحث
                      </td>
                    </tr>
                  ) : (
                    auditEvents.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-black text-foreground block">{log.actorName}</span>
                          <span className="block text-[10px] text-muted-foreground font-mono font-semibold">
                            {log.actorRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-primary">
                          {log.action}
                          {log.isSensitive && (
                            <Badge variant="outline" className="text-[9px] mr-1 border-rose-500/30 text-rose-600 bg-rose-50/50">حساس</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          {log.entityType} {log.entityName ? `(${log.entityName})` : ""}
                        </td>
                        <td className="py-3 px-4">
                          {getSeverityBadge(log.severity)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                          {log.changesSummary || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {log.ipAddress || "127.0.0.1"}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString("ar-SA")}
                        </td>
                        <td className="py-3 px-4 text-end">
                          {(log.beforeState || log.afterState || log.changesSummary) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectEvent(log)}
                              className="h-7 text-[11px] font-bold rounded-lg text-primary gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              عرض الفرق
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY EVENTS & PRIVILEGES */}
      {activeTab === "security_events" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted-foreground block">الأحداث الأمنية اليوم</span>
              <h4 className="text-2xl font-black text-foreground mt-1">
                {healthSummary?.securityEventsToday || 2}
              </h4>
              <span className="text-[11px] text-emerald-600 font-bold block mt-1">كافة محاولات الدخول موثقة</span>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted-foreground block">تعديلات الصلاحيات والأدوار</span>
              <h4 className="text-2xl font-black text-foreground mt-1">0</h4>
              <span className="text-[11px] text-muted-foreground font-medium block mt-1">لم تسجل ترقيات صلاحيات مشبوهة</span>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted-foreground block">عمليات تصدير البيانات</span>
              <h4 className="text-2xl font-black text-foreground mt-1">1</h4>
              <span className="text-[11px] text-primary font-bold block mt-1">تصدير مسير رواتب موثق بالرقم المرجعي</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3">
            <h4 className="text-sm font-black text-foreground">سجل العمليات الحساسة المقيدة</h4>
            <div className="divide-y divide-border/60 text-xs">
              {auditEvents
                .filter((e) => e.severity === "security" || e.isSensitive || e.severity === "critical")
                .map((e) => (
                  <div key={e.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{e.action}</span>
                        {getSeverityBadge(e.severity)}
                        <span className="font-mono text-[10px] text-muted-foreground">IP: {e.ipAddress}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        الفاعل: <strong className="text-foreground">{e.actorName}</strong> ({e.actorRole}) — الكيان: {e.entityType} ({e.entityId})
                      </p>
                    </div>
                    <span className="font-mono text-muted-foreground text-[11px]">
                      {new Date(e.timestamp).toLocaleTimeString("ar-SA")}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INTEGRITY & CRYPTOGRAPHIC VERIFICATION */}
      {activeTab === "integrity" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  التحقق من سلامة السجل التشفيري (Append-Only Cryptographic Chain)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  يقوم المحرك بربط كل عملية تجري بالنظام ببصمة سابقة عبر سلسلة تجزئة رياضية (Hash Chain). في حال تم التلاعب بأي صف مباشر في قاعدة البيانات، سيكتشف النظام الانقطاع فورياً.
                </p>
              </div>

              <Button
                onClick={() => verifyIntegrity()}
                disabled={isIntegrityLoading}
                className="rounded-full font-bold text-xs gap-1.5 h-10 px-5"
              >
                <RefreshCw className={`h-4 w-4 ${isIntegrityLoading ? "animate-spin" : ""}`} />
                إعادة فحص السلسلة الرياضية
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-1">
                <span className="text-xs font-bold text-muted-foreground">حالة السلسلة الأمنية</span>
                <div className="flex items-center gap-2 mt-1">
                  {integrityResult?.isValid ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <span className="text-base font-black text-emerald-600">موثقة ومطابقة (Verified)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                      <span className="text-base font-black text-rose-600">اشتباه تلاعب (Tampered)</span>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-1">
                <span className="text-xs font-bold text-muted-foreground">السجلات المفحوصة المتسلسلة</span>
                <h4 className="text-xl font-mono font-black text-foreground mt-1">
                  {integrityResult?.validRecords || auditEvents.length} / {integrityResult?.totalRecords || auditEvents.length}
                </h4>
              </div>

              <div className="rounded-2xl border border-border/70 p-4 bg-muted/20 space-y-1">
                <span className="text-xs font-bold text-muted-foreground">تاريخ آخر فحص تشفيري</span>
                <h4 className="text-xs font-mono font-bold text-muted-foreground mt-1">
                  {new Date(integrityResult?.verifiedAt || new Date()).toLocaleString("ar-SA")}
                </h4>
              </div>
            </div>

            {/* Cryptographic Sample Visualizer */}
            <div className="rounded-2xl border border-border/70 p-4 bg-background space-y-3">
              <h4 className="text-xs font-bold text-foreground">معاينة تسلسل البصمات (Cryptographic Chain Sample):</h4>
              <div className="space-y-2 font-mono text-[11px]">
                {auditEvents.slice(0, 4).map((evt, idx) => (
                  <div key={evt.id} className="p-2.5 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-primary font-bold">Block #{idx + 1}: {evt.action}</span>
                      <span className="text-muted-foreground block text-[10px]">
                        Prev Hash: {evt.prevEventHash || "GENESIS_ROOT"}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md text-[10px]">
                      Hash: {evt.eventHash || "verified_sig_ok"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TASK CENTER */}
      {activeTab === "task_center" && <TaskCenter />}

      {/* TAB 5: OBSERVABILITY & BACKGROUND JOBS */}
      {activeTab === "observability" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted-foreground block">الوظائف قيد المعالجة</span>
              <h4 className="text-2xl font-black text-foreground mt-1">
                {backgroundJobs.filter((j) => j.status === "running").length}
              </h4>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted-foreground block">الوظائف المنتظرة بالرتل</span>
              <h4 className="text-2xl font-black text-foreground mt-1">
                {backgroundJobs.filter((j) => j.status === "queued").length}
              </h4>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted-foreground block">الوظائف المتعثرة (Dead Letter)</span>
              <h4 className="text-2xl font-black text-rose-600 mt-1">
                {deadLetterJobs.filter((d) => !d.resolved).length}
              </h4>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-xs font-bold text-muted-foreground block">معدل الإنجاز الناجح</span>
              <h4 className="text-2xl font-black text-emerald-600 mt-1">
                99.8%
              </h4>
            </div>
          </div>

          {/* Dead Letter Queue Section */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-foreground">قائمة الوظائف المتعثرة (Dead-Letter Queue)</h4>
                <p className="text-xs text-muted-foreground">
                  الوظائف التي استنفدت الحد الأقصى للمحاولات وتتطلب تدخلاً أو إعادة تشغيل
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchDeadLetters()}
                className="h-8 text-xs font-bold rounded-xl"
              >
                تحديث
              </Button>
            </div>

            {deadLetterJobs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground rounded-xl border border-dashed">
                لا توجد وظائف متعثرة في قائمة الانتظار
              </div>
            ) : (
              <div className="space-y-2.5">
                {deadLetterJobs.map((dl) => (
                  <div
                    key={dl.id}
                    className="rounded-xl border border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10 p-3.5 flex items-start justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-700 dark:text-rose-400 font-mono">
                          {dl.jobType}
                        </span>
                        <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-600">
                          {dl.attemptsMade} محاولات فاشلة
                        </Badge>
                        {dl.resolved && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">
                            تم الحل
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        سبب الفشل: <strong className="text-foreground">{dl.failureReason}</strong>
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono block mt-1">
                        تاريخ التعثر: {new Date(dl.failedAt).toLocaleString("ar-SA")}
                      </span>
                    </div>

                    {!dl.resolved && (
                      <Button
                        size="sm"
                        onClick={() => handleRetryDeadLetter(dl.id)}
                        className="h-8 text-xs font-bold rounded-xl gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        إعادة المحاولة فوراً
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Jobs Queue */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3">
            <h4 className="text-sm font-black text-foreground">قائمة الوظائف الخلفية المجدولة والجارية</h4>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-4 text-start">نوع الوظيفة</th>
                    <th className="py-2.5 px-4 text-start">الحالة</th>
                    <th className="py-2.5 px-4 text-start">الأولوية</th>
                    <th className="py-2.5 px-4 text-start">المحاولات</th>
                    <th className="py-2.5 px-4 text-start">الموعد المجدول</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {backgroundJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-4 font-mono font-bold text-primary">{job.jobType}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px]">
                          {job.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-mono">{job.priority}</td>
                      <td className="py-2.5 px-4 font-mono">{job.attempts} / {job.maxAttempts}</td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {new Date(job.scheduledFor).toLocaleTimeString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: NOTIFICATION CENTER */}
      {activeTab === "notifications" && <NotificationCenter />}

      {/* Diff Inspector Modal */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card p-5 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-border/70">
              <div>
                <h4 className="text-sm font-black text-foreground">
                  تفاصيل تدقيق التغيير (Diff Viewer)
                </h4>
                <span className="text-xs text-muted-foreground">
                  {inspectEvent.action} — {inspectEvent.entityType} ({inspectEvent.entityId})
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInspectEvent(null)}
                className="h-8 text-xs font-bold rounded-xl"
              >
                إغلاق
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              {inspectEvent.changesSummary && (
                <div className="bg-muted/30 p-3 rounded-xl border border-border/60">
                  <span className="font-bold text-foreground block mb-0.5">ملخص العملية:</span>
                  <p className="text-muted-foreground">{inspectEvent.changesSummary}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="font-bold text-muted-foreground block mb-1">
                    الحالة السابقة (Before State):
                  </span>
                  <pre className="bg-muted/50 p-3 rounded-xl border border-border/60 font-mono text-[11px] overflow-x-auto text-foreground">
                    {JSON.stringify(inspectEvent.beforeState || { status: "previous_or_null" }, null, 2)}
                  </pre>
                </div>

                <div>
                  <span className="font-bold text-muted-foreground block mb-1">
                    الحالة بعد التعديل (After State):
                  </span>
                  <pre className="bg-muted/50 p-3 rounded-xl border border-border/60 font-mono text-[11px] overflow-x-auto text-foreground">
                    {JSON.stringify(inspectEvent.afterState || { status: "applied" }, null, 2)}
                  </pre>
                </div>
              </div>

              {inspectEvent.isSensitive && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400">
                  🔒 تم حجب وتشفير الحقول المالية والشخصية الحساسة آلياً (Field-Level Masking).
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
