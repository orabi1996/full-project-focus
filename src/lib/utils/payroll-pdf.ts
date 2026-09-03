export interface PayrollPdfRow {
  employeeNo: string;
  employeeName: string;
  departmentName: string;
  workingDays: number;
  gross: number;
  net: number;
  loanPaid: number;
  gap: number;
}

export interface PayrollPdfMeta {
  period: string;
  status: string;
  employees: number;
  net: number;
  loansPaid: number;
  paidOut: number;
  pendingOut: number;
  companyBalance: number;
  companyName?: string;
}

const money = (value: number) =>
  `${Number(value ?? 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ر.س`;

/**
 * Opens a print-ready RTL Arabic payroll report (Save as PDF from the print dialog).
 * HTML printing is used because Arabic shaping is fully supported by the browser.
 */
export function openMonthlyPayrollPdf(meta: PayrollPdfMeta, rows: PayrollPdfRow[]) {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) throw new Error("المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");

  const cards = [
    ["عدد الموظفين", String(meta.employees)],
    ["إجمالي الصافي", money(meta.net)],
    ["السلف المسددة", money(meta.loansPaid)],
    ["المصروف فعليًا", money(meta.paidOut)],
    ["المتبقي غير المصروف", money(meta.pendingOut)],
    ["رصيد حساب المنشأة", money(meta.companyBalance)],
  ];

  win.document.write(`<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>تقرير الرواتب — ${meta.period}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;margin:24px;color:#1c1b1f}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#666;font-size:12px;margin-bottom:16px}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
  .card{border:1px solid #e0dede;border-radius:12px;padding:10px 12px}
  .card b{display:block;font-size:15px;margin-top:4px}
  .card span{font-size:11px;color:#666}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #e0dede;padding:7px 8px;text-align:right}
  th{background:#f6f2ea;font-weight:700}
  tfoot td{background:#faf7f1;font-weight:700}
  .foot{margin-top:14px;font-size:10px;color:#888}
  @media print{body{margin:10mm}}
</style></head><body>
<h1>${meta.companyName ?? "تقرير الرواتب الشهري"}</h1>
<div class="sub">الفترة: ${meta.period} — حالة المسيّر: ${meta.status} — تاريخ الإصدار: ${new Date().toLocaleString("ar-EG")}</div>
<div class="cards">${cards
    .map((c) => `<div class="card"><span>${c[0]}</span><b>${c[1]}</b></div>`)
    .join("")}</div>
<table>
  <thead><tr>
    <th>#</th><th>الرقم الوظيفي</th><th>الموظف</th><th>الإدارة</th>
    <th>أيام العمل</th><th>الإجمالي</th><th>السلف المخصومة</th><th>الصافي</th>
  </tr></thead>
  <tbody>${rows
    .map(
      (r, i) => `<tr><td>${i + 1}</td><td>${r.employeeNo}</td><td>${r.employeeName}</td>
      <td>${r.departmentName}</td><td>${r.workingDays}</td><td>${money(r.gross)}</td>
      <td>${money(r.loanPaid)}</td><td>${money(r.net)}</td></tr>`,
    )
    .join("")}</tbody>
  <tfoot><tr>
    <td colspan="5">الإجمالي</td>
    <td>${money(rows.reduce((s, r) => s + r.gross, 0))}</td>
    <td>${money(rows.reduce((s, r) => s + r.loanPaid, 0))}</td>
    <td>${money(rows.reduce((s, r) => s + r.net, 0))}</td>
  </tr></tfoot>
</table>
<div class="foot">تم توليد هذا التقرير آليًا من تسوية الرواتب — الأرقام مطابقة لسجلات قاعدة البيانات.</div>
<script>window.onload=()=>{window.focus();window.print();}<\u002fscript>
</body></html>`);
  win.document.close();
}
