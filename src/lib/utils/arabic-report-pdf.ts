export interface ReportSection {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  totals?: (string | number)[];
  note?: string;
}

export interface ArabicReportOptions {
  title: string;
  subtitle?: string;
  cards?: { label: string; value: string }[];
  sections: ReportSection[];
  footer?: string;
}

/**
 * Opens a print-ready RTL Arabic report in a new window (Save as PDF from the
 * browser print dialog). HTML printing is used because Arabic letter shaping
 * is handled natively by the browser, unlike canvas-based PDF writers.
 */
export function openArabicReportPdf(options: ArabicReportOptions) {
  const win = window.open("", "_blank", "width=1100,height=850");
  if (!win) throw new Error("المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");

  const cardsHtml = (options.cards ?? [])
    .map((c) => `<div class="card"><span>${c.label}</span><b>${c.value}</b></div>`)
    .join("");

  const sectionsHtml = options.sections
    .map(
      (section) => `
      <h2>${section.title}</h2>
      <table>
        <thead><tr>${section.columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${
          section.rows.length
            ? section.rows
                .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
                .join("")
            : `<tr><td colspan="${section.columns.length}" class="empty">لا توجد بيانات</td></tr>`
        }</tbody>
        ${
          section.totals
            ? `<tfoot><tr>${section.totals.map((cell) => `<td>${cell}</td>`).join("")}</tr></tfoot>`
            : ""
        }
      </table>
      ${section.note ? `<p class="note">${section.note}</p>` : ""}`,
    )
    .join("");

  win.document.write(`<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${options.title} | Classera Pulse</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;margin:22px;color:#1c1b1f}
  .rep-header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #004BCE;padding-bottom:12px;margin-bottom:16px}
  .rep-brand{display:flex;align-items:center;gap:12px}
  .rep-logo{height:46px;max-width:180px;object-fit:contain}
  h1{font-size:20px;margin:0 0 4px;color:#004BCE}
  h2{font-size:14px;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #00B5FF;color:#004BCE}
  .sub{color:#64748b;font-size:12px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
  .card{border:1px solid #e2e8f0;border-radius:12px;padding:9px 11px;background:#f8fafc}
  .card span{font-size:10px;color:#64748b}
  .card b{display:block;font-size:14px;margin-top:3px;color:#004BCE}
  table{width:100%;border-collapse:collapse;font-size:11.5px}
  th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right}
  th{background:#f1f5f9;color:#0f172a;font-weight:700}
  tfoot td{background:#f8fafc;font-weight:700}
  .empty{text-align:center;color:#94a3b8}
  .note{font-size:10px;color:#64748b;margin:6px 0 0}
  .foot{margin-top:18px;font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between}
  @media print{body{margin:10mm} h2{page-break-after:avoid} tr{page-break-inside:avoid}}
</style></head><body>
<div class="rep-header">
  <div>
    <h1>${options.title}</h1>
    <div class="sub">${options.subtitle ?? ""} — صدر في ${new Date().toLocaleString("ar-SA")}</div>
  </div>
  <div class="rep-brand">
    <img src="${window.location.origin}/classera-pulse-logo.png" class="rep-logo" alt="Classera Pulse" onerror="this.style.display='none'" />
  </div>
</div>
${cardsHtml ? `<div class="cards">${cardsHtml}</div>` : ""}
${sectionsHtml}
<div class="foot">
  <span>${options.footer ?? "تقرير آلي معتمد مستخرج من منصة كلاسيرا بالس لإدارة رأس المال البشري (Classera Pulse HCM)."}</span>
  <span>Classera Pulse HCM © ${new Date().getFullYear()}</span>
</div>
<script>window.onload=()=>{window.focus();window.print();}</script>
</body></html>`);
  win.document.close();
}

export const reportMoney = (value: number) =>
  `${Number(value ?? 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ر.س`;
