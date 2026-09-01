import React, { useState } from "react";
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
  ChevronDown,
  Layers,
  Map,
  Compass,
  Search,
  Sliders,
  ZoomIn,
  ZoomOut,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
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
    employees,
    addOrgUnit,
    addSubsidiary,
    addWorkLocation,
    currentRole,
    language,
    t,
  } = useApp();
  const canManage = canManageModule(currentRole, "organization");
  const [activeTab, setActiveTab] = useState("structure");

  // Modals state
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [isAddLocOpen, setIsAddLocOpen] = useState(false);

  // Forms state
  const [newDept, setNewDept] = useState({
    nameAr: "",
    nameEn: "",
    code: `DEP-${Math.floor(100 + Math.random() * 900)}`,
    type: "department" as const,
    managerName: "",
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

  const [orgChartZoom, setOrgChartZoom] = useState(1);
  const [orgChartSearch, setOrgChartSearch] = useState("");

  const handleCreateDept = () => {
    if (!newDept.nameAr) {
      alert("يرجى كتابة اسم الإدارة / القسم");
      return;
    }
    addOrgUnit({
      companyId: company.id,
      nameAr: newDept.nameAr,
      nameEn: newDept.nameEn || newDept.nameAr,
      code: newDept.code,
      type: newDept.type,
      managerName: newDept.managerName || "غير معين",
      status: "active",
    });
    alert("تمت إضافة الإدارة / القسم بنجاح في الهيكل التنظيمي");
    setIsAddDeptOpen(false);
    setNewDept({
      nameAr: "",
      nameEn: "",
      code: `DEP-${Math.floor(100 + Math.random() * 900)}`,
      type: "department",
      managerName: "",
    });
  };

  const handleCreateSub = () => {
    if (!newSub.nameAr) {
      alert("يرجى كتابة اسم الشركة الفرعية");
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
    alert("تمت إضافة الشركة التابعة بنجاح");
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
      alert("يرجى كتابة اسم الموقع الجغرافي");
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
    alert("تمت إضافة الموقع الجغرافي ونطاق السياج بنجاح");
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
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t.org.companyProfile} والهيكل المؤسسي (M02)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة المنشأة، الشركات التابعة، شجرة الأقسام، والمواقع الجغرافية بنطاق السياج الذكي
            (Geofencing)
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setIsAddDeptOpen(true)}
              size="sm"
              className="font-bold text-xs gap-1.5 bg-primary"
            >
              <Plus className="h-4 w-4" />
              {t.org.addDepartment}
            </Button>
            <Button
              onClick={() => setIsAddSubOpen(true)}
              variant="outline"
              size="sm"
              className="font-bold text-xs gap-1.5"
            >
              <Plus className="h-4 w-4" />
              إضافة شركة تابعة
            </Button>
            <Button
              onClick={() => setIsAddLocOpen(true)}
              variant="secondary"
              size="sm"
              className="font-bold text-xs gap-1.5"
            >
              <MapPin className="h-4 w-4" />
              إضافة موقع وسياج GPS
            </Button>
          </div>
        )}
      </div>

      {/* Tabs Menu */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="structure" className="text-xs font-bold">
            {t.org.departments} ({orgUnits.length})
          </TabsTrigger>
          <TabsTrigger value="subsidiaries" className="text-xs font-bold">
            {t.org.subsidiaries} ({subsidiaries.length})
          </TabsTrigger>
          <TabsTrigger value="locations" className="text-xs font-bold">
            {t.org.locations} ({workLocations.length})
          </TabsTrigger>
          <TabsTrigger value="orgchart" className="text-xs font-bold">
            {t.org.orgChart} الشجري
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Organization Units / Departments */}
        <TabsContent value="structure" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgUnits.map((unit) => (
              <div
                key={unit.id}
                className="rounded-xl border bg-card p-4 shadow-sm space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      {unit.code.substring(0, 3)}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-foreground">
                        {language === "ar" ? unit.nameAr : unit.nameEn}
                      </h3>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {unit.code}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200"
                  >
                    نشط
                  </Badge>
                </div>

                <div className="border-t pt-2 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between items-center">
                    <span>{t.org.manager}:</span>
                    <span className="font-semibold text-foreground">
                      {unit.managerName || "غير معين"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t.org.employeeCount}:</span>
                    <span className="font-semibold text-foreground">{unit.employeeCount} موظف</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Subsidiaries */}
        <TabsContent value="subsidiaries" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subsidiaries.map((sub) => (
              <div key={sub.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs font-mono font-bold">
                    {sub.code}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200"
                  >
                    شركة تابعة معتمدة
                  </Badge>
                </div>
                <h3 className="text-sm font-black text-foreground">
                  {language === "ar" ? sub.nameAr : sub.nameEn}
                </h3>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    السجل التجاري:{" "}
                    <span className="font-mono font-bold text-foreground">{sub.crNumber}</span>
                  </p>
                  <p>
                    المدير التنفيذي:{" "}
                    <span className="font-medium text-foreground">{sub.managerName}</span>
                  </p>
                  <p className="font-bold text-primary">{sub.employeeCount} موظف مسجل</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Geofenced Work Locations */}
        <TabsContent value="locations" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workLocations.map((loc) => (
              <div key={loc.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                    <h3 className="font-bold text-xs text-foreground">
                      {language === "ar" ? loc.nameAr : loc.nameEn}
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {loc.code}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">{loc.address}</p>

                <div className="rounded-lg border bg-muted/40 p-2.5 text-[11px] space-y-1.5 font-mono">
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
                    <div className="relative h-16 w-16 rounded-full border-2 border-dashed border-emerald-500/60 bg-emerald-500/10 flex items-center justify-center animate-pulse">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <div className="absolute text-[9px] -bottom-3 text-muted-foreground font-mono">
                        {loc.radiusMeters}m
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Interactive SVG Org Chart */}
        <TabsContent value="orgchart" className="pt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <OrgChartSvg
                root={chartRoot}
                language={language}
                selectedId={selectedNodeId}
                onSelect={setSelectedNodeId}
              />
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
              <h3 className="flex items-center gap-2 border-b pb-2 text-xs font-black">
                <Network className="h-4 w-4 text-primary" />
                تفاصيل العقدة المحددة
              </h3>

              {!selectedUnit ? (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="font-bold text-foreground">{company.legalNameAr}</p>
                  <p>السجل التجاري: {company.crNumber}</p>
                  <p>الرقم الضريبي: {company.taxNumber}</p>
                  <p>{company.headquartersAddress}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {employees.length} موظف • {orgUnits.length} وحدة تنظيمية
                  </Badge>
                  <p className="pt-2 text-[11px]">اضغط على أي وحدة في الشجرة لعرض تفاصيلها.</p>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <h4 className="text-sm font-black text-foreground">
                      {language === "ar" ? selectedUnit.nameAr : selectedUnit.nameEn}
                    </h4>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {selectedUnit.code}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">المستوى:</span>
                    <span className="font-bold">{unitTypeLabel[selectedUnit.type]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الوحدة الأعلى:</span>
                    <span className="font-bold">
                      {orgUnits.find((u) => u.id === selectedUnit.parentId)?.nameAr ??
                        company.legalNameAr}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المدير:</span>
                    <span className="font-bold">{selectedUnit.managerName || "غير معين"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">عدد الموظفين:</span>
                    <span className="font-bold">{selectedUnit.employeeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">وحدات فرعية:</span>
                    <span className="font-bold">
                      {orgUnits.filter((u) => u.parentId === selectedUnit.id).length}
                    </span>
                  </div>

                  <div className="border-t pt-2">
                    <p className="mb-1.5 font-bold">أعضاء الوحدة</p>
                    <div className="max-h-52 space-y-1 overflow-y-auto">
                      {employees
                        .filter((employee) => employee.departmentId === selectedUnit.id)
                        .slice(0, 20)
                        .map((employee) => (
                          <div
                            key={employee.id}
                            className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-[11px]"
                          >
                            <span className="font-semibold">
                              {employee.firstNameAr} {employee.lastNameAr}
                            </span>
                            <span className="text-muted-foreground">{employee.jobTitleAr}</span>
                          </div>
                        ))}
                      {employees.filter((employee) => employee.departmentId === selectedUnit.id)
                        .length === 0 && (
                        <p className="text-[11px] text-muted-foreground">لا يوجد موظفون مسكنون.</p>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-[11px]"
                      onClick={() => {
                        setNewDept((prev) => ({ ...prev, parentId: selectedUnit.id }));
                        setIsAddDeptOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة وحدة فرعية تحت هذه الوحدة
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

      </Tabs>

      {/* Add Department Modal */}
      <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              إضافة إدارة / قسم جديد
            </DialogTitle>
            <DialogDescription className="text-xs">
              تسكين الإدارة في شجرة الهيكل وتعيين المدير المسؤول
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">اسم الإدارة (بالعربي) *</label>
              <input
                type="text"
                value={newDept.nameAr}
                onChange={(e) => setNewDept({ ...newDept, nameAr: e.target.value })}
                placeholder="مثال: إدارة الأمن السيبراني"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">رمز الإدارة (Code)</label>
              <input
                type="text"
                value={newDept.code}
                onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                className="w-full h-8 rounded border px-2.5 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">المدير المسؤول</label>
              <input
                type="text"
                value={newDept.managerName}
                onChange={(e) => setNewDept({ ...newDept, managerName: e.target.value })}
                placeholder="اسم المدير..."
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateDept} className="text-xs bg-primary font-bold">
              إضافة الإدارة للهيكل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subsidiary Modal */}
      <Dialog open={isAddSubOpen} onOpenChange={setIsAddSubOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              إضافة شركة تابعة (Subsidiary)
            </DialogTitle>
            <DialogDescription className="text-xs">
              تسجيل كيان قانوني فرعي تابع للشركة القابضة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">اسم الشركة التابعة *</label>
              <input
                type="text"
                value={newSub.nameAr}
                onChange={(e) => setNewSub({ ...newSub, nameAr: e.target.value })}
                placeholder="مثال: فوكس للحلول التقنية المتقدمة"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">رقم السجل التجاري (CR Number) *</label>
              <input
                type="text"
                value={newSub.crNumber}
                onChange={(e) => setNewSub({ ...newSub, crNumber: e.target.value })}
                className="w-full h-8 rounded border px-2.5 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">المدير العام</label>
              <input
                type="text"
                value={newSub.managerName}
                onChange={(e) => setNewSub({ ...newSub, managerName: e.target.value })}
                placeholder="اسم المدير العام..."
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateSub} className="text-xs bg-primary font-bold">
              تسجيل الشركة التابعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Location Modal */}
      <Dialog open={isAddLocOpen} onOpenChange={setIsAddLocOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              إضافة موقع عمل وسياج جغرافي (Geofencing)
            </DialogTitle>
            <DialogDescription className="text-xs">
              تحديد إحداثيات GPS ونصف قطر السماح لبصمة الجوال
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">اسم المقر / الفرع *</label>
              <input
                type="text"
                value={newLoc.nameAr}
                onChange={(e) => setNewLoc({ ...newLoc, nameAr: e.target.value })}
                placeholder="مثال: فرع جدة - الكورنيش"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold">خط العرض (Latitude) *</label>
                <input
                  type="number"
                  step="any"
                  value={newLoc.latitude}
                  onChange={(e) => setNewLoc({ ...newLoc, latitude: parseFloat(e.target.value) })}
                  className="w-full h-8 rounded border px-2.5 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">خط الطول (Longitude) *</label>
                <input
                  type="number"
                  step="any"
                  value={newLoc.longitude}
                  onChange={(e) => setNewLoc({ ...newLoc, longitude: parseFloat(e.target.value) })}
                  className="w-full h-8 rounded border px-2.5 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="font-bold">نصف قطر السياج الجغرافي (Radius)</label>
                <span className="font-mono text-emerald-600 font-bold">
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

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleCreateLoc}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              تأكيد وحفظ الموقع الجغرافي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
