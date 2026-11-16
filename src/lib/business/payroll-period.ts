import { daysInMonth, round2 } from "./guards";
import type { PayrollCalculationBasis } from "../../types";

export interface PayrollPeriodInput {
  year: number;
  month: number;
  periodCalculationMode?: "full_month" | "custom_end_date" | "custom_days";
  periodEndDate?: string | null;
  customDaysCount?: number | null;
}

export function payrollPeriod(input: PayrollPeriodInput) {
  if (!input || !Number.isInteger(input.year) || input.year < 2000 || input.year > 2100 ||
      !Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error("سنة أو شهر المسير غير صالح");
  }
  const days = daysInMonth(input.year, input.month);
  const prefix = `${input.year}-${String(input.month).padStart(2, "0")}`;
  const start = `${prefix}-01`;
  const monthEnd = `${prefix}-${days}`;
  const mode = input.periodCalculationMode ?? "full_month";
  let end = monthEnd;
  if (mode === "custom_end_date") {
    const date = input.periodEndDate;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date > monthEnd ||
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      throw new Error("تاريخ نهاية المسير يجب أن يكون تاريخًا صحيحًا داخل الشهر المختار");
    }
    end = date;
  } else if (mode === "custom_days") {
    const count = input.customDaysCount;
    if (!Number.isInteger(count) || count! < 1 || count! > days) {
      throw new Error("عدد أيام المسير يجب أن يكون عددًا صحيحًا داخل الشهر المختار");
    }
    end = `${prefix}-${String(count).padStart(2, "0")}`;
  } else if (mode !== "full_month") {
    throw new Error("طريقة احتساب فترة المسير غير صالحة");
  }
  return { start, end, monthEnd, days };
}

export interface SalaryVersion {
  effective_from: string;
  basic_salary: number | string;
  housing_allowance?: number | string | null;
  transport_allowance?: number | string | null;
  other_allowances?: number | string | { amount?: number | string }[] | null;
}

export function salaryAmounts(profile: Omit<SalaryVersion, "effective_from">) {
  const other = Array.isArray(profile.other_allowances)
    ? profile.other_allowances.reduce((sum, item) => {
        const amount = Number(item.amount ?? 0);
        if (!Number.isFinite(amount) || amount < 0) throw new Error("بدل غير صالح في ملف الراتب");
        return sum + amount;
      }, 0)
    : profile.other_allowances ?? 0;
  const values = [profile.basic_salary, profile.housing_allowance ?? 0,
    profile.transport_allowance ?? 0, other].map(Number);
  if (values.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error("مكونات راتب الموظف غير صالحة");
  }
  return values;
}

/** Month-end accrual normalizes a full fixed-30 month to 30 units, including February. */
export function payrollDayWeight(day: number, days: number, basis: PayrollCalculationBasis) {
  if (basis === "calendar_days") return 1 / days;
  if (basis !== "fixed_30_days") {
    throw new Error("احتساب أيام العمل يتطلب جدول دوام معتمد؛ اختر سياسة مدعومة للمجموعة");
  }
  const accrued = (value: number) => value >= days ? 30 : Math.min(value, 30);
  return (accrued(day) - accrued(day - 1)) / 30;
}

export function employeePeriodSalary(
  period: ReturnType<typeof payrollPeriod>,
  employee: { hire_date: string; exit_date?: string | null; basic_salary: number | string },
  versions: SalaryVersion[],
  basis: PayrollCalculationBasis,
) {
  const start = employee.hire_date > period.start ? employee.hire_date : period.start;
  const end = employee.exit_date && employee.exit_date < period.end ? employee.exit_date : period.end;
  if (start > end) return null;
  const sorted = [...versions].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  if (sorted.some((version, i) => i > 0 && version.effective_from === sorted[i - 1].effective_from)) {
    throw new Error("يوجد أكثر من راتب للموظف بنفس تاريخ السريان");
  }
  const earned = [0, 0, 0, 0];
  const daily = new Map<string, number[]>();
  let weight = 0;
  for (let day = Number(start.slice(8)); day <= Number(end.slice(8)); day++) {
    const date = `${period.start.slice(0, 8)}${String(day).padStart(2, "0")}`;
    const profile = sorted.filter(version => version.effective_from <= date).at(-1);
    if (!profile && sorted.length) throw new Error("توجد فجوة في تاريخ سريان راتب الموظف");
    const amounts = salaryAmounts(profile ?? { basic_salary: employee.basic_salary });
    const dayWeight = payrollDayWeight(day, period.days, basis);
    amounts.forEach((amount, index) => { earned[index] += amount * dayWeight; });
    weight += dayWeight;
    daily.set(date, amounts);
  }
  const nominal = daily.get(end)!;
  return { earned: earned.map(round2), nominal, daily, weight, eligibleDays: daily.size };
}
