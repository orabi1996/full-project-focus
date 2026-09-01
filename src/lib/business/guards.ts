import type { SupabaseClient } from "@supabase/supabase-js";

export type PrivilegedRole =
  | "super_admin"
  | "org_admin"
  | "hr_manager"
  | "payroll_officer"
  | "finance_officer"
  | "attendance_officer"
  | "line_manager";

/**
 * Server-side role verification. Reads the caller's roles through the
 * authenticated (RLS-scoped) client, never through the admin client.
 */
export async function assertRole(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  allowed: PrivilegedRole[],
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error(`تعذر التحقق من الصلاحيات: ${error.message}`);
  const roles = (data ?? []).map((row: { role: string }) => row.role);
  const permitted = roles.some((role) => allowed.includes(role as PrivilegedRole));
  if (!permitted) throw new Error("غير مصرح لك بتنفيذ هذه العملية");
  return roles;
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function round2(value: number) {
  return Number(value.toFixed(2));
}
