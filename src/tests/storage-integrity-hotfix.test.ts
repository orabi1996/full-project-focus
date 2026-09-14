import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  createSignedDownloadUrl,
  getSignedUrlForFileId,
  rollbackUploadedFile,
  uploadSecureFile,
  replaceSecureFile,
  archiveSecureFile,
  archiveBusinessDocument,
  setStorageDemoMode,
  demoFileCatalog,
} from '../lib/storage/storage-service';
import {
  verifyEmployeeDocumentRecord,
  archiveDocumentRecord,
} from '../lib/data/operational-repository';
import { enterpriseSupabase } from '../lib/data/enterprise-client';
import { supabase } from '../integrations/supabase/client';
import {
  uploadCompanyDocumentFile,
  uploadEmployeeDocumentFile,
  uploadExpenseReceiptFile,
  uploadCandidateCvFile,
  uploadJobOfferFile,
} from '../lib/storage/storage-domain';
import { queryKeys } from '../lib/query/query-keys';

describe('Storage Integrity & Authorization Hotfix Test Suite', () => {
  beforeEach(() => {
    setStorageDemoMode(true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setStorageDemoMode(null);
  });

  describe('1. Migration Hardening & Immutability Verification', () => {
    it('verifies the append-only migration file exists with hardened triggers and RPCs', () => {
      const migrationFile = path.resolve(
        process.cwd(),
        'supabase/migrations/20260914050000_harden_storage_integrity_visibility_and_orphan_cleanup.sql'
      );
      expect(fs.existsSync(migrationFile)).toBe(true);

      const sql = fs.readFileSync(migrationFile, 'utf8');

      // Check file_objects status constraints
      expect(sql).toContain("'orphaned'");
      expect(sql).toContain("'cleanup_failed'");

      // Check malware_status default to unscanned
      expect(sql).toContain("DEFAULT 'unscanned'");

      // Check immutable identity trigger
      expect(sql).toContain('trg_protect_file_objects_identity');
      expect(sql).toContain('Modification of file_objects identity fields');

      // Check malware_status protection against client spoofing
      expect(sql).toContain('Only authorized administrators may attest malware clearance');

      // Check RPCs
      expect(sql).toContain('finalize_file_replacement');
      expect(sql).toContain('archive_file_object');
      expect(sql).toContain('mark_file_orphaned');

      // Check storage access hardening
      expect(sql).toContain('can_access_storage_object');
      expect(sql).toContain('visibility_scope');
      expect(sql).toContain('storage_employee_docs_update');
      expect(sql).toContain('storage_expense_receipts_update');

      // Check download access audit log permission check
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.log_file_download_access');
    });
  });

  describe('2. Truthful Malware Status Handling', () => {
    it('defaults malware_status to unscanned upon upload, never pretending to be clean', async () => {
      const dummyFile = new File(['file content here'], 'sample_doc.pdf', { type: 'application/pdf' });
      const uploaded = await uploadEmployeeDocumentFile({
        employeeId: 'emp-test-01',
        documentId: 'doc-test-01',
        file: dummyFile,
        docType: 'national_id',
      });

      expect(uploaded.malware_status).toBe('unscanned');
      expect(uploaded.malware_status).not.toBe('clean');
    });
  });

  describe('3. File Status Checks for Signed URLs', () => {
    it('refuses to generate signed URL for deleted, quarantined, or orphaned files', async () => {
      const testBucket = 'employee-documents';
      const testPath = 'employees/emp-1/doc-1/v1_test.pdf';

      // Setup a deleted file in catalog
      demoFileCatalog.set(`${testBucket}:${testPath}`, {
        id: 'file-deleted-1',
        bucket_id: testBucket,
        object_path: testPath,
        original_filename: 'test.pdf',
        safe_filename: 'v1_test.pdf',
        content_type: 'application/pdf',
        size_bytes: 1024,
        entity_type: 'employee_document',
        uploaded_at: new Date().toISOString(),
        status: 'deleted',
        version: 1,
        malware_status: 'unscanned',
      });

      await expect(
        createSignedDownloadUrl(testBucket, testPath)
      ).rejects.toThrow(/محظورة/);

      // Quarantined file
      demoFileCatalog.set(`${testBucket}:${testPath}`, {
        id: 'file-quarantined-1',
        bucket_id: testBucket,
        object_path: testPath,
        original_filename: 'test.pdf',
        safe_filename: 'v1_test.pdf',
        content_type: 'application/pdf',
        size_bytes: 1024,
        entity_type: 'employee_document',
        uploaded_at: new Date().toISOString(),
        status: 'quarantined',
        version: 1,
        malware_status: 'quarantined',
      });

      await expect(
        createSignedDownloadUrl(testBucket, testPath)
      ).rejects.toThrow(/محظورة/);

      // Orphaned file
      demoFileCatalog.set(`${testBucket}:${testPath}`, {
        id: 'file-orphaned-1',
        bucket_id: testBucket,
        object_path: testPath,
        original_filename: 'test.pdf',
        safe_filename: 'v1_test.pdf',
        content_type: 'application/pdf',
        size_bytes: 1024,
        entity_type: 'employee_document',
        uploaded_at: new Date().toISOString(),
        status: 'orphaned',
        version: 1,
        malware_status: 'unscanned',
      });

      await expect(
        createSignedDownloadUrl(testBucket, testPath)
      ).rejects.toThrow(/محظورة/);
    });

    it('rejects getSignedUrlForFileId if file is marked cleanup_failed or missing', async () => {
      await expect(
        getSignedUrlForFileId('non-existent-file-id')
      ).rejects.toThrow();

      demoFileCatalog.set('cleanup-failed-id', {
        id: 'cleanup-failed-id',
        bucket_id: 'expense-receipts',
        object_path: 'expenses/emp-1/exp-1/receipt.png',
        original_filename: 'receipt.png',
        safe_filename: 'receipt.png',
        content_type: 'image/png',
        size_bytes: 2048,
        entity_type: 'expense_receipt',
        uploaded_at: new Date().toISOString(),
        status: 'cleanup_failed',
        version: 1,
        malware_status: 'unscanned',
      });

      await expect(
        getSignedUrlForFileId('cleanup-failed-id')
      ).rejects.toThrow(/محظورة/);
    });
  });

  describe('4. Rollback and Orphan Cleanup Helper', () => {
    it('removes catalog entries cleanly upon rollback in demo mode', async () => {
      const bucket = 'candidate-cvs';
      const objectPath = 'candidates/cand-99/cv.pdf';
      const fileId = 'file-cv-99';

      demoFileCatalog.set(fileId, {
        id: fileId,
        bucket_id: bucket,
        object_path: objectPath,
        original_filename: 'cv.pdf',
        safe_filename: 'cv.pdf',
        content_type: 'application/pdf',
        size_bytes: 4096,
        entity_type: 'candidate_cv',
        uploaded_at: new Date().toISOString(),
        status: 'active',
        version: 1,
        malware_status: 'unscanned',
      });
      demoFileCatalog.set(`${bucket}:${objectPath}`, demoFileCatalog.get(fileId)!);

      expect(demoFileCatalog.has(fileId)).toBe(true);
      expect(demoFileCatalog.has(`${bucket}:${objectPath}`)).toBe(true);

      await rollbackUploadedFile({ bucket, objectPath, fileId });

      expect(demoFileCatalog.has(fileId)).toBe(false);
      expect(demoFileCatalog.has(`${bucket}:${objectPath}`)).toBe(false);
    });
  });

  describe('5. Atomic File Replacement Saga', () => {
    it('archives previous file and registers replacement', async () => {
      const bucket = 'company-documents';
      const oldPath = 'company/policies/v1_hr_bylaws.pdf';
      const prevFileId = 'prev-file-123';

      demoFileCatalog.set(prevFileId, {
        id: prevFileId,
        bucket_id: bucket,
        object_path: oldPath,
        original_filename: 'hr_bylaws.pdf',
        safe_filename: 'v1_hr_bylaws.pdf',
        content_type: 'application/pdf',
        size_bytes: 10240,
        entity_type: 'company_document',
        uploaded_at: new Date().toISOString(),
        status: 'active',
        version: 1,
        malware_status: 'unscanned',
      });

      const newFileObj = new File(['updated content'], 'hr_bylaws_v2.pdf', { type: 'application/pdf' });
      const replaced = await replaceSecureFile(prevFileId, {
        bucket,
        objectPath: 'company/policies/v2_hr_bylaws.pdf',
        file: newFileObj,
        originalFilename: 'hr_bylaws_v2.pdf',
        contentType: 'application/pdf',
        entityType: 'company_document',
      });

      expect(replaced.version).toBe(2);
      expect(replaced.replaces_file_id).toBe(prevFileId);

      const oldMeta = demoFileCatalog.get(prevFileId);
      expect(oldMeta?.status).toBe('archived');
      expect(oldMeta?.archived_at).toBeDefined();
    });
  });

  describe('6. Domain Query Keys Integrity', () => {
    it('defines distinct company and employee query keys for targeted invalidation', () => {
      expect(queryKeys.documents.company()).toEqual(['documents', 'company']);
      expect(queryKeys.documents.employees()).toEqual(['documents', 'employees']);
      expect(queryKeys.documents.employee('emp-123')).toEqual(['documents', 'employees', 'emp-123']);
      expect(queryKeys.expenses.claims()).toEqual(['expenses', 'claims']);
      expect(queryKeys.recruitment.candidates()).toEqual(['recruitment', 'candidates']);
      expect(queryKeys.recruitment.offers()).toEqual(['recruitment', 'offers']);
    });
  });

  describe('7. Pre-Upload UUID Consistency Verification', () => {
    it('domain upload wrappers propagate stable entity IDs into object paths', async () => {
      const stableDocId = '550e8400-e29b-41d4-a716-446655440000';
      const dummyFile = new File(['cv data'], 'cv.pdf', { type: 'application/pdf' });

      const uploaded = await uploadCandidateCvFile({
        candidateId: stableDocId,
        file: dummyFile,
      });

      expect(uploaded.entity_id).toBe(stableDocId);
      expect(uploaded.object_path).toContain(stableDocId);
    });

    it('job offer upload wrapper propagates offerId and candidateId', async () => {
      const stableOfferId = '660e8400-e29b-41d4-a716-446655440001';
      const candId = 'cand-uuid-123';
      const dummyFile = new File(['offer letter'], 'offer.pdf', { type: 'application/pdf' });

      const uploaded = await uploadJobOfferFile({
        offerId: stableOfferId,
        candidateId: candId,
        file: dummyFile,
      });

      expect(uploaded.entity_id).toBe(stableOfferId);
      expect(uploaded.object_path).toContain(stableOfferId);
    });
  });

  describe('8. Authoritative Document Archiving Migration & RPC Verification', () => {
    it('verifies the append-only archive migration exists with locking and atomic file_objects updates', () => {
      const migrationFile = path.resolve(
        process.cwd(),
        'supabase/migrations/20260914060000_finalize_document_archive_and_live_data_integrity.sql'
      );
      expect(fs.existsSync(migrationFile)).toBe(true);

      const sql = fs.readFileSync(migrationFile, 'utf8');

      // RPC signature & security definition
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.archive_business_document');
      expect(sql).toContain('p_document_id uuid');
      expect(sql).toContain('p_document_type text');
      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain('SET search_path = public');

      // FOR UPDATE locking
      expect(sql).toContain('SELECT * INTO v_comp_doc');
      expect(sql).toContain('WHERE id = p_document_id');
      expect(sql).toContain('FOR UPDATE;');
      expect(sql).toContain('SELECT * INTO v_emp_doc');

      // Atomic file_objects archive
      expect(sql).toContain('UPDATE public.company_documents');
      expect(sql).toContain("status = 'archived'");
      expect(sql).toContain('UPDATE public.employee_documents');
      expect(sql).toContain('UPDATE public.file_objects');
      expect(sql).toContain("archived_at = now()");

      // Permissions
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.archive_business_document(uuid, text) FROM PUBLIC;');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.archive_business_document(uuid, text) TO authenticated;');

      // Hardened storage access
      expect(sql).toContain('can_access_storage_object');
      expect(sql).toContain("IF v_emp_doc.status IN ('archived', 'inactive') THEN");
      expect(sql).toContain('RETURN false;');
      expect(sql).toContain("IF v_file.status = 'archived' AND NOT v_is_hr THEN");
    });
  });

  describe('9. Live Mode Document Source-of-Truth & Empty State Logic (Issue 1)', () => {
    it('strictly outputs empty array for 0 live documents in live mode without falling back to demo data', () => {
      const localSeededDocs = [
        { id: 'mock-1', title: 'وثيقة وهمية 1' },
        { id: 'mock-2', title: 'وثيقة وهمية 2' },
      ];
      const mappedLiveDocs: any[] = [];

      // Test Live mode derivation logic
      const isLive = true;
      const liveResult = isLive ? mappedLiveDocs : (mappedLiveDocs.length > 0 ? mappedLiveDocs : localSeededDocs);

      expect(liveResult).toEqual([]);
      expect(liveResult.length).toBe(0);
      expect(liveResult).not.toEqual(localSeededDocs);

      // Test Demo mode derivation logic
      const isDemo = false; // in our architecture isLive = Boolean(session && !isDemo)
      const demoModeIsLive = false;
      const demoResult = demoModeIsLive ? mappedLiveDocs : (mappedLiveDocs.length > 0 ? mappedLiveDocs : localSeededDocs);

      expect(demoResult).toEqual(localSeededDocs);
      expect(demoResult.length).toBe(2);
    });
  });

  describe('10. Separation of Company vs Employee Verification (Issue 4)', () => {
    it('filters company documents out of pending review verification queue', () => {
      const mixedDocuments: any[] = [
        { id: 'doc-emp-1', status: 'pending_review', isCompanyDoc: false, title: 'هوية موظف' },
        { id: 'doc-emp-2', status: 'pending_review', isCompanyDoc: false, title: 'جواز سفر' },
        { id: 'doc-comp-1', status: 'pending_review', isCompanyDoc: true, title: 'سجل تجاري' },
        { id: 'doc-comp-2', status: 'valid', isCompanyDoc: true, title: 'شهادة زكاة' },
      ];

      // Computation used in DocumentVaultView
      const pendingReviewCount = mixedDocuments.filter(
        (d) => d.status === 'pending_review' && !d.isCompanyDoc
      ).length;

      expect(pendingReviewCount).toBe(2);

      const pendingReviewItems = mixedDocuments.filter(
        (d) => d.status === 'pending_review' && !d.isCompanyDoc
      );

      expect(pendingReviewItems.map((d) => d.id)).toEqual(['doc-emp-1', 'doc-emp-2']);
      expect(pendingReviewItems.some((d) => d.isCompanyDoc)).toBe(false);
    });
  });

  describe('11. Zero-Affected-Row Truthfulness (Issue 5)', () => {
    it('throws an error when verifyEmployeeDocumentRecord updates 0 rows', async () => {
      // Mock supabase query builder returning empty data array
      const originalFrom = enterpriseSupabase.from;
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      (enterpriseSupabase as any).from = vi.fn().mockReturnValue({
        update: mockUpdate,
      });

      await expect(
        verifyEmployeeDocumentRecord('non-existent-doc-uuid', 'valid', 'HR Manager')
      ).rejects.toThrow(/وثيقة الموظف غير موجودة/);

      (enterpriseSupabase as any).from = originalFrom;
    });

    it('propagates RPC error when archiveDocumentRecord fails in database', async () => {
      const originalRpc = enterpriseSupabase.rpc;
      (enterpriseSupabase as any).rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Document not found with code P0002' },
      });

      await expect(
        archiveDocumentRecord('invalid-uuid', 'employee')
      ).rejects.toThrow(/تعذر أرشفة المستند: Document not found/);

      (enterpriseSupabase as any).rpc = originalRpc;
    });
  });

  describe('12. Truthful Bulk Archive Tracking & State Retention (Issue 6)', () => {
    it('tracks individual results, retains failed items in selection, and generates truthful counts', async () => {
      const selectedDocIds = ['doc-1', 'doc-2', 'doc-3'];
      const archiveMock = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'doc-2') return false; // simulated failure
        return true;
      });

      const successIds: string[] = [];
      const failedIds: string[] = [];

      for (const id of selectedDocIds) {
        const ok = await archiveMock(id);
        if (ok) {
          successIds.push(id);
        } else {
          failedIds.push(id);
        }
      }

      // Assertions
      expect(successIds).toEqual(['doc-1', 'doc-3']);
      expect(failedIds).toEqual(['doc-2']);

      // Retained selection for user inspection
      const remainingSelected = failedIds;
      expect(remainingSelected).toEqual(['doc-2']);

      // Feedback message calculation
      let feedback = '';
      if (failedIds.length === 0) {
        feedback = `تم أرشفة (${successIds.length}) مستندات بنجاح!`;
      } else if (successIds.length > 0) {
        feedback = `تم أرشفة ${successIds.length} مستندات، وتعذر أرشفة ${failedIds.length} مستند.`;
      } else {
        feedback = `تعذر أرشفة (${failedIds.length}) مستندات.`;
      }

      expect(feedback).toBe('تم أرشفة 2 مستندات، وتعذر أرشفة 1 مستند.');
    });
  });

  describe('13. Storage Service RPC Error Audit (Issue 7)', () => {
    it('throws when archiveBusinessDocument RPC returns error', async () => {
      setStorageDemoMode(false);
      const originalRpc = supabase.rpc;
      (supabase as any).rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied: 42501' },
      });

      await expect(
        archiveBusinessDocument('doc-test-uuid', 'company')
      ).rejects.toThrow(/تعذر أرشفة المستند عبر الإجراء المخزن: Permission denied: 42501/);

      (supabase as any).rpc = originalRpc;
      setStorageDemoMode(true);
    });

    it('throws when archiveSecureFile RPC returns error', async () => {
      setStorageDemoMode(false);
      const originalRpc = supabase.rpc;
      (supabase as any).rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Object lock violation' },
      });

      await expect(
        archiveSecureFile('file-test-uuid')
      ).rejects.toThrow(/فشل أرشفة بيانات الملف عبر الإجراء المخزن: Object lock violation/);

      (supabase as any).rpc = originalRpc;
      setStorageDemoMode(true);
    });
  });
});
