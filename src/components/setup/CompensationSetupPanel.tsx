import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import {
  useSalaryPayGrades,
  useSalaryRanges,
  useBenefitPlans,
} from "../../lib/data/compensation-repository";
import { CreateStructureModal } from "../compensation/CreateStructureModal";
import {
  Layers,
  Gift,
  Plus,
  ExternalLink,
  ShieldCheck,
  DollarSign,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export const CompensationSetupPanel: React.FC = () => {
  const { company, currentRole } = useApp();
  const navigate = useNavigate();
  const companyId = company?.id || "";
  const canManage =
    canManageModule(currentRole, "setup") || canManageModule(currentRole, "compensation");

  const { data: payGrades = [] } = useSalaryPayGrades(companyId);
  const { data: salaryRanges = [], refetch: refetchRanges } = useSalaryRanges(companyId);
  const { data: benefitPlans = [] } = useBenefitPlans(companyId);

  const [structureModalOpen, setStructureModalOpen] = useState(false);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              تهيئة سلالم ونطاقات الرواتب وكتالوج المزايا لشركة «{company?.legalNameAr || "الأندلس"}»
            </h2>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">
              شاشة التهيئة والحوكمة
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ضبط الدرجات الوظيفية، نطاقات الرواتب (Min / Mid / Max)، وخطط التأمين والمزايا، بينما تتم طلبات تعديل الرواتب ودورات المراجعة السنوية في شاشة التعويضات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/compensation" })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            الانتقال لعمليات التعويضات وتعديل الرواتب
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setStructureModalOpen(true)}
              className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              إضافة درجة ونطاق راتب جديد
            </Button>
          )}
        </div>
      </div>

      {/* Section 1: Salary Pay Grades & Ranges */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              نطاقات الرواتب وهيكل الدرجات الوظيفية ({salaryRanges.length} نطاق • {payGrades.length} درجة)
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full">
            حوكمة Compa-Ratio
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs text-right">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/60">
              <tr>
                <th className="py-3 px-4">الدرجة الوظيفية</th>
                <th className="py-3 px-4">المسار المهني</th>
                <th className="py-3 px-4">الحد الأدنى (Min)</th>
                <th className="py-3 px-4">نقطة المنتصف (Mid)</th>
                <th className="py-3 px-4">الحد الأقصى (Max)</th>
                <th className="py-3 px-4 text-center">اتساع النطاق</th>
                <th className="py-3 px-4 text-center">تاريخ السريان</th>
                <th className="py-3 px-4 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {salaryRanges.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    لا توجد نطاقات رواتب مسجلة حالياً. انقر على «إضافة درجة ونطاق راتب جديد» للبدء.
                  </td>
                </tr>
              ) : (
                salaryRanges.map((range: any) => (
                  <tr key={range.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-bold text-foreground">
                      {range.pay_grade?.code || "G-01"} — {range.pay_grade?.name_ar || "الدرجة الوظيفية"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {range.pay_grade?.career_track || "مهني وتخصصي"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {Number(range.minimum_salary || 0).toLocaleString()} {range.currency || "SAR"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {Number(range.midpoint_salary || 0).toLocaleString()} {range.currency || "SAR"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {Number(range.maximum_salary || 0).toLocaleString()} {range.currency || "SAR"}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                      {range.spread_percentage || 50}%
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                      {range.effective_from || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px] rounded-full font-bold">
                        نشط ومعتمد
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Benefits Catalog & Plans */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-black text-foreground">
              كتالوج خطط المزايا والتأمين الطبي المعتمدة ({benefitPlans.length})
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full border-emerald-500/30 text-emerald-600">
            خطط المزايا المؤسسية
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {benefitPlans.length === 0 ? (
            <div className="col-span-3 text-center py-6 text-xs text-muted-foreground">
              لا توجد خطط مزايا معرفة حالياً.
            </div>
          ) : (
            benefitPlans.map((plan: any) => (
              <div key={plan.id} className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-2.5 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-primary block">
                      {plan.category?.name_ar || "مزايا مؤسسية"}
                    </span>
                    <h4 className="font-black text-foreground text-sm mt-0.5">{plan.name_ar}</h4>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-full font-bold uppercase">
                    {plan.tier_level}
                  </Badge>
                </div>
                <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                  <div className="flex justify-between">
                    <span>مساهمة المنشأة الشهرية:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {Number(plan.employer_monthly_cost || 0).toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>استقطاع الموظف الشهري:</span>
                    <span className="font-mono font-bold text-foreground">
                      {Number(plan.employee_monthly_cost || 0).toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>تغطية التابعين:</span>
                    <span className="font-bold text-foreground">
                      {plan.dependent_coverage_allowed ? "مسموحة" : "غير متاحة"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CreateStructureModal
        open={structureModalOpen}
        onOpenChange={setStructureModalOpen}
        companyId={companyId}
        onSuccess={refetchRanges}
      />
    </div>
  );
};
