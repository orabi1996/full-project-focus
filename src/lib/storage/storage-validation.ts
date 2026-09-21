/**
 * Production Supabase Storage - Validation & Path Sanitization
 */

import { StorageBucket, StorageValidationRule, StorageValidationResult } from './storage-types';

export const BUCKET_VALIDATION_RULES: Record<StorageBucket, StorageValidationRule> = {
  'employee-documents': {
    maxSizeBytes: 15 * 1024 * 1024, // 15 MB
    allowedMimeTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
    ],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
  },
  'company-documents': {
    maxSizeBytes: 25 * 1024 * 1024, // 25 MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
  },
  'expense-receipts': {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
    ],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
  },
  'candidate-cvs': {
    maxSizeBytes: 15 * 1024 * 1024, // 15 MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx'],
  },
  'job-offers': {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
  },
  'employee-avatars': {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
    ],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
  },
  'leave-attachments': {
    maxSizeBytes: 15 * 1024 * 1024, // 15 MB
    allowedMimeTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'],
  },
};

export const FORBIDDEN_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.vbs',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.html',
  '.htm',
  '.svg',
  '.apk',
  '.jar',
  '.msi',
  '.dll',
  '.scr',
  '.php',
  '.phtml',
  '.py',
  '.rb',
]);

/**
 * Extract lowercased file extension including the leading dot
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Strips path traversal sequences, null bytes, and dangerous characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file';

  // 1. Remove null bytes and control chars
  // eslint-disable-next-line no-control-regex
  let clean = filename.replace(/[\x00-\x1f\x7f]/g, '');

  // 2. Strip directory path prefixes (both / and \)
  clean = clean.replace(/^.*[/\\]/, '');

  // 3. Remove traversal patterns
  clean = clean.replace(/\.\.+/g, '.');

  // 4. Split name and extension
  const ext = getFileExtension(clean);
  const baseName = ext ? clean.slice(0, -ext.length) : clean;

  // 5. Sanitize baseName: keep alphanumeric, unicode (Arabic letters), hyphens, underscores
  const safeBase = baseName
    .replace(/[^\p{L}\p{N}\-_.]/gu, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 80);

  const finalName = `${safeBase || 'file'}${ext}`;
  return finalName;
}

/**
 * Asserts that a storage object path has no traversal vectors or malformed prefixes.
 */
export function assertSafePath(objectPath: string): void {
  if (!objectPath || typeof objectPath !== 'string') {
    throw new Error('Storage path cannot be empty');
  }

  if (objectPath.includes('\0')) {
    throw new Error('Storage path contains null bytes');
  }

  if (objectPath.includes('..')) {
    throw new Error('Path traversal sequence (..) detected in storage path');
  }

  if (objectPath.startsWith('/') || objectPath.startsWith('\\')) {
    throw new Error('Storage path must not have a leading slash');
  }

  if (objectPath.includes('//') || objectPath.includes('\\\\')) {
    throw new Error('Storage path contains redundant separators');
  }
}

/**
 * Validates a file against bucket rules: size, MIME type, and extension restrictions.
 */
export function validateStorageFile(
  bucket: StorageBucket,
  file: { name: string; size: number; type?: string }
): StorageValidationResult {
  const rule = BUCKET_VALIDATION_RULES[bucket];
  if (!rule) {
    return {
      valid: false,
      error: `المستودع غير معروف (${bucket})`,
      sanitizedFilename: sanitizeFilename(file.name),
    };
  }

  const sanitized = sanitizeFilename(file.name);
  const ext = getFileExtension(sanitized);

  // 1. Empty file check
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'الملف فارغ (0 بايت)',
      sanitizedFilename: sanitized,
    };
  }

  // 2. Max size check
  if (file.size > rule.maxSizeBytes) {
    const maxMb = Math.round(rule.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `حجم الملف يتجاوز الحد الأقصى المسموح به (${maxMb} ميجابايت)`,
      sanitizedFilename: sanitized,
    };
  }

  // 3. Blacklisted extension check
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `نوع الملف (${ext}) محظور لأسباب أمنية`,
      sanitizedFilename: sanitized,
    };
  }

  // 4. Whitelisted extension check
  if (!rule.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `امتداد الملف (${ext}) غير مدعوم في هذا القسم. الامتدادات المدعومة: ${rule.allowedExtensions.join(', ')}`,
      sanitizedFilename: sanitized,
    };
  }

  // 5. MIME type check (if provided by browser)
  if (file.type && !rule.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `نوع المحتوى (${file.type}) غير متطابق مع متطلبات الأمان`,
      sanitizedFilename: sanitized,
    };
  }

  return {
    valid: true,
    sanitizedFilename: sanitized,
  };
}
