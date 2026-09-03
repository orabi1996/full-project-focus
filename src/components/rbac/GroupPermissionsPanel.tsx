import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Shield,
  Users,
  Plus,
  Trash2,
  Save,
  Search,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Building2,
  Clock,
  Wallet,
  Briefcase,
  Sliders,
  Check,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { toast } from "sonner";
import type { DataScope } from "../../types";
import {
  ALL_SYSTEM_SCREENS,
  type PermissionGroup,
  type ScreenActionPermissions,
  type ScreenModuleConfig,
} from "../../lib/auth/rbac-definitions";
import { ScreenPermissionRow } from "./ScreenPermissionRow";
import { CreateGroupModal } from "./CreateGroupModal";
import { ManageGroupMembersModal } from "./ManageGroupMembersModal";

interface DomainConfig {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  screenIds: string[];
}

const DOMAIN_SECTIONS: DomainConfig[] = [
  {
    id: "core",
    nameAr: "الوحدات الإدارية والأساسية (Core Management)",
    nameEn: "Core Management & Organization",
    icon: "corporate_fare",
    screenIds: ["dashboard", "organization", "employees", "documents"],
  },
  {
    id: "operations",
    nameAr: "الوقت والعمليات والدوام (Time & Operations)",
    nameEn: "Time & Operations Engine",
    icon: "schedule",
    screenIds: ["workflow", "leaves", "attendance", "shifts"],
  },
  {
    id: "finance",
    nameAr: "الرواتب والعمليات المالية (Payroll & Finance)",
    nameEn: "Compensation, Payroll & Expenses",
    icon: "account_balance_wallet",
    screenIds: ["payroll", "loans", "expenses"],
  },
  {
    id: "talent",
    nameAr: "إدارة المواهب واستقطاب الكفاءات (Talent & Growth)",
    nameEn: "Talent Acquisition & Performance",
    icon: "stars",
    screenIds: ["ats", "performance", "workforce"],
  },
  {
    id: "governance",
    nameAr: "الأصول والحوكمة والتكامل (Governance & Ecosystem)",
    nameEn: "Assets, Audit, BI & Integrations",
    icon: "admin_panel_settings",
    screenIds: ["assets", "reports", "integrations", "audit"],
  },
  {
    id: "self_service",
    nameAr: "الخدمة الذاتية والأمان (Self-Service & Access)",
    nameEn: "Employee Self-Service & Security",
    icon: "smartphone",
    screenIds: ["ess", "rbac"],
  },
];

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
  const [screenSearch, setScreenSearch] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // Selected Group
  const selectedGroup = useMemo(() => {
    return (
      permissionGroups.find((g) => g.id === selectedGroupId) ||
      permissionGroups[0] ||
      null
    );
  }, [permissionGroups, selectedGroupId]);

  // Group Members Resolution
  const groupMembers = useMemo(() => {
    if (!selectedGroup?.memberUserIds) return [];
    return employees.filter((e) => selectedGroup.memberUserIds.includes(e.id));
  }, [employees, selectedGroup]);

  // Permission updater for a single screen
  const handleUpdateScreenPermission = (
    screenId: string,
    nextPerm: ScreenActionPermissions,
  ) => {
    if (!selectedGroup) return;
    const currentScreens = selectedGroup.screens || {};
    const updatedScreens = {
      ...currentScreens,
      [screenId]: nextPerm,
    };
    updatePermissionGroup(selectedGroup.id, { screens: updatedScreens });
  };

  // Bulk Domain Toggle
  const handleToggleDomain = (domain: DomainConfig, enable: boolean) => {
    if (!selectedGroup) return;
    const currentScreens = { ...(selectedGroup.screens || {}) };
    domain.screenIds.forEach((sId) => {
      currentScreens[sId] = enable
        ? { view: true, create: true, edit: true, delete: true, approveExport: true }
        : { view: false, create: false, edit: false, delete: false, approveExport: false };
    });
    updatePermissionGroup(selectedGroup.id, { screens: currentScreens });
    toast.success(
      enable
        ? `تم تفعيل كافة شاشات ${domain.nameAr} بنجاح.`
        : `تم تعطيل شاشات ${domain.nameAr}.`,
    );
  };

  // Global Bulk Actions
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
    toast.success(`تم منح كافة الصلاحيات لجميع الشاشات لمجموعة (${selectedGroup.nameAr}).`);
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
    toast.warning(`تم تعطيل الوصول لكافة الشاشات لمجموعة (${selectedGroup.nameAr}).`);
  };

  const handleDeleteGroup = () => {
    if (!selectedGroup) return;
    if (confirm(`هل أنت متأكد من رغبتك في حذف المجموعة "${selectedGroup.nameAr}"؟`)) {
      const ok = deletePermissionGroup(selectedGroup.id);
      if (ok && permissionGroups[0]) {
        setSelectedGroupId(permissionGroups[0].id);
      }
    }
  };

  // Filter screens by search
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
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. GROUPS DECK (Horizontal Grid of Groups) */}
      {/* ========================================================= */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              مجموعات الصلاحيات المعتمدة في النظام ({permissionGroups.length})
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              اضغط على أي مجموعة لتهيئة صلاحياتها وإدارة المستخدمين المنضمين إليها
            </p>
          </div>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-9 px-4 self-start sm:self-center"
          >
            <Plus className="h-4 w-4" />
            إنشاء مجموعة جديدة
          </Button>
        </div>

        {/* Groups Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {permissionGroups.map((grp) => {
            const isSelected = selectedGroup?.id === grp.id;
            const memberCount = grp.memberUserIds?.length || 0;
            // Calculate active screens count
            const activeScreensCount = Object.values(grp.screens || {}).filter(
              (s) => s.view || s.create || s.edit || s.delete || s.approveExport,
            ).length;

            return (
              <div
                key={grp.id}
                onClick={() => setSelectedGroupId(grp.id)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer space-y-3 relative overflow-hidden select-none ${
                  isSelected
                    ? "bg-card border-primary shadow-md ring-2 ring-primary/30"
                    : "bg-card hover:border-primary/40 border-border/80 shadow-2xs"
                }`}
              >
                {/* Top Accent Color Line */}
                <div
                  className="absolute top-0 right-0 left-0 h-1"
                  style={{ backgroundColor: grp.color || "#4f46e5" }}
                />

                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-2xl flex items-center justify-center text-white font-bold shrink-0 shadow-xs"
                      style={{ backgroundColor: grp.color || "#4f46e5" }}
                    >
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-xs text-foreground truncate">
                        {grp.nameAr}
                      </h3>
                      <span className="text-[10px] text-muted-foreground font-medium block truncate">
                        {grp.nameEn || grp.code}
                      </span>
                    </div>
                  </div>

                  {grp.isSystem ? (
                    <Badge variant="secondary" className="text-[9px] font-bold rounded-full px-2 shrink-0">
                      أساسية
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] font-bold rounded-full px-2 text-primary border-primary/30 shrink-0">
                      مخصصة
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                  {grp.descriptionAr}
                </p>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                  <Badge variant="outline" className="text-[10px] font-bold rounded-full px-2.5 gap-1.5">
                    <Users className="h-3 w-3 text-primary" />
                    {memberCount} مستخدم
                  </Badge>

                  <span className="text-[10px] font-bold text-muted-foreground">
                    {activeScreensCount} / {ALL_SYSTEM_SCREENS.length} شاشة
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SELECTED GROUP DETAILS & MEMBERS */}
      {/* ========================================================= */}
      {selectedGroup && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
            {/* Header & Data Scope */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-5">
              <div className="flex items-center gap-4">
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0"
                  style={{ backgroundColor: selectedGroup.color || "#4f46e5" }}
                >
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-black text-foreground">
                      {selectedGroup.nameAr}
                    </h2>
                    <Badge variant="outline" className="font-mono text-xs font-bold">
                      {selectedGroup.code}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {selectedGroup.descriptionAr}
                  </p>
                </div>
              </div>

              {/* Data Scope & Delete Group */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-muted/40 px-3.5 py-1.5 rounded-2xl border border-border/80">
                  <span className="text-xs font-bold text-muted-foreground">
                    نطاق أمان البيانات:
                  </span>
                  <select
                    value={selectedGroup.dataScope || "all"}
                    onChange={(e) =>
                      updatePermissionGroup(selectedGroup.id, {
                        dataScope: e.target.value as DataScope,
                      })
                    }
                    className="bg-transparent text-xs font-black text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="all">كامل سجلات المنشأة (All Records)</option>
                    <option value="subsidiary">الشركة التابعة الحالية فقط</option>
                    <option value="department">القسم / الإدارة الحالية فقط</option>
                    <option value="team">أعضاء الفريق المباشر فقط</option>
                    <option value="self">البيانات الشخصية فقط (Self Only)</option>
                  </select>
                </div>

                {!selectedGroup.isSystem && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteGroup}
                    className="rounded-full text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10 h-9 px-3 gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف المجموعة
                  </Button>
                )}
              </div>
            </div>

            {/* Members Section Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-2xl border border-border/60">
              <div className="space-y-1.5">
                <span className="text-xs font-black text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  المستخدمون المنضمون لهذه المجموعة ({groupMembers.length} مستخدم):
                </span>
                <p className="text-[11px] text-muted-foreground font-medium">
                  أي صلاحيات تُحدد بالأسفل تُطبق تلقائياً على كافة هؤلاء المستخدمين
                </p>

                {/* Member Avatars & Names */}
                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  {groupMembers.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      لم يتم تعيين مستخدمين بعد في هذه المجموعة.
                    </span>
                  ) : (
                    groupMembers.slice(0, 8).map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-full border border-border/70 text-xs shadow-2xs"
                      >
                        <Avatar className="h-5 w-5 rounded-full">
                          <AvatarImage src={emp.avatarUrl} />
                          <AvatarFallback className="text-[8px] font-bold">
                            {emp.firstNameAr?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-[11px] text-foreground">
                          {emp.firstNameAr} {emp.lastNameAr}
                        </span>
                      </div>
                    ))
                  )}
                  {groupMembers.length > 8 && (
                    <Badge variant="secondary" className="text-[10px] font-bold rounded-full px-2">
                      +{groupMembers.length - 8} آخرين
                    </Badge>
                  )}
                </div>
              </div>

              {/* Add/Edit Members Button */}
              <Button
                onClick={() => setIsMembersModalOpen(true)}
                size="sm"
                className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-9 px-4 shrink-0 self-start sm:self-center"
              >
                <Users className="h-4 w-4" />
                إدارة وتعيين المستخدمين (+/-)
              </Button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. STRUCTURED SCREEN PERMISSIONS BY FUNCTIONAL DOMAINS */}
          {/* ========================================================= */}
          <div className="space-y-4">
            {/* Top Toolbar: Search & Bulk Presets */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-border/80 shadow-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={screenSearch}
                  onChange={(e) => setScreenSearch(e.target.value)}
                  placeholder="البحث في الشاشات والوحدات..."
                  className="w-full h-9 rounded-2xl border border-border/80 bg-muted/20 pr-10 pl-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Bulk Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetAllFullAccess}
                  className="rounded-full text-xs font-bold h-8 px-3 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                >
                  كامل الصلاحيات للكل
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetAllReadOnly}
                  className="rounded-full text-xs font-bold h-8 px-3 border-sky-500/30 text-sky-700 hover:bg-sky-500/10"
                >
                  قراءة فقط للكل
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAllPermissions}
                  className="rounded-full text-xs font-bold h-8 px-3 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  تعطيل الكل
                </Button>
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Sliders className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-foreground">
                            {domain.nameAr}
                          </h3>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {domainScreens.length} شاشات في هذا القطاع
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleToggleDomain(domain, true)}
                          className="text-[11px] font-bold text-emerald-700 hover:underline px-2 py-1"
                        >
                          تفعيل كامل شاشات القطاع
                        </button>
                        <span className="text-border">·</span>
                        <button
                          type="button"
                          onClick={() => handleToggleDomain(domain, false)}
                          className="text-[11px] font-bold text-muted-foreground hover:text-destructive hover:underline px-2 py-1"
                        >
                          تعطيل القطاع
                        </button>
                      </div>
                    </div>

                    {/* Domain Screen Rows */}
                    <div className="space-y-2.5">
                      {domainScreens.map((screen) => {
                        const perm = selectedGroup.screens?.[screen.id] || {
                          view: false,
                          create: false,
                          edit: false,
                          delete: false,
                          approveExport: false,
                        };

                        return (
                          <ScreenPermissionRow
                            key={screen.id}
                            screen={screen}
                            permissions={perm}
                            onChange={(nextPerm) =>
                              handleUpdateScreenPermission(screen.id, nextPerm)
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Save Bar */}
            <div className="sticky bottom-4 z-20 bg-card/95 backdrop-blur-md p-4 rounded-3xl border border-border/80 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <span className="text-xs font-black text-foreground block">
                    مصفوفة صلاحيات ({selectedGroup.nameAr})
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    يتم الحفظ التلقائي وتأكيد سريان الصلاحيات فوراً في قاعدة البيانات
                  </span>
                </div>
              </div>

              <Button
                onClick={() =>
                  toast.success(
                    `تم تأكيد وحفظ كافة صلاحيات مجموعة (${selectedGroup.nameAr}) بنجاح!`,
                  )
                }
                size="sm"
                className="rounded-full text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10 shadow-xs"
              >
                <Check className="h-4 w-4" />
                تأكيد واعتماد الصلاحيات
              </Button>
            </div>
          </div>
        </div>
      )}

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
