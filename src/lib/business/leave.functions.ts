import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";

/**
 * Monthly leave accrual: entitlement / 12 added to every active employee's
 * balance for the given year, capped at the annual entitlement plus carryover.
 */
export const accrueLeaveBalancesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number; months?: number }) => {
    if (!Number.isInteger(input.year)) throw new Error("سنة غير صالحة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "hr_manager"]);

    const months = data.months ?? 1;
    const { data: balances, error } = await supabase
      .from("leave_balances")
      .select("id, annual_entitlement, accrued_days, used_days, reserved_days, carried_over_days")
      .eq("year", data.year);
    if (error) throw new Error(`تعذر قراءة الأرصدة: ${error.message}`);

    let updated = 0;
    for (const balance of balances ?? []) {
      const entitlement = Number(balance.annual_entitlement ?? 0);
      if (entitlement <= 0) continue;
      const carried = Number(balance.carried_over_days ?? 0);
      const accrued = Math.min(
        entitlement + carried,
        round2(Number(balance.accrued_days ?? 0) + (entitlement / 12) * months),
      );
      const available = round2(
        accrued - Number(balance.used_days ?? 0) - Number(balance.reserved_days ?? 0),
      );
      await supabase
        .from("leave_balances")
        .update({ accrued_days: accrued, balance: Math.max(0, available) })
        .eq("id", balance.id);
      updated += 1;
    }

    return { updated };
  });

/**
 * Moves reserved days to used (approval) or releases them (rejection/return).
 */
export const settleLeaveReservationServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { employeeId: string; leaveTypeId: string; days: number; outcome: "commit" | "release" }) => {
      if (!input.employeeId || !input.leaveTypeId) throw new Error("بيانات ناقصة");
      if (!(input.days > 0)) throw new Error("عدد الأيام غير صالح");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "line_manager",
    ]);

    const { data: balance, error } = await supabase
      .from("leave_balances")
      .select("id, accrued_days, used_days, reserved_days, carried_over_days")
      .eq("employee_id", data.employeeId)
      .eq("leave_type_id", data.leaveTypeId)
      .maybeSingle();
    if (error) throw new Error(`تعذر قراءة الرصيد: ${error.message}`);
    if (!balance) throw new Error("لا يوجد رصيد إجازات مسجّل لهذا الموظف");

    const reserved = Math.max(0, round2(Number(balance.reserved_days ?? 0) - data.days));
    const used =
      data.outcome === "commit"
        ? round2(Number(balance.used_days ?? 0) + data.days)
        : Number(balance.used_days ?? 0);
    const available = round2(
      Number(balance.accrued_days ?? 0) + Number(balance.carried_over_days ?? 0) - used - reserved,
    );

    const { error: updateError } = await supabase
      .from("leave_balances")
      .update({ reserved_days: reserved, used_days: used, balance: Math.max(0, available) })
      .eq("id", balance.id);
    if (updateError) throw new Error(`تعذر تحديث الرصيد: ${updateError.message}`);

    return { reservedDays: reserved, usedDays: used, availableDays: Math.max(0, available) };
  });
