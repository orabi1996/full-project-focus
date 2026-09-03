import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Users,
  Search,
  CheckCircle2,
  Shield,
  Eye,
  Edit,
  FilePlus,
  Trash2,
  ShieldAlert,
  RotateCcw,
  Save,
  Filter,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { toast } from "sonner";
import {
  ALL_SYSTEM_SCREENS,
  type ScreenActionPermissions,
  type ScreenModuleConfig,
} from "../../lib/auth/rbac-definitions";

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
  const [screenSearchTerm, setScreenSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

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

  const hasOverride = (screenId: string) => {
    return Boolean(userOverrides[screenId]);
  };

  const handleToggleGroup = (groupId: string, isMember: boolean) => {
    if (!selectedEmployee) return;
    if (isMember) {
      removeUserFromGroup(groupId, selectedEmployee.id);
    } else {
      addUsersToGroup(groupId, [selectedEmployee.id]);
    }
  };

  const handleToggleUserScreenAction = (
    screenId: string,
    action: keyof ScreenActionPermissions,
  ) => {
    if (!selectedEmployee) return;
    const currentEffective = getEffectiveScreenPermission(screenId);
    const nextVal = !currentEffective[action];
    const newActionUpdate: Partial<ScreenActionPermissions> = {
      [action]: nextVal,
    };
    if (action !== "view" && nextVal) {
      newActionUpdate.view = true;
    }
    updateUserScreenPermissions(selectedEmployee.id, screenId, newActionUpdate);
  };

  const handleSetUserScreenFull = (screenId: string) => {
    if (!selectedEmployee) return;
    updateUserScreenPermissions(selectedEmployee.id, screenId, {
      view: true,
      create: true,
      edit: true,
      delete: true,
      approveExport: true,
    });
  };

  const handleSetUserScreenDisabled = (screenId: string) => {
    if (!selectedEmployee) return;
    updateUserScreenPermissions(selectedEmployee.id, screenId, {
      view: false,
      create: false,
      edit: false,
      delete: false,
      approveExport: false,
    });
  };

  const handleResetOverrides = () => {
    if (!selectedEmployee) return;
    resetUserScreenPermissions(selectedEmployee.id);
  };

  // Filtered screens
  const filteredScreens = useMemo(() => {
    return ALL_SYSTEM_SCREENS.filter((screen) => {
      const matchCategory =
        selectedCategory === "all" || screen.category === selectedCategory;
      const matchSearch =
        !screenSearchTerm.trim() ||
        screen.nameAr.toLowerCase().includes(screenSearchTerm.toLowerCase()) ||
        screen.code.toLowerCase().includes(screenSearchTerm.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, screenSearchTerm]);

  const categories = [
    { id: "all", label: `كافة الشاشات (${ALL_SYSTEM_SCREENS.length})` },
    { id: "core", label: "الرئيسية والهيكل" },
    { id: "operations", label: "الوقت والعمليات" },
    { id: "finance", label: "الرواتب والمالية" },
    { id: "talent", label: "المواهب والنمو" },
    { id: "governance", label: "الأمان والامتثال" },
    { id: "self_service", label: "الخدمة الذاتية" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Employees List (4 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-muted-foreground uppercase flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              دليل المستخدمين والموظفين ({employees.length})
            </h2>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث بالاسم أو الرقم الوظيفي..."
                className="w-full h-9 rounded-2xl border border-border/80 bg-card pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full h-8 rounded-xl border border-border/80 bg-card px-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="all">كافة الإدارات والأقسام</option>
                {orgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Employees List */}
          <div className="space-y-2 max-h-[720px] overflow-y-auto custom-scrollbar pr-1">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedEmployee?.id === emp.id;
              const memberOf = permissionGroups.filter((g) => g.memberUserIds?.includes(emp.id));
              const hasCustomOverrides = Boolean(userPermissionOverrides[emp.id]);

              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedUserId(emp.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary/30"
                      : "bg-card hover:border-primary/40 border-border/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 rounded-xl border border-border/80">
                      <AvatarImage src={emp.avatarUrl} />
                      <AvatarFallback className="text-[11px] font-bold bg-secondary">
                        {emp.firstNameAr?.[0]}
                        {emp.lastNameAr?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground truncate">
                          {emp.firstNameAr} {emp.lastNameAr}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4">
                          {emp.employeeNo}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {emp.jobTitleAr} • {emp.departmentName}
                      </div>
                    </div>
                  </div>

                  {/* Badges of groups */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/50">
                    {memberOf.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">
                        لا توجد مجموعة معينة
                      </span>
                    ) : (
                      memberOf.map((g) => (
                        <Badge
                          key={g.id}
                          variant="secondary"
                          className="text-[9px] font-bold rounded-full px-1.5 py-0"
                          style={{ borderColor: g.color }}
                        >
                          {g.nameAr}
                        </Badge>
                      ))
                    )}
                    {hasCustomOverrides && (
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
        {/* RIGHT COLUMN: Selected User Permissions & Matrix (8 cols) */}
        {/* ========================================================= */}
        {selectedEmployee ? (
          <div className="lg:col-span-8 space-y-5">
            {/* User Profile Summary Header Card */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3.5">
                  <Avatar className="h-12 w-12 rounded-2xl border-2 border-primary/30 shadow-xs">
                    <AvatarImage src={selectedEmployee.avatarUrl} />
                    <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
                      {selectedEmployee.firstNameAr?.[0]}
                      {selectedEmployee.lastNameAr?.[0]}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-foreground">
                        {selectedEmployee.firstNameAr} {selectedEmployee.lastNameAr}
                      </h2>
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        {selectedEmployee.employeeNo}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-2 mt-0.5">
                      <span className="font-bold text-primary">{selectedEmployee.jobTitleAr}</span>
                      <span>•</span>
                      <span>{selectedEmployee.departmentName}</span>
                      <span>•</span>
                      <span dir="ltr">{selectedEmployee.email}</span>
                    </div>
                  </div>
                </div>

                {hasOverride(ALL_SYSTEM_SCREENS[0].id) ||
                Object.keys(userOverrides).length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetOverrides}
                    className="rounded-full text-xs font-bold gap-1 text-amber-700 border-amber-500/40 hover:bg-amber-500/10 h-8 px-3"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    استعادة الصلاحيات الموروثة
                  </Button>
                ) : null}
              </div>

              {/* Group Memberships Quick Toggle */}
              <div className="space-y-2">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-primary" />
                  المجموعات التي ينتمي إليها الموظف حالياً:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {permissionGroups.map((grp) => {
                    const isMember = grp.memberUserIds?.includes(selectedEmployee.id);
                    return (
                      <div
                        key={grp.id}
                        onClick={() => handleToggleGroup(grp.id, isMember)}
                        className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          isMember
                            ? "border-primary bg-primary/10 shadow-2xs font-bold"
                            : "border-border/70 hover:bg-muted/40 bg-muted/20 opacity-80"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isMember}
                            onChange={() => {}}
                            className="rounded-md text-primary focus:ring-primary h-3.5 w-3.5 pointer-events-none"
                          />
                          <span className="text-xs truncate text-foreground">{grp.nameAr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Direct Screen Permissions Matrix */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    الصلاحيات الفعلية للشاشات للمستخدم: {selectedEmployee.firstNameAr}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    الصلاحيات تُورث تلقائياً من المجموعات المنضم إليها، ويمكنك تخصيص أو استثناء أي شاشة يدوياً
                  </p>
                </div>

                <Badge variant="secondary" className="rounded-full text-xs px-3 py-1 font-bold self-start sm:self-center">
                  ينتمي لـ {userGroups.length} مجموعة
                </Badge>
              </div>

              {/* Filters */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={screenSearchTerm}
                    onChange={(e) => setScreenSearchTerm(e.target.value)}
                    placeholder="البحث في الشاشات والوحدات..."
                    className="w-full h-8 rounded-2xl border border-border/80 bg-muted/20 pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`text-[11px] font-bold rounded-full px-3 py-1 transition-all whitespace-nowrap ${
                        selectedCategory === cat.id
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/70 text-muted-foreground font-black text-[11px]">
                      <th className="p-3 w-64">الشاشة والوحدة</th>
                      <th className="p-3 text-center w-24">
                        <span className="flex items-center justify-center gap-1">
                          <Eye className="h-3.5 w-3.5 text-sky-600" />
                          قراءة
                        </span>
                      </th>
                      <th className="p-3 text-center w-24">
                        <span className="flex items-center justify-center gap-1">
                          <FilePlus className="h-3.5 w-3.5 text-emerald-600" />
                          إدخال
                        </span>
                      </th>
                      <th className="p-3 text-center w-24">
                        <span className="flex items-center justify-center gap-1">
                          <Edit className="h-3.5 w-3.5 text-amber-600" />
                          تعديل
                        </span>
                      </th>
                      <th className="p-3 text-center w-24">
                        <span className="flex items-center justify-center gap-1">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          حذف
                        </span>
                      </th>
                      <th className="p-3 text-center w-28">
                        <span className="flex items-center justify-center gap-1">
                          <ShieldAlert className="h-3.5 w-3.5 text-purple-600" />
                          اعتماد/تصدير
                        </span>
                      </th>
                      <th className="p-3 text-center w-36">إجراء سريع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredScreens.map((screen) => {
                      const eff = getEffectiveScreenPermission(screen.id);
                      const isOverridden = hasOverride(screen.id);

                      return (
                        <tr
                          key={screen.id}
                          className={`transition-colors ${
                            isOverridden ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] font-black px-1.5 py-0 h-5"
                              >
                                {screen.code}
                              </Badge>
                              <div>
                                <span className="font-bold text-xs text-foreground block">
                                  {screen.nameAr}
                                </span>
                                {isOverridden && (
                                  <span className="text-[9px] text-amber-600 font-bold block">
                                    ● تم تخصيص صلاحية فردية لهذا المستخدم
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* View Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={eff.view}
                              onChange={() => handleToggleUserScreenAction(screen.id, "view")}
                              className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                            />
                          </td>

                          {/* Create Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={eff.create}
                              onChange={() => handleToggleUserScreenAction(screen.id, "create")}
                              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>

                          {/* Edit Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={eff.edit}
                              onChange={() => handleToggleUserScreenAction(screen.id, "edit")}
                              className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>

                          {/* Delete Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={eff.delete}
                              onChange={() => handleToggleUserScreenAction(screen.id, "delete")}
                              className="h-4 w-4 rounded text-destructive focus:ring-destructive cursor-pointer"
                            />
                          </td>

                          {/* Approve/Export Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={eff.approveExport}
                              onChange={() =>
                                handleToggleUserScreenAction(screen.id, "approveExport")
                              }
                              className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          </td>

                          {/* Row Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSetUserScreenFull(screen.id)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700 transition-all"
                              >
                                كامل
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetUserScreenDisabled(screen.id)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                              >
                                إيقاف
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Save Bar */}
              <div className="border-t border-border/60 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium">
                  يتم حفظ الصلاحيات المخصصة لهذا المستخدم بشكل لحظي وآمن.
                </span>

                <Button
                  onClick={() =>
                    toast.success(
                      `تم حفظ وتطبيق الصلاحيات الخاصة للمستخدم (${selectedEmployee.firstNameAr} ${selectedEmployee.lastNameAr}) بنجاح!`,
                    )
                  }
                  size="sm"
                  className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-9 shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  تأكيد وحفظ صلاحيات المستخدم
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
