/**
 * Production Supabase Storage & Secure File Management Types
 */

export type StorageBucket =
  | 'employee-documents'
  | 'company-documents'
  | 'expense-receipts'
  | 'candidate-cvs'
  | 'job-offers';

export type FileStatus =
  | 'active'
  | 'archived'
  | 'deleted'
  | 'quarantined'
  | 'orphaned'
  | 'cleanup_failed';

export type MalwareStatus =
  | 'unscanned'
  | 'pending_scan'
  | 'clean'
  | 'quarantined'
  | 'scan_failed';

export interface RollbackFileOptions {
  bucket?: StorageBucket;
  objectPath?: string;
  fileId?: string;
  reason?: string;
}

export interface FileObject {
  id: string;
  bucket_id: StorageBucket;
  object_path: string;
  original_filename: string;
  safe_filename: string;
  content_type: string;
  size_bytes: number;
  checksum_sha256?: string | null;
  entity_type: string;
  entity_id?: string | null;
  employee_id?: string | null;
  company_id?: string | null;
  uploaded_by?: string | null;
  uploaded_at: string;
  status: FileStatus;
  version: number;
  replaces_file_id?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  malware_status: MalwareStatus;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface UploadFileOptions {
  bucket: StorageBucket;
  objectPath: string;
  file: File | Blob;
  originalFilename: string;
  contentType?: string;
  entityType: string;
  entityId?: string;
  employeeId?: string;
  companyId?: string;
  version?: number;
  replacesFileId?: string;
  metadata?: Record<string, unknown>;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
  download?: boolean | string;
  trackAudit?: boolean;
}

export interface SignedUrlResult {
  signedUrl: string;
  expiresIn: number;
  expiresAt: number;
  fileId?: string;
  filename: string;
}

export interface StorageValidationRule {
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
}

export interface StorageValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename: string;
}
