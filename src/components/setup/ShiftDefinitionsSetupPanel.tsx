import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { Clock, Plus, Pencil, Archive, Sun, Moon, Split, Sliders } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useShiftDefinitions, useShiftMutations } from "../../lib/domains/shifts";
import type { ShiftDefinition } from "../../types";
import { ShiftDefinitionModal } from "../shifts/ShiftDefinitionModal";
import { WorkweekConfigCard } from "../shifts/WorkweekConfigCard";

export const ShiftDefinitionsSetupPanel: React.FC = () => {
  const { company, currentRole, language } = useApp();
  const canManage = canManageModule(currentRole, "shifts");

  const companyId = company?.id;
  const companyName = company?.legalNameAr || company?.legalNameEn || "المنشأة";

  const { shifts, isLoading, refetch } = useShiftDefinitions(companyId);
  const { archiveShift } = useShiftMutations(companyId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftDefinition | null>(null);

  const handleOpenCreate = () => {
    setEditingShift(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sh: ShiftDefinition) => {
    setEditingShift(sh);
    setIsModalOpen(true);
  };

  const handleArchive = async (sh: ShiftDefinition) => {
    if (window.confirm(`هل أنت متأكد من أرشفة الوردية «${sh.nameAr}»؟`)) {
      await archiveShift(sh.id);
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            تعريف سياسات وورديات العمل لشركة «{companyName}»
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            تهيئة سياسات الورديات، ساعات العمل الرسمية، وفترات الراحة الإلزامية المتوافقة مع نظام العمل السعودي.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            تعريف وردية جديدة
          </Button>
        )}
      </div>

      {/* Shifts Grid */}
      {shifts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Clock className="h-7 w-7" />
            </div>
            <p className="font-bold text-foreground text-sm">
              لم يتم تعريف أي ورديات عمل بعد بشركة «{companyName}»
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              الورديات ضرورية لحساب الحضور والانصراف، التأخير، وساعات العمل الإضافية بدقة وفق نظام العمل.
            </p>
            {canManage && (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                className="rounded-full text-xs font-bold gap-1.5 mt-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                تعريف أول وردية الآن
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((sh) => (
            <div
              key={sh.id}
              className={`classera-kpi-card p-5 shadow-xs space-y-3.5 relative overflow-hidden transition-all ${
                sh.status === "archived" ? "opacity-60 bg-muted/30" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3.5 w-3.5 rounded-full shadow-xs shrink-0"
                    style={{ backgroundColor: sh.color || "#0284c7" }}
                  />
                  <div>
                    <h3 className="font-black text-xs text-foreground">
                      {language === "ar" ? sh.nameAr : sh.nameEn}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">{sh.code}</span>
                      {sh.version && sh.version > 1 && (
                        <span className="text-[9px] text-muted-foreground font-mono">v{sh.version}</span>
                      )}
                    </div>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] rounded-full px-2.5 font-bold flex items-center gap-1 ${
                    sh.type === "fixed"
                      ? "bg-sky-500/10 text-sky-700 border-sky-300"
                      : sh.type === "flexible"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                        : sh.type === "split"
                          ? "bg-amber-500/10 text-amber-700 border-amber-300"
                          : "bg-indigo-500/10 text-indigo-700 border-indigo-300"
                  }`}
                >
                  {sh.type === "fixed" && <Sun className="h-3 w-3" />}
                  {sh.type === "flexible" && <Sliders className="h-3 w-3" />}
                  {sh.type === "split" && <Split className="h-3 w-3" />}
                  {sh.type === "overnight" && <Moon className="h-3 w-3" />}
                  {sh.type === "fixed" ? "ثابت" : sh.type === "flexible" ? "مرن" : sh.type === "split" ? "مقسم" : "ليلي"}
                </Badge>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-sans">فترة العمل:</span>
                  <span className="font-bold text-foreground">
                    {sh.startTime} - {sh.endTime}
                  </span>
                </div>
                {sh.type === "split" && sh.splitSecondStartTime && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">الفترة 2:</span>
                    <span className="font-bold text-amber-700">
                      {sh.splitSecondStartTime} - {sh.splitSecondEndTime}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-sans">سماح حضور:</span>
                  <span className="font-bold text-emerald-600">+{sh.graceMinutesArrival} دقيقة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-sans">راحة بعدها:</span>
                  <span className="font-bold text-foreground">{sh.minRestHoursAfter ?? 11} ساعة</span>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenEdit(sh)}
                    className="h-8 px-2.5 text-xs font-bold gap-1 text-primary hover:bg-primary/10 rounded-xl"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    تعديل
                  </Button>
                  {sh.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleArchive(sh)}
                      className="h-8 px-2.5 text-xs font-bold gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      أرشفة
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Workweek and Rest Configuration Card */}
      <WorkweekConfigCard companyId={companyId} canManage={canManage} />

      {/* Modal */}
      <ShiftDefinitionModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        initialShift={editingShift}
        companyId={companyId}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
};
