import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
import {
  ShieldCheck,
  Users,
  Shield,
  Sliders,
  Layers,
  FileCheck,
  History,
  Lock,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { ALL_SYSTEM_SCREENS } from "../../lib/auth/rbac-definitions";
import { GroupPermissionsPanel } from "./GroupPermissionsPanel";
import { UserPermissionsPanel } from "./UserPermissionsPanel";
import { GlobalRbacMatrixPanel } from "./GlobalRbacMatrixPanel";

export const RbacView: React.FC = () => {
  const { currentRole, permissionGroups, auditLogs, employees, language, t } = useApp();
  const canManage = canManageModule(currentRole, "rbac");

  const [activeTab, setActiveTab] = useState<
    "groups" | "users" | "matrix" | "audit"
  >("groups");

  // Calculate unique assigned users across all groups
  const totalAssignedUsers = useMemo(() => {
    const userSet = new Set<string>();
    permissionGroups.forEach((g) => {
      g.memberUserIds?.forEach((id) => userSet.add(id));
    });
    return userSet.size;
  }, [permissionGroups]);

  // Security and RBAC specific audit logs
  const rbacAuditLogs = useMemo(() => {
    return auditLogs.filter(
      (log) =>
        log.entityType === "PermissionGroup" ||
        log.entityType === "UserPermission" ||
        log.entityType === "RoleDefinition" ||
        log.action.includes("صلاحي") ||
        log.action.includes("مجموع"),
    );
  }, [auditLogs]);

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. Executive Page Header */}
      {/* ========================================================= */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconSymbol name="admin_panel_settings" source="material" filled size={24} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  {t.nav.rbac} ومصفوفة الصلاحيات والحوكمة
                </h1>
                <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5">
                  حوكمة أمنية وصلاحيات متقدمة
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                إدارة مجموعات الصلاحيات، تعيين المستخدمين، مصفوفة الشاشات الـ 20 الدقيقة (قراءة، إدخال، تعديل، حذف، اعتماد)، ونطاقات الأمان
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full px-3 py-1 font-bold text-xs gap-1.5 border-primary/30 text-primary bg-primary/5 shadow-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            نطاق أمان مؤسسي معتمد
          </Badge>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. Top Metric Cards */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Metric 1: Groups */}
        <div className="classera-kpi-card p-4 shadow-xs flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-2xs">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted-foreground block">
              مجموعات الصلاحيات
            </span>
            <span className="text-lg font-black text-foreground font-tabular-nums font-mono">
              {permissionGroups.length} مجموعات
            </span>
          </div>
        </div>

        {/* Metric 2: Covered Screens */}
        <div className="classera-kpi-card p-4 shadow-xs flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-secondary flex items-center justify-center text-primary shadow-2xs">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted-foreground block">
              الشاشات والوحدات
            </span>
            <span className="text-lg font-black text-foreground font-tabular-nums font-mono">
              {ALL_SYSTEM_SCREENS.length} شاشة ووحدة
            </span>
          </div>
        </div>

        {/* Metric 3: Assigned Users */}
        <div className="classera-kpi-card p-4 shadow-xs flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-2xs">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted-foreground block">
              المستخدمين المعينين
            </span>
            <span className="text-lg font-black text-foreground font-tabular-nums font-mono">
              {totalAssignedUsers} من {employees.length} موظف
            </span>
          </div>
        </div>

        {/* Metric 4: Security Scopes */}
        <div className="classera-kpi-card p-4 shadow-xs flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-2xs">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted-foreground block">
              نطاقات الأمان (Scopes)
            </span>
            <span className="text-lg font-black text-foreground font-tabular-nums font-mono">
              5 مستويات عزل
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. Navigation Tabs */}
      {/* ========================================================= */}
      <div className="classera-tabs-strip w-full">
        <button
          type="button"
          onClick={() => setActiveTab("groups")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "groups"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/60"
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          مجموعات الصلاحيات والأدوار ({permissionGroups.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "users"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/60"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          صلاحيات المستخدمين المباشرة ({employees.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "matrix"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/60"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          المصفوفة المقارنة الشاملة
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "audit"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/60"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          سجل تدقيق الأمان ({rbacAuditLogs.length})
        </button>
      </div>

      {/* ========================================================= */}
      {/* 4. Tab Content */}
      {/* ========================================================= */}
      {activeTab === "groups" && <GroupPermissionsPanel />}
      {activeTab === "users" && <UserPermissionsPanel />}
      {activeTab === "matrix" && <GlobalRbacMatrixPanel />}

      {/* Audit Trail Tab */}
      {activeTab === "audit" && (
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                سجل التدقيق الزمني لعمليات الصلاحيات والمجموعات
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                سجل آمن غير قابل للحذف يوثق كل إضافة أو تعديل في صلاحيات المجموعات أو المستخدمين
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full text-xs font-bold px-3 py-1">
              {rbacAuditLogs.length} عملية مسجلة
            </Badge>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/70 text-muted-foreground font-black text-[11px]">
                  <th className="p-3">الإجراء والعملية</th>
                  <th className="p-3">الكيان المتأثر</th>
                  <th className="p-3">تفاصيل التعديل</th>
                  <th className="p-3">المنفذ</th>
                  <th className="p-3">الوقت والتاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rbacAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      لا توجد عمليات تعديل صلاحيات مسجلة حديثاً.
                    </td>
                  </tr>
                ) : (
                  rbacAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="p-3 font-bold text-foreground">{log.action}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {log.entityType}: {log.entityName}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground font-medium">{log.changesSummary}</td>
                      <td className="p-3">
                        <span className="font-bold text-foreground">{log.actorName}</span>
                        <span className="text-[10px] text-muted-foreground block">
                          ({log.actorRole})
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-[11px]" dir="ltr">
                        {new Date(log.timestamp).toLocaleString("ar-SA")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
