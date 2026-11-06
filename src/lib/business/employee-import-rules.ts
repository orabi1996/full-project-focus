/** Pure validation rules for Excel employee import (shared by browser preview and server). */

export type ImportRowInput = Record<string, unknown>;

export const IMPORT_COLUMNS = [
  { key: "employee_no", ar: "الرقم الوظيفي", required: true },
  { key: "full_name", ar: "الاسم الكامل", required: true },
  { key: "job_title", ar: "المسمى الوظيفي", required: true },
  { key: "department", ar: "القسم", required: false },
  { key: "email", ar: "البريد الإلكتروني", required: false },
  { key: "phone", ar: "الجوال", required: false },
  { key: "national_id_or_iqama", ar: "رقم الهوية أو الإقامة", required: false },
  { key: "nationality", ar: "الجنسية", required: false },
  { key: "gender", ar: "الجنس", required: false },
  { key: "birth_date", ar: "تاريخ الميلاد", required: false },
  { key: "hire_date", ar: "تاريخ التعيين", required: true },
  { key: "contract_type", ar: "نوع العقد", required: false },
  { key: "basic_salary", ar: "الراتب الأساسي", required: true },
  { key: "total_salary", ar: "إجمالي الراتب", required: false },
  { key: "iban", ar: "الآيبان", required: false },
  { key: "bank_name", ar: "البنك", required: false },
] as const;

const AR_TO_KEY = new Map<string, string>(IMPORT_COLUMNS.flatMap((c) => [[c.ar, c.key], [c.key, c.key]]));

/** Map a sheet row (Arabic or English headers) to canonical keys. */
export function normalizeRowKeys(row: Record<string, unknown>): ImportRowInput {
  const out: ImportRowInput = {};
  for (const [k, v] of Object.entries(row)) {
    const key = AR_TO_KEY.get(k.trim().replace(/\s*\*$/, ""));
    if (key) out[key] = v;
  }
  return out;
}

function toDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
}
function str(v: unknown) {
  return v === null || v === undefined ? "" : toDigits(String(v)).trim();
}
export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && v > 1000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = str(v).replace(/\//g, "-");
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
function num(v: unknown): number | null {
  const s = str(v).replace(/[,٬\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const GENDER: Record<string, string> = { ذكر: "male", انثى: "female", أنثى: "female", male: "male", female: "female" };
const CONTRACT: Record<string, string> = { "غير محدد": "indefinite", محدد: "fixed", indefinite: "indefinite", fixed: "fixed" };

export interface ValidRow {
  row: number;
  department: string;
  record: Record<string, unknown>;
}

export function validateImportRows(
  rows: ImportRowInput[],
  ctx: { existingNos?: Set<string>; existingIds?: Set<string> } = {},
) {
  const valid: ValidRow[] = [];
  const errors: { row: number; message: string }[] = [];
  const seenNos = new Set<string>();
  const seenIds = new Set<string>();

  rows.forEach((raw, idx) => {
    const row = idx + 2; // Excel row number (header is row 1)
    const problems: string[] = [];
    const employeeNo = str(raw.employee_no);
    const fullName = str(raw.full_name);
    const jobTitle = str(raw.job_title);
    const hireDate = parseDate(raw.hire_date);
    const basic = num(raw.basic_salary);
    const total = num(raw.total_salary);
    const nid = str(raw.national_id_or_iqama);
    const email = str(raw.email);
    const iban = str(raw.iban).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const birth = raw.birth_date ? parseDate(raw.birth_date) : null;

    if (!employeeNo) problems.push("الرقم الوظيفي مطلوب");
    if (!fullName) problems.push("الاسم مطلوب");
    if (!jobTitle) problems.push("المسمى الوظيفي مطلوب");
    if (!hireDate) problems.push("تاريخ التعيين غير صحيح");
    if (basic === null || basic < 0) problems.push("الراتب الأساسي غير صحيح");
    if (total !== null && basic !== null && total < basic) problems.push("إجمالي الراتب أقل من الأساسي");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("البريد غير صحيح");
    if (nid && !/^[12]\d{9}$/.test(nid)) problems.push("رقم الهوية/الإقامة يجب أن يكون 10 أرقام ويبدأ بـ1 أو 2");
    if (iban && !/^SA\d{22}$/.test(iban)) problems.push("الآيبان يجب أن يبدأ بـSA ويتكون من 24 خانة");
    if (raw.birth_date && !birth) problems.push("تاريخ الميلاد غير صحيح");
    if (employeeNo && (seenNos.has(employeeNo) || ctx.existingNos?.has(employeeNo))) problems.push("الرقم الوظيفي مكرر");
    if (nid && (seenIds.has(nid) || ctx.existingIds?.has(nid))) problems.push("رقم الهوية مكرر");

    if (problems.length) {
      errors.push({ row, message: problems.join("، ") });
      return;
    }
    seenNos.add(employeeNo);
    if (nid) seenIds.add(nid);
    valid.push({
      row,
      department: str(raw.department),
      record: {
        employee_no: employeeNo,
        full_name: fullName,
        job_title: jobTitle,
        email: email || null,
        phone: str(raw.phone) || null,
        national_id_or_iqama: nid || null,
        nationality: str(raw.nationality) || null,
        gender: GENDER[str(raw.gender).toLowerCase()] ?? null,
        birth_date: birth,
        hire_date: hireDate,
        contract_type: CONTRACT[str(raw.contract_type).toLowerCase()] ?? "indefinite",
        basic_salary: basic,
        total_salary: total ?? basic,
        iban: iban || null,
        bank_name: str(raw.bank_name) || null,
        status: "active",
      },
    });
  });
  return { valid, errors };
}
