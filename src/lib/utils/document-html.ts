import type { StoredDocument } from "../../components/documents/DocumentVaultView";
import { escapeHtml } from "./escape-html";

export function generateDocumentHtml(
  storedDoc: StoredDocument,
  company: { legalNameAr?: string },
): string {
  const doc = Object.fromEntries(
    Object.entries(storedDoc).map(([key, value]) => [
      key,
      typeof value === "string" ? escapeHtml(value) : value,
    ]),
  ) as unknown as StoredDocument;
  const currentDate = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const refNo = doc.docNumber || `DOC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title} - ${doc.employeeName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 36px;
      background: #f8fafc;
      color: #0f172a;
      direction: rtl;
    }
    .sheet {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px 48px;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 17px;
      font-weight: 900;
      margin: 0 0 4px 0;
      color: #0f172a;
    }
    .header p {
      font-size: 11px;
      color: #475569;
      margin: 2px 0;
    }
    .meta {
      text-align: left;
      font-family: monospace;
      font-size: 11px;
    }
    .title-banner {
      background: #f1f5f9;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      padding: 10px;
      text-align: center;
      margin-bottom: 20px;
    }
    .title-banner h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .grid div {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 4px;
    }
    .grid div span.label {
      color: #64748b;
      font-weight: 600;
    }
    .grid div span.val {
      color: #0f172a;
      font-weight: 700;
    }
    .content-box {
      font-size: 12px;
      line-height: 1.8;
      color: #1e293b;
      margin-bottom: 28px;
      text-align: justify;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 2px solid #0f172a;
      padding-top: 20px;
      margin-top: 32px;
    }
    .stamp {
      border: 2px dashed #059669;
      color: #059669;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 900;
      display: inline-block;
      transform: rotate(-3deg);
      margin-top: 6px;
    }
    .qr-box {
      text-align: center;
      font-size: 9px;
      color: #64748b;
    }
    .qr-placeholder {
      width: 56px;
      height: 56px;
      border: 2px solid #0f172a;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 4px auto;
      font-weight: 900;
      font-size: 9px;
      background: #f1f5f9;
    }
    @media print {
      body {
        padding: 0;
        background: #fff;
      }
      .sheet {
        box-shadow: none;
        border: none;
        padding: 20px;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1>${escapeHtml(company.legalNameAr) || "كلاسيرا بالس لحلول رأس المال البشري"}</h1>
        <p>سجل تجاري: 1010789654 • الرقم الضريبي: 300098765400003</p>
        <p>المملكة العربية السعودية - الرياض - المقر الرئيسي</p>
      </div>
      <div class="meta">
        <p><strong>المرجع:</strong> ${refNo}</p>
        <p><strong>التاريخ:</strong> ${currentDate}</p>
      </div>
    </div>

    <div class="title-banner">
      <h2>شهادة وتوثيق مستند رسمي: ${doc.title}</h2>
    </div>

    <div class="grid">
      <div><span class="label">صاحب الوثيقة / المنشأة:</span><span class="val">${doc.employeeName}</span></div>
      <div><span class="label">الرقم الوظيفي:</span><span class="val font-mono">${doc.employeeNo || "منشأة"}</span></div>
      <div><span class="label">رقم الوثيقة / السجل:</span><span class="val font-mono">${doc.docNumber || "—"}</span></div>
      <div><span class="label">الجهة الحكومية / المصدرة:</span><span class="val">${doc.issuingAuthority || "رسمي"}</span></div>
      <div><span class="label">تصنيف المستند:</span><span class="val">${doc.category}</span></div>
      <div><span class="label">تاريخ الإصدار / الرفع:</span><span class="val font-mono">${doc.uploadDate}</span></div>
      <div><span class="label">تاريخ انتهاء الصلاحية:</span><span class="val font-mono">${doc.expiryDate || "ساري بدون انتهاء"}</span></div>
      <div><span class="label">مستوى السرية والوصول:</span><span class="val">${doc.confidentiality}</span></div>
      <div><span class="label">حالة الصلاحية:</span><span class="val">${doc.status === "valid" ? "ساري المفعول وموثق" : doc.status === "expiring_soon" ? "ينتهي قريباً" : "منتهي الصلاحية"}</span></div>
      <div><span class="label">المعتمد والمراجع:</span><span class="val">${doc.verifiedBy || "إدارة الموارد البشرية"}</span></div>
    </div>

    <div class="content-box">
      <p>تشهد إدارة الموارد البشرية والشؤون الإدارية بأن هذا المستند معتمد ومحفوظ رسمياً بالأرشيف السحابي المشفر للشركة وفقاً للأنظمة واللوائح والقرارات الوزارية المعمول بها في المملكة العربية السعودية.</p>
      ${doc.notes ? `<p><strong>ملاحظات التوثيق الرسمية:</strong> ${doc.notes}</p>` : ""}
      <p style="font-size: 10px; color: #64748b;">تم التحقق من الوثيقة إلكترونياً برقم الأرشيف المعتمد (${doc.id.toUpperCase()}) بمعيار الأمان المشفر AES-256.</p>
    </div>

    <div class="footer">
      <div>
        <p style="font-weight: bold; margin: 0; font-size: 12px;">إدارة الموارد البشرية والتدقيق السحابي</p>
        <p style="font-size: 10px; color: #64748b; margin: 2px 0;">كلاسيرا بالس لحلول رأس المال البشري</p>
        <div class="stamp">ختم الموارد البشرية المعتمد ✓</div>
      </div>
      <div class="qr-box">
        <div class="qr-placeholder">QR CODE</div>
        <span>رمز التحقق الإلكتروني</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}
