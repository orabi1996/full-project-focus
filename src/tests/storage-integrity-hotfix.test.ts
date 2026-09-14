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
  setStorageDemoMode,
  demoFileCatalog,
} from '../lib/storage/storage-service';
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
});
