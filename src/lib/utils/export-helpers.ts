// ============================================================================
// Data Export Utilities (CSV, Excel-compatible, WPS SIF generator)
// ============================================================================

export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) {
    alert('لا توجد بيانات متاحة للتصدير');
    return;
  }

  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    '\uFEFF' + // UTF-8 BOM for Arabic support in Excel
    keys.join(separator) +
    '\n' +
    rows
      .map(row => {
        return keys
          .map(k => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates Saudi Wage Protection System (WPS) SIF file format
 */
export function generateWPSSIFFile(
  employerCR: string,
  bankCode: string,
  payrollMonth: string,
  records: {
    employeeId: string;
    employeeName: string;
    iban: string;
    basicSalary: number;
    housingAllowance: number;
    otherEarnings: number;
    deductions: number;
    netSalary: number;
  }[]
) {
  const totalEmployees = records.length;
  const totalNet = records.reduce((sum, r) => sum + r.netSalary, 0);

  // Header Record: SCR,EmployerCR,BankCode,FileCreationDate,FileCreationTime,TotalSalary,TotalRecords,PayrollMonth
  const now = new Date();
  const creationDate = now.toISOString().split('T')[0].replace(/-/g, '');
  const creationTime = now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4);

  let sif = `SCR,${employerCR},${bankCode},${creationDate},${creationTime},${totalNet.toFixed(2)},${totalEmployees},${payrollMonth}\n`;

  // Employee Records: EDR,EmployeeId,IBAN,EmployeeName,Basic,Housing,Other,Deductions,Net
  records.forEach(r => {
    sif += `EDR,${r.employeeId},${r.iban},"${r.employeeName}",${r.basicSalary.toFixed(2)},${r.housingAllowance.toFixed(2)},${r.otherEarnings.toFixed(2)},${r.deductions.toFixed(2)},${r.netSalary.toFixed(2)}\n`;
  });

  const blob = new Blob([sif], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `WPS_${employerCR}_${payrollMonth}.sif`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
