import React, { useMemo, useState } from "react";
import { OrgChartSvg, type OrgChartNodeData, defaultCompanyTree } from "./OrgChartSvg";
import { CostCentersPanel, JobPositionsPanel } from "./OrganizationPlanningPanels";
import { CompanyProfilePanel } from "./CompanyProfilePanel";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import {
  Building2,
  MapPin,
  Users,
  Plus,
  Network,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Layers,
  Search,
  Briefcase,
  TrendingUp,
  FileCheck,
  Pencil,
  Trash2,
  ExternalLink,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  Eye,
  UserCheck,
  AlertTriangle,
  Compass,
  ArrowUpDown,
  Building,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { OrgUnit, Subsidiary, WorkLocation, Employee } from "../../types";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

type OrgUnitType = OrgUnit["type"];

const unitTypeLabel: Record<OrgUnitType, string> = {
  division: "قطاع تنفيذي",
  department: "إدارة عامة",
  section: "قسم",
  unit: "وحدة",
};

const locationTypeLabel: Record<string, string> = {
  headquarters: "المقر الرئيسي",
  branch: "فرع تشغيلي",
  office: "مكتب إداري",
  warehouse: "مستودع لوجستي",
  remote: "عمل عن بُعد",
};

export const OrganizationView: React.FC = () => {
  const {
    company,
    subsidiaries,
    orgUnits,
    workLocations,
    costCenters,
    jobPositions,
    employees,
    addOrgUnit,
    updateOrgUnit,
    deleteOrgUnit,
    addSubsidiary,
    updateSubsidiary,
    deleteSubsidiary,
    addWorkLocation,
    updateWorkLocation,
    deleteWorkLocation,
    updateEmployee,
    openEmployeeProfile,
    currentRole,
    language,
    t,
    isSaving,
  } = useApp();

  const canManage = canManageModule(currentRole, "organization");
  const [activeTab, setActiveTab] = useState("structure");

  // Department Filters & View Mode
  const [deptSearch, setDeptSearch] = useState("");
  const [deptTypeFilter, setDeptTypeFilter] = useState<string>("all");
  const [deptSubFilter, setDeptSubFilter] = useState<string>("all");
  const [deptViewMode, setDeptViewMode] = useState<"grid" | "table">("grid");

  // Subsidiary & Location Filters
  const [subSearch, setSubSearch] = useState("");
  const [locSearch, setLocSearch] = useState("");

  // Department Modals State
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isEditDeptOpen, setIsEditDeptOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deleteDeptConfirm, setDeleteDeptConfirm] = useState<OrgUnit | null>(null);
  const [reassignDeptId, setReassignDeptId] = useState<string>("");
  const [viewEmployeesDept, setViewEmployeesDept] = useState<OrgUnit | null>(null);

  // Department Form State
  const [deptForm, setDeptForm] = useState({
    nameAr: "",
    nameEn: "",
    code: "",
    type: "department" as OrgUnitType,
    managerName: "",
    managerEmployeeId: "",
    parentId: "",
    subsidiaryId: "",
    costCenterId: "",
  });

  // Subsidiary Modals State
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [isEditSubOpen, setIsEditSubOpen] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [deleteSubConfirm, setDeleteSubConfirm] = useState<Subsidiary | null>(null);

  const [subForm, setSubForm] = useState({
    nameAr: "",
    nameEn: "",
    code: "",
    crNumber: "",
    taxNumber: "",
    unifiedNumber: "",
    managerName: "",
    managerEmployeeId: "",
    city: "الرياض",
    address: "",
    email: "",
    phone: "",
    status: "active" as "active" | "inactive",
  });

  // Location Modals State
  const [isAddLocOpen, setIsAddLocOpen] = useState(false);
  const [isEditLocOpen, setIsEditLocOpen] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [deleteLocConfirm, setDeleteLocConfirm] = useState<WorkLocation | null>(null);

  const [locForm, setLocForm] = useState({
    nameAr: "",
    nameEn: "",
    code: "",
    address: "الرياض - طريق الملك فهد",
    city: "الرياض",
    locationType: "branch" as WorkLocation["locationType"],
    latitude: 24.7136,
    longitude: 46.6753,
    radiusMeters: 150,
    status: "active" as "active" | "inactive",
    subsidiaryId: "",
  });

  // Org Chart Node State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedUnit = useMemo(
    () => orgUnits.find((unit) => unit.id === selectedNodeId) ?? null,
    [orgUnits, selectedNodeId],
  );

  // Dynamic Headcount Helpers
  const getDeptEmployees = (deptId: string) =>
    employees.filter((e) => e.departmentId === deptId);

  const getDeptSalaryMass = (deptId: string) => {
    const deptEmps = getDeptEmployees(deptId);
    return deptEmps.reduce((sum, e) => {
      const basic = e.basicSalary || 7500;
      const housing = e.housingAllowance || 1875;
      return sum + basic + housing;
    }, 0);
  };

  const getSubEmployees = (subId: string) =>
    employees.filter((e) => e.subsidiaryId === subId);

  const getLocEmployees = (locId: string) =>
    employees.filter((e) => e.workLocationId === locId);

  // Filtered Departments
  const filteredOrgUnits = useMemo(() => {
    return orgUnits.filter((unit) => {
      if (deptTypeFilter !== "all" && unit.type !== deptTypeFilter) return false;
      if (deptSubFilter !== "all" && unit.subsidiaryId !== deptSubFilter) return false;
      if (deptSearch.trim()) {
        const q = deptSearch.trim().toLowerCase();
        const matches =
          unit.nameAr.toLowerCase().includes(q) ||
          unit.nameEn.toLowerCase().includes(q) ||
          unit.code.toLowerCase().includes(q) ||
          (unit.managerName && unit.managerName.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [orgUnits, deptTypeFilter, deptSubFilter, deptSearch]);

  // Filtered Subsidiaries
  const filteredSubsidiaries = useMemo(() => {
    if (!subSearch.trim()) return subsidiaries;
    const q = subSearch.trim().toLowerCase();
    return subsidiaries.filter(
      (s) =>
        s.nameAr.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.crNumber && s.crNumber.includes(q)) ||
        (s.managerName && s.managerName.toLowerCase().includes(q)),
    );
  }, [subsidiaries, subSearch]);

  // Filtered Work Locations
  const filteredWorkLocations = useMemo(() => {
    if (!locSearch.trim()) return workLocations;
    const q = locSearch.trim().toLowerCase();
    return workLocations.filter(
      (l) =>
        l.nameAr.toLowerCase().includes(q) ||
        l.nameEn.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q) ||
        (l.city && l.city.toLowerCase().includes(q)),
    );
  }, [workLocations, locSearch]);

  // Chart Tree Structure with live headcount
  const chartRoot = useMemo<OrgChartNodeData>(() => {
    if (!orgUnits || orgUnits.length === 0) {
      return defaultCompanyTree;
    }

    const byParent = new Map<string, typeof orgUnits>();
    const ids = new Set(orgUnits.map((unit) => unit.id));
    orgUnits.forEach((unit) => {
      const key = unit.parentId && ids.has(unit.parentId) ? unit.parentId : "__root__";
      const bucket = byParent.get(key) ?? [];
      bucket.push(unit);
      byParent.set(key, bucket);
    });

    const build = (parentKey: string, depth: number): OrgChartNodeData[] => {
      if (depth > 8) return [];
      return (byParent.get(parentKey) ?? []).map((unit) => {
        const headcount = getDeptEmployees(unit.id).length || unit.employeeCount;
        const salary = getDeptSalaryMass(unit.id);
        return {
          id: unit.id,
          titleAr: unit.nameAr,
          titleEn: unit.nameEn,
          subtitle: unit.managerName || "بدون مدير معين",
          managerName: unit.managerName,
          code: unit.code,
          kind: unit.type,
          employeeCount: headcount,
          openPositions: 2,
          budgetMonthly: salary || headcount * 16500,
          children: build(unit.id, depth + 1),
        };
      });
    };

    return {
      id: "__company__",
      titleAr: company.legalNameAr || "مجموعة كلاسيرا القابضة",
      titleEn: company.legalNameEn || "Classera Holding Group",
      subtitle: `سجل تجاري ${company.crNumber || "1010892341"}`,
      managerName: "م. عبد العزيز الفهد • الرئيس التنفيذي",
      code: company.id || "HQ-01",
      kind: "company",
      employeeCount: employees.length || 120,
      openPositions: 8,
      budgetMonthly: (employees.length || 120) * 17500,
      children: build("__root__", 1),
    };
  }, [orgUnits, company, employees]);

  // ===================== CRUD HANDLERS =====================

  // 1. Department Handlers
  const resetDeptForm = () => {
    setDeptForm({
      nameAr: "",
      nameEn: "",
      code: `DEP-${Math.floor(100 + Math.random() * 900)}`,
      type: "department",
      managerName: "",
      managerEmployeeId: "",
      parentId: "",
      subsidiaryId: "",
      costCenterId: "",
    });
    setEditingDeptId(null);
  };

  const handleCreateDept = async () => {
    if (isSaving) return;
    if (!deptForm.nameAr.trim()) {
      toast.error("يرجى إدخال اسم الإدارة / القسم بالعربية");
      return;
    }
    const saved = await addOrgUnit({
      companyId: company.id,
      parentId: deptForm.parentId || null,
      subsidiaryId: deptForm.subsidiaryId || null,
      costCenterId: deptForm.costCenterId || null,
      nameAr: deptForm.nameAr.trim(),
      nameEn: deptForm.nameEn.trim() || deptForm.nameAr.trim(),
      code: deptForm.code.trim() || `DEP-${Date.now().toString().slice(-4)}`,
      type: deptForm.type,
      managerEmployeeId: deptForm.managerEmployeeId || undefined,
      managerName: deptForm.managerName || "غير معين",
      status: "active",
    });
    if (!saved) return;
    toast.success("تمت إضافة الإدارة للهيكل التنظيمي بنجاح");
    setIsAddDeptOpen(false);
    resetDeptForm();
  };

  const startEditDept = (unit: OrgUnit) => {
    setEditingDeptId(unit.id);
    setDeptForm({
      nameAr: unit.nameAr,
      nameEn: unit.nameEn,
      code: unit.code,
      type: unit.type,
      managerName: unit.managerName || "",
      managerEmployeeId: unit.managerEmployeeId || "",
      parentId: unit.parentId || "",
      subsidiaryId: unit.subsidiaryId || "",
      costCenterId: unit.costCenterId || "",
    });
    setIsEditDeptOpen(true);
  };

  const handleUpdateDept = async () => {
    if (isSaving || !editingDeptId) return;
    if (!deptForm.nameAr.trim()) {
      toast.error("يرجى إدخال اسم الإدارة بالعربية");
      return;
    }
    const saved = await updateOrgUnit(editingDeptId, {
      companyId: company.id,
      parentId: deptForm.parentId || null,
      subsidiaryId: deptForm.subsidiaryId || null,
      costCenterId: deptForm.costCenterId || null,
      nameAr: deptForm.nameAr.trim(),
      nameEn: deptForm.nameEn.trim() || deptForm.nameAr.trim(),
      code: deptForm.code.trim(),
      type: deptForm.type,
      managerEmployeeId: deptForm.managerEmployeeId || undefined,
      managerName: deptForm.managerName || "غير معين",
      status: "active",
    });
    if (!saved) return;
    toast.success("تم تحديث بيانات الإدارة بنجاح");
    setIsEditDeptOpen(false);
    resetDeptForm();
  };

  const handleDeleteDept = async () => {
    if (!deleteDeptConfirm || isSaving) return;
    const deptId = deleteDeptConfirm.id;
    const deptEmps = getDeptEmployees(deptId);

    // If reassign department is chosen for existing employees
    if (reassignDeptId && deptEmps.length > 0) {
      for (const emp of deptEmps) {
        await updateEmployee(emp.id, { departmentId: reassignDeptId });
      }
    }

    const ok = await deleteOrgUnit(deptId);
    if (ok) {
      toast.success(`تم حذف الإدارة ${deleteDeptConfirm.nameAr} بنجاح`);
    } else {
      toast.error("تعذر حذف الإدارة");
    }
    setDeleteDeptConfirm(null);
    setReassignDeptId("");
  };

  // 2. Subsidiary Handlers
  const resetSubForm = () => {
    setSubForm({
      nameAr: "",
      nameEn: "",
      code: `SUB-${Math.floor(10 + Math.random() * 90)}`,
      crNumber: "1010" + Math.floor(100000 + Math.random() * 900000),
      taxNumber: "310" + Math.floor(100000000 + Math.random() * 900000000) + "00003",
      unifiedNumber: "700" + Math.floor(1000000 + Math.random() * 9000000),
      managerName: "",
      managerEmployeeId: "",
      city: "الرياض",
      address: "",
      email: "",
      phone: "",
      status: "active",
    });
    setEditingSubId(null);
  };

  const handleCreateSub = async () => {
    if (isSaving) return;
    if (!subForm.nameAr.trim()) {
      toast.error("يرجى إدخال اسم الشركة التابعة بالعربية");
      return;
    }
    const saved = await addSubsidiary({
      companyId: company.id,
      nameAr: subForm.nameAr.trim(),
      nameEn: subForm.nameEn.trim() || subForm.nameAr.trim(),
      code: subForm.code.trim() || `SUB-${Date.now().toString().slice(-4)}`,
      crNumber: subForm.crNumber.trim() || undefined,
      taxNumber: subForm.taxNumber.trim() || undefined,
      unifiedNumber: subForm.unifiedNumber.trim() || undefined,
      managerName: subForm.managerName || "غير معين",
      managerEmployeeId: subForm.managerEmployeeId || undefined,
      city: subForm.city,
      address: subForm.address,
      email: subForm.email,
      phone: subForm.phone,
      status: subForm.status,
    });
    if (!saved) return;
    toast.success("تمت إضافة الكيان والشركة التابعة بنجاح");
    setIsAddSubOpen(false);
    resetSubForm();
  };

  const startEditSub = (sub: Subsidiary) => {
    setEditingSubId(sub.id);
    setSubForm({
      nameAr: sub.nameAr,
      nameEn: sub.nameEn,
      code: sub.code,
      crNumber: sub.crNumber || "",
      taxNumber: sub.taxNumber || "",
      unifiedNumber: sub.unifiedNumber || "",
      managerName: sub.managerName || "",
      managerEmployeeId: sub.managerEmployeeId || "",
      city: sub.city || "الرياض",
      address: sub.address || "",
      email: sub.email || "",
      phone: sub.phone || "",
      status: sub.status,
    });
    setIsEditSubOpen(true);
  };

  const handleUpdateSub = async () => {
    if (isSaving || !editingSubId) return;
    if (!subForm.nameAr.trim()) {
      toast.error("يرجى إدخال اسم الشركة التابعة");
      return;
    }
    const saved = await updateSubsidiary(editingSubId, {
      companyId: company.id,
      nameAr: subForm.nameAr.trim(),
      nameEn: subForm.nameEn.trim() || subForm.nameAr.trim(),
      code: subForm.code.trim(),
      crNumber: subForm.crNumber.trim() || undefined,
      taxNumber: subForm.taxNumber.trim() || undefined,
      unifiedNumber: subForm.unifiedNumber.trim() || undefined,
      managerName: subForm.managerName || "غير معين",
      managerEmployeeId: subForm.managerEmployeeId || undefined,
      city: subForm.city,
      address: subForm.address,
      email: subForm.email,
      phone: subForm.phone,
      status: subForm.status,
    });
    if (!saved) return;
    toast.success("تم تحديث بيانات الشركة التابعة بنجاح");
    setIsEditSubOpen(false);
    resetSubForm();
  };

  const handleDeleteSub = async () => {
    if (!deleteSubConfirm || isSaving) return;
    const ok = await deleteSubsidiary(deleteSubConfirm.id);
    if (ok) {
      toast.success(`تم حذف الشركة التابعة ${deleteSubConfirm.nameAr} بنجاح`);
    } else {
      toast.error("تعذر حذف الشركة التابعة");
    }
    setDeleteSubConfirm(null);
  };

  // 3. Work Location Handlers
  const resetLocForm = () => {
    setLocForm({
      nameAr: "",
      nameEn: "",
      code: `LOC-${Math.floor(10 + Math.random() * 90)}`,
      address: "الرياض - طريق الملك فهد",
      city: "الرياض",
      locationType: "branch",
      latitude: 24.7136,
      longitude: 46.6753,
      radiusMeters: 150,
      status: "active",
      subsidiaryId: "",
    });
    setEditingLocId(null);
  };

  const handleCreateLoc = async () => {
    if (isSaving) return;
    if (!locForm.nameAr.trim()) {
      toast.error("يرجى إدخال اسم المقر / الفرع بالعربية");
      return;
    }
    const saved = await addWorkLocation({
      companyId: company.id,
      subsidiaryId: locForm.subsidiaryId || null,
      nameAr: locForm.nameAr.trim(),
      nameEn: locForm.nameEn.trim() || locForm.nameAr.trim(),
      code: locForm.code.trim() || `LOC-${Date.now().toString().slice(-4)}`,
      address: locForm.address.trim(),
      city: locForm.city,
      locationType: locForm.locationType,
      latitude: Number(locForm.latitude) || 24.7136,
      longitude: Number(locForm.longitude) || 46.6753,
      radiusMeters: Number(locForm.radiusMeters) || 150,
      status: locForm.status,
    });
    if (!saved) return;
    toast.success("تمت إضافة الموقع الجغرافي ونطاق السياج بنجاح");
    setIsAddLocOpen(false);
    resetLocForm();
  };

  const startEditLoc = (loc: WorkLocation) => {
    setEditingLocId(loc.id);
    setLocForm({
      nameAr: loc.nameAr,
      nameEn: loc.nameEn,
      code: loc.code,
      address: loc.address,
      city: loc.city || "الرياض",
      locationType: loc.locationType || "branch",
      latitude: loc.latitude,
      longitude: loc.longitude,
      radiusMeters: loc.radiusMeters,
      status: loc.status,
      subsidiaryId: loc.subsidiaryId || "",
    });
    setIsEditLocOpen(true);
  };

  const handleUpdateLoc = async () => {
    if (isSaving || !editingLocId) return;
    if (!locForm.nameAr.trim()) {
      toast.error("يرجى إدخال اسم الموقع الجغرافي");
      return;
    }
    const saved = await updateWorkLocation(editingLocId, {
      companyId: company.id,
      subsidiaryId: locForm.subsidiaryId || null,
      nameAr: locForm.nameAr.trim(),
      nameEn: locForm.nameEn.trim() || locForm.nameAr.trim(),
      code: locForm.code.trim(),
      address: locForm.address.trim(),
      city: locForm.city,
      locationType: locForm.locationType,
      latitude: Number(locForm.latitude),
      longitude: Number(locForm.longitude),
      radiusMeters: Number(locForm.radiusMeters),
      status: locForm.status,
    });
    if (!saved) return;
    toast.success("تم تحديث بيانات الموقع الجغرافي والسياج بنجاح");
    setIsEditLocOpen(false);
    resetLocForm();
  };

  const handleDeleteLoc = async () => {
    if (!deleteLocConfirm || isSaving) return;
    const ok = await deleteWorkLocation(deleteLocConfirm.id);
    if (ok) {
      toast.success(`تم حذف الموقع ${deleteLocConfirm.nameAr} وإعادة توجيه الموظفين بنجاح`);
    } else {
      toast.error("تعذر حذف الموقع");
    }
    setDeleteLocConfirm(null);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  {company.legalNameAr || "إدارة المنشأة والهيكل التنظيمي"}
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5"
                >
                  الحوكمة المؤسسية المعتمدة
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                التحكم الكامل في الكيان القانوني، شجرة الهيكل التنظيمي، الشركات التابعة، والمواقع الجغرافية بنظام السياج (GPS Geofencing)
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                resetDeptForm();
                setIsAddDeptOpen(true);
              }}
              size="sm"
              className="classera-btn-primary rounded-full font-bold text-xs gap-1.5 shadow-xs h-10 px-5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {t.org.addDepartment}
            </Button>
            <Button
              onClick={() => {
                resetSubForm();
                setIsAddSubOpen(true);
              }}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
            >
              <Building className="h-4 w-4 text-primary" />
              إضافة شركة تابعة
            </Button>
            <Button
              onClick={() => {
                resetLocForm();
                setIsAddLocOpen(true);
              }}
              variant="secondary"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs cursor-pointer"
            >
              <MapPin className="h-4 w-4 text-emerald-600" />
              إضافة موقع وسياج GPS
            </Button>
          </div>
        )}
      </div>

      {/* Primary KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              الكيانات والشركات التابعة
            </span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {subsidiaries.length + 1} كيانات قانونية
            </h4>
            <span className="text-[10px] text-primary font-bold">سجلات تجارية مستقلة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">الإدارات والأقسام المعتمدة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {orgUnits.length} وحدة تنظيمية
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">هيكل إداري موحد 100%</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Network className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              فروع العمل وسياج GPS
            </span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {workLocations.length} مواقع معتمدة
            </h4>
            <span className="text-[10px] text-amber-600 font-bold">دقة السياج 50م - 1000م</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <MapPin className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">
              إجمالي القوى العاملة المسجلة
            </span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {employees.length} موظف مسجل
            </h4>
            <span className="text-[10px] text-primary font-bold">ربط مباشر بقوى والتأمينات</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="classera-tabs-strip">
          <TabsTrigger
            value="structure"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
          >
            {t.org.departments} ({orgUnits.length})
          </TabsTrigger>
          <TabsTrigger
            value="orgchart"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
          >
            {t.org.orgChart} الشجري
          </TabsTrigger>
          <TabsTrigger
            value="subsidiaries"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
          >
            {t.org.subsidiaries} ({subsidiaries.length})
          </TabsTrigger>
          <TabsTrigger
            value="locations"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
          >
            {t.org.locations} ({workLocations.length})
          </TabsTrigger>
          <TabsTrigger
            value="positions"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
          >
            المناصب ({jobPositions.length})
          </TabsTrigger>
          <TabsTrigger
            value="cost-centers"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
          >
            مراكز التكلفة ({costCenters.length})
          </TabsTrigger>
          <TabsTrigger
            value="company"
            className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5"
          >
            بيانات المنشأة والحسابات
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: DEPARTMENTS & STRUCTURE ==================== */}
        <TabsContent value="structure" className="space-y-4 pt-4">
          {/* Top Control Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="absolute right-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  placeholder="بحث باسم الإدارة، الرمز، أو المدير..."
                  className="h-10 w-full rounded-full border border-border/80 bg-muted/40 pr-10 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>

              {/* Type Filter */}
              <select
                value={deptTypeFilter}
                onChange={(e) => setDeptTypeFilter(e.target.value)}
                className="h-10 rounded-full border border-border/80 bg-muted/40 px-3.5 text-xs font-bold text-foreground focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">كافة المستويات التنظيمية</option>
                <option value="division">قطاع تنفيذي</option>
                <option value="department">إدارة عامة</option>
                <option value="section">قسم</option>
                <option value="unit">وحدة</option>
              </select>

              {/* Subsidiary Filter */}
              {subsidiaries.length > 0 && (
                <select
                  value={deptSubFilter}
                  onChange={(e) => setDeptSubFilter(e.target.value)}
                  className="h-10 rounded-full border border-border/80 bg-muted/40 px-3.5 text-xs font-bold text-foreground focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="all">كافة الكيانات والشركات</option>
                  {subsidiaries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* View Switcher & Actions */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <div className="flex items-center rounded-full border border-border/80 bg-muted/30 p-1">
                <Button
                  size="sm"
                  variant={deptViewMode === "grid" ? "secondary" : "ghost"}
                  className="h-8 rounded-full text-xs font-bold px-3 gap-1"
                  onClick={() => setDeptViewMode("grid")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  بطاقات
                </Button>
                <Button
                  size="sm"
                  variant={deptViewMode === "table" ? "secondary" : "ghost"}
                  className="h-8 rounded-full text-xs font-bold px-3 gap-1"
                  onClick={() => setDeptViewMode("table")}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  جدول بيانات
                </Button>
              </div>

              {canManage && (
                <Button
                  onClick={() => {
                    resetDeptForm();
                    setIsAddDeptOpen(true);
                  }}
                  size="sm"
                  className="rounded-full text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
                >
                  <Plus className="h-4 w-4" />
                  إضافة إدارة
                </Button>
              )}
            </div>
          </div>

          {/* GRID VIEW */}
          {deptViewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrgUnits.map((unit) => {
                const deptEmps = getDeptEmployees(unit.id);
                const headcount = deptEmps.length || unit.employeeCount;
                const salaryMass = getDeptSalaryMass(unit.id);
                const parentUnit = orgUnits.find((u) => u.id === unit.parentId);

                return (
                  <div
                    key={unit.id}
                    className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4 hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Badges & Actions */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-xs font-mono shadow-xs">
                            {unit.code.substring(0, 4)}
                          </div>
                          <div>
                            <h3 className="font-black text-sm text-foreground">
                              {language === "ar" ? unit.nameAr : unit.nameEn}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                {unit.code}
                              </span>
                              <span className="text-muted-foreground text-xs">•</span>
                              <span className="text-[10px] text-primary font-bold">
                                {unitTypeLabel[unit.type]}
                              </span>
                            </div>
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                              title="تعديل بيانات الإدارة"
                              onClick={() => startEditDept(unit)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                              title="حذف الإدارة"
                              onClick={() => {
                                setDeleteDeptConfirm(unit);
                                setReassignDeptId("");
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Parent Breadcrumb if applicable */}
                      {parentUnit && (
                        <div className="rounded-xl bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span>تابعة لـ:</span>
                          <span className="font-bold text-foreground">{parentUnit.nameAr}</span>
                        </div>
                      )}

                      {/* Metrics Box */}
                      <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs">
                        <div className="rounded-2xl bg-muted/30 p-2.5 space-y-0.5">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            القوى العاملة
                          </span>
                          <p className="text-sm font-black text-primary font-mono">
                            {headcount} موظف
                          </p>
                        </div>
                        <div className="rounded-2xl bg-muted/30 p-2.5 space-y-0.5">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            الكتلة المالية الشهرية
                          </span>
                          <p className="text-sm font-black text-foreground font-mono">
                            {salaryMass.toLocaleString("ar-SA")} ر.س
                          </p>
                        </div>
                      </div>

                      {/* Manager Section */}
                      <div className="border-t border-border/60 pt-2.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">المدير المسؤول:</span>
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                          {unit.managerName || "غير معين"}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Quick Actions */}
                    <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-[11px] font-bold h-8 px-3 gap-1 border-border/80 hover:bg-secondary flex-1"
                        onClick={() => setViewEmployeesDept(unit)}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                        استعراض الموظفين ({headcount})
                      </Button>

                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-[11px] font-bold h-8 px-3 gap-1 text-primary hover:bg-primary/10"
                          onClick={() => {
                            resetDeptForm();
                            setDeptForm((prev) => ({
                              ...prev,
                              parentId: unit.id,
                              type: unit.type === "division" ? "department" : "section",
                            }));
                            setIsAddDeptOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          قسم فرعي
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE VIEW */}
          {deptViewMode === "table" && (
            <div className="overflow-x-auto rounded-3xl border border-border/80 bg-card shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="p-4">رمز واسم الإدارة</th>
                    <th className="p-4">المستوى التنظيمي</th>
                    <th className="p-4">الوحدة الأب</th>
                    <th className="p-4">المدير المسؤول</th>
                    <th className="p-4">القوى العاملة</th>
                    <th className="p-4">الكتلة المالية (شهرياً)</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredOrgUnits.map((unit) => {
                    const deptEmps = getDeptEmployees(unit.id);
                    const headcount = deptEmps.length || unit.employeeCount;
                    const salaryMass = getDeptSalaryMass(unit.id);
                    const parentUnit = orgUnits.find((u) => u.id === unit.parentId);

                    return (
                      <tr key={unit.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <span className="font-black text-foreground text-sm block">
                            {unit.nameAr}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {unit.code} • {unit.nameEn}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="rounded-full text-[10px] font-bold text-primary border-primary/30">
                            {unitTypeLabel[unit.type]}
                          </Badge>
                        </td>
                        <td className="p-4 text-muted-foreground font-medium">
                          {parentUnit ? parentUnit.nameAr : "— المقر الرئيسي"}
                        </td>
                        <td className="p-4 font-bold text-foreground">
                          {unit.managerName || "غير معين"}
                        </td>
                        <td className="p-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="font-mono font-black text-primary hover:underline h-7 px-2"
                            onClick={() => setViewEmployeesDept(unit)}
                          >
                            {headcount} موظف
                          </Button>
                        </td>
                        <td className="p-4 font-mono font-bold text-foreground">
                          {salaryMass.toLocaleString("ar-SA")} ر.س
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                              title="استعراض الموظفين"
                              onClick={() => setViewEmployeesDept(unit)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                                  title="تعديل"
                                  onClick={() => startEditDept(unit)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                                  title="حذف"
                                  onClick={() => {
                                    setDeleteDeptConfirm(unit);
                                    setReassignDeptId("");
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredOrgUnits.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
              لا توجد إدارات أو وحدات تنظيمية مطابقة للبحث أو التصفية الحالية.
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB 2: INTERACTIVE SVG ORG CHART ==================== */}
        <TabsContent value="orgchart" className="pt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <div>
              <OrgChartSvg
                root={chartRoot}
                language={language}
                selectedId={selectedNodeId}
                onSelect={setSelectedNodeId}
              />
            </div>

            {/* Sidebar Inspector Node Details */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Network className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black text-foreground">تفاصيل العقدة في الهيكل التنظيمي</h3>
                </div>

                {!selectedUnit ? (
                  <div className="space-y-2.5 text-xs text-muted-foreground">
                    <p className="font-black text-foreground text-sm">
                      {company.legalNameAr || "مجموعة كلاسيرا القابضة"}
                    </p>
                    <p>
                      السجل التجاري:{" "}
                      <span className="font-mono font-bold text-foreground">
                        {company.crNumber || "1010892341"}
                      </span>
                    </p>
                    <p>
                      الرقم الضريبي:{" "}
                      <span className="font-mono font-bold text-foreground">
                        {company.taxNumber || "310298374600003"}
                      </span>
                    </p>
                    <p>{company.headquartersAddress || "الرياض - طريق الملك فهد - أبراج العليا"}</p>
                    <div className="pt-2">
                      <Badge variant="outline" className="text-[10px] rounded-full">
                        {employees.length} موظف مسجل • {orgUnits.length} وحدة تنظيمية
                      </Badge>
                    </div>
                    <p className="pt-2 text-[11px] text-primary font-medium leading-relaxed">
                      💡 اضغط على أي بطاقة أو دائرة في الشجرة الشجرية لتحديدها واستعراض منسوبيها وإجراء تعديلات عليها.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div>
                      <h4 className="text-sm font-black text-foreground">
                        {language === "ar" ? selectedUnit.nameAr : selectedUnit.nameEn}
                      </h4>
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">
                        {selectedUnit.code}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border/60 pt-2.5">
                      <span className="text-muted-foreground">المستوى التنظيمي:</span>
                      <span className="font-bold text-primary">
                        {unitTypeLabel[selectedUnit.type]}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المدير المسؤول:</span>
                      <span className="font-bold text-foreground">
                        {selectedUnit.managerName || "غير معين"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي القوى العاملة:</span>
                      <span className="font-black text-foreground font-mono">
                        {getDeptEmployees(selectedUnit.id).length} موظف
                      </span>
                    </div>

                    <div className="border-t border-border/60 pt-2.5 space-y-2">
                      <p className="font-bold text-foreground flex items-center justify-between">
                        <span>منسوبو هذه الإدارة</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-primary p-0"
                          onClick={() => setViewEmployeesDept(selectedUnit)}
                        >
                          عرض الكل
                        </Button>
                      </p>
                      <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                        {getDeptEmployees(selectedUnit.id)
                          .slice(0, 10)
                          .map((employee) => (
                            <div
                              key={employee.id}
                              onClick={() => openEmployeeProfile(employee)}
                              className="flex items-center justify-between rounded-xl bg-muted/30 hover:bg-secondary/50 px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors group"
                            >
                              <span className="font-bold text-foreground group-hover:text-primary group-hover:underline">
                                {employee.firstNameAr} {employee.lastNameAr}
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                {employee.jobTitleAr}
                              </span>
                            </div>
                          ))}
                        {getDeptEmployees(selectedUnit.id).length === 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            لا يوجد موظفون مسكنون حالياً في هذه الإدارة.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {canManage && selectedUnit && (
                <div className="space-y-2 pt-3 border-t border-border/60">
                  <Button
                    size="sm"
                    className="w-full text-xs font-bold rounded-full h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => startEditDept(selectedUnit)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    تعديل بيانات هذه الإدارة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs font-bold rounded-full border-primary/30 text-primary hover:bg-secondary h-9 gap-1.5"
                    onClick={() => {
                      resetDeptForm();
                      setDeptForm((prev) => ({
                        ...prev,
                        parentId: selectedUnit.id,
                        type: selectedUnit.type === "division" ? "department" : "section",
                      }));
                      setIsAddDeptOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    إضافة قسم تابع لهذه الإدارة
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ==================== TAB 3: SUBSIDIARIES ==================== */}
        <TabsContent value="subsidiaries" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute right-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                placeholder="بحث في الشركات التابعة أو السجل التجاري..."
                className="h-10 w-full rounded-full border border-border/80 bg-muted/40 pr-10 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            {canManage && (
              <Button
                onClick={() => {
                  resetSubForm();
                  setIsAddSubOpen(true);
                }}
                size="sm"
                className="rounded-full text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
              >
                <Plus className="h-4 w-4" />
                إضافة شركة تابعة
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubsidiaries.map((sub) => {
              const headcount = getSubEmployees(sub.id).length || sub.employeeCount;

              return (
                <div
                  key={sub.id}
                  className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4 hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs font-mono font-bold rounded-full px-2.5">
                        {sub.code}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200 rounded-full px-2.5 font-bold"
                      >
                        كيان تجاري معتمد
                      </Badge>
                    </div>

                    <h3 className="text-base font-black text-foreground">
                      {language === "ar" ? sub.nameAr : sub.nameEn}
                    </h3>

                    <div className="text-xs text-muted-foreground space-y-2 border-t border-border/60 pt-3">
                      <p className="flex justify-between">
                        <span>السجل التجاري:</span>
                        <span className="font-mono font-bold text-foreground">{sub.crNumber || "—"}</span>
                      </p>
                      {sub.taxNumber && (
                        <p className="flex justify-between">
                          <span>الرقم الضريبي:</span>
                          <span className="font-mono font-bold text-foreground">{sub.taxNumber}</span>
                        </p>
                      )}
                      <p className="flex justify-between">
                        <span>المدير التنفيذي:</span>
                        <span className="font-bold text-foreground">{sub.managerName || "غير معين"}</span>
                      </p>
                      <p className="flex justify-between font-bold text-primary pt-1">
                        <span>الموظفون المسكنون:</span>
                        <span className="font-mono">{headcount} موظف</span>
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="border-t border-border/60 pt-3 flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs font-bold h-8 px-3 gap-1"
                        onClick={() => startEditSub(sub)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        تعديل
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs font-bold h-8 px-3 gap-1 text-rose-600 hover:bg-rose-500/10"
                        onClick={() => setDeleteSubConfirm(sub)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredSubsidiaries.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              لا توجد شركات تابعة مسجلة مطابقة لنتائج البحث.
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB 4: GEOFENCED WORK LOCATIONS ==================== */}
        <TabsContent value="locations" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute right-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={locSearch}
                onChange={(e) => setLocSearch(e.target.value)}
                placeholder="بحث في المقرات والفروع أو العناوين..."
                className="h-10 w-full rounded-full border border-border/80 bg-muted/40 pr-10 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            {canManage && (
              <Button
                onClick={() => {
                  resetLocForm();
                  setIsAddLocOpen(true);
                }}
                size="sm"
                className="rounded-full text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4"
              >
                <Plus className="h-4 w-4" />
                إضافة موقع وسياج GPS
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkLocations.map((loc) => {
              const assignedCount = getLocEmployees(loc.id).length;
              const mapsUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;

              return (
                <div
                  key={loc.id}
                  className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4 hover:border-emerald-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-xs">
                          <MapPin className="h-5 w-5 shrink-0" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-foreground">
                            {language === "ar" ? loc.nameAr : loc.nameEn}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">{loc.address}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono rounded-full font-bold">
                        {loc.code}
                      </Badge>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-[11px] space-y-2 font-mono">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t.org.coordinates}:</span>
                        <span className="font-bold text-foreground">
                          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>نصف قطر السياج:</span>
                        <span className="font-bold text-emerald-600 font-mono">
                          {loc.radiusMeters} متر (GPS Geofence)
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>الموظفون المعينون:</span>
                        <span className="font-bold text-primary font-mono">{assignedCount} موظف</span>
                      </div>

                      {/* Interactive Visual Geofence Simulation Radar */}
                      <div className="pt-2 flex items-center justify-center">
                        <div className="relative h-20 w-20 rounded-full border-2 border-dashed border-emerald-500/60 bg-emerald-500/10 flex items-center justify-center animate-pulse shadow-sm">
                          <MapPin className="h-5 w-5 text-emerald-600" />
                          <div className="absolute text-[9px] -bottom-3 text-muted-foreground font-mono font-bold">
                            {loc.radiusMeters}m
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      فتح في الخريطة
                    </a>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs font-bold h-8 px-3 gap-1"
                          onClick={() => startEditLoc(loc)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-xs font-bold h-8 px-3 gap-1 text-rose-600 hover:bg-rose-500/10"
                          onClick={() => setDeleteLocConfirm(loc)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredWorkLocations.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              لا توجد مواقع جغرافية مسجلة مطابقة لنتائج البحث.
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB 5: POSITIONS ==================== */}
        <TabsContent value="positions" className="space-y-4 pt-4">
          <JobPositionsPanel />
        </TabsContent>

        {/* ==================== TAB 6: COST CENTERS ==================== */}
        <TabsContent value="cost-centers" className="space-y-4 pt-4">
          <CostCentersPanel />
        </TabsContent>

        {/* ==================== TAB 7: COMPANY PROFILE ==================== */}
        <TabsContent value="company" className="space-y-4 pt-4">
          <CompanyProfilePanel />
        </TabsContent>
      </Tabs>

      {/* ==================== MODALS ==================== */}

      {/* 1. Add Department Modal */}
      <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              إضافة إدارة / قسم جديد في الهيكل
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تسكين الإدارة في شجرة الهيكل التنظيمي وتعيين المدير المسؤول
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الإدارة (بالعربي) *</label>
              <input
                type="text"
                value={deptForm.nameAr}
                onChange={(e) => setDeptForm({ ...deptForm, nameAr: e.target.value })}
                placeholder="مثال: الإدارة العامة للأمن السيبراني"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">الاسم (بالإنجليزي)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={deptForm.nameEn}
                  onChange={(e) => setDeptForm({ ...deptForm, nameEn: e.target.value })}
                  placeholder="e.g. Cybersecurity Dept"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">رمز الإدارة (Code)</label>
                <input
                  type="text"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">المستوى التنظيمي</label>
                <select
                  value={deptForm.type}
                  onChange={(e) => setDeptForm({ ...deptForm, type: e.target.value as OrgUnitType })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="division">قطاع تنفيذي</option>
                  <option value="department">إدارة عامة</option>
                  <option value="section">قسم</option>
                  <option value="unit">وحدة</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الوحدة الأعلى (Parent Unit)</label>
                <select
                  value={deptForm.parentId}
                  onChange={(e) => setDeptForm({ ...deptForm, parentId: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">مباشرة تحت المنشأة الرئيسية</option>
                  {orgUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.nameAr} ({unit.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">المدير المسؤول</label>
                <select
                  value={deptForm.managerEmployeeId}
                  onChange={(e) => {
                    const emp = employees.find((item) => item.id === e.target.value);
                    setDeptForm({
                      ...deptForm,
                      managerEmployeeId: e.target.value,
                      managerName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "",
                    });
                  }}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">غير معين</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstNameAr} {employee.lastNameAr} — {employee.jobTitleAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">مركز التكلفة المرتبط</label>
                <select
                  value={deptForm.costCenterId}
                  onChange={(e) => setDeptForm({ ...deptForm, costCenterId: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">غير محدد</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateDept}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              إضافة الإدارة للهيكل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Edit Department Modal */}
      <Dialog open={isEditDeptOpen} onOpenChange={setIsEditDeptOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              تعديل بيانات الإدارة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديث بيانات الوحدة التنظيمية ومسؤولياتها في الهيكل
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الإدارة (بالعربي) *</label>
              <input
                type="text"
                value={deptForm.nameAr}
                onChange={(e) => setDeptForm({ ...deptForm, nameAr: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">الاسم (بالإنجليزي)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={deptForm.nameEn}
                  onChange={(e) => setDeptForm({ ...deptForm, nameEn: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">رمز الإدارة (Code)</label>
                <input
                  type="text"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">المستوى التنظيمي</label>
                <select
                  value={deptForm.type}
                  onChange={(e) => setDeptForm({ ...deptForm, type: e.target.value as OrgUnitType })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="division">قطاع تنفيذي</option>
                  <option value="department">إدارة عامة</option>
                  <option value="section">قسم</option>
                  <option value="unit">وحدة</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الوحدة الأعلى (Parent Unit)</label>
                <select
                  value={deptForm.parentId}
                  onChange={(e) => setDeptForm({ ...deptForm, parentId: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">مباشرة تحت المنشأة الرئيسية</option>
                  {orgUnits
                    .filter((u) => u.id !== editingDeptId)
                    .map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.nameAr} ({unit.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">المدير المسؤول</label>
                <select
                  value={deptForm.managerEmployeeId}
                  onChange={(e) => {
                    const emp = employees.find((item) => item.id === e.target.value);
                    setDeptForm({
                      ...deptForm,
                      managerEmployeeId: e.target.value,
                      managerName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "",
                    });
                  }}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">غير معين</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstNameAr} {employee.lastNameAr} — {employee.jobTitleAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">مركز التكلفة المرتبط</label>
                <select
                  value={deptForm.costCenterId}
                  onChange={(e) => setDeptForm({ ...deptForm, costCenterId: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">غير محدد</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleUpdateDept}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              تحديث بيانات الإدارة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Delete Department Confirmation Modal */}
      <Dialog
        open={Boolean(deleteDeptConfirm)}
        onOpenChange={(open) => !open && setDeleteDeptConfirm(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف الوحدة التنظيمية
            </DialogTitle>
            <DialogDescription className="text-xs font-medium space-y-2">
              <p>
                هل أنت متأكد من رغبتك في حذف (
                <span className="font-bold text-foreground">{deleteDeptConfirm?.nameAr}</span>)؟
              </p>

              {deleteDeptConfirm && getDeptEmployees(deleteDeptConfirm.id).length > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-800 dark:text-amber-200 mt-2 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    يوجد {getDeptEmployees(deleteDeptConfirm.id).length} موظف مسكن في هذه الإدارة!
                  </p>
                  <label className="block text-[11px] font-bold">
                    إعادة تسكين الموظفين في إدارة بديلة:
                  </label>
                  <select
                    value={reassignDeptId}
                    onChange={(e) => setReassignDeptId(e.target.value)}
                    className="w-full h-8 rounded-xl border border-amber-300 bg-card text-foreground px-2 text-xs"
                  >
                    <option value="">فك الارتباط فقط (غير مسكنين)</option>
                    {orgUnits
                      .filter((u) => u.id !== deleteDeptConfirm.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          نقل إلى: {u.nameAr}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => setDeleteDeptConfirm(null)}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="rounded-full text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={handleDeleteDept}
            >
              تأكيد الحذف النهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. View Department Employees Modal */}
      <Dialog
        open={Boolean(viewEmployeesDept)}
        onOpenChange={(open) => !open && setViewEmployeesDept(null)}
      >
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                منسوبو {viewEmployeesDept?.nameAr}
              </span>
              <Badge variant="outline" className="text-xs rounded-full font-mono">
                {viewEmployeesDept && getDeptEmployees(viewEmployeesDept.id).length} موظف
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              قائمة بالكوادر البشرية المسكنة تحت هذه الإدارة وبياناتهم الوظيفية
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto divide-y divide-border/60 py-2">
            {viewEmployeesDept &&
              getDeptEmployees(viewEmployeesDept.id).map((emp) => (
                <div
                  key={emp.id}
                  className="py-3 flex items-center justify-between hover:bg-muted/30 px-2 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {emp.firstNameAr.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-foreground text-xs block">
                        {emp.firstNameAr} {emp.lastNameAr}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {emp.jobTitleAr} • {emp.employeeNo}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {emp.phone || emp.email || "موثق"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-xs font-bold text-primary hover:bg-primary/10 h-8"
                      onClick={() => {
                        setViewEmployeesDept(null);
                        openEmployeeProfile(emp);
                      }}
                    >
                      الملف الشامل
                    </Button>
                  </div>
                </div>
              ))}

            {viewEmployeesDept && getDeptEmployees(viewEmployeesDept.id).length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                لا يوجد موظفون مسكنون حالياً في هذه الإدارة.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Add / Edit Subsidiary Modal */}
      <Dialog
        open={isAddSubOpen || isEditSubOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddSubOpen(false);
            setIsEditSubOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              {isEditSubOpen ? "تعديل بيانات الشركة التابعة" : "إضافة شركة تابعة (Subsidiary)"}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تسجيل بيانات الكيان القانوني والسجل التجاري المعتمد
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الشركة التابعة *</label>
              <input
                type="text"
                value={subForm.nameAr}
                onChange={(e) => setSubForm({ ...subForm, nameAr: e.target.value })}
                placeholder="مثال: كلاسيرا لحلول التعليم الذكي"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">رقم السجل التجاري (CR) *</label>
                <input
                  type="text"
                  dir="ltr"
                  value={subForm.crNumber}
                  onChange={(e) => setSubForm({ ...subForm, crNumber: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الرقم الضريبي (VAT)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={subForm.taxNumber}
                  onChange={(e) => setSubForm({ ...subForm, taxNumber: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">الرمز (Code)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={subForm.code}
                  onChange={(e) => setSubForm({ ...subForm, code: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">المدينة</label>
                <input
                  type="text"
                  value={subForm.city}
                  onChange={(e) => setSubForm({ ...subForm, city: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">المدير العام / المسؤول</label>
              <select
                value={subForm.managerEmployeeId}
                onChange={(e) => {
                  const emp = employees.find((item) => item.id === e.target.value);
                  setSubForm({
                    ...subForm,
                    managerEmployeeId: e.target.value,
                    managerName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "",
                  });
                }}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">غير معين</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstNameAr} {employee.lastNameAr} — {employee.jobTitleAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={isEditSubOpen ? handleUpdateSub : handleCreateSub}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              {isEditSubOpen ? "حفظ التعديلات" : "تسجيل الشركة التابعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Delete Subsidiary Confirmation Modal */}
      <Dialog
        open={Boolean(deleteSubConfirm)}
        onOpenChange={(open) => !open && setDeleteSubConfirm(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف الشركة التابعة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              هل أنت متأكد من رغبتك في حذف الكيان التابع (
              <span className="font-bold text-foreground">{deleteSubConfirm?.nameAr}</span>)؟ سيتم فك ارتباط الإدارات والموظفين التابعين له تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => setDeleteSubConfirm(null)}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="rounded-full text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={handleDeleteSub}
            >
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Add / Edit Location Modal */}
      <Dialog
        open={isAddLocOpen || isEditLocOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddLocOpen(false);
            setIsEditLocOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
              {isEditLocOpen ? "تعديل موقع العمل ونطاق السياج" : "إضافة موقع عمل وسياج جغرافي (Geofencing)"}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد إحداثيات GPS ونصف قطر السماح لبصمة الموظف
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم المقر / الفرع *</label>
              <input
                type="text"
                value={locForm.nameAr}
                onChange={(e) => setLocForm({ ...locForm, nameAr: e.target.value })}
                placeholder="مثال: فرع الرياض - برج العليا"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">العنوان التفصيلي</label>
              <input
                type="text"
                value={locForm.address}
                onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
                placeholder="الشارع، الحي، المعلم"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">خط العرض (Latitude) *</label>
                <input
                  type="number"
                  step="any"
                  value={locForm.latitude}
                  onChange={(e) => setLocForm({ ...locForm, latitude: parseFloat(e.target.value) })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">خط الطول (Longitude) *</label>
                <input
                  type="number"
                  step="any"
                  value={locForm.longitude}
                  onChange={(e) => setLocForm({ ...locForm, longitude: parseFloat(e.target.value) })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="font-bold">نصف قطر السياج الجغرافي (Radius)</label>
                <span className="font-mono text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full text-[11px]">
                  {locForm.radiusMeters} متر
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={1000}
                step={25}
                value={locForm.radiusMeters}
                onChange={(e) => setLocForm({ ...locForm, radiusMeters: parseInt(e.target.value) })}
                className="w-full cursor-pointer accent-emerald-600"
              />
              <p className="text-[10px] text-muted-foreground">
                المسافة المسموحة للموظف لإثبات الحضور بالبصمة عبر تطبيق الجوال (ESS).
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={isEditLocOpen ? handleUpdateLoc : handleCreateLoc}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              {isEditLocOpen ? "حفظ تعديلات الموقع" : "تأكيد وحفظ الموقع الجغرافي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. Delete Location Confirmation Modal */}
      <Dialog
        open={Boolean(deleteLocConfirm)}
        onOpenChange={(open) => !open && setDeleteLocConfirm(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف الموقع الجغرافي
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              هل أنت متأكد من رغبتك في حذف موقع العمل (
              <span className="font-bold text-foreground">{deleteLocConfirm?.nameAr}</span>)؟
              سيتم إعادة توجيه الموظفين المرتبطين به إلى المقر الرئيسي المعتمد.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => setDeleteLocConfirm(null)}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              className="rounded-full text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={handleDeleteLoc}
            >
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
