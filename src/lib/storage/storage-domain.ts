/**
 * Production Supabase Storage - Domain-Specific Upload & Retrieval Wrappers
 */

import {
  buildCandidateCvPath,
  buildCompanyDocumentPath,
  buildEmployeeDocumentPath,
  buildExpenseReceiptPath,
  buildJobOfferPath,
} from './storage-paths';
import {
  createSignedDownloadUrl,
  getFileObjectById,
  uploadSecureFile,
} from './storage-service';
import { FileObject, SignedUrlOptions, SignedUrlResult } from './storage-types';

/**
 * Upload an Employee Document (Iqama, Passport, Contract, Certificate, etc.)
 */
export async function uploadEmployeeDocumentFile({
  employeeId,
  documentId,
  file,
  docType,
  version = 1,
  metadata = {},
}: {
  employeeId: string;
  documentId: string;
  file: File;
  docType: string;
  version?: number;
  metadata?: Record<string, unknown>;
}): Promise<FileObject> {
  const objectPath = buildEmployeeDocumentPath({
    employeeId,
    documentId,
    filename: file.name,
    version,
  });

  return uploadSecureFile({
    bucket: 'employee-documents',
    objectPath,
    file,
    originalFilename: file.name,
    contentType: file.type,
    entityType: 'employee_document',
    entityId: documentId,
    employeeId,
    version,
    metadata: {
      ...metadata,
      docType,
    },
  });
}

/**
 * Upload a Company Document / Policy (Bylaws, Handbooks, Regulations)
 */
export async function uploadCompanyDocumentFile({
  documentId,
  file,
  category,
  version = 1,
  companyId,
  metadata = {},
}: {
  documentId: string;
  file: File;
  category: string;
  version?: number;
  companyId?: string;
  metadata?: Record<string, unknown>;
}): Promise<FileObject> {
  const objectPath = buildCompanyDocumentPath({
    documentId,
    filename: file.name,
    version,
  });

  return uploadSecureFile({
    bucket: 'company-documents',
    objectPath,
    file,
    originalFilename: file.name,
    contentType: file.type,
    entityType: 'company_document',
    entityId: documentId,
    companyId,
    version,
    metadata: {
      ...metadata,
      category,
    },
  });
}

/**
 * Upload an Expense Receipt (attached to an expense claim)
 */
export async function uploadExpenseReceiptFile({
  employeeId,
  expenseId,
  file,
  metadata = {},
}: {
  employeeId: string;
  expenseId: string;
  file: File;
  metadata?: Record<string, unknown>;
}): Promise<FileObject> {
  const objectPath = buildExpenseReceiptPath({
    employeeId,
    expenseId,
    filename: file.name,
  });

  return uploadSecureFile({
    bucket: 'expense-receipts',
    objectPath,
    file,
    originalFilename: file.name,
    contentType: file.type,
    entityType: 'expense_claim',
    entityId: expenseId,
    employeeId,
    metadata,
  });
}

/**
 * Upload a Candidate CV / Resume (restricted to Recruitment staff)
 */
export async function uploadCandidateCvFile({
  candidateId,
  file,
  metadata = {},
}: {
  candidateId: string;
  file: File;
  metadata?: Record<string, unknown>;
}): Promise<FileObject> {
  const objectPath = buildCandidateCvPath({
    candidateId,
    filename: file.name,
  });

  return uploadSecureFile({
    bucket: 'candidate-cvs',
    objectPath,
    file,
    originalFilename: file.name,
    contentType: file.type,
    entityType: 'candidate',
    entityId: candidateId,
    metadata,
  });
}

/**
 * Upload an Official Job Offer document/PDF
 */
export async function uploadJobOfferFile({
  candidateId,
  offerId,
  file,
  metadata = {},
}: {
  candidateId: string;
  offerId: string;
  file: File;
  metadata?: Record<string, unknown>;
}): Promise<FileObject> {
  const objectPath = buildJobOfferPath({
    candidateId,
    offerId,
    filename: file.name,
  });

  return uploadSecureFile({
    bucket: 'job-offers',
    objectPath,
    file,
    originalFilename: file.name,
    contentType: file.type,
    entityType: 'job_offer',
    entityId: offerId,
    metadata,
  });
}

/**
 * Get a short-lived signed URL for any file by its authoritative file_id
 */
export async function getSignedUrlForFileId(
  fileId: string,
  options?: SignedUrlOptions
): Promise<SignedUrlResult> {
  const fileObj = await getFileObjectById(fileId);
  if (!fileObj) {
    throw new Error(`الملف المطلوب غير موجود في سجل الملفات (${fileId})`);
  }

  return createSignedDownloadUrl(fileObj.bucket_id, fileObj.object_path, {
    ...options,
    download: options?.download ?? fileObj.original_filename,
  });
}
