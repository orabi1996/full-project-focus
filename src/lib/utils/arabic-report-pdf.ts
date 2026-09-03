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
<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${options.title}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;margin:22px;color:#1c1b1f}
  h1{font-size:20px;margin:0 0 4px}
  h2{font-size:14px;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #d9c9a3}
  .sub{color:#666;font-size:12px;margin-bottom:14px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}
  .card{border:1px solid #e3ddd2;border-radius:12px;padding:9px 11px;background:#fbf8f2}
  .card span{font-size:10px;color:#6b6b6b}
  .card b{display:block;font-size:14px;margin-top:3px}
  table{width:100%;border-collapse:collapse;font-size:11.5px}
  th,td{border:1px solid #e3ddd2;padding:6px 8px;text-align:right}
  th{background:#f6f2ea;font-weight:700}
  tfoot td{background:#faf7f1;font-weight:700}
  .empty{text-align:center;color:#999}
  .note{font-size:10px;color:#777;margin:6px 0 0}
  .foot{margin-top:18px;font-size:10px;color:#888;border-top:1px solid #eee;padding-top:8px}
  @media print{body{margin:10mm} h2{page-break-after:avoid} tr{page-break-inside:avoid}}
</style></head><body>
<h1>${options.title}</h1>
<div class="sub">${options.subtitle ?? ""} — صدر في ${new Date().toLocaleString("ar-EG")}</div>
${cardsHtml ? `<div class="cards">${cardsHtml}</div>` : ""}
${sectionsHtml}
<div class="foot">${options.footer ?? "تقرير آلي مستخرج من قاعدة بيانات النظام — الأرقام مطابقة للسجلات الفعلية."}</div>
<script>window.onload=()=>{window.focus();window.print();}<\/script>
</body></html>`);
  win.document.close();
}

export const reportMoney = (value: number) =>
  `${Number(value ?? 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ر.س`;
