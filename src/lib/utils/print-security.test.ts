import { afterEach, expect, it, vi } from "vitest";
import { escapeHtml } from "./escape-html";
import { generateDocumentHtml } from "./document-html";
import { openMonthlyPayrollPdf } from "./payroll-pdf";
import { openArabicReportPdf } from "./arabic-report-pdf";

vi.mock("../../components/common/AppLogo", () => ({ getActiveBrandLogoPath: () => "/logo.svg" }));
const attack = '</title><img src=x onerror="alert(1)">';
const capture = () => {
  const write = vi.fn();
  vi.stubGlobal("window", {
    location: { origin: "https://example.invalid" },
    open: () => ({ document: { write, close: vi.fn() } }),
  });
  return write;
};
afterEach(() => vi.unstubAllGlobals());

it("encodes HTML delimiters and quotes while preserving Arabic text", () => {
  expect(escapeHtml("&<>\"' اسم")).toBe("&amp;&lt;&gt;&quot;&#39; اسم");
});
it("renders stored document text without executable HTML", () => {
  const html = generateDocumentHtml(
    {
      id: "doc-1",
      employeeId: "employee-1",
      employeeName: attack,
      title: attack,
      notes: attack,
      docNumber: attack,
      category: "contract",
      fileName: "document.pdf",
      fileSize: "1 KB",
      uploadDate: "2026-09-10",
      status: "valid",
      confidentiality: "internal",
    },
    { legalNameAr: attack },
  );
  expect(html).not.toContain(attack);
  expect(html).toContain(escapeHtml(attack));
});
it("escapes employee and company text in payroll print output", () => {
  const write = capture();
  openMonthlyPayrollPdf(
    {
      period: attack,
      status: attack,
      employees: 1,
      net: 0,
      loansPaid: 0,
      paidOut: 0,
      pendingOut: 0,
      companyBalance: 0,
      companyName: attack,
    },
    [
      {
        employeeNo: attack,
        employeeName: attack,
        departmentName: attack,
        workingDays: 1,
        gross: 0,
        net: 0,
        loanPaid: 0,
        gap: 0,
      },
    ],
  );
  const html = write.mock.calls[0][0];
  expect(html).not.toContain(attack);
  expect(html).toContain(escapeHtml(attack));
});
it("escapes report headings, cards, table cells, notes and footer", () => {
  const write = capture();
  openArabicReportPdf({
    title: attack,
    subtitle: attack,
    cards: [{ label: attack, value: attack }],
    sections: [
      { title: attack, columns: [attack], rows: [[attack]], totals: [attack], note: attack },
    ],
    footer: attack,
  });
  const html = write.mock.calls[0][0];
  expect(html).not.toContain(attack);
  expect(html).toContain(escapeHtml(attack));
});
