import React, { useCallback, useEffect, useState } from "react";
import { Building2, Landmark, RefreshCw, Save, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  getCompanyProfileServer,
  saveCompanyBankAccountServer,
  saveCompanyProfileServer,
} from "../../lib/business/company.functions";

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
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [company, setCompany] = useState({
    id: "",
    legalNameAr: "",
    legalNameEn: "",
    crNumber: "",
    taxNumber: "",
    currency: "SAR",
    headquartersAddress: "",
  });
  const [accountForm, setAccountForm] = useState({ ...emptyAccount });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result: any = await getCompanyProfileServer();
      setAccounts(result.accounts);
      setTotals(result.totals);
      if (result.company) {
        setCompany({
          id: result.company.id,
          legalNameAr: result.company.legal_name_ar ?? "",
          legalNameEn: result.company.legal_name_en ?? "",
          crNumber: result.company.cr_number ?? "",
          taxNumber: result.company.tax_number ?? "",
          currency: result.company.currency ?? "SAR",
          headquartersAddress: result.company.headquarters_address ?? "",
        });
      }
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة بيانات المنشأة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCompany = async () => {
    setBusy(true);
    try {
      await saveCompanyProfileServer({
        data: {
          id: company.id || undefined,
          legalNameAr: company.legalNameAr,
          legalNameEn: company.legalNameEn,
          crNumber: company.crNumber,
          taxNumber: company.taxNumber,
          currency: company.currency,
          headquartersAddress: company.headquartersAddress,
        },
      });
      toast.success("تم حفظ بيانات المنشأة");
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const saveAccount = async () => {
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
      toast.success("تم حفظ الحساب البنكي");
      setAccountForm({ ...emptyAccount });
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر حفظ الحساب");
    } finally {
      setBusy(false);
    }
  };

  const field = (
    label: string,
    value: string | number,
    onChange: (v: string) => void,
    type = "text",
  ) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <div>
            <h3 className="text-sm font-black text-foreground">بيانات المنشأة والحساب البنكي</h3>
            <p className="text-xs text-muted-foreground">
              تُقرأ مباشرة من قاعدة البيانات وتُحدَّث تلقائيًا مع كل تسوية رواتب.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "رصيد حسابات المنشأة", value: money(totals?.balance ?? 0), icon: Wallet },
          { label: "إجمالي الرواتب المصروفة", value: money(totals?.paidOut ?? 0), icon: Landmark },
          { label: "سلف قيد الصرف", value: money(totals?.loansPendingDisbursement ?? 0), icon: ShieldCheck },
          {
            label: "موظفون بآيبان مسجّل",
            value: `${totals?.employeesWithIban ?? 0} / ${totals?.employeesTotal ?? 0}`,
            icon: Building2,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <card.icon className="size-4 text-primary" /> {card.label}
            </div>
            <p className="mt-2 text-lg font-black text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          <h4 className="text-sm font-black text-foreground">هوية المنشأة</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("الاسم القانوني (عربي)", company.legalNameAr, (v) =>
              setCompany((c) => ({ ...c, legalNameAr: v })),
            )}
            {field("الاسم القانوني (إنجليزي)", company.legalNameEn, (v) =>
              setCompany((c) => ({ ...c, legalNameEn: v })),
            )}
            {field("السجل التجاري", company.crNumber, (v) =>
              setCompany((c) => ({ ...c, crNumber: v })),
            )}
            {field("الرقم الضريبي", company.taxNumber, (v) =>
              setCompany((c) => ({ ...c, taxNumber: v })),
            )}
            {field("العملة", company.currency, (v) => setCompany((c) => ({ ...c, currency: v })))}
            {field("العنوان", company.headquartersAddress, (v) =>
              setCompany((c) => ({ ...c, headquartersAddress: v })),
            )}
          </div>
          <Button size="sm" onClick={() => void saveCompany()} disabled={busy}>
            <Save className="size-4" /> حفظ بيانات المنشأة
          </Button>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          <h4 className="text-sm font-black text-foreground">
            {accountForm.id ? "تعديل حساب بنكي" : "إضافة حساب بنكي حقيقي"}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("اسم البنك", accountForm.bankName, (v) =>
              setAccountForm((a) => ({ ...a, bankName: v })),
            )}
            {field("اسم الحساب", accountForm.accountName, (v) =>
              setAccountForm((a) => ({ ...a, accountName: v })),
            )}
            {field("رقم الآيبان (IBAN)", accountForm.iban, (v) =>
              setAccountForm((a) => ({ ...a, iban: v.toUpperCase() })),
            )}
            {field("العملة", accountForm.currency, (v) =>
              setAccountForm((a) => ({ ...a, currency: v })),
            )}
            {field(
              "الرصيد الحالي",
              accountForm.currentBalance,
              (v) => setAccountForm((a) => ({ ...a, currentBalance: Number(v) })),
              "number",
            )}
            <label className="flex items-center gap-2 pt-6 text-xs font-bold text-muted-foreground">
              <input
                type="checkbox"
                checked={accountForm.isPrimary}
                onChange={(e) => setAccountForm((a) => ({ ...a, isPrimary: e.target.checked }))}
              />
              الحساب الرئيسي للرواتب
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void saveAccount()} disabled={busy}>
              <Save className="size-4" /> حفظ الحساب
            </Button>
            {accountForm.id && (
              <Button size="sm" variant="outline" onClick={() => setAccountForm({ ...emptyAccount })}>
                إلغاء التعديل
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/40 text-xs font-bold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">البنك</th>
              <th className="px-4 py-3">اسم الحساب</th>
              <th className="px-4 py-3">الآيبان</th>
              <th className="px-4 py-3">الرصيد</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-border/50">
                <td className="px-4 py-3 font-bold">{account.bankName}</td>
                <td className="px-4 py-3">{account.accountName}</td>
                <td className="px-4 py-3 font-mono text-xs">{account.iban}</td>
                <td className="px-4 py-3 font-black">{money(account.balance)}</td>
                <td className="px-4 py-3">
                  {account.isPrimary ? (
                    <Badge>حساب الرواتب الرئيسي</Badge>
                  ) : (
                    <Badge variant="outline">حساب فرعي</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="outline"
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
            {!accounts.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  لا توجد حسابات بنكية — أضف الحساب الحقيقي للمنشأة أعلاه.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
