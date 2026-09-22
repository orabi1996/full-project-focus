import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, X, Sparkles } from "lucide-react";
import { Button } from "../ui/button";

export const SetupProgressBanner: React.FC = () => {
  const { company, orgUnits, currentRole } = useApp();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Show only for admins/HR managers
  const canManage = canManageModule(currentRole, "setup");
  if (!canManage || dismissed) return null;

  // Show if company setup is marked incomplete or if no departments are created yet
  const isIncomplete = company?.setupStatus === "incomplete" || orgUnits.length === 0;
  if (!isIncomplete) return null;

  return (
    <div
      dir="rtl"
      className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-primary/10 border-b border-amber-300/40 px-4 py-2.5 text-xs text-foreground transition-all duration-300"
    >
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <p className="font-bold text-foreground">
            تهيئة النظام لشركة «{company?.legalNameAr || "الأندلس"}» قيد الاستكمال.
            <span className="font-normal text-muted-foreground mr-1.5 hidden md:inline">
              يمكنك استكمال الهيكل التنظيمي ومقار العمل وقواعد التشغيل تدريجيًا دون تعطيل بقية الوحدات.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => navigate({ to: "/setup" })}
            className="h-7 rounded-full text-[11px] font-black bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs cursor-pointer px-3"
          >
            استكمال التهيئة
            <ArrowLeft className="h-3 w-3" />
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            title="إخفاء التنبيه مؤقتاً"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
