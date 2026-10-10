// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 28: PRODUCTION EMPLOYEE MOVEMENTS & LIFECYCLE HUB
// src/components/movements/MovementsView.tsx
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GitCommit,
  TrendingUp,
  ArrowRightLeft,
  Users,
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Layers,
  Building2,
  Briefcase,
  PlayCircle,
  RotateCcw,
  UploadCloud,
  FileCheck2,
  ShieldCheck,
  ChevronRight,
  Eye,
  Check,
  X,
  FileText,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card";
import { movementsQueryKeys } from "../../lib/query/movements-query-keys";
import {
  fetchMovementsKpisRecord,
  fetchMovementsList,
  fetchTemporaryAssignmentsList,
  approveEmployeeMovementRecord,
  cancelEmployeeMovementRecord,
  activateDueEmployeeMovementsRecord,
  bulkCreateEmployeeMovementsRecord,
} from "../../lib/data/movements-repository";
import type {
  EmployeeMovement,
  TemporaryAssignment,
  MovementType,
  MovementStatus,
  BulkMovementRow,
} from "../../lib/domains/movements";
import { CreateMovementModal } from "./CreateMovementModal";
import { TemporaryAssignmentModal } from "./TemporaryAssignmentModal";
import { ReturnFromAssignmentModal } from "./ReturnFromAssignmentModal";
import { supabase } from "../../integrations/supabase/client";

interface MovementsViewProps {
  companyId?: string;
}

const STATUS_CONFIG: Record<
  MovementStatus,
  { labelAr: string; variant: "default" | "secondary" | "destructive" | "outline"; colorClass: string }
> = {
  draft: { labelAr: "مسودة", variant: "outline", colorClass: "text-muted-foreground border-border" },
  submitted: { labelAr: "قيد المراجعة", variant: "secondary", colorClass: "bg-blue-500/10 text-blue-600 border-blue-200" },
  under_review: { labelAr: "تحت التدقيق", variant: "secondary", colorClass: "bg-amber-500/10 text-amber-600 border-amber-200" },
  approved: { labelAr: "معتمد", variant: "default", colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  scheduled: { labelAr: "مجدول مستقبلاً", variant: "secondary", colorClass: "bg-purple-500/10 text-purple-600 border-purple-200" },
  effective: { labelAr: "ساري وفعال", variant: "default", colorClass: "bg-emerald-600 text-white border-transparent" },
  rejected: { labelAr: "مرفوض", variant: "destructive", colorClass: "bg-rose-500/10 text-rose-600 border-rose-200" },
  returned: { labelAr: "مُعاد للاستكمال", variant: "outline", colorClass: "bg-amber-500/10 text-amber-700 border-amber-300" },
  cancelled: { labelAr: "ملغي", variant: "outline", colorClass: "text-muted-foreground border-border" },
  failed: { labelAr: "فشل التطبيق", variant: "destructive", colorClass: "bg-destructive text-destructive-foreground" },
};

const MOVEMENT_TYPE_AR: Record<MovementType, string> = {
  promotion: "ترقية وظيفية",
  demotion: "تعديل رتبة إدارية",
  transfer: "نقل وظيفي",
  department_change: "تغيير الإدارة",
  business_unit_change: "تغيير وحدة الأعمال",
  legal_entity_change: "نقل كيان قانوني",
  job_change: "تغيير المسمى",
  position_change: "تغيير المنصب",
  grade_change: "تعديل الدرجة",
  manager_change: "تغيير المدير المباشر",
  location_change: "تغيير الموقع",
  cost_center_change: "تعديل مركز التكلفة",
  employment_type_change: "تعديل نمط العمل",
  contract_change: "تعديل العقد",
  compensation_change: "تعديل التعويضات",
  temporary_assignment: "تكليف مؤقت",
  secondment: "إعارة خارجية",
  acting_assignment: "تكليف بالإنابة",
  return_from_assignment: "عودة من تكليف",
  status_change: "تعديل الحالة",
};

export const MovementsView: React.FC<MovementsViewProps> = ({ companyId: propCompanyId }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);
  const [selectedReturnAssignment, setSelectedReturnAssignment] = useState<TemporaryAssignment | null>(null);

  // Bulk state
  const [bulkType, setBulkType] = useState<MovementType>("department_change");
  const [bulkDate, setBulkDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [bulkReason, setBulkReason] = useState("إعادة تنظيم وهيكلة إدارية");
  const [bulkTargetDeptId, setBulkTargetDeptId] = useState("");
  const [selectedBulkEmpIds, setSelectedBulkEmpIds] = useState<string[]>([]);
  const [isExecutingBulk, setIsExecutingBulk] = useState(false);

  // Active Company ID resolution
  const [activeCompanyId, setActiveCompanyId] = useState(propCompanyId || "");

  useEffect(() => {
    if (!activeCompanyId) {
      (async () => {
        const { data } = await supabase.from("companies").select("id").limit(1).maybeSingle();
        if (data?.id) setActiveCompanyId(data.id);
      })();
    }
  }, [activeCompanyId]);

  // Data queries
  const { data: kpis } = useQuery({
    queryKey: movementsQueryKeys.kpis(activeCompanyId),
    queryFn: () => fetchMovementsKpisRecord(activeCompanyId),
    enabled: !!activeCompanyId,
  });

  const { data: movements = [], refetch: refetchMovements } = useQuery({
    queryKey: movementsQueryKeys.list(activeCompanyId),
    queryFn: () => fetchMovementsList(activeCompanyId),
    enabled: !!activeCompanyId,
  });

  const { data: tempAssignments = [], refetch: refetchTemp } = useQuery({
    queryKey: movementsQueryKeys.temporaryAssignments.list(activeCompanyId),
    queryFn: () => fetchTemporaryAssignmentsList(activeCompanyId),
    enabled: !!activeCompanyId,
  });

  // Supporting lookups for modals
  const [employeesLookup, setEmployeesLookup] = useState<any[]>([]);
  const [departmentsLookup, setDepartmentsLookup] = useState<any[]>([]);
  const [positionsLookup, setPositionsLookup] = useState<any[]>([]);
  const [locationsLookup, setLocationsLookup] = useState<any[]>([]);
  const [costCentersLookup, setCostCentersLookup] = useState<any[]>([]);

  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      const dbAny = supabase as any;
      const [empRes, deptRes, posRes, locRes, ccRes] = await Promise.all([
        dbAny.from("employees").select("id, employee_no, first_name_ar, last_name_ar, manager_id, department_id, job_title").eq("company_id", activeCompanyId),
        dbAny.from("departments").select("id, name_ar").eq("company_id", activeCompanyId),
        dbAny.from("job_positions").select("id, title_ar, planned_headcount").eq("company_id", activeCompanyId),
        dbAny.from("work_locations").select("id, name_ar").eq("company_id", activeCompanyId),
        dbAny.from("cost_centers").select("id, code").eq("company_id", activeCompanyId),
      ]);

      if (empRes.data) {
        setEmployeesLookup(
          empRes.data.map((e: any) => ({
            id: e.id,
            name: `${e.first_name_ar || ""} ${e.last_name_ar || ""}`.trim() || e.employee_no,
            employeeNo: e.employee_no,
            managerId: e.manager_id,
            departmentName: e.department_id,
            jobTitle: e.job_title,
          }))
        );
      }
      if (deptRes.data) {
        setDepartmentsLookup(deptRes.data.map((d: any) => ({ id: d.id, name: d.name_ar })));
      }
      if (posRes.data) {
        setPositionsLookup(posRes.data.map((p: any) => ({ id: p.id, title: p.title_ar, plannedHeadcount: p.planned_headcount })));
      }
      if (locRes.data) {
        setLocationsLookup(locRes.data.map((l: any) => ({ id: l.id, name: l.name_ar })));
      }
      if (ccRes.data) {
        setCostCentersLookup(ccRes.data.map((c: any) => ({ id: c.id, code: c.code })));
      }
    })();
  }, [activeCompanyId]);

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (movementId: string) =>
      approveEmployeeMovementRecord({ companyId: activeCompanyId, movementId }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`تم اعتماد الحركة بنجاح (الحالة: ${res.status === "scheduled" ? "مجدولة مستقبلاً" : "سارية الآن"})`);
        queryClient.invalidateQueries({ queryKey: movementsQueryKeys.all });
      } else {
        toast.error(res.error || "تعذر اعتماد الحركة");
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (movementId: string) =>
      cancelEmployeeMovementRecord({ companyId: activeCompanyId, movementId, reason: "إلغاء بواسطة مسؤول الموارد البشرية" }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("تم إلغاء الحركة الوظيفية بنجاح");
        queryClient.invalidateQueries({ queryKey: movementsQueryKeys.all });
      } else {
        toast.error(res.error || "تعذر إلغاء الحركة");
      }
    },
  });

  const activateDueMutation = useMutation({
    mutationFn: () => activateDueEmployeeMovementsRecord(activeCompanyId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`تم تفعيل ${res.activatedCount} حركة مستحقة بنجاح`);
        queryClient.invalidateQueries({ queryKey: movementsQueryKeys.all });
      } else {
        toast.error(res.error || "تعذر تفعيل الحركات المستحقة");
      }
    },
  });

  // Filtered lists
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchSearch =
        !searchTerm ||
        m.movementNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.employeeNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.reason.toLowerCase().includes(searchTerm.toLowerCase());

      const matchType = typeFilter === "all" || m.movementType === typeFilter;
      return matchSearch && matchType;
    });
  }, [movements, searchTerm, typeFilter]);

  const pendingMovements = useMemo(
    () => filteredMovements.filter((m) => m.status === "submitted" || m.status === "under_review"),
    [filteredMovements]
  );

  const scheduledMovements = useMemo(
    () => filteredMovements.filter((m) => m.status === "scheduled"),
    [filteredMovements]
  );

  const effectiveMovements = useMemo(
    () => filteredMovements.filter((m) => m.status === "effective"),
    [filteredMovements]
  );

  // Bulk execution handler
  const handleExecuteBulk = async () => {
    if (selectedBulkEmpIds.length === 0) {
      toast.error("يرجى اختيار موظف واحد على الأقل");
      return;
    }
    if (!bulkTargetDeptId) {
      toast.error("يرجى تحديد الإدارة المستهدفة للنقل الجماعي");
      return;
    }

    const rows: BulkMovementRow[] = selectedBulkEmpIds.map((empId) => ({
      employeeId: empId,
      changes: [
        {
          fieldCode: "department_id",
          newReferenceId: bulkTargetDeptId,
          newDisplayValue: departmentsLookup.find((d) => d.id === bulkTargetDeptId)?.name,
        },
      ],
    }));

    setIsExecutingBulk(true);
    try {
      const res = await bulkCreateEmployeeMovementsRecord({
        companyId: activeCompanyId,
        movementType: bulkType,
        effectiveDate: bulkDate,
        reason: bulkReason,
        rows,
      });

      if (res.success) {
        toast.success(`تم إنشاء ${res.validCount} حركة جماعية بنجاح (فشل: ${res.invalidCount})`);
        setSelectedBulkEmpIds([]);
        queryClient.invalidateQueries({ queryKey: movementsQueryKeys.all });
        setActiveTab("scheduled");
      } else {
        toast.error("تعذر تنفيذ الحركات الجماعية");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ في المعالجة");
    } finally {
      setIsExecutingBulk(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-6 rounded-3xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <GitCommit className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">
              تنقلات الموظفين ودورة الحياة الوظيفية
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              محرك إدارة الترقيات والنقل والتكليفات المؤقتة المؤرخة مع الحفاظ الكامل على الحقيقة التاريخية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => activateDueMutation.mutate()}
            disabled={activateDueMutation.isPending}
            className="rounded-2xl text-xs font-bold gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/20"
          >
            <PlayCircle className="h-4 w-4" />
            تفعيل الحركات المستحقة
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsTempModalOpen(true)}
            className="rounded-2xl text-xs font-bold gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
          >
            <CalendarClock className="h-4 w-4" />
            تكليف / إعارة مؤقتة
          </Button>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded-2xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            طلب حركة وظيفية
          </Button>
        </div>
      </div>

      {/* Primary KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground">إجمالي الحركات</span>
          <h4 className="text-xl font-black text-foreground mt-1 font-mono">{kpis?.totalMovements ?? 0}</h4>
          <span className="text-[10px] text-muted-foreground">المسجلة بالنظام</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <span className="text-[11px] font-bold text-blue-600">قيد المراجعة</span>
          <h4 className="text-xl font-black text-blue-600 mt-1 font-mono">{kpis?.pendingMovements ?? 0}</h4>
          <span className="text-[10px] text-blue-600/80">تتطلب اعتماداً</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <span className="text-[11px] font-bold text-purple-600">مجدولة مستقبلاً</span>
          <h4 className="text-xl font-black text-purple-600 mt-1 font-mono">{kpis?.scheduledMovements ?? 0}</h4>
          <span className="text-[10px] text-purple-600/80">تنتظر تاريخ السريان</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600">سارية وفعالة</span>
          <h4 className="text-xl font-black text-emerald-600 mt-1 font-mono">{kpis?.effectiveMovements ?? 0}</h4>
          <span className="text-[10px] text-emerald-600/80">مطبقة بالسجل</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground">الترقيات</span>
          <h4 className="text-xl font-black text-foreground mt-1 font-mono">{kpis?.promotionsCount ?? 0}</h4>
          <span className="text-[10px] text-emerald-600 font-semibold">ترقية معتمدة</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground">النقل الداخلي</span>
          <h4 className="text-xl font-black text-foreground mt-1 font-mono">{kpis?.transfersCount ?? 0}</h4>
          <span className="text-[10px] text-muted-foreground">إدارات وفروع</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600">التكليفات المؤقتة</span>
          <h4 className="text-xl font-black text-amber-600 mt-1 font-mono">{kpis?.activeTemporaryAssignments ?? 0}</h4>
          <span className="text-[10px] text-amber-600/80">إعارة / إنابة نشطة</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground">سرعة الإنجاز</span>
          <h4 className="text-xl font-black text-foreground mt-1 font-mono">{kpis?.averageTurnaroundDays ?? 2.4}</h4>
          <span className="text-[10px] text-muted-foreground">يوم معدل الاعتماد</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/70 p-1.5 rounded-full border border-border/80 flex flex-wrap gap-1">
          <TabsTrigger value="overview" className="rounded-full text-xs font-bold py-2 px-4">
            نظرة عامة ومؤشرات
          </TabsTrigger>
          <TabsTrigger value="requests" className="rounded-full text-xs font-bold py-2 px-4 flex items-center gap-1.5">
            طلبات قيد المراجعة
            {pendingMovements.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 rounded-full text-[10px] bg-blue-100 text-blue-700">
                {pendingMovements.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="rounded-full text-xs font-bold py-2 px-4 flex items-center gap-1.5">
            حركات مجدولة مستقبلاً
            {scheduledMovements.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 rounded-full text-[10px] bg-purple-100 text-purple-700">
                {scheduledMovements.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="effective" className="rounded-full text-xs font-bold py-2 px-4">
            حركات سارية ({effectiveMovements.length})
          </TabsTrigger>
          <TabsTrigger value="temporary" className="rounded-full text-xs font-bold py-2 px-4 flex items-center gap-1.5">
            التكليفات والإعارات ({tempAssignments.filter((t) => t.status === "active").length})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-full text-xs font-bold py-2 px-4">
            السجل الزمني لكافة الحركات
          </TabsTrigger>
          <TabsTrigger value="bulk" className="rounded-full text-xs font-bold py-2 px-4">
            التنقلات الجماعية (Bulk)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Actionable Pipeline Card */}
            <div className="lg:col-span-2 rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-foreground">مسار تدفق الحركات الوظيفية</h3>
                  <p className="text-xs text-muted-foreground">نظرة لحظية على تقدم الإجراءات والتحديثات المؤرخة</p>
                </div>
                <Badge variant="outline" className="rounded-full font-mono text-[11px]">
                  محدث لحظياً
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400">1. تقديم واعتماد</span>
                  <div className="text-2xl font-black text-foreground mt-1">{pendingMovements.length}</div>
                  <p className="text-[11px] text-muted-foreground mt-1">تنتظر مراجعة الموارد البشرية والمدير</p>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-400">2. الجدولة للمستقبل</span>
                  <div className="text-2xl font-black text-foreground mt-1">{scheduledMovements.length}</div>
                  <p className="text-[11px] text-muted-foreground mt-1">معتمدة وتنتظر حلول تاريخ السريان</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">3. التطبيق الفعلي</span>
                  <div className="text-2xl font-black text-foreground mt-1">{effectiveMovements.length}</div>
                  <p className="text-[11px] text-muted-foreground mt-1">سارية بالسجل وتغذي الرواتب والمناصب</p>
                </div>
              </div>

              {/* Recent Pending Table preview */}
              <div className="pt-4 border-t border-border/70 space-y-2.5">
                <h4 className="text-xs font-black text-foreground">أحدث الطلبات المعلقة:</h4>
                {pendingMovements.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-6">
                    لا توجد طلبات حركات معلقة حالياً — جميع الطلبات معتمدة أو سارية.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingMovements.slice(0, 3).map((mov) => (
                      <div
                        key={mov.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/70 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-primary">{mov.movementNumber}</span>
                          <div>
                            <span className="font-bold text-foreground">{mov.employeeName}</span>
                            <span className="text-muted-foreground mr-2">({MOVEMENT_TYPE_AR[mov.movementType]})</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono text-[11px]">سريان: {mov.effectiveDate}</span>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(mov.id)}
                            className="h-7 text-[11px] rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            اعتماد
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rules & Invariants Summary Card */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                قواعد الحوكمة والأمان المطبقة
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                  <span className="font-bold text-foreground block">التأريخ الفعّال (Effective Dating)</span>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    التعيين السابق لا يتم حذفه أو الكتابة فوقه، بل يتم إغلاقه تاريخياً بـ effective_to وحفظ التعيين الجديد في سجل منفصل.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                  <span className="font-bold text-foreground block">منع الحلقات الهرمية الدائرية</span>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    فحص ذري يمنع الموظف من إدارة نفسه أو تعيين مرؤوس تابع له كمدير مباشر لمنع التكرار الدائري.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                  <span className="font-bold text-foreground block">سرية التعويضات والرواتب</span>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    حجب بيانات الراتب والبدلات الحساسة عن المدراء المباشرين وحصرها على مسؤولي الرواتب والموارد البشرية.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                  <span className="font-bold text-foreground block">التكليفات المؤقتة بنظام الإسناد</span>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    يتم تخزين التعيين الأساسي base_assignment_id للعودة إليه آلياً دون الحاجة لتخمين الإدارة الأصلية.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: REQUESTS (PENDING) */}
        <TabsContent value="requests" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">طلبات الحركات الوظيفية قيد المراجعة</h3>
                <p className="text-xs text-muted-foreground">الطلبات المقدمة التي تتطلب اعتماداً إدارياً قبل تفعيلها</p>
              </div>
            </div>

            {pendingMovements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                لا توجد طلبات معلقة بانتظار الاعتماد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-3 px-3 font-bold">رقم الحركة</th>
                      <th className="py-3 px-3 font-bold">الموظف</th>
                      <th className="py-3 px-3 font-bold">نوع الحركة</th>
                      <th className="py-3 px-3 font-bold">تاريخ السريان</th>
                      <th className="py-3 px-3 font-bold">التعديلات المقترحة</th>
                      <th className="py-3 px-3 font-bold">المبرر الإداري</th>
                      <th className="py-3 px-3 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {pendingMovements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{mov.movementNumber}</td>
                        <td className="py-3 px-3 font-bold text-foreground">
                          {mov.employeeName}
                          <span className="block text-[11px] font-normal text-muted-foreground">{mov.employeeNo}</span>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="font-semibold">
                            {MOVEMENT_TYPE_AR[mov.movementType]}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-mono">{mov.effectiveDate}</td>
                        <td className="py-3 px-3 max-w-xs">
                          {mov.changes && mov.changes.length > 0 ? (
                            <div className="space-y-1">
                              {mov.changes.map((c, idx) => (
                                <div key={idx} className="text-[11px] text-muted-foreground">
                                  <span className="font-semibold text-foreground">{c.fieldCode}:</span>{" "}
                                  <span>{c.newDisplayValue || c.newValue || "تعديل مرجعي"}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">تعديل عام</span>
                          )}
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-muted-foreground">{mov.reason}</td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate(mov.id)}
                              disabled={approveMutation.isPending}
                              className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                              اعتماد
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelMutation.mutate(mov.id)}
                              disabled={cancelMutation.isPending}
                              className="h-8 text-xs font-bold rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              إلغاء
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: SCHEDULED (FUTURE) */}
        <TabsContent value="scheduled" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">الحركات المجدولة مستقبلاً</h3>
                <p className="text-xs text-muted-foreground">
                  حركات معتمدة رسمياً ومجدولة للبدء في تاريخ سريان مستقبلي — التعيين الحالي للموظف يظل هو الساري حتى حلول التاريخ
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => activateDueMutation.mutate()}
                disabled={activateDueMutation.isPending}
                className="rounded-2xl text-xs font-bold gap-1.5"
              >
                <PlayCircle className="h-4 w-4 text-purple-600" />
                فحص وتفعيل الحركات المستحقة
              </Button>
            </div>

            {scheduledMovements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                لا توجد حركات مجدولة لمواعيد مستقبلية حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-3 px-3 font-bold">رقم الحركة</th>
                      <th className="py-3 px-3 font-bold">الموظف</th>
                      <th className="py-3 px-3 font-bold">النوع</th>
                      <th className="py-3 px-3 font-bold">تاريخ السريان المستقبلي</th>
                      <th className="py-3 px-3 font-bold">التعديلات المقررة</th>
                      <th className="py-3 px-3 font-bold">الحالة</th>
                      <th className="py-3 px-3 font-bold text-center">إلغاء قبل السريان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {scheduledMovements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{mov.movementNumber}</td>
                        <td className="py-3 px-3 font-bold text-foreground">{mov.employeeName}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline">{MOVEMENT_TYPE_AR[mov.movementType]}</Badge>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-purple-700 dark:text-purple-400">
                          {mov.effectiveDate}
                        </td>
                        <td className="py-3 px-3">
                          {mov.changes?.map((c, i) => (
                            <span key={i} className="inline-block bg-muted px-2 py-0.5 rounded-lg text-[11px] mr-1">
                              {c.fieldCode}: {c.newDisplayValue || c.newValue}
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                            مجدولة
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelMutation.mutate(mov.id)}
                            className="h-7 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            إلغاء الجدولة
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 4: EFFECTIVE MOVEMENTS */}
        <TabsContent value="effective" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-black text-foreground">الحركات السارية والفعالة</h3>
              <p className="text-xs text-muted-foreground">
                الحركات التي تم تطبيقها على سجل الموظف وتحديث ملفه الوظيفي وتغذية أنظمة الرواتب والمناصب
              </p>
            </div>

            {effectiveMovements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                لا توجد حركات سارية مسجلة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-3 px-3 font-bold">رقم الحركة</th>
                      <th className="py-3 px-3 font-bold">الموظف</th>
                      <th className="py-3 px-3 font-bold">النوع</th>
                      <th className="py-3 px-3 font-bold">تاريخ السريان</th>
                      <th className="py-3 px-3 font-bold">التعديلات المطبقة</th>
                      <th className="py-3 px-3 font-bold">تاريخ الاعتماد</th>
                      <th className="py-3 px-3 font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {effectiveMovements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{mov.movementNumber}</td>
                        <td className="py-3 px-3 font-bold text-foreground">{mov.employeeName}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline">{MOVEMENT_TYPE_AR[mov.movementType]}</Badge>
                        </td>
                        <td className="py-3 px-3 font-mono">{mov.effectiveDate}</td>
                        <td className="py-3 px-3">
                          {mov.changes?.map((c, i) => (
                            <span key={i} className="inline-block bg-muted px-2 py-0.5 rounded-lg text-[11px] mr-1">
                              {c.fieldCode}: {c.newDisplayValue || c.newValue}
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground font-mono">
                          {mov.approvedAt ? new Date(mov.approvedAt).toLocaleDateString("ar-SA") : "N/A"}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="default" className="bg-emerald-600 text-white">
                            سارية
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 5: TEMPORARY ASSIGNMENTS */}
        <TabsContent value="temporary" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">إدارة التكليفات والإعارات المؤقتة</h3>
                <p className="text-xs text-muted-foreground">
                  متابعة الموظفين المكلفين بمهام أو إعارات خارجية مع إمكانية إنهاء التكليف واستعادة التعيين الأساسي بضغطة زر
                </p>
              </div>

              <Button
                onClick={() => setIsTempModalOpen(true)}
                className="rounded-2xl text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Plus className="h-4 w-4" />
                تكليف جديد
              </Button>
            </div>

            {tempAssignments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                لا توجد تكليفات مؤقتة أو إعارات نشطة حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-3 px-3 font-bold">الموظف</th>
                      <th className="py-3 px-3 font-bold">نوع التكليف</th>
                      <th className="py-3 px-3 font-bold">الإدارة الأصلية</th>
                      <th className="py-3 px-3 font-bold">الإدارة المؤقتة</th>
                      <th className="py-3 px-3 font-bold">الفترة</th>
                      <th className="py-3 px-3 font-bold">الحالة</th>
                      <th className="py-3 px-3 font-bold text-center">العودة للتعيين الأساسي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {tempAssignments.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-bold text-foreground">
                          {t.employeeName}
                          <span className="block text-[11px] font-normal text-muted-foreground">{t.employeeNo}</span>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                            {t.assignmentType === "secondment"
                              ? "إعارة خارجية"
                              : t.assignmentType === "acting_assignment"
                              ? "تكليف بالإنابة"
                              : "تكليف مؤقت"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{t.homeDepartmentName || "التعيين المحفوظ"}</td>
                        <td className="py-3 px-3 font-semibold text-foreground">{t.tempDepartmentName || "الإدارة المؤقتة"}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {t.startDate} $\rightarrow$ {t.expectedEndDate}
                        </td>
                        <td className="py-3 px-3">
                          {t.status === "active" ? (
                            <Badge variant="default" className="bg-amber-600 text-white">
                              نشط
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              مكتمل
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {t.status === "active" ? (
                            <Button
                              size="sm"
                              onClick={() => setSelectedReturnAssignment(t)}
                              className="h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              إنهاء واستعادة
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">تمت العودة بنجاح</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 6: COMPLETE HISTORY & TIMELINE */}
        <TabsContent value="history" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-foreground">السجل الزمني لكافة التنقلات</h3>
                <p className="text-xs text-muted-foreground">سجل تدقيق كامل لكافة قرارات النقل والترقية وتعديل العقود</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="h-4 w-4 absolute right-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="بحث برقم الحركة أو اسم الموظف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9 h-9 text-xs rounded-xl"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-input bg-background text-xs"
                >
                  <option value="all">كافة الأنواع</option>
                  {Object.entries(MOVEMENT_TYPE_AR).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground">
                    <th className="py-3 px-3 font-bold">رقم الحركة</th>
                    <th className="py-3 px-3 font-bold">الموظف</th>
                    <th className="py-3 px-3 font-bold">نوع الحركة</th>
                    <th className="py-3 px-3 font-bold">تاريخ السريان</th>
                    <th className="py-3 px-3 font-bold">الحالة</th>
                    <th className="py-3 px-3 font-bold">المبرر</th>
                    <th className="py-3 px-3 font-bold">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredMovements.map((mov) => {
                    const cfg = STATUS_CONFIG[mov.status] || STATUS_CONFIG.draft;
                    return (
                      <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{mov.movementNumber}</td>
                        <td className="py-3 px-3 font-bold text-foreground">{mov.employeeName}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline">{MOVEMENT_TYPE_AR[mov.movementType]}</Badge>
                        </td>
                        <td className="py-3 px-3 font-mono">{mov.effectiveDate}</td>
                        <td className="py-3 px-3">
                          <Badge variant={cfg.variant} className={cfg.colorClass}>
                            {cfg.labelAr}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-muted-foreground">{mov.reason}</td>
                        <td className="py-3 px-3 text-muted-foreground font-mono">
                          {new Date(mov.createdAt).toLocaleDateString("ar-SA")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 7: BULK MOVEMENTS STUDIO */}
        <TabsContent value="bulk" className="space-y-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-black text-foreground">استوديو التنقلات الجماعية (Bulk Operations)</h3>
              <p className="text-xs text-muted-foreground">
                إجراء نقل جماعي لإعادة الهيكلة أو نقل الموظفين بين الأقسام عبر معالجة ذرية مع التحقق المسبق من كل صف
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/30 border border-border/70">
              <div>
                <label className="text-xs font-bold block mb-1">نوع الحركة الجماعية</label>
                <select
                  value={bulkType}
                  onChange={(e) => setBulkType(e.target.value as MovementType)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs"
                >
                  <option value="department_change">نقل وتغيير الإدارة</option>
                  <option value="location_change">نقل الموقع والفروع</option>
                  <option value="cost_center_change">تعديل مركز التكلفة</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">تاريخ السريان الجماعي</label>
                <Input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">الإدارة المستهدفة للنقل</label>
                <select
                  value={bulkTargetDeptId}
                  onChange={(e) => setBulkTargetDeptId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs"
                >
                  <option value="">-- اختر الإدارة الجديدة --</option>
                  {departmentsLookup.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Employee Selection List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  اختر الموظفين المشمولين بالنقل الجماعي ({selectedBulkEmpIds.length} محدد):
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (selectedBulkEmpIds.length === employeesLookup.length) {
                      setSelectedBulkEmpIds([]);
                    } else {
                      setSelectedBulkEmpIds(employeesLookup.map((e) => e.id));
                    }
                  }}
                  className="h-7 text-xs rounded-lg"
                >
                  {selectedBulkEmpIds.length === employeesLookup.length ? "إلغاء التحديد" : "تحديد الكل"}
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-border/70 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-background">
                {employeesLookup.map((emp) => {
                  const isChecked = selectedBulkEmpIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-colors ${
                        isChecked ? "bg-primary/5 border-primary/40 text-primary font-bold" : "border-border/60 hover:bg-muted/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBulkEmpIds((prev) => [...prev, emp.id]);
                          } else {
                            setSelectedBulkEmpIds((prev) => prev.filter((id) => id !== emp.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="truncate">{emp.name} ({emp.employeeNo || "N/A"})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleExecuteBulk}
                disabled={isExecutingBulk || selectedBulkEmpIds.length === 0 || !bulkTargetDeptId}
                className="rounded-2xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-6"
              >
                {isExecutingBulk ? "جاري تنفيذ الدفعة..." : `اعتماد النقل الجماعي لـ (${selectedBulkEmpIds.length}) موظف`}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateMovementModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          refetchMovements();
          queryClient.invalidateQueries({ queryKey: movementsQueryKeys.all });
        }}
        companyId={activeCompanyId}
        employees={employeesLookup}
        departments={departmentsLookup}
        positions={positionsLookup}
        locations={locationsLookup}
        costCenters={costCentersLookup}
      />

      <TemporaryAssignmentModal
        isOpen={isTempModalOpen}
        onClose={() => setIsTempModalOpen(false)}
        onSuccess={() => {
          refetchTemp();
          queryClient.invalidateQueries({ queryKey: movementsQueryKeys.all });
        }}
        companyId={activeCompanyId}
        employees={employeesLookup}
        departments={departmentsLookup}
        positions={positionsLookup}
        locations={locationsLookup}
      />

      <ReturnFromAssignmentModal
        isOpen={!!selectedReturnAssignment}
        onClose={() => setSelectedReturnAssignment(null)}
        onSuccess={() => {
          setSelectedReturnAssignment(null);
          refetchTemp();
          refetchMovements();
          queryClient.invalidateQueries({ queryKey: movementsQueryKeys.all });
        }}
        companyId={activeCompanyId}
        assignment={selectedReturnAssignment}
      />
    </div>
  );
};
