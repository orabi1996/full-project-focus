import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth, type AuthRole } from "../../auth/AuthContext";
import {
  REPORT_CATALOG,
  useExecutiveKpis,
  useReportData,
  useSavedReportFilters,
  useReportMutations,
  type ReportCatalogItem,
  type ReportCategory,
  type ReportFilterState,
  type SavedReportFilter,
} from "../../data/reports-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { exportToCSV, formatCsvCell } from "../../utils/export-helpers";
import { openArabicReportPdf, type ReportSection } from "../../utils/arabic-report-pdf";

export {
  REPORT_CATALOG,
  useExecutiveKpis,
  useReportData,
  useSavedReportFilters,
  useReportMutations,
};

export type {
  ReportCatalogItem,
  ReportCategory,
  ReportFilterState,
  SavedReportFilter,
};

// ============================================================================
// RBAC & PERMISSION CHECK
// ============================================================================

export function canUserAccessReport(role: AuthRole, reportCode: string): boolean {
  if (role === "super_admin") return true;

  const catalogItem = REPORT_CATALOG.find((r) => r.code === reportCode);
  if (!catalogItem) return false;

  // Sensitive reports require strict payroll/hr permissions
  if (catalogItem.isSensitive) {
    return ["super_admin", "hr_manager", "payroll_officer", "finance_officer"].includes(role);
  }

  return catalogItem.requiredRoles.includes(role);
}

// ============================================================================
// DATE PRESET RESOLVER (Strict Company Timezone / Standard ISO Dates)
// ============================================================================

function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDatePreset(
  preset: "today" | "last_7_days" | "current_month" | "prev_month" | "quarter" | "year" | "custom",
): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = formatDateYMD(now);

  switch (preset) {
    case "today":
      return { startDate: todayStr, endDate: todayStr };

    case "last_7_days": {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: formatDateYMD(past7), endDate: todayStr };
    }

    case "current_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatDateYMD(firstDay), endDate: todayStr };
    }

    case "prev_month": {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: formatDateYMD(firstDayPrev),
        endDate: formatDateYMD(lastDayPrev),
      };
    }

    case "quarter": {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstDayQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      return { startDate: formatDateYMD(firstDayQuarter), endDate: todayStr };
    }

    case "year": {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatDateYMD(firstDayYear), endDate: todayStr };
    }

    case "custom":
    default: {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: formatDateYMD(past30), endDate: todayStr };
    }
  }
}

// ============================================================================
// EXPORT HELPERS (CSV & ARABIC RTL PDF)
// ============================================================================

export function exportReportDataToCsv(
  reportTitle: string,
  rows: Record<string, unknown>[],
  columnLabels?: Record<string, string>,
) {
  if (!rows || rows.length === 0) {
    toast.error("لا توجد بيانات متاحة للتصدير");
    return;
  }

  // Map keys to friendly Arabic column headers if provided
  const transformedRows = rows.map((row) => {
    if (!columnLabels) return row;
    const mapped: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      const label = columnLabels[key] || key;
      mapped[label] = val;
    }
    return mapped;
  });

  const timestamp = new Date().toISOString().split("T")[0];
  exportToCSV(`${reportTitle}_${timestamp}`, transformedRows);
  toast.success("تم تصدير ملف التقرير (CSV) بنجاح");
}

export function exportReportDataToArabicPdf(
  reportTitle: string,
  subtitle: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
  cards?: { label: string; value: string }[],
) {
  if (!rows || rows.length === 0) {
    toast.error("لا توجد بيانات متاحة لطباعة التقرير");
    return;
  }

  const tableRows = rows.map((r) =>
    columns.map((c) => {
      const val = r[c.key];
      return val !== null && val !== undefined ? String(val) : "—";
    }),
  );

  const section: ReportSection = {
    title: reportTitle,
    columns: columns.map((c) => c.label),
    rows: tableRows,
    note: `تم استخراج هذا التقرير آلياً من منصة Classera Pulse بتاريخ ${new Date().toLocaleDateString("ar-SA")}`,
  };

  openArabicReportPdf({
    title: reportTitle,
    subtitle,
    cards,
    sections: [section],
  });
}

// ============================================================================
// DOMAIN HOOK FOR MANAGING REPORT ACTIONS & PRESETS
// ============================================================================

export function useReportingEngine() {
  const { session, isDemo, role } = useAuth();
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
  const queryClient = useQueryClient();
  const mutations = useReportMutations();

  const saveFilterPreset = useCallback(
    async (
      reportCode: string,
      nameAr: string,
      filters: ReportFilterState,
      selectedColumns?: string[],
      sortBy?: string,
      sortOrder?: "asc" | "desc",
      isShared = false,
    ) => {
      if (!nameAr.trim()) {
        toast.error("يرجى إدخال اسم للفلتر المحفوظ");
        return false;
      }

      const result = await executeReliableMutation({
        mode,
        mutationKey: `save-report-filter-${reportCode}-${Date.now()}`,
        operation: async () => {
          const res = await mutations.saveFilter.mutateAsync({
            reportCode,
            nameAr,
            filters,
            selectedColumns,
            sortBy,
            sortOrder,
            isShared,
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.reports.savedFilters(reportCode),
          });
          return res;
        },
        demoOperation: () => {
          return { ok: true, filterId: `flt-demo-${Date.now()}` };
        },
        refresh: async () => {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.reports.savedFilters(reportCode),
          });
        },
      });

      if (result.ok) {
        toast.success("تم حفظ إعدادات الفلتر بنجاح");
        return true;
      } else {
        toast.error("فشل حفظ إعدادات الفلتر");
        return false;
      }
    },
    [mode, mutations.saveFilter, queryClient],
  );

  const deleteFilterPreset = useCallback(
    async (filterId: string, reportCode?: string) => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `delete-report-filter-${filterId}`,
        operation: async () => {
          const res = await mutations.deleteFilter.mutateAsync(filterId);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.reports.savedFilters(reportCode),
          });
          return res;
        },
        demoOperation: () => {
          return { ok: true };
        },
        refresh: async () => {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.reports.savedFilters(reportCode),
          });
        },
      });

      if (result.ok) {
        toast.success("تم حذف الفلتر المحفوظ");
        return true;
      } else {
        toast.error("فشل حذف الفلتر");
        return false;
      }
    },
    [mode, mutations.deleteFilter, queryClient],
  );

  return {
    canAccessReport: (reportCode: string) => canUserAccessReport(role, reportCode),
    saveFilterPreset,
    deleteFilterPreset,
  };
}
