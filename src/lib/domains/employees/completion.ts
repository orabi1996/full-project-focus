import type { Employee } from "../../../types";

/**
 * Deterministic profile completion calculator based purely on persisted HR data.
 * Does NOT generate synthetic scores or assume default percentages.
 */
export function calculateProfileCompletion(emp: Partial<Employee>): number {
  if (!emp) return 0;

  let score = 0;

  // 1. Basic Identity (20%)
  if (emp.firstNameAr?.trim() && emp.lastNameAr?.trim()) {
    score += 7;
  }
  if (emp.nationalIdOrIqama?.trim()) {
    score += 7;
  }
  if (emp.birthDate?.trim() && emp.gender) {
    score += 6;
  }

  // 2. Contact Information (15%)
  if (emp.email?.trim()) {
    score += 8;
  }
  if (emp.phone?.trim()) {
    score += 7;
  }

  // 3. Organization Placement (20%)
  if (emp.departmentId && emp.departmentId !== "unassigned") {
    score += 7;
  }
  if (emp.jobTitleAr?.trim()) {
    score += 7;
  }
  if (emp.workLocationId || emp.subsidiaryId) {
    score += 6;
  }

  // 4. Employment & Contract (15%)
  if (emp.hireDate?.trim()) {
    score += 5;
  }
  if (emp.contractType) {
    score += 5;
  }
  if (emp.status) {
    score += 5;
  }

  // 5. Financial & Banking (15%)
  if (typeof emp.basicSalary === "number" && emp.basicSalary > 0) {
    score += 8;
  }
  if (emp.iban?.trim() && emp.iban.trim().length >= 15) {
    score += 7;
  }

  // 6. Emergency Contact (15%)
  if (emp.emergencyContact?.name?.trim() && emp.emergencyContact?.phone?.trim()) {
    score += 15;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Authoritative nationality check for Saudi citizenship.
 * Avoids fragile heuristics like ID startsWith("1").
 */
export function isSaudiNationality(nat?: string): boolean {
  return Boolean(
    nat &&
      (nat.includes("سعود") ||
        nat.toLowerCase().includes("saudi") ||
        nat === "KSA" ||
        nat === "SA"),
  );
}
