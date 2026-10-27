import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import { usePayroll } from "../../lib/domains/payroll";
import { useCompanyBankAccounts } from "../../lib/data/payroll-repository";
import { useSocialInsuranceProfiles } from "../../lib/data/country-packs-repository";
import {
  COUNTRY_PACK_CATALOG,
  type CountryCode,
} from "../../lib/domains/country-packs";
import {
  Wallet,
  Globe,
  ShieldCheck,
  Building,
  CheckCircle2,
  ExternalLink,
  Scale,
  CreditCard,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export const PayrollStatutorySetupPanel: React.FC = () => {
  const { company } = useApp();
  const navigate = useNavigate();
  const { payrollGroups } = usePayroll();
  const { data: bankAccounts = [] } = useCompanyBankAccounts();
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const { data: siProfiles = [] } = useSocialInsuranceProfiles(selectedCountry);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              تهيئة محرك الرواتب والحزم النظامية والتأمينات لشركة «{company?.legalNameAr || "الأندلس"}»
            </h2>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">
              شاشة التهيئة والحوكمة
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ضبط مجموعات الرواتب، حسابات حماية الأجور (WPS)، وقواعد التأمينات الاجتماعية والضرائب للدول المعتمدة، بينما يتم احتساب وصرف المسيرات الشهرية في شاشة الرواتب.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/country-packs" as any })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            مركز حزم الدول والربط الحكومي
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/payroll" })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            الانتقال لتشغيل مسيرات الرواتب الشهرية
          </Button>
        </div>
      </div>

      {/* Section 1: Payroll Groups & WPS Bank Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payroll Groups Card */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-black text-foreground">
                مجموعات ودوريات الرواتب المعتمدة ({payrollGroups.length})
              </h3>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold rounded-full">
              دورية الصرف الشهرية
            </Badge>
          </div>

          <div className="space-y-2.5">
            {payrollGroups.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                لا توجد مجموعات رواتب معرفة حالياً.
              </div>
            ) : (
              payrollGroups.map((grp) => (
                <div
                  key={grp.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/60 text-xs"
                >
                  <div>
                    <span className="font-black text-foreground block">{grp.nameAr}</span>
                    <span className="text-[11px] text-muted-foreground">
                      دورية الصرف: شهري • العملة: {grp.currency || "SAR"}
                    </span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px] rounded-full font-bold">
                    نشط ومعتمد
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* WPS Bank Accounts Card */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-black text-foreground">
                حسابات المنشأة البنكية لملفات حماية الأجور (WPS SIF)
              </h3>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-bold rounded-full border-emerald-500/30 text-emerald-600"
            >
              {bankAccounts.length} حساب بنكي
            </Badge>
          </div>

          <div className="space-y-2.5">
            {bankAccounts.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                لم يتم ربط حساب بنكي رئيسي لملفات حماية الأجور بعد. يمكنك إضافته من تبويب «1. بيانات المنشأة والسجل».
              </div>
            ) : (
              bankAccounts.map((acc: any) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/60 text-xs"
                >
                  <div>
                    <span className="font-black text-foreground block">
                      {acc.bankName || acc.bank_name || "البنك المعتمد"}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      IBAN: {acc.iban || "—"} • كود المصرف: {acc.bankCode || acc.bank_code || "—"}
                    </span>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-full font-bold">
                    جاهز لـ WPS
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Multi-Country Statutory & Social Insurance Rules */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              حزم الأنظمة التشريعية ونسب التأمينات الاجتماعية (5 دول معتمدة)
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { code: "all", label: "الكل (5)" },
              { code: "SA", label: "🇸🇦 السعودية" },
              { code: "EG", label: "🇪🇬 مصر" },
              { code: "QA", label: "🇶🇦 قطر" },
              { code: "OM", label: "🇴🇲 عمان" },
              { code: "BH", label: "🇧🇭 البحرين" },
            ].map((item) => (
              <Button
                key={item.code}
                size="sm"
                variant={selectedCountry === item.code ? "default" : "outline"}
                onClick={() => setSelectedCountry(item.code)}
                className="h-7 rounded-full text-[11px] font-bold px-2.5 cursor-pointer"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Country Packs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.keys(COUNTRY_PACK_CATALOG) as CountryCode[])
            .filter((c) => selectedCountry === "all" || selectedCountry === c)
            .map((c) => {
              const pack = COUNTRY_PACK_CATALOG[c];
              return (
                <div key={c} className="p-3.5 rounded-2xl border border-border/70 bg-muted/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-foreground">{pack.nameAr}</span>
                    <Badge variant="outline" className="font-mono text-[10px] rounded-full">
                      {pack.currencyCode}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                    <div className="flex justify-between">
                      <span>حماية الأجور:</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> WPS
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ضريبة الدخل:</span>
                      <span className="font-bold text-foreground">
                        {pack.incomeTaxSupported ? "تصاعدية" : "معفى (0%)"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>معيار الآيبان:</span>
                      <span className="font-mono font-bold text-foreground">{pack.ibanPrefix}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Social Insurance Matrix */}
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs text-right">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border/60">
              <tr>
                <th className="py-2.5 px-3">الدولة</th>
                <th className="py-2.5 px-3">النظام التأميني</th>
                <th className="py-2.5 px-3">الفئة المشمولة</th>
                <th className="py-2.5 px-3 text-center">حصة الموظف</th>
                <th className="py-2.5 px-3 text-center">حصة صاحب العمل</th>
                <th className="py-2.5 px-3 text-center">سقف الأجر الخاضع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {siProfiles.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="py-2.5 px-3 font-mono font-bold text-primary">{p.country_code}</td>
                  <td className="py-2.5 px-3 font-bold text-foreground">{p.name_ar}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant="outline" className="text-[10px] rounded-full">
                      {p.target_citizenship === "national"
                        ? "المواطنون"
                        : p.target_citizenship === "non_national"
                          ? "الوافدون"
                          : "الكل"}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">
                    {p.employee_rate_pct}%
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                    {p.employer_rate_pct}%
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                    {p.wage_ceiling ? p.wage_ceiling.toLocaleString() : "بدون سقف"}
                  </td>
                </tr>
              ))}
              {siProfiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    جاري تحميل مصفوفة التأمينات الاجتماعية المعتمدة...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
