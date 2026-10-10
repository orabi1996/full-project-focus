// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 28: PRODUCTION EMPLOYEE MOVEMENTS & LIFECYCLE ENGINE
// src/lib/domains/movements/index.ts
// ============================================================================

export type MovementType =
  | "promotion"
  | "demotion"
  | "transfer"
  | "department_change"
  | "business_unit_change"
  | "legal_entity_change"
  | "job_change"
  | "position_change"
  | "grade_change"
  | "manager_change"
  | "location_change"
  | "cost_center_change"
  | "employment_type_change"
  | "contract_change"
  | "compensation_change"
  | "temporary_assignment"
  | "secondment"
  | "acting_assignment"
  | "return_from_assignment"
  | "status_change";

export type MovementStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "scheduled"
  | "effective"
  | "rejected"
  | "returned"
  | "cancelled"
  | "failed";

export type TemporaryAssignmentType =
  | "temporary_assignment"
  | "secondment"
  | "acting_assignment";

export interface EmployeeMovementChange {
  id: string;
  movementId: string;
  companyId: string;
  fieldCode: string;
  oldReferenceId?: string | null;
  newReferenceId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  oldDisplayValue?: string | null;
  newDisplayValue?: string | null;
  isConfidential: boolean;
  createdAt: string;
}

export interface EmployeeMovement {
  id: string;
  companyId: string;
  movementNumber: string;
  employeeId: string;
  employeeName?: string;
  employeeNo?: string;
  movementType: MovementType;
  requestedBy?: string | null;
  requesterName?: string;
  effectiveDate: string; // YYYY-MM-DD
  reason: string;
  status: MovementStatus;
  workflowInstanceId?: string | null;
  requestId?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  reversalOfMovementId?: string | null;
  notes?: string | null;
  isBulk: boolean;
  batchId?: string | null;
  createdAt: string;
  updatedAt: string;
  changes?: EmployeeMovementChange[];
}

export interface EmployeeAssignmentHistory {
  id: string;
  companyId: string;
  employeeId: string;
  departmentId?: string | null;
  departmentName?: string;
  subsidiaryId?: string | null;
  subsidiaryName?: string;
  workLocationId?: string | null;
  locationName?: string;
  jobPositionId?: string | null;
  positionTitle?: string;
  costCenterId?: string | null;
  costCenterCode?: string;
  managerId?: string | null;
  managerName?: string;
  grade?: string | null;
  employmentType?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isCurrent: boolean;
  changeReason?: string | null;
  changedBy?: string | null;
  movementId?: string | null;
  isTemporary: boolean;
  temporaryAssignmentId?: string | null;
  createdAt: string;
}

export interface EmployeeContractVersion {
  id: string;
  companyId: string;
  employeeId: string;
  contractId?: string | null;
  version: number;
  contractNumber?: string | null;
  contractType: string;
  startDate: string;
  endDate?: string | null;
  probationEndDate?: string | null;
  workType?: string | null;
  terms?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: "active" | "superseded" | "terminated" | "cancelled";
  reason?: string | null;
  movementId?: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface TemporaryAssignment {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  employeeNo?: string;
  assignmentType: TemporaryAssignmentType;
  startDate: string;
  expectedEndDate: string;
  actualEndDate?: string | null;
  homeCompanyId?: string | null;
  hostCompanyId?: string | null;
  homeDepartmentId?: string | null;
  homeDepartmentName?: string;
  tempDepartmentId?: string | null;
  tempDepartmentName?: string;
  homePositionId?: string | null;
  homePositionTitle?: string;
  tempPositionId?: string | null;
  tempPositionTitle?: string;
  homeManagerId?: string | null;
  homeManagerName?: string;
  tempManagerId?: string | null;
  tempManagerName?: string;
  homeLocationId?: string | null;
  tempLocationId?: string | null;
  baseAssignmentId?: string | null;
  sourceMovementId?: string | null;
  returnMovementId?: string | null;
  status: "active" | "completed" | "cancelled";
  reason: string;
  createdAt: string;
}

export interface MovementPolicy {
  id: string;
  companyId: string;
  policyCode: string;
  movementType: MovementType;
  requiresWorkflow: boolean;
  allowCrossLegalEntity: boolean;
  crossEntityAction: "internal_transfer" | "new_employment" | "separation_rehire";
  maxTemporaryMonths: number;
  allowConcurrentScheduled: boolean;
  enforcePositionControl: boolean;
  createdAt: string;
}

export interface MovementKpis {
  totalMovements: number;
  pendingMovements: number;
  scheduledMovements: number;
  effectiveMovements: number;
  promotionsCount: number;
  transfersCount: number;
  managerChangesCount: number;
  activeTemporaryAssignments: number;
  averageTurnaroundDays?: number;
}

export interface BulkMovementRow {
  employeeId: string;
  employeeNo?: string;
  employeeName?: string;
  changes: Array<{
    fieldCode: string;
    newReferenceId?: string;
    newValue?: string;
    newDisplayValue?: string;
    isConfidential?: boolean;
  }>;
}

export interface BulkMovementValidationResult {
  validCount: number;
  invalidCount: number;
  errors: Array<{
    employeeId: string;
    error: string;
  }>;
  warnings?: string[];
}

// ============================================================================
// PURE DOMAIN RULES & LOGIC FUNCTIONS
// ============================================================================

/**
 * Validates that setting a new manager does not create a circular hierarchy loop.
 * A circular hierarchy happens if:
 * 1. An employee is assigned to manage themselves.
 * 2. The proposed new manager currently reports (directly or indirectly) to the employee.
 */
export function validateHierarchyCircular(
  employeeId: string,
  newManagerId: string,
  managerTree: Record<string, string | null>
): { valid: boolean; reason?: string } {
  if (employeeId === newManagerId) {
    return {
      valid: false,
      reason: "الموظف لا يمكن أن يكون مديراً لنفسه (Self-reporting is forbidden)",
    };
  }

  let currentId: string | null = newManagerId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === employeeId) {
      return {
        valid: false,
        reason: "تسلسل هرمي دائري: المدير المقترح يتبع بالفعل لهذا الموظف (Circular hierarchy loop detected)",
      };
    }

    if (visited.has(currentId)) {
      return {
        valid: false,
        reason: "تم اكتشاف حلقة دائرية سابقة في الهيكل الإداري للمدير المقترح",
      };
    }
    visited.add(currentId);

    currentId = managerTree[currentId] ?? null;
  }

  return { valid: true };
}

/**
 * Detects conflicts between a proposed movement and existing scheduled/pending movements.
 */
export function detectMovementConflicts(
  proposed: { employeeId: string; effectiveDate: string; fieldCodes: string[] },
  existingMovements: EmployeeMovement[]
): { hasConflict: boolean; conflictingMovement?: EmployeeMovement; reason?: string } {
  for (const existing of existingMovements) {
    if (existing.employeeId !== proposed.employeeId) continue;
    if (existing.status !== "scheduled" && existing.status !== "submitted" && existing.status !== "under_review") {
      continue;
    }

    // Direct effective date collision
    if (existing.effectiveDate === proposed.effectiveDate) {
      return {
        hasConflict: true,
        conflictingMovement: existing,
        reason: `يوجد حركة أخرى مجدولة لنفس الموظف في نفس تاريخ السريان (${proposed.effectiveDate}) برقم ${existing.movementNumber}`,
      };
    }

    // Overlapping field collision in pending movements
    if (existing.changes) {
      const existingFields = existing.changes.map((c) => c.fieldCode);
      const overlappingFields = proposed.fieldCodes.filter((f) => existingFields.includes(f));
      if (overlappingFields.length > 0) {
        return {
          hasConflict: true,
          conflictingMovement: existing,
          reason: `يوجد تعديل معلق قيد المراجعة لنفس الحقول (${overlappingFields.join(", ")}) في الحركة ${existing.movementNumber}`,
        };
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Validates position eligibility and headcount capacity.
 */
export function validatePositionAvailability(targetPosition: {
  id: string;
  status: string;
  plannedHeadcount: number;
  currentHeadcount: number;
  allowMultipleIncumbents?: boolean;
}): { eligible: boolean; reason?: string } {
  if (targetPosition.status !== "active") {
    return {
      eligible: false,
      reason: "الوظيفة المستهدفة غير نشطة في الهيكل التنظيمي",
    };
  }

  if (
    !targetPosition.allowMultipleIncumbents &&
    targetPosition.currentHeadcount >= targetPosition.plannedHeadcount
  ) {
    return {
      eligible: false,
      reason: `الوظيفة مشغولة بالكامل (${targetPosition.currentHeadcount}/${targetPosition.plannedHeadcount}) ونظام التحكم بالوظائف لا يسمح بتجاوز السقف المحدد`,
    };
  }

  return { eligible: true };
}

/**
 * Validates return from temporary assignment.
 */
export function validateTemporaryAssignmentReturn(
  assignment: TemporaryAssignment,
  targetDate: string
): { canReturn: boolean; reason?: string } {
  if (assignment.status !== "active") {
    return {
      canReturn: false,
      reason: "التكليف المؤقت مغلق بالفعل أو تم إلغاؤه سابقاً",
    };
  }

  if (!assignment.baseAssignmentId) {
    return {
      canReturn: false,
      reason: "لا يوجد تعيين أساسي مسجل للعودة إليه (Missing base assignment snapshot)",
    };
  }

  if (targetDate < assignment.startDate) {
    return {
      canReturn: false,
      reason: "تاريخ العودة لا يمكن أن يكون قبل تاريخ بدء التكليف المؤقت",
    };
  }

  return { canReturn: true };
}

/**
 * Masks confidential compensation fields for unauthorized viewers (e.g. general managers).
 */
export function maskMovementConfidentialData(
  movement: EmployeeMovement,
  isPrivilegedViewer: boolean
): EmployeeMovement {
  if (isPrivilegedViewer || !movement.changes) {
    return movement;
  }

  const maskedChanges = movement.changes.map((change) => {
    if (change.isConfidential || change.fieldCode.includes("salary") || change.fieldCode.includes("allowance")) {
      return {
        ...change,
        oldValue: "******",
        newValue: "******",
        oldDisplayValue: "******",
        newDisplayValue: "******",
      };
    }
    return change;
  });

  return {
    ...movement,
    changes: maskedChanges,
  };
}

/**
 * Calculates average turnaround days for approved movements.
 */
export function calculateMovementTurnaround(movements: EmployeeMovement[]): {
  averageDays: number;
  medianDays: number;
} {
  const durations: number[] = [];

  for (const mov of movements) {
    if ((mov.status === "approved" || mov.status === "scheduled" || mov.status === "effective") && mov.approvedAt) {
      const created = new Date(mov.createdAt).getTime();
      const approved = new Date(mov.approvedAt).getTime();
      const days = Math.max(0, Math.round((approved - created) / (1000 * 60 * 60 * 24)));
      durations.push(days);
    }
  }

  if (durations.length === 0) {
    return { averageDays: 0, medianDays: 0 };
  }

  durations.sort((a, b) => a - b);
  const sum = durations.reduce((acc, curr) => acc + curr, 0);
  const averageDays = Math.round((sum / durations.length) * 10) / 10;
  const mid = Math.floor(durations.length / 2);
  const medianDays = durations.length % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;

  return { averageDays, medianDays };
}
