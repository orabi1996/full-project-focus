import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { saveCountryPayrollPolicyServer } from "../../lib/business/payroll-country.functions";
import { COUNTRY_PACK_CATALOG, type CountryCode, type CountryPayrollPolicy, type PayrollScheme, type CountryPolicyRecord } from "../../lib/business/payroll-country";
import { Button } from "../ui/button";

const inputClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm";
const newScheme = (code: string, citizenship: PayrollScheme["citizenship"]): PayrollScheme => ({
  code, citizenship, name: citizenship === "national" ? "اشتراك المواطنين" : "اشتراك غير المواطنين",
  contributions: [{ name: "اشتراك", basis: "basic_housing", employeeRate: 0, employerRate: 0, minimum: 0, maximum: null }],
});
const authorities: Record<CountryCode, string> = {
  SA: "https://www.gosi.gov.sa", EG: "https://www.nosi.gov.eg", AE: "https://www.gpssa.gov.ae",
  QA: "https://www.grsia.gov.qa", OM: "https://www.spf.gov.om", BH: "https://www.sio.gov.bh", KW: "https://www.pifss.gov.kw",
};

export function CountryPayrollPolicyPanel({ companyId, country, initialEffectiveFrom, onSaved }: { companyId: string; country: CountryCode; initialEffectiveFrom: string; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const pack = COUNTRY_PACK_CATALOG[country];
  const records = useQuery({ queryKey: ["payroll-country-policies", companyId, country], enabled: Boolean(companyId), queryFn: async () => {
    const { data, error } = await (supabase as any).from("payroll_country_policies").select("*")
      .eq("company_id", companyId).eq("country_code", country).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as CountryPolicyRecord[];
  }});
  const [policy, setPolicy] = useState<CountryPayrollPolicy>({ name: "", effectiveFrom: initialEffectiveFrom,
    effectiveTo: null, sourceUrl: authorities[country], monthlyHours: 240, overtimeWageMultiplier: 1,
    overtimeBasicPremium: 0, schemes: [newScheme("national", "national"), newScheme("non_national", "non_national")],
    tax: { enabled: country === "EG", annualExemption: 0, brackets: [{ upper: null, rate: 0, availableUpToAnnual: null }] },
  });
  const [activate, setActivate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const setScheme = (index: number, change: Partial<PayrollScheme>) => setPolicy(current => ({ ...current,
    schemes: current.schemes.map((scheme, i) => i === index ? { ...scheme, ...change } : scheme) }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setPending(true);
    try {
      await saveCountryPayrollPolicyServer({ data: { companyId, country, activate, policy } });
      await queryClient.invalidateQueries({ queryKey: ["payroll-country-policies", companyId, country] });
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ السياسة"); }
    finally { setPending(false); }
  };
  return <form onSubmit={save} className="space-y-5">
    <p className="text-sm text-muted-foreground">{pack.nameAr} · {pack.currencyCode} · {pack.decimalPrecision} منازل عشرية. أدخل قواعد المنشأة المراجعة من مصادرها، وحدد الأنظمة المختلفة بحسب فئات الموظفين.</p>
    {records.isError && <p role="alert" className="text-destructive">تعذر تحميل السياسات الحالية</p>}
    {records.data?.length ? <div className="rounded-xl border p-3 space-y-2">
      {records.data.map(record => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{record.policy.name} — {record.status === "active" ? "معتمدة" : "مسودة"} — {record.policy.effectiveFrom} حتى {record.policy.effectiveTo || "مفتوح"}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => { setPolicy({ ...record.policy, name: `${record.policy.name} — إصدار جديد`, effectiveFrom: initialEffectiveFrom, effectiveTo: null }); setActivate(false); }}>نسخ لإصدار جديد</Button>
      </div>)}
    </div> : null}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">اسم السياسة<input className={inputClass} required value={policy.name} onChange={e => setPolicy({ ...policy, name: e.target.value })} /></label>
      <label className="text-sm">رابط المصدر النظامي<input className={inputClass} type="url" required value={policy.sourceUrl} onChange={e => setPolicy({ ...policy, sourceUrl: e.target.value })} /></label>
      <label className="text-sm">بداية السريان<input className={inputClass} type="date" required value={policy.effectiveFrom} onChange={e => setPolicy({ ...policy, effectiveFrom: e.target.value })} /></label>
      <label className="text-sm">نهاية السريان الاختيارية<input className={inputClass} type="date" value={policy.effectiveTo || ""} onChange={e => setPolicy({ ...policy, effectiveTo: e.target.value || null })} /></label>
      <label className="text-sm">ساعات الأجر الشهرية<input className={inputClass} type="number" min="1" max="744" required value={policy.monthlyHours} onChange={e => setPolicy({ ...policy, monthlyHours: Number(e.target.value) })} /></label>
      <label className="text-sm">معامل الأجر الفعلي للإضافي<input className={inputClass} type="number" min="0" max="10" step="0.01" required value={policy.overtimeWageMultiplier} onChange={e => setPolicy({ ...policy, overtimeWageMultiplier: Number(e.target.value) })} /></label>
      <label className="text-sm">معامل زيادة الأساسي للإضافي<input className={inputClass} type="number" min="0" max="10" step="0.01" required value={policy.overtimeBasicPremium} onChange={e => setPolicy({ ...policy, overtimeBasicPremium: Number(e.target.value) })} /></label>
    </div>
    <p className="text-xs text-muted-foreground">أجر الإضافي للساعة يساوي الأجر الفعلي ÷ الساعات الشهرية × معامله، مضافًا إليه الأساسي ÷ الساعات الشهرية × معامل الزيادة.</p>
    {policy.schemes.map((scheme, index) => <fieldset key={index} className="rounded-xl border p-4 space-y-3">
      <legend className="px-2 font-semibold">نظام الاشتراك {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">الاسم<input className={inputClass} required value={scheme.name} onChange={e => setScheme(index, { name: e.target.value })} /></label>
        <label className="text-sm">رمز النظام<input className={inputClass} required pattern="[a-zA-Z0-9_-]+" value={scheme.code} onChange={e => setScheme(index, { code: e.target.value })} /></label>
        <label className="text-sm">الفئة<select className={inputClass} value={scheme.citizenship} onChange={e => setScheme(index, { citizenship: e.target.value as PayrollScheme["citizenship"] })}><option value="national">مواطنو دولة المنشأة</option><option value="non_national">غير المواطنين</option><option value="explicit">تعيين صريح لكل موظف</option></select></label>
      </div>
      {scheme.contributions.map((component, componentIndex) => {
        const update = (change: Partial<typeof component>) => setScheme(index, { contributions: scheme.contributions.map((item, i) => i === componentIndex ? { ...item, ...change } : item) });
        return <div key={componentIndex} className="grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-3">
          <label className="text-xs">اسم المكون<input className={inputClass} required value={component.name} onChange={e => update({ name: e.target.value })} /></label>
          <label className="text-xs">أساس الاشتراك<select className={inputClass} value={component.basis} onChange={e => update({ basis: e.target.value as typeof component.basis })}><option value="basic">الأساسي</option><option value="basic_housing">الأساسي والسكن</option><option value="gross">إجمالي الأجر الثابت</option><option value="registered">أجر الاشتراك المسجل للموظف</option></select></label>
          <label className="text-xs">نسبة الموظف %<input className={inputClass} type="number" min="0" max="100" step="0.001" required value={Number((component.employeeRate * 100).toFixed(6))} onChange={e => update({ employeeRate: Number(e.target.value) / 100 })} /></label>
          <label className="text-xs">نسبة المنشأة %<input className={inputClass} type="number" min="0" max="100" step="0.001" required value={Number((component.employerRate * 100).toFixed(6))} onChange={e => update({ employerRate: Number(e.target.value) / 100 })} /></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={component.taxDeductible !== false} onChange={e => update({ taxDeductible: e.target.checked })} />يخصم من وعاء ضريبة الدخل</label>
          <label className="text-xs">الأجر المستبعد قبل تطبيق المكون<input className={inputClass} type="number" min="0" step="0.001" value={component.offset ?? 0} onChange={e => update({ offset: Number(e.target.value) })} /></label>
          <label className="text-xs">الحد الأدنى<input className={inputClass} type="number" min="0" step="0.001" required value={component.minimum} onChange={e => update({ minimum: Number(e.target.value) })} /></label>
          <label className="text-xs">الحد الأقصى الاختياري<input className={inputClass} type="number" min="0" step="0.001" value={component.maximum ?? ""} onChange={e => update({ maximum: e.target.value === "" ? null : Number(e.target.value) })} /></label>
          {scheme.contributions.length > 1 && <Button type="button" variant="outline" onClick={() => setScheme(index, { contributions: scheme.contributions.filter((_, i) => i !== componentIndex) })}>حذف المكون</Button>}
        </div>;
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setScheme(index, { contributions: [...scheme.contributions, { name: "", basis: "gross", employeeRate: 0, employerRate: 0, minimum: 0, maximum: null }] })}>إضافة مكون اشتراك</Button>
        {policy.schemes.length > 1 && <Button type="button" variant="outline" onClick={() => setPolicy({ ...policy, schemes: policy.schemes.filter((_, i) => i !== index) })}>حذف النظام</Button>}
      </div>
    </fieldset>)}
    <Button type="button" variant="outline" onClick={() => setPolicy({ ...policy, schemes: [...policy.schemes, newScheme(`scheme_${policy.schemes.length + 1}`, "explicit")] })}>إضافة نظام اشتراك</Button>
    <fieldset className="rounded-xl border p-4 space-y-3">
      <legend className="px-2 font-semibold">ضريبة الدخل</legend>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={policy.tax.enabled} onChange={e => setPolicy({ ...policy, tax: { ...policy.tax, enabled: e.target.checked } })} />تطبيق ضريبة الدخل السنوية المقدرة على الأجر الشهري بعد الاشتراكات القابلة للخصم ضريبيًا</label>
      {policy.tax.enabled && <>
        <label className="block text-sm">الإعفاء الشخصي السنوي<input className={inputClass} type="number" min="0" required value={policy.tax.annualExemption} onChange={e => setPolicy({ ...policy, tax: { ...policy.tax, annualExemption: Number(e.target.value) } })} /></label>
        <p className="text-xs text-muted-foreground">أدخل الشرائح بترتيبها التصاعدي. عند تجاوز حد الاستفادة لشريحة، يبدأ حساب الضريبة من أول شريحة متاحة. المراجعة السنوية والتسويات تعالج بإجراء مستقل.</p>
        {policy.tax.brackets.map((bracket, index) => {
          const update = (change: Partial<typeof bracket>) => setPolicy({ ...policy, tax: { ...policy.tax, brackets: policy.tax.brackets.map((item, i) => i === index ? { ...item, ...change } : item) } });
          return <div key={index} className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">الحد السنوي الأعلى، فارغ للشريحة الأخيرة<input className={inputClass} type="number" min="0" value={bracket.upper ?? ""} onChange={e => update({ upper: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label className="text-xs">النسبة %<input className={inputClass} type="number" min="0" max="100" step="0.01" value={Number((bracket.rate * 100).toFixed(6))} onChange={e => update({ rate: Number(e.target.value) / 100 })} /></label>
            <label className="text-xs">حد الدخل السنوي الخاضع للاستفادة، فارغ للجميع<input className={inputClass} type="number" min="0" value={bracket.availableUpToAnnual ?? ""} onChange={e => update({ availableUpToAnnual: e.target.value === "" ? null : Number(e.target.value) })} /></label>
          </div>;
        })}
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setPolicy({ ...policy, tax: { ...policy.tax, brackets: [...policy.tax.brackets, { upper: null, rate: 0, availableUpToAnnual: null }] } })}>إضافة شريحة</Button>
        {policy.tax.brackets.length > 1 && <Button type="button" variant="outline" onClick={() => setPolicy({ ...policy, tax: { ...policy.tax, brackets: policy.tax.brackets.slice(0, -1) } })}>حذف آخر شريحة</Button>}</div>
      </>}
    </fieldset>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} />راجعت النسب والحدود والفئات ومصدرها، وأعتمد هذه الإعدادات لحساب رواتب المنشأة خلال فترة السريان.</label>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ..." : activate ? "حفظ واعتماد إصدار السياسة" : "حفظ مسودة السياسة"}</Button>
  </form>;
}
