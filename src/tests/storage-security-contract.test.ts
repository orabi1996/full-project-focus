import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  BUCKET_VALIDATION_RULES,
  FORBIDDEN_EXTENSIONS,
  assertSafePath,
  getFileExtension,
  sanitizeFilename,
  validateStorageFile,
} from '../lib/storage/storage-validation';
import {
  buildCandidateCvPath,
  buildCompanyDocumentPath,
  buildEmployeeDocumentPath,
  buildExpenseReceiptPath,
  buildJobOfferPath,
} from '../lib/storage/storage-paths';
import {
  createSignedDownloadUrl,
  isStorageInDemoMode,
  setStorageDemoMode,
  uploadSecureFile,
} from '../lib/storage/storage-service';
import { supabase } from '../integrations/supabase/client';

describe('Supabase Storage & Secure File Management Security Contract', () => {
  beforeEach(() => {
    setStorageDemoMode(true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setStorageDemoMode(null);
  });

  describe('1. Validation & Anti-Traversal Tests', () => {
    it('rejects empty (0 byte) files', () => {
      const result = validateStorageFile('employee-documents', {
        name: 'iqama.pdf',
        size: 0,
        type: 'application/pdf',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('فارغ');
    });

    it('rejects oversized files beyond bucket limit', () => {
      const max15MB = 15 * 1024 * 1024;
      const result = validateStorageFile('employee-documents', {
        name: 'heavy_document.pdf',
        size: max15MB + 1,
        type: 'application/pdf',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('الحد الأقصى');
    });

    it('accepts valid PDF within size limit for employee-documents', () => {
      const result = validateStorageFile('employee-documents', {
        name: 'contract_signed.pdf',
        size: 2 * 1024 * 1024,
        type: 'application/pdf',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts valid images (PNG, JPG, WebP) for expense-receipts', () => {
      for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
        const result = validateStorageFile('expense-receipts', {
          name: `receipt_sample${ext}`,
          size: 500 * 1024,
        });
        expect(result.valid).toBe(true);
      }
    });

    it('blocks dangerous executable and script file extensions', () => {
      const dangerousNames = [
        'script.exe',
        'exploit.sh',
        'payload.bat',
        'attack.ps1',
        'malware.vbs',
        'xss.svg',
        'index.html',
        'bundle.js',
        'archive.apk',
        'shell.php',
      ];

      for (const filename of dangerousNames) {
        const ext = getFileExtension(filename);
        expect(FORBIDDEN_EXTENSIONS.has(ext)).toBe(true);

        const result = validateStorageFile('employee-documents', {
          name: filename,
          size: 1024,
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('محظور لأسباب أمنية');
      }
    });

    it('sanitizes malicious filenames and directory traversal sequences', () => {
      expect(sanitizeFilename('../../etc/passwd.pdf')).toBe('passwd.pdf');
      expect(sanitizeFilename('..\\..\\windows\\system32.pdf')).toBe('system32.pdf');
      expect(sanitizeFilename('test\0nullbyte.pdf')).toBe('testnullbyte.pdf');
      expect(sanitizeFilename('عقد عمل الموظف (نسخة نهائية).pdf')).toContain('عقد_عمل_الموظف');
    });

    it('assertSafePath rejects traversal vectors, null bytes, and leading slashes', () => {
      expect(() => assertSafePath('/employees/123/doc.pdf')).toThrow('leading slash');
      expect(() => assertSafePath('employees/../123/doc.pdf')).toThrow('Path traversal sequence');
      expect(() => assertSafePath('employees//123/doc.pdf')).toThrow('redundant separators');
      expect(() => assertSafePath('employees/123/\0doc.pdf')).toThrow('null bytes');
      expect(() => assertSafePath('employees/123/doc.pdf')).not.toThrow();
    });
  });

  describe('2. Deterministic Storage Paths', () => {
    it('generates secure deterministic path for employee documents', () => {
      const path = buildEmployeeDocumentPath({
        employeeId: 'emp-uuid-1',
        documentId: 'doc-uuid-2',
        filename: 'national_id.pdf',
        version: 1,
      });
      expect(path).toMatch(/^employees\/emp-uuid-1\/doc-uuid-2\/v1_[a-z0-9]+_national_id\.pdf$/);
    });

    it('generates secure deterministic path for company documents', () => {
      const path = buildCompanyDocumentPath({
        documentId: 'doc-uuid-10',
        filename: 'Internal Bylaws 2026.pdf',
        version: 2,
      });
      expect(path).toMatch(/^company\/doc-uuid-10\/v2_[a-z0-9]+_Internal_Bylaws_2026\.pdf$/);
    });

    it('generates secure deterministic path for expense receipts', () => {
      const path = buildExpenseReceiptPath({
        employeeId: 'emp-uuid-3',
        expenseId: 'exp-uuid-4',
        filename: 'taxi_receipt.png',
      });
      expect(path).toMatch(/^expenses\/emp-uuid-3\/exp-uuid-4\/[a-z0-9]+_taxi_receipt\.png$/);
    });

    it('generates secure deterministic path for candidate CVs', () => {
      const path = buildCandidateCvPath({
        candidateId: 'cand-uuid-5',
        filename: 'Resume_Software_Engineer.pdf',
      });
      expect(path).toMatch(/^candidates\/cand-uuid-5\/[a-z0-9]+_Resume_Software_Engineer\.pdf$/);
    });

    it('generates secure deterministic path for job offers', () => {
      const path = buildJobOfferPath({
        candidateId: 'cand-uuid-5',
        offerId: 'offer-uuid-6',
        filename: 'Job_Offer_Official.pdf',
      });
      expect(path).toMatch(/^offers\/cand-uuid-5\/offer-uuid-6\/[a-z0-9]+_Job_Offer_Official\.pdf$/);
    });
  });

  describe('3. Safe Orphan Cleanup on DB Failure', () => {
    it('cleans up uploaded storage object if metadata registration in DB fails', async () => {
      setStorageDemoMode(false);

      const removeSpy = vi.fn().mockResolvedValue({ data: null, error: null });
      const uploadSpy = vi.fn().mockResolvedValue({ data: { path: 'test/path.pdf' }, error: null });

      const fromStorageMock = vi.spyOn(supabase.storage, 'from').mockReturnValue({
        upload: uploadSpy,
        remove: removeSpy,
        createSignedUrl: vi.fn(),
      } as any);

      const fromDbMock = vi.spyOn(supabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB connection timeout' },
            }),
          }),
        }),
      } as any);

      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'usr-1' } as any },
        error: null,
      });

      const fakeFile = new File(['mock content'], 'test_contract.pdf', {
        type: 'application/pdf',
      });

      await expect(
        uploadSecureFile({
          bucket: 'employee-documents',
          objectPath: 'employees/emp-1/doc-1/v1_token_test_contract.pdf',
          file: fakeFile,
          originalFilename: 'test_contract.pdf',
          entityType: 'employee_document',
          employeeId: 'emp-1',
        })
      ).rejects.toThrow('فشل تسجيل بيانات الملف في قاعدة البيانات');

      // Assert that rollback occurred: storage remove was called with the exact uploaded path!
      expect(removeSpy).toHaveBeenCalledWith(['employees/emp-1/doc-1/v1_token_test_contract.pdf']);

      fromStorageMock.mockRestore();
      fromDbMock.mockRestore();
    });
  });

  describe('4. Demo Mode Isolation', () => {
    it('executes in-memory mock upload without touching Supabase Storage in demo mode', async () => {
      setStorageDemoMode(true);
      expect(isStorageInDemoMode()).toBe(true);

      const storageSpy = vi.spyOn(supabase.storage, 'from');

      const fakeFile = new File(['demo file content'], 'demo_cv.pdf', {
        type: 'application/pdf',
      });

      const result = await uploadSecureFile({
        bucket: 'candidate-cvs',
        objectPath: 'candidates/cand-1/token_demo_cv.pdf',
        file: fakeFile,
        originalFilename: 'demo_cv.pdf',
        entityType: 'candidate',
      });

      expect(result.id).toContain('demo-file-');
      expect(result.bucket_id).toBe('candidate-cvs');
      expect(result.status).toBe('active');
      expect(storageSpy).not.toHaveBeenCalled();
    });

    it('generates mock signed URL in demo mode without network requests', async () => {
      setStorageDemoMode(true);

      const storageSpy = vi.spyOn(supabase.storage, 'from');
      const result = await createSignedDownloadUrl(
        'expense-receipts',
        'expenses/emp-1/exp-1/receipt.png'
      );

      expect(result.signedUrl).toContain('demo-storage.local');
      expect(result.signedUrl).toContain('mock-demo-hmac-signed-token');
      expect(storageSpy).not.toHaveBeenCalled();
    });
  });

  describe('5. Database Migration & Schema Invariants', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20260914040000_secure_storage_and_file_objects.sql'
    );

    it('contains the append-only storage migration file', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('creates all 5 buckets as private (public = false)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain("'employee-documents'");
      expect(sql).toContain("'company-documents'");
      expect(sql).toContain("'expense-receipts'");
      expect(sql).toContain("'candidate-cvs'");
      expect(sql).toContain("'job-offers'");

      // Verify no bucket is marked public
      const publicMatches = sql.match(/public\s*=\s*true/gi);
      expect(publicMatches).toBeNull();
    });

    it('has zero over-permissive USING (true) or WITH CHECK (true) policies', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
      expect(sql).not.toMatch(/WITH\s+CHECK\s*\(\s*true\s*\)/i);
    });

    it('enforces can_access_storage_object validator on storage.objects', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('can_access_storage_object');
      expect(sql).toContain('log_file_download_access');
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    });

    it('adds file_id foreign keys to business domain tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('ALTER TABLE public.employee_documents');
      expect(sql).toContain('ALTER TABLE public.company_documents');
      expect(sql).toContain('ALTER TABLE public.expense_claims');
      expect(sql).toContain('ALTER TABLE public.candidates');
      expect(sql).toContain('ALTER TABLE public.job_offers');
      expect(sql).toContain('file_id uuid REFERENCES public.file_objects(id)');
      expect(sql).toContain('receipt_file_id uuid REFERENCES public.file_objects(id)');
      expect(sql).toContain('cv_file_id uuid REFERENCES public.file_objects(id)');
      expect(sql).toContain('offer_file_id uuid REFERENCES public.file_objects(id)');
    });
  });
});
