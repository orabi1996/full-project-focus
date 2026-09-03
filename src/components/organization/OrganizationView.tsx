import React, { useMemo, useState } from "react";
import { OrgChartSvg, type OrgChartNodeData, defaultCompanyTree } from "./OrgChartSvg";
import { CostCentersPanel, JobPositionsPanel } from "./OrganizationPlanningPanels";
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
  Sparkles,
  Briefcase,
  TrendingUp,
  FileCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { OrgUnit } from "../../types";
import { toast } from "sonner";

type OrgUnitType = OrgUnit["type"];

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

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
    addSubsidiary,
    addWorkLocation,
    openEmployeeProfile,
    currentRole,
    language,
    t,
  } = useApp();
  const canManage = canManageModule(currentRole, "organization");
  const [activeTab, setActiveTab] = useState("orgchart");

  // Modals state
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [isAddLocOpen, setIsAddLocOpen] = useState(false);

  // Forms state
  const [newDept, setNewDept] = useState({
    nameAr: "",
    nameEn: "",
    code: `DEP-${Math.floor(100 + Math.random() * 900)}`,
    type: "department" as OrgUnitType,
    managerName: "",
    managerEmployeeId: "",
    parentId: "",
  });

  const [newSub, setNewSub] = useState({
    nameAr: "",
    nameEn: "",
    code: `SUB-${Math.floor(10 + Math.random() * 90)}`,
    crNumber: "1010" + Math.floor(100000 + Math.random() * 900000),
    managerName: "",
  });

  const [newLoc, setNewLoc] = useState({
    nameAr: "",
    nameEn: "",
    code: `LOC-${Math.floor(10 + Math.random() * 90)}`,
    address: "الرياض - طريق الملك فهد",
    latitude: 24.7136,
    longitude: 46.6753,
    radiusMeters: 150,
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const unitTypeLabel: Record<OrgUnitType, string> = {
    division: "قطاع تنفيذي",
    department: "إدارة عامة",
    section: "قسم",
    unit: "وحدة",
  };

  const selectedUnit = useMemo(
    () => orgUnits.find((unit) => unit.id === selectedNodeId) ?? null,
    [orgUnits, selectedNodeId],
  );

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
      return (byParent.get(parentKey) ?? []).map((unit) => ({
        id: unit.id,
        titleAr: unit.nameAr,
        titleEn: unit.nameEn,
        subtitle: unit.managerName || "بدون مدير معين",
        managerName: unit.managerName,
        code: unit.code,
        kind: unit.type,
        employeeCount: unit.employeeCount,
        openPositions: 2,
        budgetMonthly: unit.employeeCount * 16500,
        children: build(unit.id, depth + 1),
      }));
    };

    return {
      id: "__company__",
      titleAr: company.legalNameAr || "شركة فوكس القابضة",
      titleEn: company.legalNameEn || "Focus Holding Co.",
      subtitle: `سجل تجاري ${company.crNumber || "1010892341"}`,
      managerName: "م. عبد العزيز الفهد • الرئيس التنفيذي",
      code: company.id || "HQ-01",
      kind: "company",
      employeeCount: employees.length || 120,
      openPositions: 8,
      budgetMonthly: (employees.length || 120) * 17500,
      children: build("__root__", 1),
    };
  }, [orgUnits, company, employees.length]);

  const handleCreateDept = () => {
    if (!newDept.nameAr) {
      toast.error("يرجى كتابة اسم الإدارة / القسم");
      return;
    }
    addOrgUnit({
      companyId: company.id,
      parentId: newDept.parentId || null,
      nameAr: newDept.nameAr,
      nameEn: newDept.nameEn || newDept.nameAr,
      code: newDept.code,
      type: newDept.type,
      managerEmployeeId: newDept.managerEmployeeId || undefined,
      managerName: newDept.managerName || "غير معين",
      status: "active",
    });
    toast.success("تمت إضافة الإدارة / القسم بنجاح في الهيكل التنظيمي");
    setIsAddDeptOpen(false);
    setNewDept({
      nameAr: "",
      nameEn: "",
      code: `DEP-${Math.floor(100 + Math.random() * 900)}`,
      type: "department",
      managerName: "",
      managerEmployeeId: "",
      parentId: "",
    });
  };

  const handleCreateSub = () => {
    if (!newSub.nameAr) {
      toast.error("يرجى كتابة اسم الشركة الفرعية");
      return;
    }
    addSubsidiary({
      companyId: company.id,
      nameAr: newSub.nameAr,
      nameEn: newSub.nameEn || newSub.nameAr,
      code: newSub.code,
      crNumber: newSub.crNumber,
      managerName: newSub.managerName || "غير معين",
      status: "active",
    });
    toast.success("تمت إضافة الشركة التابعة بنجاح");
    setIsAddSubOpen(false);
    setNewSub({
      nameAr: "",
      nameEn: "",
      code: `SUB-${Math.floor(10 + Math.random() * 90)}`,
      crNumber: "1010" + Math.floor(100000 + Math.random() * 900000),
      managerName: "",
    });
  };

  const handleCreateLoc = () => {
    if (!newLoc.nameAr) {
      toast.error("يرجى كتابة اسم الموقع الجغرافي");
      return;
    }
    addWorkLocation({
      companyId: company.id,
      nameAr: newLoc.nameAr,
      nameEn: newLoc.nameEn || newLoc.nameAr,
      code: newLoc.code,
      address: newLoc.address,
      latitude: newLoc.latitude,
      longitude: newLoc.longitude,
      radiusMeters: newLoc.radiusMeters,
      status: "active",
    });
    toast.success("تمت إضافة الموقع الجغرافي ونطاق السياج بنجاح");
    setIsAddLocOpen(false);
    setNewLoc({
      nameAr: "",
      nameEn: "",
      code: `LOC-${Math.floor(10 + Math.random() * 90)}`,
      address: "الرياض - طريق الملك فهد",
      latitude: 24.7136,
      longitude: 46.6753,
      radiusMeters: 150,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-primary" />
            {t.org.companyProfile} والهيكل التنظيمي (M02)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            إدارة المنشأة الرئيسية، الشركات التابعة، شجرة الهيكل التنظيمي SVG، والمواقع الجغرافية بنطاق السياج الذكي (Geofencing)
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => setIsAddDeptOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              {t.org.addDepartment}
            </Button>
            <Button
              onClick={() => setIsAddSubOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <Plus className="h-4 w-4 text-primary" />
              إضافة شركة تابعة
            </Button>
            <Button
              onClick={() => setIsAddLocOpen(true)}
              variant="secondary"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
            >
              <MapPin className="h-4 w-4 text-primary" />
              إضافة موقع وسياج GPS
            </Button>
          </div>
        )}
      </div>

      {/* Primary KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">المنشأة والشركات التابعة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">{subsidiaries.length + 1} كيانات قانونية</h4>
            <span className="text-[10px] text-primary font-bold">سجلات تجارية مستقلة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">الإدارات والأقسام</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">{orgUnits.length} إدارات عامة</h4>
            <span className="text-[10px] text-emerald-600 font-bold">هيكل إداري موحد</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Network className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">فروع العمل وسياج GPS</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">{workLocations.length} مواقع معتمدة</h4>
            <span className="text-[10px] text-amber-600 font-bold">نصف قطر 150م - 300م</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <MapPin className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي القوى العاملة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">{employees.length} موظف مسجل</h4>
            <span className="text-[10px] text-purple-600 font-bold">100% عقود موثقة (قوى)</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs Menu (Google M3 Segmented / Primary Tabs) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-3xl border border-border/60 bg-muted/60 p-1 sm:grid-cols-3 xl:grid-cols-6">
          <TabsTrigger value="orgchart" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.org.orgChart} الشجري SVG
          </TabsTrigger>
          <TabsTrigger value="structure" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.org.departments} ({orgUnits.length})
          </TabsTrigger>
          <TabsTrigger value="subsidiaries" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.org.subsidiaries} ({subsidiaries.length})
          </TabsTrigger>
          <TabsTrigger value="locations" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.org.locations} ({workLocations.length})
          </TabsTrigger>
          <TabsTrigger value="positions" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            المناصب ({jobPositions.length})
          </TabsTrigger>
          <TabsTrigger value="cost-centers" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            مراكز التكلفة ({costCenters.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Interactive Vector SVG Org Chart with Inspection Panel */}
        <TabsContent value="orgchart" className="pt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
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
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Network className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black text-foreground">تفاصيل العقدة في الهيكل</h3>
                </div>

                {!selectedUnit ? (
                  <div className="space-y-2.5 text-xs text-muted-foreground">
                    <p className="font-bold text-foreground text-sm">{company.legalNameAr || "شركة فوكس القابضة"}</p>
                    <p>السجل التجاري: <span className="font-mono font-bold text-foreground">{company.crNumber || "1010892341"}</span></p>
                    <p>الرقم الضريبي: <span className="font-mono font-bold text-foreground">{company.taxNumber || "310298374600003"}</span></p>
                    <p>{company.headquartersAddress || "الرياض - طريق الملك فهد - برج فوكس"}</p>
                    <div className="pt-2">
                      <Badge variant="outline" className="text-[10px] rounded-full">
                        {employees.length} موظف مسجل • {orgUnits.length} وحدة تنظيمية
                      </Badge>
                    </div>
                    <p className="pt-2 text-[11px] text-primary font-medium leading-relaxed">
                      💡 اضغط على أي بطاقة أو دائرة في الشجرة الشجرية لتحديدها واستعراض منسوبيها.
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
                      <span className="font-bold text-primary">{unitTypeLabel[selectedUnit.type]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المدير المسؤول:</span>
                      <span className="font-bold text-foreground">{selectedUnit.managerName || "غير معين"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي القوى العاملة:</span>
                      <span className="font-black text-foreground">{selectedUnit.employeeCount} موظف</span>
                    </div>

                    <div className="border-t border-border/60 pt-2.5 space-y-1.5">
                      <p className="font-bold text-foreground">منسوبو هذه الإدارة / القسم</p>
                      <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                        {employees
                          .filter((employee) => employee.departmentId === selectedUnit.id)
                          .slice(0, 15)
                          .map((employee) => (
                            <div
                              key={employee.id}
                              onClick={() => openEmployeeProfile(employee)}
                              className="flex items-center justify-between rounded-xl bg-muted/30 hover:bg-secondary/50 px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors group"
                            >
                              <span className="font-bold text-foreground group-hover:text-primary group-hover:underline">
                                {employee.firstNameAr} {employee.lastNameAr}
                              </span>
                              <span className="text-muted-foreground text-[10px]">{employee.jobTitleAr}</span>
                            </div>
                          ))}
                        {employees.filter((employee) => employee.departmentId === selectedUnit.id).length === 0 && (
                          <p className="text-[11px] text-muted-foreground">لا يوجد موظفون مسكنون حالياً.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {canManage && selectedUnit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-bold rounded-full border-primary/30 text-primary hover:bg-secondary h-9 gap-1.5 mt-2"
                  onClick={() => {
                    setNewDept((prev) => ({ ...prev, parentId: selectedUnit.id }));
                    setIsAddDeptOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  إضافة قسم تابع لهذه الإدارة
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Organization Units / Departments */}
        <TabsContent value="structure" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgUnits.map((unit) => (
              <div
                key={unit.id}
                className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-xs">
                      {unit.code.substring(0, 3)}
                    </div>
                    <div>
                      <h3 className="font-black text-xs text-foreground">
                        {language === "ar" ? unit.nameAr : unit.nameEn}
                      </h3>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono">
                        {unit.code}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200 rounded-full px-2 font-bold"
                  >
                    نشط
                  </Badge>
                </div>

                <div className="border-t border-border/60 pt-3 space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center">
                    <span>{t.org.manager}:</span>
                    <span className="font-bold text-foreground">
                      {unit.managerName || "غير معين"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t.org.employeeCount}:</span>
                    <span className="font-bold text-primary">{unit.employeeCount} موظف مسجل</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Subsidiaries */}
        <TabsContent value="subsidiaries" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subsidiaries.map((sub) => (
              <div key={sub.id} className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5 hover:border-primary/50 transition-all">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs font-mono font-bold rounded-full px-2.5">
                    {sub.code}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200 rounded-full px-2 font-bold"
                  >
                    شركة تابعة معتمدة
                  </Badge>
                </div>
                <h3 className="text-sm font-black text-foreground">
                  {language === "ar" ? sub.nameAr : sub.nameEn}
                </h3>
                <div className="text-xs text-muted-foreground space-y-2 border-t border-border/60 pt-3">
                  <p className="flex justify-between">
                    <span>السجل التجاري:</span>
                    <span className="font-mono font-bold text-foreground">{sub.crNumber}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>المدير التنفيذي:</span>
                    <span className="font-bold text-foreground">{sub.managerName}</span>
                  </p>
                  <p className="flex justify-between font-bold text-primary pt-1">
                    <span>الموظفون المسجلون:</span>
                    <span>{sub.employeeCount} موظف</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Geofenced Work Locations */}
        <TabsContent value="locations" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workLocations.map((loc) => (
              <div key={loc.id} className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 hover:border-primary/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <MapPin className="h-4 w-4 shrink-0" />
                    </div>
                    <div>
                      <h3 className="font-black text-xs text-foreground">
                        {language === "ar" ? loc.nameAr : loc.nameEn}
                      </h3>
                      <p className="text-[10px] text-muted-foreground">{loc.address}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono rounded-full">
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
                    <span className="font-bold text-emerald-600">
                      {loc.radiusMeters} متر (GPS Geofence)
                    </span>
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
            ))}
          </div>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4 pt-4">
          <JobPositionsPanel />
        </TabsContent>

        <TabsContent value="cost-centers" className="space-y-4 pt-4">
          <CostCentersPanel />
        </TabsContent>
      </Tabs>

      {/* Add Department Modal */}
      <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              إضافة إدارة / قسم جديد
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تسكين الإدارة في شجرة الهيكل وتعيين المدير المسؤول
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الإدارة (بالعربي) *</label>
              <input
                type="text"
                value={newDept.nameAr}
                onChange={(e) => setNewDept({ ...newDept, nameAr: e.target.value })}
                placeholder="مثال: إدارة الأمن السيبراني"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">رمز الإدارة (Code)</label>
              <input
                type="text"
                value={newDept.code}
                onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">المستوى التنظيمي</label>
                <select
                  value={newDept.type}
                  onChange={(e) =>
                    setNewDept({ ...newDept, type: e.target.value as OrgUnitType })
                  }
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="division">قطاع تنفيذي</option>
                  <option value="department">إدارة عامة</option>
                  <option value="section">قسم</option>
                  <option value="unit">وحدة</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الوحدة الأعلى (Parent)</label>
                <select
                  value={newDept.parentId}
                  onChange={(e) => setNewDept({ ...newDept, parentId: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">مباشرة تحت المنشأة</option>
                  {orgUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">المدير المسؤول</label>
              <select
                value={newDept.managerEmployeeId}
                onChange={(e) => {
                  const employee = employees.find((item) => item.id === e.target.value);
                  setNewDept({
                    ...newDept,
                    managerEmployeeId: e.target.value,
                    managerName: employee
                      ? `${employee.firstNameAr} ${employee.lastNameAr}`
                      : "",
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
            <Button size="sm" onClick={handleCreateDept} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              إضافة الإدارة للهيكل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subsidiary Modal */}
      <Dialog open={isAddSubOpen} onOpenChange={setIsAddSubOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              إضافة شركة تابعة (Subsidiary)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تسجيل كيان قانوني فرعي تابع للشركة القابضة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الشركة التابعة *</label>
              <input
                type="text"
                value={newSub.nameAr}
                onChange={(e) => setNewSub({ ...newSub, nameAr: e.target.value })}
                placeholder="مثال: فوكس للحلول التقنية المتقدمة"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">رقم السجل التجاري (CR Number) *</label>
              <input
                type="text"
                value={newSub.crNumber}
                onChange={(e) => setNewSub({ ...newSub, crNumber: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">المدير العام</label>
              <input
                type="text"
                value={newSub.managerName}
                onChange={(e) => setNewSub({ ...newSub, managerName: e.target.value })}
                placeholder="اسم المدير العام..."
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleCreateSub} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              تسجيل الشركة التابعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Location Modal */}
      <Dialog open={isAddLocOpen} onOpenChange={setIsAddLocOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              إضافة موقع عمل وسياج جغرافي (Geofencing)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد إحداثيات GPS ونصف قطر السماح لبصمة الجوال
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم المقر / الفرع *</label>
              <input
                type="text"
                value={newLoc.nameAr}
                onChange={(e) => setNewLoc({ ...newLoc, nameAr: e.target.value })}
                placeholder="مثال: فرع جدة - الكورنيش"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">خط العرض (Latitude) *</label>
                <input
                  type="number"
                  step="any"
                  value={newLoc.latitude}
                  onChange={(e) => setNewLoc({ ...newLoc, latitude: parseFloat(e.target.value) })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">خط الطول (Longitude) *</label>
                <input
                  type="number"
                  step="any"
                  value={newLoc.longitude}
                  onChange={(e) => setNewLoc({ ...newLoc, longitude: parseFloat(e.target.value) })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="font-bold">نصف قطر السياج الجغرافي (Radius)</label>
                <span className="font-mono text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full text-[10px]">
                  {newLoc.radiusMeters} متر
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={500}
                step={25}
                value={newLoc.radiusMeters}
                onChange={(e) => setNewLoc({ ...newLoc, radiusMeters: parseInt(e.target.value) })}
                className="w-full cursor-pointer accent-primary"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateLoc}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              تأكيد وحفظ الموقع الجغرافي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
