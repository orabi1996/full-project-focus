import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Pure simulation of the authoritative PostgreSQL function:
 * public.can_access_storage_object(p_bucket_id text, p_object_name text)
 * as defined in migration 20260914070000_restore_strict_storage_metadata_read_authorization.sql
 */
interface StorageAccessContext {
  role?: string; // 'service_role', 'authenticated', 'anon'
  userId?: string | null;
  employeeId?: string | null;
  userRoles?: string[]; // ['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'recruiter', 'employee']
  employeeDepartmentId?: string | null;
  employeeSubsidiaryId?: string | null;
}

interface DatabaseState {
  fileObjects: Array<{
    id: string;
    bucket_id: string;
    object_path: string;
    status: string; // 'active', 'archived', 'deleted', 'quarantined', 'orphaned', 'cleanup_failed'
    entity_id?: string | null;
    employee_id?: string | null;
  }>;
  companyDocuments: Array<{
    id: string;
    file_id?: string | null;
    status: string; // 'active', 'archived', 'inactive'
    visibility_scope: string; // 'all', 'department', 'subsidiary', 'hr_only', 'confidential', 'restricted'
    department_id?: string | null;
    subsidiary_id?: string | null;
  }>;
  employeeDocuments: Array<{
    id: string;
    file_id?: string | null;
    employee_id?: string | null;
    status: string; // 'valid', 'expired', 'rejected', 'archived', 'inactive'
    visibility: string; // 'all', 'hr_only', 'restricted'
    confidentiality: string; // 'normal', 'internal', 'confidential', 'strictly_confidential'
  }>;
  expenseClaims: Array<{
    id: string;
    receipt_file_id?: string | null;
    employee_id?: string | null;
  }>;
  candidates: Array<{
    id: string;
    cv_file_id?: string | null;
  }>;
  jobOffers: Array<{
    id: string;
    offer_file_id?: string | null;
  }>;
}

function simulateCanAccessStorageObject(
  bucketId: string,
  objectName: string,
  ctx: StorageAccessContext,
  db: DatabaseState
): boolean {
  // 1. Service role bypass (system maintenance, workers)
  if (ctx.role === 'service_role') {
    return true;
  }

  // 2. Unauthenticated callers are strictly denied
  if (!ctx.userId) {
    return false;
  }

  const currentEmpId = ctx.employeeId ?? null;
  const isHr = Boolean(ctx.userRoles?.some((r) => ['super_admin', 'org_admin', 'hr_manager'].includes(r)));
  const isFinance = Boolean(ctx.userRoles?.some((r) => ['super_admin', 'org_admin', 'hr_manager', 'finance_officer', 'auditor'].includes(r)));
  const isRecruiter = Boolean(ctx.userRoles?.some((r) => ['super_admin', 'org_admin', 'hr_manager', 'recruiter'].includes(r)));

  // 3. Query authoritative metadata catalog (TASK 1: STRICT METADATA-FIRST REQUIREMENT)
  const file = db.fileObjects.find((f) => f.bucket_id === bucketId && f.object_path === objectName);
  if (!file) {
    return false;
  }

  // 4. Status Enforcement on file_objects (TASK 4)
  if (['deleted', 'quarantined', 'orphaned', 'cleanup_failed'].includes(file.status)) {
    return false;
  }

  // Archived files: only HR/admins retain audit/historical access
  if (file.status === 'archived' && !isHr) {
    return false;
  }

  // 5. Bucket-specific authoritative business entity verification (TASKS 3, 5, 6, 7)
  if (bucketId === 'company-documents') {
    const compDoc = db.companyDocuments.find((d) => d.file_id === file.id || d.id === file.entity_id);
    if (!compDoc) {
      return false; // Transient/unattached file without business entity is denied
    }

    if (['archived', 'inactive'].includes(compDoc.status)) {
      return isHr;
    }

    if (isHr) {
      return true;
    }

    if (compDoc.visibility_scope === 'all') {
      return true;
    } else if (compDoc.visibility_scope === 'department') {
      if (currentEmpId && ctx.employeeDepartmentId) {
        return compDoc.department_id === ctx.employeeDepartmentId;
      }
      return false;
    } else if (compDoc.visibility_scope === 'subsidiary') {
      if (currentEmpId && ctx.employeeSubsidiaryId) {
        return compDoc.subsidiary_id === ctx.employeeSubsidiaryId;
      }
      return false;
    } else if (['hr_only', 'confidential', 'restricted'].includes(compDoc.visibility_scope)) {
      return false;
    }
    return false;
  }

  if (bucketId === 'employee-documents') {
    const empDoc = db.employeeDocuments.find((d) => d.file_id === file.id || d.id === file.entity_id);
    if (!empDoc) {
      return false; // Transient/unattached file without business entity is denied
    }

    if (isHr) {
      return true;
    }

    if (file.employee_id === currentEmpId || empDoc.employee_id === currentEmpId) {
      if (['archived', 'inactive'].includes(empDoc.status)) {
        return false;
      }
      if (['hr_only', 'restricted'].includes(empDoc.visibility) || empDoc.confidentiality === 'strictly_confidential') {
        return false;
      }
      return true;
    }
    return false;
  }

  if (bucketId === 'expense-receipts') {
    const claim = db.expenseClaims.find((c) => c.receipt_file_id === file.id || c.id === file.entity_id);
    if (!claim) {
      return false; // Transient/unattached receipt without business entity is denied
    }

    if (isFinance) {
      return true;
    }

    if (claim.employee_id === currentEmpId || file.employee_id === currentEmpId) {
      return true;
    }
    return false;
  }

  if (bucketId === 'candidate-cvs') {
    const candidate = db.candidates.find((c) => c.cv_file_id === file.id || c.id === file.entity_id);
    if (!candidate) {
      return false; // Transient/unattached CV without candidate entity is denied
    }

    return isRecruiter;
  }

  if (bucketId === 'job-offers') {
    const offer = db.jobOffers.find((o) => o.offer_file_id === file.id || o.id === file.entity_id);
    if (!offer) {
      return false; // Transient/unattached offer document without job offer entity is denied
    }

    return isRecruiter;
  }

  return false;
}

describe('Strict Storage Metadata Read Authorization & Business Linking Test Suite', () => {
  const defaultDb: DatabaseState = {
    fileObjects: [],
    companyDocuments: [],
    employeeDocuments: [],
    expenseClaims: [],
    candidates: [],
    jobOffers: [],
  };

  const normalEmployeeCtx: StorageAccessContext = {
    userId: 'user-emp-1',
    employeeId: 'emp-1',
    userRoles: ['employee'],
    employeeDepartmentId: 'dept-eng',
    employeeSubsidiaryId: 'sub-sa',
  };

  const hrManagerCtx: StorageAccessContext = {
    userId: 'user-hr-1',
    employeeId: 'emp-hr-1',
    userRoles: ['hr_manager'],
    employeeDepartmentId: 'dept-hr',
    employeeSubsidiaryId: 'sub-sa',
  };

  const financeOfficerCtx: StorageAccessContext = {
    userId: 'user-fin-1',
    employeeId: 'emp-fin-1',
    userRoles: ['finance_officer'],
  };

  const recruiterCtx: StorageAccessContext = {
    userId: 'user-rec-1',
    employeeId: 'emp-rec-1',
    userRoles: ['recruiter'],
  };

  describe('1. Missing file_objects Metadata (Task 1)', () => {
    it('denies SELECT when file_objects metadata is missing even if object path is known', () => {
      const allowed = simulateCanAccessStorageObject(
        'employee-documents',
        'employees/emp-1/doc-1/token_passport.pdf',
        normalEmployeeCtx,
        defaultDb
      );
      expect(allowed).toBe(false);
    });

    it('denies SELECT for company-documents when metadata is missing', () => {
      const allowed = simulateCanAccessStorageObject(
        'company-documents',
        'company/policies/token_handbook.pdf',
        normalEmployeeCtx,
        defaultDb
      );
      expect(allowed).toBe(false);
    });

    it('denies SELECT for expense-receipts when metadata is missing even for own employee path', () => {
      const allowed = simulateCanAccessStorageObject(
        'expense-receipts',
        'expenses/emp-1/claim-1/token_receipt.png',
        normalEmployeeCtx,
        defaultDb
      );
      expect(allowed).toBe(false);
    });
  });

  describe('2. Unattached / Transient Objects Without Business Entities (Task 3)', () => {
    it('denies Candidate CV access if Candidate entity relationship does not exist', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-cv-1',
            bucket_id: 'candidate-cvs',
            object_path: 'candidates/cand-1/token_cv.pdf',
            status: 'active',
            entity_id: 'cand-1',
          },
        ],
        candidates: [], // Missing business entity!
      };

      // Even a recruiter cannot access unattached CVs
      const allowed = simulateCanAccessStorageObject(
        'candidate-cvs',
        'candidates/cand-1/token_cv.pdf',
        recruiterCtx,
        db
      );
      expect(allowed).toBe(false);
    });

    it('denies Job Offer access if Job Offer entity relationship does not exist', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-offer-1',
            bucket_id: 'job-offers',
            object_path: 'offers/cand-1/offer-1/token_offer.pdf',
            status: 'active',
            entity_id: 'offer-1',
          },
        ],
        jobOffers: [], // Missing business entity!
      };

      const allowed = simulateCanAccessStorageObject(
        'job-offers',
        'offers/cand-1/offer-1/token_offer.pdf',
        recruiterCtx,
        db
      );
      expect(allowed).toBe(false);
    });

    it('denies Expense Claim receipt access if Expense Claim entity does not exist', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-rec-1',
            bucket_id: 'expense-receipts',
            object_path: 'expenses/emp-1/exp-1/token_receipt.png',
            status: 'active',
            entity_id: 'exp-1',
            employee_id: 'emp-1',
          },
        ],
        expenseClaims: [], // Missing business entity!
      };

      // Neither claimant nor finance officer can access
      expect(
        simulateCanAccessStorageObject('expense-receipts', 'expenses/emp-1/exp-1/token_receipt.png', normalEmployeeCtx, db)
      ).toBe(false);

      expect(
        simulateCanAccessStorageObject('expense-receipts', 'expenses/emp-1/exp-1/token_receipt.png', financeOfficerCtx, db)
      ).toBe(false);
    });

    it('denies Employee Document access if employee_documents row is missing', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-doc-1',
            bucket_id: 'employee-documents',
            object_path: 'employees/emp-1/doc-1/token_id.pdf',
            status: 'active',
            entity_id: 'doc-1',
            employee_id: 'emp-1',
          },
        ],
        employeeDocuments: [], // Missing business entity!
      };

      expect(
        simulateCanAccessStorageObject('employee-documents', 'employees/emp-1/doc-1/token_id.pdf', normalEmployeeCtx, db)
      ).toBe(false);
    });
  });

  describe('3. Employee Document Visibility & Confidentiality (Task 6)', () => {
    it('allows owner employee access to valid employee-visible document', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-emp-doc-1',
            bucket_id: 'employee-documents',
            object_path: 'employees/emp-1/doc-1/v1_token_id.pdf',
            status: 'active',
            entity_id: 'doc-1',
            employee_id: 'emp-1',
          },
        ],
        employeeDocuments: [
          {
            id: 'doc-1',
            file_id: 'file-emp-doc-1',
            employee_id: 'emp-1',
            status: 'valid',
            visibility: 'all',
            confidentiality: 'internal',
          },
        ],
      };

      const allowed = simulateCanAccessStorageObject(
        'employee-documents',
        'employees/emp-1/doc-1/v1_token_id.pdf',
        normalEmployeeCtx,
        db
      );
      expect(allowed).toBe(true);
    });

    it('denies owner employee access to strictly confidential or hr-only document', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-emp-doc-secret',
            bucket_id: 'employee-documents',
            object_path: 'employees/emp-1/doc-secret/v1_investigation.pdf',
            status: 'active',
            entity_id: 'doc-secret',
            employee_id: 'emp-1',
          },
        ],
        employeeDocuments: [
          {
            id: 'doc-secret',
            file_id: 'file-emp-doc-secret',
            employee_id: 'emp-1',
            status: 'valid',
            visibility: 'hr_only',
            confidentiality: 'strictly_confidential',
          },
        ],
      };

      // Owner employee is denied
      expect(
        simulateCanAccessStorageObject(
          'employee-documents',
          'employees/emp-1/doc-secret/v1_investigation.pdf',
          normalEmployeeCtx,
          db
        )
      ).toBe(false);

      // HR manager has full access
      expect(
        simulateCanAccessStorageObject(
          'employee-documents',
          'employees/emp-1/doc-secret/v1_investigation.pdf',
          hrManagerCtx,
          db
        )
      ).toBe(true);
    });

    it('denies owner employee access to archived or inactive employee documents', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-emp-doc-old',
            bucket_id: 'employee-documents',
            object_path: 'employees/emp-1/doc-old/v1_old_iqama.pdf',
            status: 'active',
            entity_id: 'doc-old',
            employee_id: 'emp-1',
          },
        ],
        employeeDocuments: [
          {
            id: 'doc-old',
            file_id: 'file-emp-doc-old',
            employee_id: 'emp-1',
            status: 'archived',
            visibility: 'all',
            confidentiality: 'normal',
          },
        ],
      };

      expect(
        simulateCanAccessStorageObject(
          'employee-documents',
          'employees/emp-1/doc-old/v1_old_iqama.pdf',
          normalEmployeeCtx,
          db
        )
      ).toBe(false);

      // HR manager retains historical audit access
      expect(
        simulateCanAccessStorageObject(
          'employee-documents',
          'employees/emp-1/doc-old/v1_old_iqama.pdf',
          hrManagerCtx,
          db
        )
      ).toBe(true);
    });
  });

  describe('4. Company Document Scope Verification (Task 5)', () => {
    it('allows all authenticated employees to access company-documents with visibility_scope = "all"', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-comp-1',
            bucket_id: 'company-documents',
            object_path: 'company/policies/token_handbook.pdf',
            status: 'active',
            entity_id: 'comp-doc-1',
          },
        ],
        companyDocuments: [
          {
            id: 'comp-doc-1',
            file_id: 'file-comp-1',
            status: 'active',
            visibility_scope: 'all',
          },
        ],
      };

      const allowed = simulateCanAccessStorageObject(
        'company-documents',
        'company/policies/token_handbook.pdf',
        normalEmployeeCtx,
        db
      );
      expect(allowed).toBe(true);
    });

    it('enforces department scope strictly on company documents', () => {
      const db: DatabaseState = {
        ...defaultDb,
        fileObjects: [
          {
            id: 'file-comp-dept',
            bucket_id: 'company-documents',
            object_path: 'company/policies/token_engineering_guidelines.pdf',
            status: 'active',
            entity_id: 'comp-doc-dept',
          },
        ],
        companyDocuments: [
          {
            id: 'comp-doc-dept',
            file_id: 'file-comp-dept',
            status: 'active',
            visibility_scope: 'department',
            department_id: 'dept-eng',
          },
        ],
      };

      // Employee in 'dept-eng' has access
      expect(
        simulateCanAccessStorageObject(
          'company-documents',
          'company/policies/token_engineering_guidelines.pdf',
          normalEmployeeCtx,
          db
        )
      ).toBe(true);

      // Employee in other department is denied
      const salesEmpCtx: StorageAccessContext = {
        ...normalEmployeeCtx,
        employeeDepartmentId: 'dept-sales',
      };
      expect(
        simulateCanAccessStorageObject(
          'company-documents',
          'company/policies/token_engineering_guidelines.pdf',
          salesEmpCtx,
          db
        )
      ).toBe(false);
    });
  });

  describe('5. Status Enforcement & Privilege Preservation (Tasks 4 & 7)', () => {
    it('strictly denies quarantined, deleted, or orphaned files even to HR and admins', () => {
      ['deleted', 'quarantined', 'orphaned', 'cleanup_failed'].forEach((blockedStatus) => {
        const db: DatabaseState = {
          ...defaultDb,
          fileObjects: [
            {
              id: `file-${blockedStatus}`,
              bucket_id: 'employee-documents',
              object_path: `employees/emp-1/doc-1/token_${blockedStatus}.pdf`,
              status: blockedStatus,
              entity_id: 'doc-1',
            },
          ],
          employeeDocuments: [
            {
              id: 'doc-1',
              file_id: `file-${blockedStatus}`,
              employee_id: 'emp-1',
              status: 'valid',
              visibility: 'all',
              confidentiality: 'normal',
            },
          ],
        };

        expect(
          simulateCanAccessStorageObject(
            'employee-documents',
            `employees/emp-1/doc-1/token_${blockedStatus}.pdf`,
            hrManagerCtx,
            db
          )
        ).toBe(false);
      });
    });

    it('allows service_role to bypass all checks for background maintenance', () => {
      const allowed = simulateCanAccessStorageObject(
        'employee-documents',
        'arbitrary/path/without/metadata.pdf',
        { role: 'service_role' },
        defaultDb
      );
      expect(allowed).toBe(true);
    });
  });

  describe('6. Anti-Regression Migration Contract Test (Tasks 8 & 9)', () => {
    const migrationFile = path.resolve(
      process.cwd(),
      'supabase/migrations/20260914070000_restore_strict_storage_metadata_read_authorization.sql'
    );

    it('verifies the append-only migration exists', () => {
      expect(fs.existsSync(migrationFile)).toBe(true);
    });

    it('prohibits path-based SELECT fallback in the migration definition', () => {
      const sql = fs.readFileSync(migrationFile, 'utf8');

      // 1. Must NOT contain employee path prefix fallback
      expect(sql).not.toMatch(/p_object_name\s+LIKE\s+'employees\/'/i);

      // 2. Must NOT contain expense path prefix fallback
      expect(sql).not.toMatch(/p_object_name\s+LIKE\s+'expenses\/'/i);

      // 3. Must NOT grant unconditional company-documents access
      expect(sql).not.toMatch(/p_bucket_id\s*=\s*'company-documents'\s*THEN\s*RETURN\s+true/i);

      // 4. Must strictly enforce IF NOT FOUND THEN RETURN false after querying file_objects
      expect(sql).toContain('SELECT * INTO v_file');
      expect(sql).toContain('FROM public.file_objects');
      expect(sql).toContain('IF NOT FOUND THEN');
      expect(sql).toContain('RETURN false;');

      // 5. Must require business entities for all 5 buckets
      expect(sql).toContain('SELECT * INTO v_comp_doc');
      expect(sql).toContain('FROM public.company_documents');
      expect(sql).toContain('SELECT * INTO v_emp_doc');
      expect(sql).toContain('FROM public.employee_documents');
      expect(sql).toContain('SELECT * INTO v_expense_claim');
      expect(sql).toContain('FROM public.expense_claims');
      expect(sql).toContain('SELECT * INTO v_candidate');
      expect(sql).toContain('FROM public.candidates');
      expect(sql).toContain('SELECT * INTO v_job_offer');
      expect(sql).toContain('FROM public.job_offers');

      // 6. Must maintain SECURITY DEFINER and revoked PUBLIC access
      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain('SET search_path = public');
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.can_access_storage_object(text, text) FROM PUBLIC;');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO authenticated;');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.can_access_storage_object(text, text) TO service_role;');
    });

    it('verifies storage.objects INSERT policies remain independent and functional without can_access_storage_object', () => {
      const initialMigration = path.resolve(
        process.cwd(),
        'supabase/migrations/20260914040000_secure_storage_and_file_objects.sql'
      );
      const sql = fs.readFileSync(initialMigration, 'utf8');

      // INSERT policies must NOT depend on can_access_storage_object (which requires pre-existing metadata)
      const insertPolicies = sql.match(/CREATE\s+POLICY\s+"storage_[^"]+_insert"[\s\S]+?WITH\s+CHECK\s*\([\s\S]+?\);/gi) || [];
      expect(insertPolicies.length).toBeGreaterThanOrEqual(4);

      insertPolicies.forEach((policy) => {
        expect(policy).not.toContain('can_access_storage_object');
      });
    });
  });
});
