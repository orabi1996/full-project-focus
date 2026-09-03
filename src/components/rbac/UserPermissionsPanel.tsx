import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Users,
  Search,
  Shield,
  Filter,
  CheckCircle2,
  UserCheck,
  RotateCcw,
  Sparkles,
  Sliders,
  Check,
  Building2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { toast } from "sonner";
import {
  ALL_SYSTEM_SCREENS,
  type ScreenActionPermissions,
} from "../../lib/auth/rbac-definitions";
import { ScreenPermissionRow } from "./ScreenPermissionRow";

interface DomainConfig {
  id: string;
  nameAr: string;
  icon: string;
  screenIds: string[];
}

const DOMAIN_SECTIONS: DomainConfig[] = [
  {
    id: "core",
    nameAr: "الوحدات الإدارية والأساسية (Core Management)",
    icon: "corporate_fare",
    screenIds: ["dashboard", "organization", "employees", "documents"],
  },
  {
    id: "operations",
    nameAr: "الوقت والعمليات والدوام (Time & Operations)",
    icon: "schedule",
    screenIds: ["workflow", "leaves", "attendance", "shifts"],
  },
  {
    id: "finance",
    nameAr: "الرواتب والعمليات المالية (Payroll & Finance)",
    icon: "account_balance_wallet",
    screenIds: ["payroll", "loans", "expenses"],
  },
  {
    id: "talent",
    nameAr: "إدارة المواهب واستقطاب الكفاءات (Talent & Growth)",
    icon: "stars",
    screenIds: ["ats", "performance", "workforce"],
  },
  {
    id: "governance",
    nameAr: "الأصول والحوكمة والتكامل (Governance & Ecosystem)",
    icon: "admin_panel_settings",
    screenIds: ["assets", "reports", "integrations", "audit"],
  },
  {
    id: "self_service",
    nameAr: "الخدمة الذاتية والأمان (Self-Service & Access)",
    icon: "smartphone",
    screenIds: ["ess", "rbac"],
  },
];

export const UserPermissionsPanel: React.FC = () => {
  const {
    employees,
    orgUnits,
    permissionGroups,
    userPermissionOverrides,
    updateUserScreenPermissions,
    resetUserScreenPermissions,
    addUsersToGroup,
    removeUserFromGroup,
  } = useApp();

  const [selectedUserId, setSelectedUserId] = useState<string>(
    employees[0]?.id || "emp-01",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [screenSearch, setScreenSearch] = useState("");

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedUserId) || employees[0] || null;
  }, [employees, selectedUserId]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesDept =
        selectedDepartment === "all" ||
        emp.departmentId === selectedDepartment ||
        emp.departmentName === selectedDepartment;

      const fullName = `${emp.firstNameAr} ${emp.lastNameAr} ${emp.firstNameEn || ""} ${emp.lastNameEn || ""}`.toLowerCase();
      const matchesSearch =
        !searchTerm.trim() ||
        fullName.includes(searchTerm.toLowerCase()) ||
        emp.employeeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.jobTitleAr.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDept && matchesSearch;
    });
  }, [employees, searchTerm, selectedDepartment]);

  // Groups this user belongs to
  const userGroups = useMemo(() => {
    if (!selectedEmployee) return [];
    return permissionGroups.filter((g) => g.memberUserIds?.includes(selectedEmployee.id));
  }, [permissionGroups, selectedEmployee]);

  // Calculate base permissions from groups for this user
  const baseGroupPermissions = useMemo(() => {
    const map: Record<string, ScreenActionPermissions> = {};
    for (const screen of ALL_SYSTEM_SCREENS) {
      let v = false;
      let c = false;
      let e = false;
      let d = false;
      let a = false;

      for (const grp of userGroups) {
        const s = grp.screens?.[screen.id];
        if (s) {
          if (s.view) v = true;
          if (s.create) c = true;
          if (s.edit) e = true;
          if (s.delete) d = true;
          if (s.approveExport) a = true;
        }
      }

      map[screen.id] = {
        view: v,
        create: c,
        edit: e,
        delete: d,
        approveExport: a,
      };
    }
    return map;
  }, [userGroups]);

  // User-specific overrides
  const userOverrides = useMemo(() => {
    if (!selectedEmployee) return {};
    return userPermissionOverrides[selectedEmployee.id] || {};
  }, [userPermissionOverrides, selectedEmployee]);

  // Combined effective permissions
  const getEffectiveScreenPermission = (screenId: string): ScreenActionPermissions => {
    const base = baseGroupPermissions[screenId] || {
      view: false,
      create: false,
      edit: false,
      delete: false,
      approveExport: false,
    };
    const override = userOverrides[screenId];
    if (!override) return base;
    return {
      view: override.view !== undefined ? override.view : base.view,
      create: override.create !== undefined ? override.create : base.create,
      edit: override.edit !== undefined ? override.edit : base.edit,
      delete: override.delete !== undefined ? override.delete : base.delete,
      approveExport:
        override.approveExport !== undefined ? override.approveExport : base.approveExport,
    };
  };

  const handleToggleGroup = (groupId: string, isMember: boolean) => {
    if (!selectedEmployee) return;
    if (isMember) {
      removeUserFromGroup(groupId, selectedEmployee.id);
    } else {
      addUsersToGroup(groupId, [selectedEmployee.id]);
    }
  };

  const handleUpdateUserScreen = (
    screenId: string,
    actions: ScreenActionPermissions,
  ) => {
    if (!selectedEmployee) return;
    updateUserScreenPermissions(selectedEmployee.id, screenId, actions);
  };

  const handleResetOverrides = () => {
    if (!selectedEmployee) return;
    resetUserScreenPermissions(selectedEmployee.id);
  };

  const hasAnyOverrides = useMemo(() => {
    return Boolean(selectedEmployee && Object.keys(userOverrides).length > 0);
  }, [selectedEmployee, userOverrides]);

  const isScreenVisible = (screenId: string) => {
    if (!screenSearch.trim()) return true;
    const s = ALL_SYSTEM_SCREENS.find((item) => item.id === screenId);
    if (!s) return false;
    const q = screenSearch.toLowerCase();
    return (
      s.nameAr.toLowerCase().includes(q) ||
      s.nameEn.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Employees List (4 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-4">
          <div>
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              دليل المستخدمين والموظفين ({employees.length})
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              اختر الموظف لعرض المجموعات التي ينتمي إليها وتخصيص صلاحياته
            </p>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute right-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث بالاسم أو الرقم الوظيفي..."
                className="w-full h-9 rounded-2xl border border-border/80 bg-card pr-10 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs"
              />
            </div>

            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full h-9 rounded-2xl border border-border/80 bg-card px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">كافة الإدارات والأقسام ({employees.length})</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Employees List */}
          <div className="space-y-2 max-h-[720px] overflow-y-auto custom-scrollbar pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedEmployee?.id === emp.id;
              const memberOf = permissionGroups.filter((g) =>
                g.memberUserIds?.includes(emp.id),
              );
              const hasOverrides = Boolean(userPermissionOverrides[emp.id]);

              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedUserId(emp.id)}
                  className={`p-3.5 rounded-3xl border transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary/30"
                      : "bg-card hover:border-primary/40 border-border/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-2xl border border-border/80 shadow-2xs">
                      <AvatarImage src={emp.avatarUrl} />
                      <AvatarFallback className="text-xs font-bold bg-secondary">
                        {emp.firstNameAr?.[0]}
                        {emp.lastNameAr?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-foreground truncate">
                          {emp.firstNameAr} {emp.lastNameAr}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4">
                          {emp.employeeNo}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {emp.jobTitleAr} • {emp.departmentName}
                      </div>
                    </div>
                  </div>

                  {/* Groups badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-border/50">
                    {memberOf.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">
                        لا توجد مجموعة معينة
                      </span>
                    ) : (
                      memberOf.map((g) => (
                        <Badge
                          key={g.id}
                          variant="secondary"
                          className="text-[9px] font-bold rounded-full px-2 py-0"
                          style={{ borderColor: g.color }}
                        >
                          {g.nameAr}
                        </Badge>
                      ))
                    )}
                    {hasOverrides && (
                      <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-[9px] font-bold rounded-full px-1.5 py-0 mr-auto">
                        صلاحيات مخصصة
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: User Config & Domain Screen Permissions */}
        {/* ========================================================= */}
        {selectedEmployee && (
          <div className="lg:col-span-8 space-y-6">
            {/* User Profile Card */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 rounded-3xl border-2 border-primary/30 shadow-xs">
                    <AvatarImage src={selectedEmployee.avatarUrl} />
                    <AvatarFallback className="text-base font-bold bg-primary text-primary-foreground">
                      {selectedEmployee.firstNameAr?.[0]}
                      {selectedEmployee.lastNameAr?.[0]}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-foreground">
                        {selectedEmployee.firstNameAr} {selectedEmployee.lastNameAr}
                      </h2>
                      <Badge variant="outline" className="font-mono text-xs font-bold">
                        {selectedEmployee.employeeNo}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-2 mt-0.5">
                      <span className="font-bold text-primary">
                        {selectedEmployee.jobTitleAr}
                      </span>
                      <span>•</span>
                      <span>{selectedEmployee.departmentName}</span>
                    </div>
                  </div>
                </div>

                {hasAnyOverrides && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetOverrides}
                    className="rounded-full text-xs font-bold gap-1 text-amber-700 border-amber-500/40 hover:bg-amber-500/10 h-9 px-3.5 self-start sm:self-center"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    استعادة الصلاحيات الموروثة
                  </Button>
                )}
              </div>

              {/* Group Membership Toggles */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    المجموعات التي ينتمي إليها الموظف (انقر لتعديل الانضمام):
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-bold rounded-full px-2">
                    عضو في {userGroups.length} مجموعات
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {permissionGroups.map((grp) => {
                    const isMember = grp.memberUserIds?.includes(selectedEmployee.id);
                    return (
                      <div
                        key={grp.id}
                        onClick={() => handleToggleGroup(grp.id, isMember)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          isMember
                            ? "border-primary bg-primary/10 shadow-2xs font-bold"
                            : "border-border/70 hover:bg-muted/40 bg-muted/20 opacity-75"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isMember}
                            onChange={() => {}}
                            className="rounded text-primary focus:ring-primary h-4 w-4 pointer-events-none"
                          />
                          <span className="text-xs truncate text-foreground">
                            {grp.nameAr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Screen Permissions Matrix */}
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-border/80 shadow-xs">
                <div>
                  <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    الصلاحيات الفعلية للشاشات للمستخدم ({selectedEmployee.firstNameAr})
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    الصلاحيات موروثة من المجموعات المنضم إليها، ويمكنك تعديل أو استثناء أي شاشة بالأسفل
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute right-3.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={screenSearch}
                    onChange={(e) => setScreenSearch(e.target.value)}
                    placeholder="البحث في الشاشات..."
                    className="w-full h-8 rounded-2xl border border-border/80 bg-muted/20 pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Domain Groups Container */}
              <div className="space-y-5">
                {DOMAIN_SECTIONS.map((domain) => {
                  const domainScreens = ALL_SYSTEM_SCREENS.filter(
                    (s) => domain.screenIds.includes(s.id) && isScreenVisible(s.id),
                  );

                  if (domainScreens.length === 0) return null;

                  return (
                    <div
                      key={domain.id}
                      className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
                    >
                      {/* Domain Header */}
                      <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Sliders className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-foreground">
                            {domain.nameAr}
                          </h4>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {domainScreens.length} شاشات في هذا القطاع
                          </span>
                        </div>
                      </div>

                      {/* Screen Rows */}
                      <div className="space-y-2.5">
                        {domainScreens.map((screen) => {
                          const eff = getEffectiveScreenPermission(screen.id);
                          return (
                            <ScreenPermissionRow
                              key={screen.id}
                              screen={screen}
                              permissions={eff}
                              onChange={(nextPerm) =>
                                handleUpdateUserScreen(screen.id, nextPerm)
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save Bar */}
              <div className="sticky bottom-4 z-20 bg-card/95 backdrop-blur-md p-4 rounded-3xl border border-border/80 shadow-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-xs font-bold text-foreground">
                    تم تطبيق الصلاحيات للمستخدم ({selectedEmployee.firstNameAr} {selectedEmployee.lastNameAr})
                  </span>
                </div>

                <Button
                  onClick={() =>
                    toast.success(
                      `تم حفظ وتأكيد صلاحيات المستخدم (${selectedEmployee.firstNameAr}) بنجاح!`,
                    )
                  }
                  size="sm"
                  className="rounded-full text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-9 shadow-xs"
                >
                  <Check className="h-4 w-4" />
                  تأكيد وحفظ الصلاحيات
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
