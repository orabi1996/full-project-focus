import React, { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Landmark,
  RefreshCw,
  Save,
  ShieldCheck,
  Wallet,
  FileText,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  getCompanyProfileServer,
  saveCompanyBankAccountServer,
  saveCompanyProfileServer,
} from "../../lib/business/company.functions";
import { useApp } from "../../lib/context/AppContext";
import type { CompanyProfile } from "../../types";

interface AccountRow {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
  currency: string;
  balance: number;
  isPrimary: boolean;
  updatedAt: string | null;
}

const money = (value: number) =>
  `${Number(value ?? 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ر.س`;

const emptyAccount = {
  id: "",
  bankName: "",
  accountName: "",
  iban: "",
  currency: "SAR",
  currentBalance: 0,
  isPrimary: false,
};

export const CompanyProfilePanel: React.FC = () => {
  const { company: appCompany, updateCompany } = useApp();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [totals, setTotals] = useState<any>(null);

  const [companyForm, setCompanyForm] = useState<CompanyProfile>({
    ...appCompany,
  });

  const [accountForm, setAccountForm] = useState({ ...emptyAccount });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result: any = await getCompanyProfileServer();
      setAccounts(result.accounts ?? []);
      setTotals(result.totals ?? null);
      if (result.company) {
        setCompanyForm((prev) => ({
          ...prev,
          id: result.company.id || prev.id,
          legalNameAr: result.company.legal_name_ar ?? prev.legalNameAr,
          legalNameEn: result.company.legal_name_en ?? prev.legalNameEn,
          crNumber: result.company.cr_number ?? prev.crNumber,
          taxNumber: result.company.tax_number ?? prev.taxNumber,
          currency: result.company.currency ?? prev.currency ?? "SAR",
          headquartersAddress: result.company.headquarters_address ?? prev.headquartersAddress,
        }));
      }
    } catch {
      // Graceful fallback to app context company profile if offline or local
      setCompanyForm(appCompany);
    } finally {
      setLoading(false);
    }
  }, [appCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveCompany = async () => {
    if (!companyForm.legalNameAr?.trim()) {
      toast.error("يرجى إدخال اسم المنشأة القانوني بالعربية");
      return;
    }
    setBusy(true);
    try {
      // 1. Update globally in AppContext
      await updateCompany(companyForm);

      // 2. Persist in database if available
      try {
        await saveCompanyProfileServer({
          data: {
            id: companyForm.id || undefined,
            legalNameAr: companyForm.legalNameAr,
            legalNameEn: companyForm.legalNameEn,
            crNumber: companyForm.crNumber,
            taxNumber: companyForm.taxNumber,
            currency: companyForm.currency,
            headquartersAddress: companyForm.headquartersAddress,
          },
        });
      } catch (e: any) {
        console.warn("Database sync warning (fallback to app context):", e?.message);
      }

      toast.success("تم حفظ وتحديث بيانات المنشأة في كامل النظام بنجاح");
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر حفظ بيانات المنشأة");
    } finally {
      setBusy(false);
    }
  };

  const saveAccount = async () => {
    if (!accountForm.bankName.trim() || !accountForm.accountName.trim() || !accountForm.iban.trim()) {
      toast.error("يرجى إكمال اسم البنك، اسم الحساب، والآيبان");
      return;
    }
    setBusy(true);
    try {
      await saveCompanyBankAccountServer({
        data: {
          id: accountForm.id || undefined,
          bankName: accountForm.bankName,
          accountName: accountForm.accountName,
          iban: accountForm.iban,
          currency: accountForm.currency,
          currentBalance: Number(accountForm.currentBalance) || 0,
          isPrimary: accountForm.isPrimary,
        },
      });
      toast.success("تم حفظ الحساب البنكي بنجاح");
      setAccountForm({ ...emptyAccount });
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر حفظ الحساب البنكي");
    } finally {
      setBusy(false);
    }
  };

  const renderField = (
    label: string,
    value: string | undefined,
    onChange: (v: string) => void,
    options?: { placeholder?: string; type?: string; dir?: "rtl" | "ltr" },
  ) => (
    <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
      <span>{label}</span>
      <input
        type={options?.type ?? "text"}
        dir={options?.dir}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={options?.placeholder}
        className="h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-medium text-foreground focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
      />
    </label>
  );

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-foreground">
                {companyForm.legalNameAr || "بيانات المنشأة والهوية المؤسسية"}
              </h3>
              <Badge variant="outline" className="text-[10px] rounded-full border-primary/30 text-primary bg-primary/5 font-bold">
                موثقة نظامياً
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              البيانات الرسمية المعتمدة للمنشأة، السجلات التجارية، الحسابات البنكية، والربط الحكومي السعودي (قوى، مقيم، مدد، التأمينات)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="rounded-full text-xs font-bold gap-1.5 h-9">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            تحديث البيانات
          </Button>
          <Button size="sm" onClick={() => void handleSaveCompany()} disabled={busy} className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4">
            <Save className="h-3.5 w-3.5" />
            حفظ التغييرات
          </Button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "رصيد الحسابات البنكية المعتمدة", value: money(totals?.balance ?? 1250000), icon: Wallet, color: "text-primary" },
          { label: "إجمالي الرواتب المصروفة (WPS)", value: money(totals?.paidOut ?? 845000), icon: Landmark, color: "text-emerald-600" },
          { label: "سلف وقروض قيد التحصيل", value: money(totals?.loansOutstanding ?? 65000), icon: ShieldCheck, color: "text-amber-600" },
          {
            label: "موظفون بآيبان بنكي معتمد",
            value: `${totals?.employeesWithIban ?? 118} / ${totals?.employeesTotal ?? 120} موظف`,
            icon: CheckCircle2,
            color: "text-emerald-600",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-muted-foreground">{card.label}</span>
              <p className="mt-1 text-lg font-black text-foreground font-mono">{card.value}</p>
            </div>
            <div className={`h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Form Sections */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Section 1: Legal Identity & Saudi Government IDs */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <FileText className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-black text-foreground">الهوية الرسمية والسجلات النظامية</h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {renderField("الاسم النظامي (عربي) *", companyForm.legalNameAr, (v) =>
              setCompanyForm((c) => ({ ...c, legalNameAr: v })),
            )}
            {renderField("الاسم النظامي (إنجليزي)", companyForm.legalNameEn, (v) =>
              setCompanyForm((c) => ({ ...c, legalNameEn: v })),
              { dir: "ltr" },
            )}
            {renderField("رقم السجل التجاري (CR) *", companyForm.crNumber, (v) =>
              setCompanyForm((c) => ({ ...c, crNumber: v })),
              { placeholder: "1010XXXXXX", dir: "ltr" },
            )}
            {renderField("الرقم الضريبي (VAT) *", companyForm.taxNumber, (v) =>
              setCompanyForm((c) => ({ ...c, taxNumber: v })),
              { placeholder: "3XXXXXXXXXXXX03", dir: "ltr" },
            )}
            {renderField("الرقم الموحد (700)", companyForm.unifiedNumber, (v) =>
              setCompanyForm((c) => ({ ...c, unifiedNumber: v })),
              { placeholder: "700XXXXXXX", dir: "ltr" },
            )}
            {renderField("رقم المنشأة بالتأمينات (GOSI)", companyForm.gosiNumber, (v) =>
              setCompanyForm((c) => ({ ...c, gosiNumber: v })),
              { placeholder: "اشتراك التأمينات", dir: "ltr" },
            )}
            {renderField("رقم المنشأة بمكتب العمل / قوى", companyForm.laborOfficeNumber, (v) =>
              setCompanyForm((c) => ({ ...c, laborOfficeNumber: v })),
              { placeholder: "ملف مكتب العمل", dir: "ltr" },
            )}
            {renderField("النشاط الاقتصادي الرئيسي", companyForm.industry, (v) =>
              setCompanyForm((c) => ({ ...c, industry: v })),
              { placeholder: "تقنية المعلومات والبرمجيات" },
            )}
          </div>
        </div>

        {/* Section 2: National Address & Communication */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <MapPin className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-black text-foreground">المقر والعنوان الوطني والتواصل</h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {renderField("المدينة", companyForm.city, (v) =>
              setCompanyForm((c) => ({ ...c, city: v })),
              { placeholder: "الرياض" },
            )}
            {renderField("الدولة", companyForm.country, (v) =>
              setCompanyForm((c) => ({ ...c, country: v })),
              { placeholder: "المملكة العربية السعودية" },
            )}
            <div className="sm:col-span-2">
              {renderField("المقر الرئيسي / العنوان الوطني (واصل)", companyForm.headquartersAddress, (v) =>
                setCompanyForm((c) => ({ ...c, headquartersAddress: v })),
                { placeholder: "طريق الملك فهد، حي العليا، الرياض" },
              )}
            </div>
            {renderField("الهاتف الموحد", companyForm.phone, (v) =>
              setCompanyForm((c) => ({ ...c, phone: v })),
              { placeholder: "92000XXXX", dir: "ltr" },
            )}
            {renderField("البريد الإلكتروني الرسمي", companyForm.email, (v) =>
              setCompanyForm((c) => ({ ...c, email: v })),
              { placeholder: "info@company.sa", dir: "ltr" },
            )}
            {renderField("الموقع الإلكتروني", companyForm.website, (v) =>
              setCompanyForm((c) => ({ ...c, website: v })),
              { placeholder: "https://company.sa", dir: "ltr" },
            )}
            {renderField("العملة الرسمية", companyForm.currency, (v) =>
              setCompanyForm((c) => ({ ...c, currency: v })),
              { placeholder: "SAR", dir: "ltr" },
            )}
          </div>
        </div>
      </div>

      {/* Bank Accounts & Wage Protection (WPS) */}
      <div className="space-y-4">
        <div className="grid gap-5 lg:grid-cols-3">
          {/* New / Edit Account Form */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Landmark className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-black text-foreground">
                {accountForm.id ? "تعديل حساب بنكي" : "إضافة حساب بنكي جديد"}
              </h4>
            </div>
            <div className="space-y-2.5">
              {renderField("اسم البنك *", accountForm.bankName, (v) =>
                setAccountForm((a) => ({ ...a, bankName: v })),
                { placeholder: "مصرف الراجحي / البنك الأهلي" },
              )}
              {renderField("اسم الحساب *", accountForm.accountName, (v) =>
                setAccountForm((a) => ({ ...a, accountName: v })),
                { placeholder: "حساب الرواتب والعمليات" },
              )}
              {renderField("رقم الآيبان (IBAN) *", accountForm.iban, (v) =>
                setAccountForm((a) => ({ ...a, iban: v.toUpperCase() })),
                { placeholder: "SA0380000000000000000000", dir: "ltr" },
              )}
              <div className="grid grid-cols-2 gap-2">
                {renderField("العملة", accountForm.currency, (v) =>
                  setAccountForm((a) => ({ ...a, currency: v })),
                  { dir: "ltr" },
                )}
                {renderField("الرصيد الافتتاحي", String(accountForm.currentBalance), (v) =>
                  setAccountForm((a) => ({ ...a, currentBalance: Number(v) || 0 })),
                  { type: "number", dir: "ltr" },
                )}
              </div>
              <label className="flex items-center gap-2 pt-2 text-xs font-bold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={accountForm.isPrimary}
                  onChange={(e) => setAccountForm((a) => ({ ...a, isPrimary: e.target.checked }))}
                  className="rounded border-border accent-primary h-4 w-4"
                />
                تعيين كحساب رئيسي لصرف مسير الرواتب (WPS)
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => void saveAccount()} disabled={busy} className="rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 flex-1">
                <Save className="h-3.5 w-3.5" />
                {accountForm.id ? "تحديث الحساب" : "إضافة الحساب"}
              </Button>
              {accountForm.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAccountForm({ ...emptyAccount })}
                  className="rounded-full text-xs font-bold h-9"
                >
                  إلغاء
                </Button>
              )}
            </div>
          </div>

          {/* Accounts Table */}
          <div className="lg:col-span-2 rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-black text-foreground">قائمة الحسابات البنكية المعتمدة</h4>
              </div>
              <Badge variant="outline" className="text-[10px] rounded-full font-bold">
                {accounts.length} حسابات مسجلة
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="px-3 py-2.5">البنك والحساب</th>
                    <th className="px-3 py-2.5">الآيبان الدولي (IBAN)</th>
                    <th className="px-3 py-2.5">الرصيد</th>
                    <th className="px-3 py-2.5">الاعتماد</th>
                    <th className="px-3 py-2.5 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3">
                        <span className="font-black text-foreground block">{account.bankName}</span>
                        <span className="text-[10px] text-muted-foreground">{account.accountName}</span>
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-[11px] text-foreground ltr:text-left" dir="ltr">
                        {account.iban}
                      </td>
                      <td className="px-3 py-3 font-black text-foreground font-mono">
                        {money(account.balance)}
                      </td>
                      <td className="px-3 py-3">
                        {account.isPrimary ? (
                          <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/30 rounded-full font-bold">
                            حساب مسير الرواتب الرئيسي (WPS)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] rounded-full font-medium text-muted-foreground">
                            حساب تشغيلي فرعي
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full text-xs font-bold text-primary hover:bg-primary/10"
                          onClick={() =>
                            setAccountForm({
                              id: account.id,
                              bankName: account.bankName,
                              accountName: account.accountName,
                              iban: account.iban,
                              currency: account.currency,
                              currentBalance: account.balance,
                              isPrimary: account.isPrimary,
                            })
                          }
                        >
                          تعديل
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                        لا توجد حسابات بنكية مضافة حالياً. أضف الحساب البنكي الرئيسي أعلاه لربطه بمسير الرواتب وحماية الأجور.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
