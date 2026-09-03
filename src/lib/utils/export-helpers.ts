// ============================================================================
// Data Export Utilities (CSV, Excel-compatible, WPS SIF generator)
// ============================================================================

import { toast } from "sonner";

export function formatCsvCell(value: unknown) {
  let cell =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toLocaleString()
        : String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(cell.trimStart())) cell = `'${cell}`;
  cell = cell.replace(/"/g, '""');
  return cell.search(/("|,|\n)/g) >= 0 ? `"${cell}"` : cell;
}

export function exportToCSV<T extends object>(filename: string, rows: T[]) {
  if (!rows || !rows.length) {
    toast.error("لا توجد بيانات متاحة للتصدير");
    return;
  }

  const separator = ",";
  const keys = Object.keys(rows[0]);
  const csvContent =
    "\uFEFF" + // UTF-8 BOM for Arabic support in Excel
    keys.join(separator) +
    "\n" +
    rows
      .map((row) => {
        const record = row as unknown as Record<string, unknown>;
        return keys.map((key) => formatCsvCell(record[key])).join(separator);
      })
      .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function escapeSifField(value: string) {
  return `"${value.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

/**
 * Generates Saudi Wage Protection System (WPS) SIF file format
 */
interface WPSRecord {
  employeeId: string;
  employeeName: string;
  iban: string;
  basicSalary: number;
  housingAllowance: number;
  otherEarnings: number;
  deductions: number;
  netSalary: number;
}

interface WPSExportOptions {
  establishmentId: string;
  employerBankCode: string;
  fileCreationDate: string;
  fileCreationTime: string;
  salaryYearMonth: string;
  records: WPSRecord[];
}

export function generateWPSSIFFile(options: WPSExportOptions): void;
export function generateWPSSIFFile(
  employerCR: string,
  bankCode: string,
  payrollMonth: string,
  records: WPSRecord[],
): void;
export function generateWPSSIFFile(
  employerOrOptions: string | WPSExportOptions,
  bankCode?: string,
  payrollMonth?: string,
  legacyRecords?: WPSRecord[],
) {
  const options =
    typeof employerOrOptions === "string"
      ? {
          establishmentId: employerOrOptions,
          employerBankCode: bankCode ?? "",
          fileCreationDate: new Date().toISOString().split("T")[0],
          fileCreationTime: new Date()
            .toTimeString()
            .split(" ")[0]
            .replace(/:/g, "")
            .substring(0, 4),
          salaryYearMonth: payrollMonth ?? "",
          records: legacyRecords ?? [],
        }
      : employerOrOptions;
  const employerCR = options.establishmentId;
  const resolvedBankCode = options.employerBankCode;
  const resolvedPayrollMonth = options.salaryYearMonth;
  const records = options.records;
  const totalEmployees = records.length;
  const totalNet = records.reduce((sum, r) => sum + r.netSalary, 0);

  // Header Record: SCR,EmployerCR,BankCode,FileCreationDate,FileCreationTime,TotalSalary,TotalRecords,PayrollMonth
  const creationDate = options.fileCreationDate.replace(/-/g, "");
  const creationTime = options.fileCreationTime.replace(/:/g, "").substring(0, 4);

  let sif = `SCR,${employerCR},${resolvedBankCode},${creationDate},${creationTime},${totalNet.toFixed(2)},${totalEmployees},${resolvedPayrollMonth}\n`;

  // Employee Records: EDR,EmployeeId,IBAN,EmployeeName,Basic,Housing,Other,Deductions,Net
  records.forEach((r) => {
    sif += `EDR,${escapeSifField(r.employeeId)},${escapeSifField(r.iban)},${escapeSifField(r.employeeName)},${r.basicSalary.toFixed(2)},${r.housingAllowance.toFixed(2)},${r.otherEarnings.toFixed(2)},${r.deductions.toFixed(2)},${r.netSalary.toFixed(2)}\n`;
  });

  const blob = new Blob([sif], { type: "text/plain;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `WPS_${employerCR}_${resolvedPayrollMonth}.sif`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
