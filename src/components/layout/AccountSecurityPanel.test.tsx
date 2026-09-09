import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Language } from "../../types";
import { AccountSecurityPanel } from "./AccountSecurityPanel";

describe("account security availability", () => {
  for (const language of ["ar", "en"] satisfies Language[]) {
    for (const isDemo of [true, false]) {
      it(`does not collect credentials or claim verified security in ${language}, demo=${isDemo}`, () => {
        const markup = renderToStaticMarkup(
          <AccountSecurityPanel language={language} isDemo={isDemo} />,
        );

        expect(markup).toContain(
          language === "ar" ? "لم يتم التحقق من الحالة" : "Status not verified",
        );
        expect(markup).toContain(
          language === "ar" ? "غير متاح من هذه الشاشة" : "Unavailable from this screen",
        );
        expect(markup).not.toMatch(/<(input|form|button)\b|role="switch"/);
        expect(markup).not.toMatch(/158\.140\.22\.81|Chrome|Windows|نشط الآن|تم تحديث كلمة المرور/);
        expect(
          markup.includes(language === "ar" ? "أنت في النسخة التجريبية" : "You are in demo mode"),
        ).toBe(isDemo);
        expect(markup).toContain(`dir="${language === "ar" ? "rtl" : "ltr"}"`);
      });
    }
  }
});
