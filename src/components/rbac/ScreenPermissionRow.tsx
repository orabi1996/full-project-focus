import React from "react";
import { Badge } from "../ui/badge";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Eye,
  FilePlus,
  Edit,
  Trash2,
  ShieldAlert,
  Check,
  Power,
  Sparkles,
} from "lucide-react";
import type {
  ScreenActionPermissions,
  ScreenModuleConfig,
} from "../../lib/auth/rbac-definitions";

interface ScreenPermissionRowProps {
  screen: ScreenModuleConfig;
  permissions: ScreenActionPermissions;
  onChange: (permissions: ScreenActionPermissions) => void;
}

export const ScreenPermissionRow: React.FC<ScreenPermissionRowProps> = ({
  screen,
  permissions,
  onChange,
}) => {
  const isAccessEnabled =
    permissions.view ||
    permissions.create ||
    permissions.edit ||
    permissions.delete ||
    permissions.approveExport;

  const handleToggleMaster = () => {
    if (isAccessEnabled) {
      // Disable all
      onChange({
        view: false,
        create: false,
        edit: false,
        delete: false,
        approveExport: false,
      });
    } else {
      // Enable with view by default
      onChange({
        view: true,
        create: false,
        edit: false,
        delete: false,
        approveExport: false,
      });
    }
  };

  const handleToggleAction = (action: keyof ScreenActionPermissions) => {
    const nextVal = !permissions[action];
    const updated = {
      ...permissions,
      [action]: nextVal,
    };
    // If enabling any write action, auto-enable view
    if (action !== "view" && nextVal) {
      updated.view = true;
    }
    // If disabling view, disable all dependent write actions
    if (action === "view" && !nextVal) {
      updated.create = false;
      updated.edit = false;
      updated.delete = false;
      updated.approveExport = false;
    }
    onChange(updated);
  };

  const handleSetFull = () => {
    onChange({
      view: true,
      create: true,
      edit: true,
      delete: true,
      approveExport: true,
    });
  };

  const handleSetReadOnly = () => {
    onChange({
      view: true,
      create: false,
      edit: false,
      delete: false,
      approveExport: true,
    });
  };

  return (
    <div
      className={`p-4 rounded-3xl border transition-all duration-200 ${
        isAccessEnabled
          ? "bg-card border-border/90 shadow-xs"
          : "bg-muted/15 border-border/50 opacity-75 hover:opacity-100"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left/Right: Screen Information & Master Toggle */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div
            className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-colors shadow-2xs shrink-0 ${
              isAccessEnabled
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-muted text-muted-foreground border border-border/80"
            }`}
          >
            <IconSymbol name={screen.iconName} source="material" size={22} />
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-foreground">
                {screen.nameAr}
              </span>
              <Badge
                variant="outline"
                className="font-mono text-[10px] font-black px-1.5 py-0 h-4 border-border/80"
              >
                {screen.code}
              </Badge>
              {!isAccessEnabled && (
                <Badge
                  variant="secondary"
                  className="text-[9px] font-bold rounded-full px-2 text-muted-foreground"
                >
                  محظور الوصول
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium line-clamp-1">
              {screen.descriptionAr}
            </p>
          </div>
        </div>

        {/* Action Controls & Chips */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
          {/* Master Access Button */}
          <button
            type="button"
            onClick={handleToggleMaster}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-all border ${
              isAccessEnabled
                ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/25"
                : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {isAccessEnabled ? "الوصول مفعل" : "معطل"}
          </button>

          {isAccessEnabled && (
            <>
              <div className="h-5 w-px bg-border/80 hidden sm:block mx-0.5" />

              {/* 5 Permission Toggle Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* 1. View Chip */}
                <button
                  type="button"
                  onClick={() => handleToggleAction("view")}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-all border shadow-2xs ${
                    permissions.view
                      ? "bg-sky-500 text-white border-sky-600 shadow-sky-500/20"
                      : "bg-card text-muted-foreground border-border/80 hover:border-sky-400 hover:text-sky-600"
                  }`}
                  title="صلاحية استعراض وقراءة البيانات"
                >
                  <Eye className="h-3.5 w-3.5" />
                  قراءة
                </button>

                {/* 2. Create Chip */}
                <button
                  type="button"
                  onClick={() => handleToggleAction("create")}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-all border shadow-2xs ${
                    permissions.create
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-emerald-600/20"
                      : "bg-card text-muted-foreground border-border/80 hover:border-emerald-400 hover:text-emerald-600"
                  }`}
                  title="صلاحية إدخال وإنشاء سجلات جديدة"
                >
                  <FilePlus className="h-3.5 w-3.5" />
                  إدخال
                </button>

                {/* 3. Edit Chip */}
                <button
                  type="button"
                  onClick={() => handleToggleAction("edit")}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-all border shadow-2xs ${
                    permissions.edit
                      ? "bg-amber-600 text-white border-amber-700 shadow-amber-600/20"
                      : "bg-card text-muted-foreground border-border/80 hover:border-amber-400 hover:text-amber-600"
                  }`}
                  title="صلاحية تعديل وتحديث السجلات"
                >
                  <Edit className="h-3.5 w-3.5" />
                  تعديل
                </button>

                {/* 4. Delete Chip */}
                <button
                  type="button"
                  onClick={() => handleToggleAction("delete")}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-all border shadow-2xs ${
                    permissions.delete
                      ? "bg-rose-600 text-white border-rose-700 shadow-rose-600/20"
                      : "bg-card text-muted-foreground border-border/80 hover:border-rose-400 hover:text-rose-600"
                  }`}
                  title="صلاحية حذف أو إلغاء السجلات"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </button>

                {/* 5. Approve/Export Chip */}
                <button
                  type="button"
                  onClick={() => handleToggleAction("approveExport")}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-all border shadow-2xs ${
                    permissions.approveExport
                      ? "bg-purple-600 text-white border-purple-700 shadow-purple-600/20"
                      : "bg-card text-muted-foreground border-border/80 hover:border-purple-400 hover:text-purple-600"
                  }`}
                  title="صلاحية اعتماد العمليات وتصدير التقارير"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  اعتماد / تصدير
                </button>
              </div>

              {/* Row Presets */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSetFull}
                  className="text-[11px] font-bold text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                >
                  كامل
                </button>
                <span className="text-border text-xs">·</span>
                <button
                  type="button"
                  onClick={handleSetReadOnly}
                  className="text-[11px] font-bold text-muted-foreground hover:text-sky-700 hover:bg-sky-50 px-2 py-1 rounded-lg transition-colors"
                >
                  قراءة
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
