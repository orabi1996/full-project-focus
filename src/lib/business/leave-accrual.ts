import type { SupabaseClient } from "@supabase/supabase-js";

/** Never fall back to direct balance writes after an RPC failure. */
export async function executeLeaveAccrual(
  supabase: Pick<SupabaseClient, "rpc">,
  input: { year: number; months?: number },
): Promise<{ updated: number }> {
  if (!Number.isInteger(input.year)) throw new Error("سنة غير صالحة");
  if (input.months !== undefined && input.months !== 1) {
    throw new Error("يجب تنفيذ الاستحقاق لفترة واحدة عبر إجراء قاعدة البيانات");
  }
  const { data, error } = await supabase.rpc("run_leave_accrual", { p_year: input.year });
  if (error) throw new Error(`تعذر تنفيذ الاستحقاق: ${error.message}`);
  if (data?.success !== true || !Number.isInteger(data.total_processed) || data.total_processed < 0) {
    throw new Error("تعذر تأكيد نتيجة الاستحقاق من قاعدة البيانات");
  }
  return { updated: data.total_processed };
}
