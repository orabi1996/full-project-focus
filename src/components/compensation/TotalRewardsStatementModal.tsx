import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Printer } from "lucide-react";
import { useTotalRewardsSnapshot } from "../../lib/data/compensation-repository";

interface TotalRewardsStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
}

export function TotalRewardsStatementModal({
  open,
  onOpenChange,
  companyId,
  employeeId,
  employeeName,
  employeeNo,
}: TotalRewardsStatementModalProps) {
  const currentYear = new Date().getFullYear();
  const { data: snapshot, isLoading } = useTotalRewardsSnapshot(companyId, employeeId, currentYear);

  const baseAnnual = snapshot?.base_salary_annual || 0;
  const allowancesAnnual = snapshot?.fixed_allowances_annual || 0;
  const variableAnnual = snapshot?.variable_pay_annual || 0;
  const benefitsAnnual = snapshot?.employer_benefits_annual || 0;
  const statutoryAnnual = snapshot?.employer_statutory_annual || 0;
  const totalEmployerValue = snapshot?.total_employer_value_annual || 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-black">
                كشف إجمالي المكافآت والمزايا الشاملة (Total Rewards Statement)
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                تقرير القيمة الإجمالية السنوية المستثمرة للموظف لعام {currentYear}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 print:hidden">
              <Printer className="h-4 w-4" />
              طباعة الكشف
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            جاري توليد كشف المكافآت الشاملة...
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-muted/40 rounded-xl text-sm border">
              <div>
                <span className="text-xs text-muted-foreground block">اسم الموظف</span>
                <span className="font-bold text-foreground">{employeeName}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">الرقم الوظيفي</span>
                <span className="font-mono font-bold text-foreground">{employeeNo}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">العملة المعتمدة</span>
                <span className="font-bold text-foreground">ريال سعودي (SAR)</span>
              </div>
            </div>

            {/* Total Highlight */}
            <div className="p-5 bg-gradient-to-br from-primary/10 via-background to-secondary/30 rounded-2xl border border-primary/20 text-center">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                إجمالي القيمة الاستثمارية لصاحب العمل سنوياً (Total Employer Investment)
              </span>
              <h2 className="text-3xl font-black font-mono text-primary mt-1">
                {totalEmployerValue.toLocaleString()} ر.س
              </h2>
              <span className="text-xs text-emerald-600 font-semibold mt-1 block">
                متوسط شهري مكافئ: {Math.round(totalEmployerValue / 12).toLocaleString()} ر.س / شهر
              </span>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                تفاصيل عناصر التعويض والمزايا السنوية
              </h4>
              <div className="rounded-xl border divide-y overflow-hidden text-sm">
                <div className="flex justify-between p-3 bg-card hover:bg-muted/20 items-center">
                  <div>
                    <span className="font-bold text-foreground block">الراتب الأساسي السنوي (Base Salary)</span>
                    <span className="text-xs text-muted-foreground">الراتب الأساسي التعاقدي المؤرخ</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">{baseAnnual.toLocaleString()} ر.س</span>
                </div>

                <div className="flex justify-between p-3 bg-card hover:bg-muted/20 items-center">
                  <div>
                    <span className="font-bold text-foreground block">البدلات النقدية الثابتة (Fixed Allowances)</span>
                    <span className="text-xs text-muted-foreground">بدل السكن، بدل النقل، والبدلات الدورية المعتمدة</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">{allowancesAnnual.toLocaleString()} ر.س</span>
                </div>

                <div className="flex justify-between p-3 bg-card hover:bg-muted/20 items-center">
                  <div>
                    <span className="font-bold text-foreground block">المكافآت والحوافز المتغيرة (Variable Pay & Bonuses)</span>
                    <span className="text-xs text-muted-foreground">مكافآت الأداء السنوية، العمولات، والحوافز التشجيعية</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600">{variableAnnual.toLocaleString()} ر.س</span>
                </div>

                <div className="flex justify-between p-3 bg-card hover:bg-muted/20 items-center">
                  <div>
                    <span className="font-bold text-foreground block">مزايا الرعاية والتأمين الطبي (Corporate Benefits)</span>
                    <span className="text-xs text-muted-foreground">مساهمة المنشأة في التأمين الطبي، الحوادث، والبرامج الصحية</span>
                  </div>
                  <span className="font-mono font-bold text-indigo-600">{benefitsAnnual.toLocaleString()} ر.س</span>
                </div>

                <div className="flex justify-between p-3 bg-card hover:bg-muted/20 items-center">
                  <div>
                    <span className="font-bold text-foreground block">مساهمة التأمينات الاجتماعية (GOSI Employer Share)</span>
                    <span className="text-xs text-muted-foreground">حصة صاحب العمل النظامية الإلزامية في فرع المعاشات والأخطار المهنية</span>
                  </div>
                  <span className="font-mono font-bold text-purple-600">{statutoryAnnual.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>

            {/* Confidentiality Notice */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              <span className="font-bold block">ملاحظة السرية المؤسسية:</span>
              هذا الكشف وثيقة مالية وإدارية سرية موجهة حصرياً للموظف المعني، وتوضح كامل استثمار المنشأة في تعويضاتك ومزاياك.
            </div>
          </div>
        )}

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
