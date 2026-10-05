import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth, type AuthRole } from "../../auth/AuthContext";
import {
  REPORT_CATALOG,
  METRIC_CATALOG,
  REPORT_SEMANTIC_DOMAINS,
  useExecutiveKpis,
  useReportData,
  useSavedReportFilters,
  useReportFavorites,
  useRecentReports,
  useMetricCatalog,
  useReportMutations,
  type ReportCatalogItem,
  type MetricCatalogItem,
  type ReportCategory,
  type ReportFilterState,
  type ReportPaginationState,
  type ReportSortState,
  type SavedReportFilter,
  type ExecutiveKpis,
  type ReportDataResponse,
  type SemanticField,
  type SemanticDomain,
} from "../../data/reports-repository";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
import { queryKeys } from "../../query/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { exportToCSV } from "../../utils/export-helpers";
import { openArabicReportPdf, type ReportSection } from "../../utils/arabic-report-pdf";

export {
  REPORT_CATALOG,
  METRIC_CATALOG,
  REPORT_SEMANTIC_DOMAINS,
  useExecutiveKpis,
  useReportData,
  useSavedReportFilters,
  useReportFavorites,
  useRecentReports,
  useMetricCatalog,
  useReportMutations,
};

export type {
  ReportCatalogItem,
  MetricCatalogItem,
  ReportCategory,
  ReportFilterState,
  ReportPaginationState,
  ReportSortState,
  SavedReportFilter,
  ExecutiveKpis,
  ReportDataResponse,
  SemanticField,
  SemanticDomain,
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

export function canUserAccessField(role: AuthRole, isSensitive: boolean): boolean {
  if (!isSensitive) return true;
  return ["super_admin", "hr_manager", "payroll_officer", "finance_officer"].includes(role);
}

// ============================================================================
// DATE PRESET RESOLVER (Authoritative Company Timezone / ISO Dates)
// ============================================================================

function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDatePreset(
  preset:
    | "today"
    | "yesterday"
    | "last_7_days"
    | "last_30_days"
    | "current_month"
    | "prev_month"
    | "quarter"
    | "prev_quarter"
    | "year"
    | "prev_year"
    | "custom",
): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = formatDateYMD(now);

  switch (preset) {
    case "today":
      return { startDate: todayStr, endDate: todayStr };

    case "yesterday": {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yStr = formatDateYMD(y);
      return { startDate: yStr, endDate: yStr };
    }

    case "last_7_days": {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: formatDateYMD(past7), endDate: todayStr };
    }

    case "last_30_days": {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: formatDateYMD(past30), endDate: todayStr };
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

    case "prev_quarter": {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const firstDay = new Date(year, prevQuarter * 3, 1);
      const lastDay = new Date(year, (prevQuarter + 1) * 3, 0);
      return {
        startDate: formatDateYMD(firstDay),
        endDate: formatDateYMD(lastDay),
      };
    }

    case "year": {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatDateYMD(firstDayYear), endDate: todayStr };
    }

    case "prev_year": {
      const prevY = now.getFullYear() - 1;
      return {
        startDate: `${prevY}-01-01`,
        endDate: `${prevY}-12-31`,
      };
    }

    case "custom":
    default: {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: formatDateYMD(past30), endDate: todayStr };
    }
  }
}

// ============================================================================
// EXPORT HELPERS (CSV, EXCEL WITH METADATA, & ARABIC RTL PDF)
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
      if (key === "id") continue;
      const label = columnLabels[key] || key;
      mapped[label] = val;
    }
    return mapped;
  });

  const timestamp = new Date().toISOString().split("T")[0];
  exportToCSV(`${reportTitle}_${timestamp}`, transformedRows);
  toast.success("تم تصدير ملف التقرير (CSV) بنجاح");
}

export function exportReportDataToExcel(
  reportTitle: string,
  rows: Record<string, unknown>[],
  columnLabels?: Record<string, string>,
  metadata?: {
    companyName?: string;
    userName?: string;
    period?: string;
    filtersSummary?: string;
  },
) {
  if (!rows || rows.length === 0) {
    toast.error("لا توجد بيانات متاحة للتصدير إلى Excel");
    return;
  }

  const generatedAt = new Date().toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  const company = metadata?.companyName || "منظومة مدار إكس (MadarX Enterprise)";
  const user = metadata?.userName || "مسؤول النظام";
  const period = metadata?.period || "الفترة الحالية";
  const filters = metadata?.filtersSummary || "كافة السجلات";

  // Build columns
  const firstRow = rows[0] || {};
  const keys = Object.keys(firstRow).filter((k) => k !== "id");
  const headers = keys.map((k) => (columnLabels && columnLabels[k] ? columnLabels[k] : k));

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${reportTitle.slice(0, 30)}</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/><x:ProtectContents>False</x:ProtectContents></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    <style>
      body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
      table { border-collapse: collapse; width: 100%; }
      th { background-color: #0066FF; color: #FFFFFF; font-weight: bold; border: 1px solid #D1D5DB; padding: 10px; text-align: right; }
      td { border: 1px solid #E5E7EB; padding: 8px; text-align: right; }
      tr:nth-child(even) { background-color: #F9FAFB; }
      .meta-box { background-color: #F0F7FF; border: 1px solid #BFDBFE; margin-bottom: 20px; padding: 12px; }
      .meta-title { font-size: 18px; font-weight: bold; color: #1E3A8A; margin-bottom: 8px; }
      .meta-item { font-size: 12px; color: #475569; margin: 4px 0; }
    </style>
  </head>
  <body>
    <div class="meta-box">
      <div class="meta-title">${reportTitle}</div>
      <div class="meta-item"><b>المنشأة:</b> ${company}</div>
      <div class="meta-item"><b>تم التوليد بواسطة:</b> ${user} &nbsp;|&nbsp; <b>تاريخ ووقت التوليد:</b> ${generatedAt}</div>
      <div class="meta-item"><b>الفترة المحددة:</b> ${period} &nbsp;|&nbsp; <b>الفلاتر المطبقة:</b> ${filters}</div>
      <div class="meta-item"><b>إجمالي السجلات:</b> ${rows.length}</div>
    </div>
    <table>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  for (const row of rows) {
    html += "<tr>";
    for (const key of keys) {
      const val = row[key];
      const displayVal = val === null || val === undefined ? "—" : typeof val === "boolean" ? (val ? "نعم" : "لا") : String(val);
      html += `<td>${displayVal}</td>`;
    }
    html += "</tr>";
  }

  html += `
      </tbody>
    </table>
  </body>
</html>`;

  const blob = new Blob(["\uFEFF", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `${reportTitle}_${timestamp}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success("تم تصدير ملف التقرير بتنسيق Excel بنجاح");
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
    note: `تم استخراج هذا التقرير آلياً من منصة مدار إكس (MadarX Enterprise Workforce Platform) بتاريخ ${new Date().toLocaleDateString("ar-SA")}`,
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

  const toggleFavoriteReport = useCallback(
    async (reportCode: string) => {
      const res = await mutations.toggleFavorite.mutateAsync(reportCode);
      if (res && res.is_favorite) {
        toast.success("تمت إضافة التقرير إلى المفضلة");
      } else {
        toast.info("تمت إزالة التقرير من المفضلة");
      }
    },
    [mutations.toggleFavorite],
  );

  const logRecent = useCallback(
    (reportCode: string) => {
      mutations.logRecentAccess.mutate(reportCode);
    },
    [mutations.logRecentAccess],
  );

  return {
    canAccessReport: (reportCode: string) => canUserAccessReport(role, reportCode),
    canAccessField: (isSensitive: boolean) => canUserAccessField(role, isSensitive),
    saveFilterPreset,
    deleteFilterPreset,
    toggleFavoriteReport,
    logRecent,
  };
}
