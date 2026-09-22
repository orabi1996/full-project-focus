import type { Candidate, Employee } from "../../../types";

export interface CandidateConversionInput {
  candidateId: string;
  firstNameAr: string;
  lastNameAr: string;
  departmentId: string;
  workLocationId: string;
  hireDate: string;
  contractType: NonNullable<Employee["contractType"]>;
  workType: NonNullable<Employee["workType"]>;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
}

export function validateCandidateConversion(input: CandidateConversionInput) {
  if (!input.firstNameAr.trim() || !input.lastNameAr.trim()) {
    throw new Error("يرجى تأكيد الاسم الأول واسم العائلة للمرشح");
  }
  if (
    !input.departmentId ||
    !input.workLocationId ||
    !input.hireDate ||
    !input.contractType ||
    !input.workType
  ) {
    throw new Error("يرجى استكمال القسم ومقر العمل وتاريخ المباشرة ونوع العقد ونمط العمل");
  }
  if (
    [input.basicSalary, input.housingAllowance, input.transportAllowance].some(
      (n) => !Number.isFinite(n) || n < 0,
    )
  ) {
    throw new Error("قيم الراتب يجب أن تكون أرقاماً غير سالبة");
  }
}

// In-memory equivalent: prepare both arrays before the caller publishes one notification.
export function convertDemoCandidate(
  input: CandidateConversionInput,
  candidates: Candidate[],
  employees: Employee[],
) {
  validateCandidateConversion(input);
  const candidate = candidates.find((c) => c.id === input.candidateId);
  if (!candidate) throw new Error("المرشح غير موجود");
  const existing = employees.find((e) => e.customFields?.sourceCandidateId === candidate.id);
  if (existing) return { candidates, employees, id: existing.id };
  if (candidate.stage !== "job_offer") throw new Error("يلزم مراجعة مرحلة المرشح قبل التحويل");
  const employee: Employee = {
    id: crypto.randomUUID(),
    employeeNo: "",
    firstNameAr: input.firstNameAr.trim(),
    lastNameAr: input.lastNameAr.trim(),
    firstNameEn: "",
    lastNameEn: "",
    email: candidate.email,
    phone: candidate.phone,
    nationalIdOrIqama: "",
    nationality: "",
    birthDate: "",
    subsidiaryId: "",
    departmentId: input.departmentId,
    workLocationId: input.workLocationId,
    jobTitleAr: candidate.jobTitle,
    jobTitleEn: "",
    hireDate: input.hireDate,
    contractType: input.contractType,
    workType: input.workType,
    status: "draft",
    completionScore: 0,
    basicSalary: input.basicSalary,
    housingAllowance: input.housingAllowance,
    transportAllowance: input.transportAllowance,
    totalSalary: input.basicSalary + input.housingAllowance + input.transportAllowance,
    customFields: { sourceCandidateId: candidate.id },
  };
  return {
    id: employee.id,
    employees: [employee, ...employees],
    candidates: candidates.map((c): Candidate =>
      c.id === candidate.id ? { ...c, stage: "hired" } : c,
    ),
  };
}
