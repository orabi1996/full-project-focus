import React, { useMemo, useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, X, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { calculateSetupProgress } from "../../lib/domains/setup/setup-progress";

export const SetupProgressBanner: React.FC = () => {
  const {
    company,
    orgUnits,
    workLocations,
    costCenters,
    jobPositions,
    shifts,
    leaveTypes,
    currentRole,
  } = useApp();

  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Show only for admins/HR managers
  const canManage = canManageModule(currentRole, "setup");

  const progress = useMemo(() => {
    return calculateSetupProgress({
      company,
      orgUnits,
      workLocations,
      costCenters,
      jobPositions,
      shifts,
      leaveTypes,
    });
  }, [company, orgUnits, workLocations, costCenters, jobPositions, shifts, leaveTypes]);

  if (!canManage || dismissed || progress.isFullyConfigured) {
    return null;
  }

  const companyName = company?.legalNameAr || "الأندلس";

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
            تهيئة النظام لشركة «{companyName}» قيد الاستكمال ({progress.percentage}%).
            <span className="font-normal text-muted-foreground mr-1.5 hidden md:inline">
              {progress.missingFields.length > 0
                ? `بانتظار: ${progress.missingFields.slice(0, 2).join("، ")}${
                    progress.missingFields.length > 2 ? " والمزيد..." : ""
                  }`
                : "يمكنك استكمال بقية الإعدادات تدريجياً دون تعطيل العمليات القائمة."}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => navigate({ to: "/setup" })}
            className="h-7 rounded-full text-[11px] font-black bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs cursor-pointer px-3"
          >
            استكمال التهيئة ({progress.percentage}%)
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
