import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("truthful workflow UI contracts", () => {
  it("does not mark a candidate hired before employee creation succeeds", () => {
    const recruitment = source("src/components/recruitment/RecruitmentView.tsx");

    expect(recruitment).toContain("const converted = await convertCandidateToEmployee");
    expect(recruitment).toContain("if (converted) setIsOnboardingModalOpen(false)");
    expect(recruitment).not.toContain('await moveCandidateStage(candidateToHire.id, "hired")');
    expect(recruitment).not.toContain("await addEmployee");
  });

  it("does not fabricate identity, bank or profile data during candidate conversion", () => {
    const recruitment = source("src/components/recruitment/RecruitmentView.tsx");

    expect(recruitment).not.toContain('nationalIdOrIqama: "غير مسجل"');
    expect(recruitment).not.toContain('birthDate: "1990-01-01"');
    expect(recruitment).not.toContain('bankName: "مصرف الراجحي"');
    expect(recruitment).not.toContain('iban: "SA0000000000000000000000"');
    expect(recruitment).not.toContain('|| "جديد"');
    expect(recruitment).not.toContain('subsidiaries[0]');
  });

  it("waits for shift and performance writes before closing their dialogs", () => {
    const shifts = source("src/components/shifts/ShiftsView.tsx");
    const shiftModal = source("src/components/shifts/ShiftDefinitionModal.tsx");
    const performance = source("src/components/performance/PerformanceView.tsx");

    expect(shifts).toContain("ShiftDefinitionModal");
    expect(shiftModal).toContain("await addShift");
    expect(shiftModal).toContain("await updateShift");
    expect(performance).toContain("const saved = await addEvaluation");
    expect(performance).toContain("const created = await addPerformanceCycle");
  });

  it("does not claim that placeholder device and punch actions succeeded", () => {
    const shifts = source("src/components/shifts/ShiftsView.tsx");

    expect(shifts).not.toContain("تم ربط واختبار الاتصال بجهاز البصمة");
    expect(shifts).not.toContain("تم استيراد ومعالجة 450 حركة بصمة خام");
    expect(shifts).toContain("المرجع الحصري المعتمد لمحرك الحضور والانصراف");
  });

  it("persists evaluation criteria and feedback", () => {
    const performance = source("src/components/performance/PerformanceView.tsx");
    const repository = source("src/lib/data/operational-repository.ts");

    expect(performance).toContain("competencyScores:");
    expect(performance).toContain("notes: finalFeedback");
    expect(repository).toContain("competency_scores: evaluation.competencyScores ?? {}");
    expect(repository).toContain("notes: evaluation.notes ?? null");
  });
});
