/**
 * Production Supabase Storage - Core Storage Service
 *
 * Provides authenticated, private file operations:
 * - Validated upload with automatic orphan cleanup on metadata failure
 * - Short-lived HMAC signed URLs for private downloads
 * - File versioning and replacement
 * - Soft-delete and archive operations
 * - Complete Demo mode isolation
 */

import { supabase } from '../../integrations/supabase/client';
import { isDemoModeEnabled } from '../config/runtime-config';
import {
  FileObject,
  SignedUrlOptions,
  SignedUrlResult,
  StorageBucket,
  UploadFileOptions,
} from './storage-types';
import { assertSafePath, validateStorageFile } from './storage-validation';

// In-memory demo storage catalog for demo mode
const demoFileCatalog = new Map<string, FileObject>();
let forceDemoModeOverride: boolean | null = null;

export function setStorageDemoMode(override: boolean | null): void {
  forceDemoModeOverride = override;
}

export function isStorageInDemoMode(): boolean {
  if (forceDemoModeOverride !== null) {
    return forceDemoModeOverride;
  }
  return isDemoModeEnabled(
    import.meta.env["VITE_ENABLE_DEMO_MODE"],
    import.meta.env.PROD
  );
}

/**
 * Upload a file to a private Supabase Storage bucket with metadata registration
 * and orphan cleanup on database failure.
 */
export async function uploadSecureFile(options: UploadFileOptions): Promise<FileObject> {
  const {
    bucket,
    objectPath,
    file,
    originalFilename,
    contentType,
    entityType,
    entityId,
    employeeId,
    companyId,
    version = 1,
    replacesFileId,
    metadata = {},
  } = options;

  // 1. Path safety check
  assertSafePath(objectPath);

  // 2. Client-side file validation (size, MIME type, extension)
  const validation = validateStorageFile(bucket, {
    name: originalFilename,
    size: file.size,
    type: contentType || file.type,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'فشل التحقق من صحة الملف');
  }

  const safeFilename = validation.sanitizedFilename;
  const resolvedContentType = contentType || file.type || 'application/octet-stream';

  // 3. Demo Mode Isolation
  if (isStorageInDemoMode()) {
    const demoId = `demo-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const demoObject: FileObject = {
      id: demoId,
      bucket_id: bucket,
      object_path: objectPath,
      original_filename: originalFilename,
      safe_filename: safeFilename,
      content_type: resolvedContentType,
      size_bytes: file.size,
      checksum_sha256: null,
      entity_type: entityType,
      entity_id: entityId ?? null,
      employee_id: employeeId ?? null,
      company_id: companyId ?? null,
      uploaded_by: 'demo-user',
      uploaded_at: new Date().toISOString(),
      status: 'active',
      version,
      replaces_file_id: replacesFileId ?? null,
      archived_at: null,
      deleted_at: null,
      malware_status: 'clean',
      metadata,
    };
    demoFileCatalog.set(demoId, demoObject);
    demoFileCatalog.set(`${bucket}:${objectPath}`, demoObject);
    return demoObject;
  }

  // 4. Live Supabase Storage Upload
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, {
      contentType: resolvedContentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`فشل رفع الملف إلى التخزين السحابي: ${uploadError.message}`);
  }

  // 5. Register in authoritative public.file_objects table
  const { data: userAuth } = await supabase.auth.getUser();
  const userId = userAuth.user?.id ?? null;

  const { data: insertedRow, error: insertError } = await supabase
    .from('file_objects')
    .insert({
      bucket_id: bucket,
      object_path: objectPath,
      original_filename: originalFilename,
      safe_filename: safeFilename,
      content_type: resolvedContentType,
      size_bytes: file.size,
      entity_type: entityType,
      entity_id: entityId ?? null,
      employee_id: employeeId ?? null,
      company_id: companyId ?? null,
      uploaded_by: userId,
      version,
      replaces_file_id: replacesFileId ?? null,
      status: 'active',
      malware_status: 'clean',
      metadata: metadata as any,
    })
    .select()
    .single();

  // 6. SAFE ORPHAN MANAGEMENT: If DB insert fails, delete uploaded storage object immediately!
  if (insertError || !insertedRow) {
    console.error('Database metadata registration failed after storage upload. Rolling back uploaded file to prevent orphans.', insertError);
    try {
      await supabase.storage.from(bucket).remove([objectPath]);
    } catch (cleanupErr) {
      console.error('Failed to clean up orphaned storage object:', cleanupErr);
    }
    throw new Error(`فشل تسجيل بيانات الملف في قاعدة البيانات: ${insertError?.message || 'خطأ غير معروف'}`);
  }

  return insertedRow as unknown as FileObject;
}

/**
 * Generate a short-lived HMAC signed URL for secure private download/view.
 * Never generates public URLs for HR assets.
 */
export async function createSignedDownloadUrl(
  bucket: StorageBucket,
  objectPath: string,
  options?: SignedUrlOptions
): Promise<SignedUrlResult> {
  assertSafePath(objectPath);
  const expiresIn = options?.expiresInSeconds ?? 300; // 5 minutes default
  const expiresAt = Date.now() + expiresIn * 1000;
  const filename = objectPath.split('/').pop() || 'document';

  // Demo mode
  if (isStorageInDemoMode()) {
    return {
      signedUrl: `https://demo-storage.local/${bucket}/${objectPath}?token=mock-demo-hmac-signed-token&expires=${expiresAt}`,
      expiresIn,
      expiresAt,
      filename,
    };
  }

  // Live signed URL from Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresIn, {
      download: options?.download,
    });

  if (error || !data?.signedUrl) {
    throw new Error(`فشل إنشاء رابط الوصول الآمن: ${error?.message || 'تعذر استخراج الرابط'}`);
  }

  // Audit logging if file object is identifiable
  if (options?.trackAudit !== false) {
    try {
      const { data: fileObj } = await supabase
        .from('file_objects')
        .select('id')
        .eq('bucket_id', bucket)
        .eq('object_path', objectPath)
        .maybeSingle();

      if (fileObj?.id) {
        await supabase.rpc('log_file_download_access', {
          p_file_id: fileObj.id,
          p_access_type: options?.download ? 'download' : 'view',
        });
      }
    } catch (auditErr) {
      // Non-blocking audit failure
      console.warn('File access audit logging warning:', auditErr);
    }
  }

  return {
    signedUrl: data.signedUrl,
    expiresIn,
    expiresAt,
    filename,
  };
}

/**
 * Replace an existing file with a new version.
 * Uploads new version object, marks previous version as archived, and links replacement.
 */
export async function replaceSecureFile(
  previousFileId: string,
  options: UploadFileOptions
): Promise<FileObject> {
  // 1. Fetch previous file metadata
  let previousFile: FileObject | null = null;

  if (isStorageInDemoMode()) {
    previousFile = demoFileCatalog.get(previousFileId) || null;
  } else {
    const { data, error } = await supabase
      .from('file_objects')
      .select('*')
      .eq('id', previousFileId)
      .single();

    if (error || !data) {
      throw new Error(`الملف السابق غير موجود (${previousFileId})`);
    }
    previousFile = data as unknown as FileObject;
  }

  const nextVersion = (previousFile?.version ?? 1) + 1;

  // 2. Upload new version
  const newFile = await uploadSecureFile({
    ...options,
    version: nextVersion,
    replacesFileId: previousFileId,
  });

  // 3. Mark previous file as archived
  if (isStorageInDemoMode()) {
    if (previousFile) {
      previousFile.status = 'archived';
      previousFile.archived_at = new Date().toISOString();
    }
  } else {
    await supabase
      .from('file_objects')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('id', previousFileId);
  }

  return newFile;
}

/**
 * Archive a file object
 */
export async function archiveSecureFile(fileId: string): Promise<void> {
  if (isStorageInDemoMode()) {
    const file = demoFileCatalog.get(fileId);
    if (file) {
      file.status = 'archived';
      file.archived_at = new Date().toISOString();
    }
    return;
  }

  const { error } = await supabase
    .from('file_objects')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('id', fileId);

  if (error) {
    throw new Error(`فشل أرشفة الملف: ${error.message}`);
  }
}

/**
 * Soft-delete a file object
 */
export async function deleteSecureFile(fileId: string): Promise<void> {
  if (isStorageInDemoMode()) {
    const file = demoFileCatalog.get(fileId);
    if (file) {
      file.status = 'deleted';
      file.deleted_at = new Date().toISOString();
    }
    return;
  }

  const { error } = await supabase
    .from('file_objects')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', fileId);

  if (error) {
    throw new Error(`فشل حذف الملف: ${error.message}`);
  }
}

/**
 * Retrieve metadata for a file object by ID
 */
export async function getFileObjectById(fileId: string): Promise<FileObject | null> {
  if (isStorageInDemoMode()) {
    return demoFileCatalog.get(fileId) || null;
  }

  const { data, error } = await supabase
    .from('file_objects')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as FileObject;
}
