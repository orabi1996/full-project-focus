import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole } from "./guards";
import { payrollCountry, validateCountryPayrollPolicy, type CountryPayrollPolicy } from "./payroll-country";

export const saveCountryPayrollPolicyServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; country: string; activate: boolean; policy: CountryPayrollPolicy }) => {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.companyId) || typeof input.activate !== "boolean") throw new Error("بيانات سياسة الرواتب غير صالحة");
    validateCountryPayrollPolicy(input.policy, payrollCountry(input.country));
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase as any, context.userId, ["super_admin", "org_admin", "hr_manager", "payroll_officer", "finance_officer"]);
    const { data: id, error } = await (context.supabase as any).rpc("save_country_payroll_policy", {
      p_company: data.companyId, p_country: payrollCountry(data.country), p_policy: data.policy, p_activate: data.activate,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });
