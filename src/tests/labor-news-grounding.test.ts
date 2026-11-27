import { describe, expect, it } from "vitest";
import { searchCountryLaborRegulations } from "../lib/ai/labor-news-and-country-regulations";

describe("Labor law answers disclose source and freshness limits", () => {
  it("withholds a country law answer when no verified source is available", () => {
    const answer = searchCountryLaborRegulations("ما هي ساعات العمل في السعودية؟");
    expect(answer).toContain("لا أستطيع تأكيد إجابة قانونية");
    expect(answer).toContain("موثقاً");
    expect(answer).not.toContain("8 ساعات");
  });

  it("does not present the locally stored news feed as current verified news", () => {
    const answer = searchCountryLaborRegulations("ما أحدث أخبار الموارد البشرية؟");
    expect(answer).toContain("لا أستطيع تأكيد أحدث أخبار");
    expect(answer).toContain("روابط تحقق رسمية مستقلة");
    expect(answer).not.toContain("إلزامية توثيق 100%");
  });

  it("does not route a law question containing a year into the news feed", () => {
    const answer = searchCountryLaborRegulations("ما قوانين العمل في السعودية لعام 2026؟");
    expect(answer).toContain("لا أستطيع تأكيد إجابة قانونية");
    expect(answer).not.toContain("المملكة العربية السعودية");
  });

  it("does not claim the country packs are connected to real-time legal updates", () => {
    const answer = searchCountryLaborRegulations("ما قوانين العمل في دول النظام؟");
    expect(answer).toContain("لا أستطيع تأكيد إجابة قانونية");
    expect(answer).toContain("موثقاً");
  });
});
