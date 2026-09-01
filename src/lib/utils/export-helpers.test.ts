import { describe, expect, it } from "vitest";

import { escapeSifField, formatCsvCell } from "./export-helpers";

describe("export helpers", () => {
  it("neutralizes spreadsheet formulas without changing numeric values", () => {
    expect(formatCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(formatCsvCell("  @command")).toBe("'  @command");
    expect(formatCsvCell(-250)).toBe("-250");
  });

  it("escapes CSV and SIF text safely", () => {
    expect(formatCsvCell('Ahmed, "HR"')).toBe('"Ahmed, ""HR"""');
    expect(escapeSifField('Ahmed "HR"\nLead')).toBe('"Ahmed ""HR"" Lead"');
  });
});
