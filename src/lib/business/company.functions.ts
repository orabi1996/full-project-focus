import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";

const FINANCE_ROLES = [
  "super_admin",
  "org_admin",
  "hr_manager",
  "payroll_officer",
  "finance_officer",
] as const;

const WRITE_ROLES = ["super_admin", "org_admin", "finance_officer"] as const;

/** ISO 13616 mod-97 check (Saudi IBANs are SA + 22 chars). */
export function isValidIban(raw: string) {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export function formatIban(raw: string) {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Company identity + real bank accounts + live payroll disbursement summary. */
export const getCompanyProfileServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...FINANCE_ROLES]);

    const [companyRes, accountsRes, paymentsRes, loansRes, employeesRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, legal_name_ar, legal_name_en, cr_number, tax_number, currency, timezone, headquarters_address")
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("company_bank_accounts")
        .select("id, bank_name, account_name, iban, currency, current_balance, is_primary, updated_at")
        .order("is_primary", { ascending: false }),
      supabase
        .from("payroll_payments")
        .select("net_amount, status, paid_at, batch_no, bank_account_id"),
      supabase.from("loans").select("status, outstanding_amount, principal_amount, approved_amount"),
      supabase.from("employees").select("id, iban").eq("status", "active"),
    ]);

    const payments = paymentsRes.data ?? [];
    const loans = loansRes.data ?? [];
    const employees = employeesRes.data ?? [];

    return {
      company: companyRes.data ?? null,
      accounts: (accountsRes.data ?? []).map((a: any) => ({
        id: a.id,
        bankName: a.bank_name,
        accountName: a.account_name,
        iban: a.iban,
        currency: a.currency,
        balance: Number(a.current_balance ?? 0),
        isPrimary: !!a.is_primary,
        updatedAt: a.updated_at,
      })),
      totals: {
        balance: round2(
          (accountsRes.data ?? []).reduce(
            (sum: number, a: any) => sum + Number(a.current_balance ?? 0),
            0,
          ),
        ),
        paidOut: round2(
          payments
            .filter((p: any) => p.status === "paid")
            .reduce((sum: number, p: any) => sum + Number(p.net_amount ?? 0), 0),
        ),
        pendingOut: round2(
          payments
            .filter((p: any) => p.status !== "paid")
            .reduce((sum: number, p: any) => sum + Number(p.net_amount ?? 0), 0),
        ),
        batches: new Set(payments.filter((p: any) => p.batch_no).map((p: any) => p.batch_no)).size,
        lastPaidAt:
          payments
            .filter((p: any) => p.paid_at)
            .map((p: any) => p.paid_at)
            .sort()
            .pop() ?? null,
        loansOutstanding: round2(
          loans
            .filter((l: any) => l.status === "active")
            .reduce((sum: number, l: any) => sum + Number(l.outstanding_amount ?? 0), 0),
        ),
        loansPendingDisbursement: round2(
          loans
            .filter((l: any) => l.status === "approved")
            .reduce(
              (sum: number, l: any) =>
                sum + Number(l.approved_amount ?? l.principal_amount ?? 0),
              0,
            ),
        ),
        employeesWithIban: employees.filter((e: any) => !!e.iban).length,
        employeesTotal: employees.length,
      },
    };
  });

/** Creates or updates a real company bank account (IBAN checksum validated). */
export const saveCompanyBankAccountServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      bankName: string;
      accountName: string;
      iban: string;
      currency?: string;
      currentBalance?: number;
      isPrimary?: boolean;
    }) => {
      if (!input.bankName?.trim()) throw new Error("اسم البنك مطلوب");
      if (!input.accountName?.trim()) throw new Error("اسم الحساب مطلوب");
      const iban = formatIban(input.iban ?? "");
      if (!isValidIban(iban)) throw new Error("رقم الآيبان غير صحيح — تحقق من الرقم كاملًا");
      return { ...input, iban };
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...WRITE_ROLES]);

    const payload: Record<string, unknown> = {
      bank_name: data.bankName.trim(),
      account_name: data.accountName.trim(),
      iban: data.iban,
      currency: data.currency?.trim() || "SAR",
      is_primary: data.isPrimary ?? false,
    };
    if (typeof data.currentBalance === "number" && !Number.isNaN(data.currentBalance)) {
      payload["current_balance"] = round2(data.currentBalance);
    }

    if (data.isPrimary) {
      await supabase
        .from("company_bank_accounts")
        .update({ is_primary: false })
        .neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }

    if (data.id) {
      const { error } = await supabase
        .from("company_bank_accounts")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(`تعذر تحديث الحساب: ${error.message}`);
      return { id: data.id, updated: true };
    }

    const { data: inserted, error } = await supabase
      .from("company_bank_accounts")
      .insert({ ...payload, current_balance: round2(data.currentBalance ?? 0) })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`تعذر إضافة الحساب: ${error.message}`);
    return { id: inserted?.id, updated: false };
  });

/** Saves the employer identity record shown on payroll and bank files. */
export const saveCompanyProfileServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      legalNameAr: string;
      legalNameEn?: string;
      crNumber?: string;
      taxNumber?: string;
      currency?: string;
      headquartersAddress?: string;
    }) => {
      if (!input.legalNameAr?.trim()) throw new Error("اسم المنشأة مطلوب");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...WRITE_ROLES]);

    const payload = {
      legal_name_ar: data.legalNameAr.trim(),
      legal_name_en: data.legalNameEn?.trim() || data.legalNameAr.trim(),
      cr_number: data.crNumber?.trim() || null,
      tax_number: data.taxNumber?.trim() || null,
      currency: data.currency?.trim() || "SAR",
      headquarters_address: data.headquartersAddress?.trim() || null,
      timezone: "Asia/Riyadh",
    };

    if (data.id) {
      const { error } = await supabase.from("companies").update(payload).eq("id", data.id);
      if (error) throw new Error(`تعذر حفظ بيانات المنشأة: ${error.message}`);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("companies")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`تعذر حفظ بيانات المنشأة: ${error.message}`);
    return { id: inserted?.id };
  });
