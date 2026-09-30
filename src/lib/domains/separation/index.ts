import {
  useEmployeeSeparations,
  useClearanceItems,
  useSeparationMutations,
  type EmployeeSeparation,
  type ClearanceItem,
} from "../../data/separation-repository";

export {
  useEmployeeSeparations,
  useClearanceItems,
  useSeparationMutations,
  type EmployeeSeparation,
  type ClearanceItem,
};

export const SEPARATION_TYPE_LABELS: Record<string, string> = {
  resignation: "استقالة اختيارية (مادة 85)",
  contract_expiration: "انتهاء مدة العقد (مادة 84)",
  termination: "إنهاء خدمات من طرف المنشأة",
  termination_with_cause: "فسخ العقد لسبب مشروع (مادة 80)",
  retirement: "تقاعد نظامي",
  other: "أسباب أخرى",
};

export const CLEARANCE_CATEGORY_LABELS: Record<string, string> = {
  hr: "الموارد البشرية والوثائق",
  manager_handover: "تسليم مهام الإدارة",
  assets_return: "تسليم العهد والأجهزة",
  documents: "الملفات والمستندات",
  finance: "الإدارة المالية والعهد النقدية",
  loans: "تسوية السلف القائمة",
  it_access: "أمن المعلومات والصلاحيات",
};

export const CLEARANCE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "معلق", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  in_progress: { label: "قيد الإجراء", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  completed: { label: "مكتمل الإخلاء", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  blocked: { label: "متوقف (مانع)", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
};
