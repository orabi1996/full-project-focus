import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { escapeSifField, exportToCSV, formatCsvCell, generateWPSSIFFile } from "./export-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function installDownloadDom() {
  const attributes = new Map<string, string>();
  const link = {
    style: { visibility: "" },
    setAttribute: vi.fn((key: string, value: string) => attributes.set(key, value)),
    click: vi.fn(),
  };
  vi.stubGlobal("document", {
    createElement: vi.fn(() => link),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  });
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
  return { attributes, link };
}

describe("export helpers", () => {
  it("neutralizes spreadsheet formulas without changing numeric values", () => {
    expect(formatCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(formatCsvCell("  @command")).toBe("'  @command");
    expect(formatCsvCell(-250)).toBe("-250");
  });

  it("escapes CSV and SIF text safely", () => {
    expect(formatCsvCell('Ahmed, "HR"')).toBe('"Ahmed, ""HR"""');
    expect(formatCsvCell("first\nsecond")).toBe('"first\nsecond"');
    expect(formatCsvCell(null)).toBe("");
    expect(formatCsvCell(new Date("2026-09-01T00:00:00Z"))).not.toBe("");
    expect(escapeSifField('Ahmed "HR"\nLead')).toBe('"Ahmed ""HR"" Lead"');
  });

  it("warns instead of exporting an empty dataset", () => {
    const toastSpy = vi.spyOn(toast, "error").mockImplementation(() => "" as any);
    exportToCSV("employees", []);
    expect(toastSpy).toHaveBeenCalledWith("لا توجد بيانات متاحة للتصدير");
  });

  it("creates a safe CSV download with the requested filename", () => {
    const { attributes, link } = installDownloadDom();
    exportToCSV("employees", [{ name: "Ahmed", value: "=1+1" }]);
    expect(attributes.get("download")).toBe("employees.csv");
    expect(attributes.get("href")).toBe("blob:test");
    expect(link.click).toHaveBeenCalledOnce();
  });

  it("creates a Wage Protection System SIF download", () => {
    const { attributes, link } = installDownloadDom();
    generateWPSSIFFile("1010000000", "RJHI", "202609", [
      {
        employeeId: "EMP-1",
        employeeName: "أحمد محمد",
        iban: "SA001234",
        basicSalary: 10_000,
        housingAllowance: 2_500,
        otherEarnings: 500,
        deductions: 1_000,
        netSalary: 12_000,
      },
    ]);
    expect(attributes.get("download")).toBe("WPS_1010000000_202609.sif");
    expect(link.click).toHaveBeenCalledOnce();
  });
});
