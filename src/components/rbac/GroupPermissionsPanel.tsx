import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Shield,
  Users,
  Search,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Sliders,
  Check,
  X,
  Copy,
  Eye,
  Edit,
  FilePlus,
  ShieldAlert,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { toast } from "sonner";
import { IconSymbol } from "../ui/IconSymbol";
import type { DataScope } from "../../types";
import {
  ALL_SYSTEM_SCREENS,
  type PermissionGroup,
  type ScreenActionPermissions,
  type ScreenModuleConfig,
} from "../../lib/auth/rbac-definitions";
import { CreateGroupModal } from "./CreateGroupModal";
import { ManageGroupMembersModal } from "./ManageGroupMembersModal";

export const GroupPermissionsPanel: React.FC = () => {
  const {
    permissionGroups,
    updatePermissionGroup,
    deletePermissionGroup,
    employees,
  } = useApp();

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    permissionGroups[0]?.id || "grp-superadmin",
  );
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [screenSearchTerm, setScreenSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // Selected Group resolution
  const selectedGroup = useMemo(() => {
    return (
      permissionGroups.find((g) => g.id === selectedGroupId) ||
      permissionGroups[0] ||
      null
    );
  }, [permissionGroups, selectedGroupId]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return permissionGroups.filter((g) => {
      const match =
        !groupSearchTerm.trim() ||
        g.nameAr.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
        g.code.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
        (g.nameEn && g.nameEn.toLowerCase().includes(groupSearchTerm.toLowerCase()));
      return match;
    });
  }, [permissionGroups, groupSearchTerm]);

  // Filtered Screens
  const filteredScreens = useMemo(() => {
    return ALL_SYSTEM_SCREENS.filter((screen) => {
      const matchCategory =
        selectedCategory === "all" || screen.category === selectedCategory;
      const matchSearch =
        !screenSearchTerm.trim() ||
        screen.nameAr.toLowerCase().includes(screenSearchTerm.toLowerCase()) ||
        screen.code.toLowerCase().includes(screenSearchTerm.toLowerCase()) ||
        screen.nameEn.toLowerCase().includes(screenSearchTerm.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, screenSearchTerm]);

  // Categories list for filter pills
  const categories = [
    { id: "all", label: `كافة الشاشات (${ALL_SYSTEM_SCREENS.length})` },
    { id: "core", label: "الرئيسية والهيكل" },
    { id: "operations", label: "الوقت والعمليات" },
    { id: "finance", label: "الرواتب والمالية" },
    { id: "talent", label: "المواهب والنمو" },
    { id: "governance", label: "الأمان والامتثال" },
    { id: "self_service", label: "الخدمة الذاتية" },
  ];

  // Group Members Resolution
  const groupMembers = useMemo(() => {
    if (!selectedGroup?.memberUserIds) return [];
    return employees.filter((e) => selectedGroup.memberUserIds.includes(e.id));
  }, [employees, selectedGroup]);

  // Permission Action Toggle Handler
  const handleToggleScreenAction = (
    screenId: string,
    action: keyof ScreenActionPermissions,
  ) => {
    if (!selectedGroup) return;

    const currentScreens = selectedGroup.screens || {};
    const screenPerm = currentScreens[screenId] || {
      view: false,
      create: false,
      edit: false,
      delete: false,
      approveExport: false,
    };

    const nextPerm = {
      ...screenPerm,
      [action]: !screenPerm[action],
    };

    // If granting create/edit/delete/approve, automatically grant view as well
    if (action !== "view" && nextPerm[action]) {
      nextPerm.view = true;
    }

    const updatedScreens = {
      ...currentScreens,
      [screenId]: nextPerm,
    };

    updatePermissionGroup(selectedGroup.id, { screens: updatedScreens });
  };

  // Row Quick Actions
  const handleSetRowFullAccess = (screenId: string) => {
    if (!selectedGroup) return;
    const currentScreens = selectedGroup.screens || {};
    const updatedScreens = {
      ...currentScreens,
      [screenId]: {
        view: true,
        create: true,
        edit: true,
        delete: true,
        approveExport: true,
      },
    };
    updatePermissionGroup(selectedGroup.id, { screens: updatedScreens });
  };

  const handleSetRowReadOnly = (screenId: string) => {
    if (!selectedGroup) return;
    const currentScreens = selectedGroup.screens || {};
    const updatedScreens = {
      ...currentScreens,
      [screenId]: {
        view: true,
        create: false,
        edit: false,
        delete: false,
        approveExport: true,
      },
    };
    updatePermissionGroup(selectedGroup.id, { screens: updatedScreens });
  };

  const handleSetRowDisabled = (screenId: string) => {
    if (!selectedGroup) return;
    const currentScreens = selectedGroup.screens || {};
    const updatedScreens = {
      ...currentScreens,
      [screenId]: {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approveExport: false,
      },
    };
    updatePermissionGroup(selectedGroup.id, { screens: updatedScreens });
  };

  // Bulk Actions
  const handleSetAllFullAccess = () => {
    if (!selectedGroup) return;
    const newScreens: Record<string, ScreenActionPermissions> = {};
    for (const s of ALL_SYSTEM_SCREENS) {
      newScreens[s.id] = {
        view: true,
        create: true,
        edit: true,
        delete: true,
        approveExport: true,
      };
    }
    updatePermissionGroup(selectedGroup.id, { screens: newScreens });
    toast.success(`تم منح كافة الصلاحيات على جميع الشاشات لمجموعة (${selectedGroup.nameAr}).`);
  };

  const handleSetAllReadOnly = () => {
    if (!selectedGroup) return;
    const newScreens: Record<string, ScreenActionPermissions> = {};
    for (const s of ALL_SYSTEM_SCREENS) {
      newScreens[s.id] = {
        view: true,
        create: false,
        edit: false,
        delete: false,
        approveExport: true,
      };
    }
    updatePermissionGroup(selectedGroup.id, { screens: newScreens });
    toast.info(`تم تعيين صلاحيات القراءة فقط لكافة الشاشات لمجموعة (${selectedGroup.nameAr}).`);
  };

  const handleClearAllPermissions = () => {
    if (!selectedGroup) return;
    const newScreens: Record<string, ScreenActionPermissions> = {};
    for (const s of ALL_SYSTEM_SCREENS) {
      newScreens[s.id] = {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approveExport: false,
      };
    }
    updatePermissionGroup(selectedGroup.id, { screens: newScreens });
    toast.warning(`تم تعطيل الصلاحيات على كافة الشاشات لمجموعة (${selectedGroup.nameAr}).`);
  };

  const handleDeleteCurrentGroup = () => {
    if (!selectedGroup) return;
    if (confirm(`هل أنت متأكد من رغبتك في حذف المجموعة "${selectedGroup.nameAr}" نهائياً؟`)) {
      const deleted = deletePermissionGroup(selectedGroup.id);
      if (deleted && permissionGroups[0]) {
        setSelectedGroupId(permissionGroups[0].id);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Groups List (4 cols on lg) */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-muted-foreground uppercase flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              مجموعات الصلاحيات والأدوار ({permissionGroups.length})
            </h2>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="sm"
              className="h-8 rounded-full text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              مجموعة جديدة
            </Button>
          </div>

          {/* Group Search Bar */}
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={groupSearchTerm}
              onChange={(e) => setGroupSearchTerm(e.target.value)}
              placeholder="البحث في المجموعات والأدوار..."
              className="w-full h-9 rounded-2xl border border-border/80 bg-card pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs"
            />
          </div>

          {/* Groups List */}
          <div className="space-y-2.5 max-h-[720px] overflow-y-auto custom-scrollbar pr-1">
            {filteredGroups.map((grp) => {
              const isSelected = selectedGroup?.id === grp.id;
              const membersCount = grp.memberUserIds?.length || 0;
              return (
                <div
                  key={grp.id}
                  onClick={() => setSelectedGroupId(grp.id)}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary/30"
                      : "bg-card hover:border-primary/40 border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-xs font-bold"
                        style={{ backgroundColor: grp.color || "#4f46e5" }}
                      >
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-black text-xs text-foreground line-clamp-1">
                          {grp.nameAr}
                        </h3>
                        {grp.nameEn && (
                          <span className="text-[10px] text-muted-foreground font-medium line-clamp-1">
                            {grp.nameEn}
                          </span>
                        )}
                      </div>
                    </div>

                    {grp.isSystem ? (
                      <Badge variant="secondary" className="text-[9px] font-bold rounded-full px-2">
                        نظام
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-bold rounded-full px-2 text-primary border-primary/30">
                        مخصص
                      </Badge>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 font-medium">
                    {grp.descriptionAr}
                  </p>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px]">
                    <span className="font-mono text-primary font-bold">{grp.code}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-bold rounded-full px-2">
                        <Users className="h-3 w-3 mr-1 text-muted-foreground" />
                        {membersCount} مستخدم
                      </Badge>
                      <Badge variant="secondary" className="text-[9px] font-bold rounded-full px-2">
                        {grp.dataScope === "all"
                          ? "كامل المنشأة"
                          : grp.dataScope === "department"
                            ? "القسم"
                            : grp.dataScope === "team"
                              ? "الفريق"
                              : "شخصي"}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Group Details & 20-Screen Matrix (8 cols on lg) */}
        {/* ========================================================= */}
        {selectedGroup ? (
          <div className="lg:col-span-8 space-y-5">
            {/* Header Box */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: selectedGroup.color || "#4f46e5" }}
                  >
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-foreground">
                        {selectedGroup.nameAr}
                      </h2>
                      {selectedGroup.isSystem && (
                        <Badge variant="secondary" className="text-[10px] rounded-full px-2.5 font-bold">
                          مجموعة نظام أساسية
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {selectedGroup.descriptionAr}
                    </p>
                  </div>
                </div>

                {/* Scope and Delete Button */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1 rounded-2xl border border-border/80">
                    <span className="text-[11px] font-bold text-muted-foreground">نطاق البيانات:</span>
                    <select
                      value={selectedGroup.dataScope || "all"}
                      onChange={(e) =>
                        updatePermissionGroup(selectedGroup.id, {
                          dataScope: e.target.value as DataScope,
                        })
                      }
                      className="bg-transparent text-xs font-black text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="all">كامل المنشأة (All Records)</option>
                      <option value="subsidiary">الشركة التابعة فقط</option>
                      <option value="department">القسم / الإدارة فقط</option>
                      <option value="team">أعضاء الفريق المباشر</option>
                      <option value="self">البيانات الشخصية فقط (Self)</option>
                    </select>
                  </div>

                  {!selectedGroup.isSystem && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteCurrentGroup}
                      className="h-8 rounded-full text-destructive border-destructive/30 hover:bg-destructive/10 text-xs font-bold gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </Button>
                  )}
                </div>
              </div>

              {/* Members Preview Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3.5 rounded-2xl border border-border/60">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" />
                    المستخدمين المعينين في المجموعة ({groupMembers.length}):
                  </span>

                  <div className="flex items-center -space-x-2 space-x-reverse overflow-hidden">
                    {groupMembers.slice(0, 6).map((member) => (
                      <Avatar
                        key={member.id}
                        className="h-7 w-7 rounded-full border-2 border-background"
                        title={`${member.firstNameAr} ${member.lastNameAr} (${member.jobTitleAr})`}
                      >
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback className="text-[9px] font-bold bg-secondary">
                          {member.firstNameAr?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {groupMembers.length > 6 && (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[9px] font-black border-2 border-background text-foreground">
                        +{groupMembers.length - 6}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => setIsMembersModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs font-bold h-8 px-3.5 border-border/80 hover:bg-card gap-1.5 shadow-2xs"
                >
                  <Users className="h-3.5 w-3.5 text-primary" />
                  إدارة أعضاء المجموعة ({groupMembers.length})
                </Button>
              </div>
            </div>

            {/* Matrix Container */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
              {/* Matrix Control Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    مصفوفة صلاحيات الشاشات والوحدات (20 شاشة ووحدة)
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    حدد مستوى الصلاحية بدقة: قراءة، إدخال، تعديل، حذف، واعتماد/تصدير
                  </p>
                </div>

                {/* Bulk Actions */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSetAllFullAccess}
                    className="rounded-full text-[11px] font-bold h-7 px-2.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                  >
                    كامل الصلاحيات للكل
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSetAllReadOnly}
                    className="rounded-full text-[11px] font-bold h-7 px-2.5 border-sky-500/30 text-sky-600 hover:bg-sky-500/10"
                  >
                    قراءة فقط للكل
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAllPermissions}
                    className="rounded-full text-[11px] font-bold h-7 px-2.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    إلغاء الكل
                  </Button>
                </div>
              </div>

              {/* Filters & Category Tabs */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={screenSearchTerm}
                      onChange={(e) => setScreenSearchTerm(e.target.value)}
                      placeholder="البحث باسم الشاشة أو الكود (مثال: الرواتب، M10)..."
                      className="w-full h-8 rounded-2xl border border-border/80 bg-muted/20 pr-9 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                {/* Category Pills */}
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
                      <th className="p-3 text-center w-40">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredScreens.map((screen) => {
                      const screenPerms: ScreenActionPermissions =
                        selectedGroup.screens?.[screen.id] || {
                          view: false,
                          create: false,
                          edit: false,
                          delete: false,
                          approveExport: false,
                        };

                      const isAllGranted =
                        screenPerms.view &&
                        screenPerms.create &&
                        screenPerms.edit &&
                        screenPerms.delete &&
                        screenPerms.approveExport;

                      const isAllDisabled =
                        !screenPerms.view &&
                        !screenPerms.create &&
                        !screenPerms.edit &&
                        !screenPerms.delete &&
                        !screenPerms.approveExport;

                      return (
                        <tr
                          key={screen.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          {/* Screen Info */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
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
                                <span className="text-[10px] text-muted-foreground font-medium line-clamp-1">
                                  {screen.descriptionAr}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* View Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={screenPerms.view}
                              onChange={() => handleToggleScreenAction(screen.id, "view")}
                              className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                              title="صلاحية القراءة والاستعراض"
                            />
                          </td>

                          {/* Create Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={screenPerms.create}
                              onChange={() => handleToggleScreenAction(screen.id, "create")}
                              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              title="صلاحية الإدخال وإنشاء سجل جديد"
                            />
                          </td>

                          {/* Edit Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={screenPerms.edit}
                              onChange={() => handleToggleScreenAction(screen.id, "edit")}
                              className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                              title="صلاحية التعديل والتحديث"
                            />
                          </td>

                          {/* Delete Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={screenPerms.delete}
                              onChange={() => handleToggleScreenAction(screen.id, "delete")}
                              className="h-4 w-4 rounded text-destructive focus:ring-destructive cursor-pointer"
                              title="صلاحية الحذف والإلغاء"
                            />
                          </td>

                          {/* Approve/Export Toggle */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={screenPerms.approveExport}
                              onChange={() => handleToggleScreenAction(screen.id, "approveExport")}
                              className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                              title="صلاحية الاعتماد أو تصدير التقارير"
                            />
                          </td>

                          {/* Row Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSetRowFullAccess(screen.id)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                  isAllGranted
                                    ? "bg-emerald-600 text-white shadow-2xs"
                                    : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700"
                                }`}
                                title="منح كافة الصلاحيات لهذه الشاشة"
                              >
                                كامل
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetRowReadOnly(screen.id)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-sky-100 hover:text-sky-700 transition-all"
                                title="قراءة فقط"
                              >
                                قراءة
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetRowDisabled(screen.id)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                  isAllDisabled
                                    ? "bg-destructive text-white shadow-2xs"
                                    : "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                }`}
                                title="تعطيل الوصول لهذه الشاشة"
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
                  يتم حفظ التعديلات وحفظ الصلاحيات ومزامنتها فوراً في النظام.
                </span>

                <Button
                  onClick={() =>
                    toast.success(
                      `تم حفظ وتأكيد مصفوفة الصلاحيات لمجموعة (${selectedGroup.nameAr}) بنجاح!`,
                    )
                  }
                  size="sm"
                  className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-9 shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  حفظ وتأكيد مصفوفة الصلاحيات
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modals */}
      <CreateGroupModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreated={(newGrp) => setSelectedGroupId(newGrp.id)}
      />

      <ManageGroupMembersModal
        group={selectedGroup}
        open={isMembersModalOpen}
        onOpenChange={setIsMembersModalOpen}
      />
    </div>
  );
};
