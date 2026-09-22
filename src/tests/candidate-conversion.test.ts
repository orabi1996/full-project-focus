import { describe, expect, it } from "vitest";
import {
  convertDemoCandidate,
  validateCandidateConversion,
  type CandidateConversionInput,
} from "../lib/domains/recruitment/candidate-conversion";
import type { Candidate } from "../types";

const input: CandidateConversionInput = {
  candidateId: "candidate-1",
  firstNameAr: "أحمد",
  lastNameAr: "محمد",
  departmentId: "dept-1",
  workLocationId: "loc-1",
  hireDate: "2026-10-01",
  contractType: "full_time",
  workType: "on_site",
  basicSalary: 0,
  housingAllowance: 0,
  transportAllowance: 0,
};
const candidate: Candidate = {
  id: input.candidateId,
  jobId: "job-1",
  jobTitle: "مهندس",
  fullName: "أحمد محمد",
  email: "candidate@example.com",
  phone: "",
  stage: "job_offer",
  ratingScore: 4,
  appliedDate: "2026-09-01",
  source: "website",
  notesCount: 0,
};

describe("candidate conversion", () => {
  it("creates a draft and changes the stage together without mutating the source", () => {
    const candidates = [candidate];
    const next = convertDemoCandidate(input, candidates, []);
    expect(candidates[0].stage).toBe("job_offer");
    expect(next.candidates[0].stage).toBe("hired");
    expect(next.employees[0]).toMatchObject({
      status: "draft",
      firstNameEn: "",
      subsidiaryId: "",
      nationalIdOrIqama: "",
    });
  });
  it("returns the same employee when retried", () => {
    const first = convertDemoCandidate(input, [candidate], []);
    const retry = convertDemoCandidate(input, first.candidates, first.employees);
    expect(retry.id).toBe(first.id);
    expect(retry.employees).toHaveLength(1);
  });
  it.each([-1, NaN, Infinity])("rejects invalid salary %s before changing state", (salary) => {
    expect(() =>
      convertDemoCandidate({ ...input, basicSalary: salary }, [candidate], []),
    ).toThrow();
    expect(candidate.stage).toBe("job_offer");
  });
  it.each(["firstNameAr", "lastNameAr", "departmentId", "workLocationId", "hireDate"] as const)(
    "requires %s",
    (field) => {
      expect(() => validateCandidateConversion({ ...input, [field]: "" })).toThrow();
    },
  );
  it("does not create a second employee for a legacy hired candidate without a link", () => {
    expect(() => convertDemoCandidate(input, [{ ...candidate, stage: "hired" }], [])).toThrow();
  });
});
