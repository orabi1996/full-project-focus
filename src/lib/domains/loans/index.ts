import {
  useLoans,
  useLoanPolicies,
  useLoanInstallments,
  useLoanMutations,
  type LoanDetail,
  type LoanPolicy,
  type LoanInstallment,
  type LoanFilters,
} from "../../data/loans-repository";

export {
  useLoans,
  useLoanPolicies,
  useLoanInstallments,
  useLoanMutations,
  type LoanDetail,
  type LoanPolicy,
  type LoanInstallment,
  type LoanFilters,
};

export const LOAN_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-muted text-muted-foreground" },
  submitted: { label: "مقدم", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  pending_approval: { label: "قيد الاعتماد", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  approved: { label: "معتمد (بانتظار الصرف)", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  rejected: { label: "مرفوض", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  disbursement_pending: { label: "قيد الصرف المالي", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  active: { label: "سارية (قيد الاسترداد)", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  closed: { label: "مسددة بالكامل", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" },
  cancelled: { label: "ملغاة", color: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300" },
};

export const LOAN_TYPE_LABELS: Record<string, string> = {
  personal_advance: "سلفة شخصية على الراتب",
  housing_advance: "سلفة بدل سكن سنوي",
  emergency_loan: "سلفة طوارئ عاجلة",
  general: "سلفة عامة",
};
