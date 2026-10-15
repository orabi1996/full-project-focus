// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: COMPLIANCE DRILLDOWN MODAL
// src/components/country-packs/ComplianceDrilldownModal.tsx
// ============================================================================

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ShieldAlert, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import type { ComplianceCheckRow } from "../../lib/data/country-packs-repository";

interface ComplianceDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checks: ComplianceCheckRow[];
}

export function ComplianceDrilldownModal({
  open,
  onOpenChange,
  checks,
}: ComplianceDrilldownModalProps) {
  const blocks = checks.filter((c) => c.check_type === "BLOCK");
  const warnings = checks.filter((c) => c.check_type === "WARNING");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            نتائج فحص الامتثال التشريعي قبل إقفال الرواتب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-4">
            <div className="flex-1 p-3 rounded-lg bg-red-50 border border-red-200">
              <span className="text-xs text-red-700 font-semibold block">موانع إقفال إلزامية (BLOCK)</span>
              <span className="text-2xl font-bold text-red-900">{blocks.length}</span>
            </div>
            <div className="flex-1 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-xs text-amber-700 font-semibold block">تنبيهات تدقيق (WARNING)</span>
              <span className="text-2xl font-bold text-amber-900">{warnings.length}</span>
            </div>
          </div>

          {checks.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
              <h4 className="font-bold text-base">مسير الرواتب متوافق تشريعياً بالكامل</h4>
              <p className="text-xs text-emerald-700 mt-1">
                تم اجتياز جميع فحوصات الآيبان والهويات والاشتراكات التأمينية بنجاح.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {checks.map((chk) => (
                <div
                  key={chk.id}
                  className={`p-3.5 rounded-lg border text-sm flex gap-3 ${
                    chk.check_type === "BLOCK"
                      ? "bg-red-50/70 border-red-200 text-red-900"
                      : "bg-amber-50/70 border-amber-200 text-amber-900"
                  }`}
                >
                  {chk.check_type === "BLOCK" ? (
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold">{chk.title_ar}</h4>
                      <Badge variant={chk.check_type === "BLOCK" ? "destructive" : "secondary"}>
                        {chk.check_type} • {chk.affected_count} موظف
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{chk.message_ar}</p>
                    <span className="inline-block mt-1 font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                      كود الفحص: {chk.check_code}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
