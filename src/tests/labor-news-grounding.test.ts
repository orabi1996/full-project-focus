import { describe, expect, it } from "vitest";
import { searchCountryLaborRegulations } from "../lib/ai/labor-news-and-country-regulations";

describe("Labor law answers disclose source and freshness limits", () => {
  it("labels a country answer as static and points to the official source", () => {
    const answer = searchCountryLaborRegulations("ما هي ساعات العمل في السعودية؟");
    expect(answer).toContain("بيانات مرجعية ثابتة");
    expect(answer).toContain("لا يتوفر تاريخ تحقق محدد");
    expect(answer).toContain("https://qiwa.sa");
  });

  it("does not present the locally stored news feed as current verified news", () => {
    const answer = searchCountryLaborRegulations("ما أحدث أخبار الموارد البشرية؟");
    expect(answer).toContain("لا أستطيع تأكيد أحدث أخبار");
    expect(answer).toContain("روابط تحقق رسمية مستقلة");
    expect(answer).not.toContain("إلزامية توثيق 100%");
  });

  it("does not route a law question containing a year into the news feed", () => {
    const answer = searchCountryLaborRegulations("ما أحكام العمل في السعودية لعام 2026؟");
    expect(answer).toContain("المملكة العربية السعودية");
    expect(answer).toContain("بيانات مرجعية ثابتة");
  });

  it("does not claim the country packs are connected to real-time legal updates", () => {
    const answer = searchCountryLaborRegulations("ما قوانين العمل في دول النظام؟");
    expect(answer).toContain("لا تعني وجود ربط مباشر أو تحديث فوري");
    expect(answer).toContain("https://www.mol.gov.qa");
  });
});
