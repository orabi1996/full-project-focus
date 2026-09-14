/**
 * Production Supabase Storage - Deterministic Path Builders
 */

import { assertSafePath, sanitizeFilename } from './storage-validation';

/**
 * Generate a random short UUID or use crypto.randomUUID()
 */
export function generateObjectToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
}

export interface EmployeeDocumentPathArgs {
  employeeId: string;
  documentId: string;
  filename: string;
  version?: number;
}

export function buildEmployeeDocumentPath({
  employeeId,
  documentId,
  filename,
  version = 1,
}: EmployeeDocumentPathArgs): string {
  const safeName = sanitizeFilename(filename);
  const token = generateObjectToken();
  const path = `employees/${employeeId}/${documentId}/v${version}_${token}_${safeName}`;
  assertSafePath(path);
  return path;
}

export interface CompanyDocumentPathArgs {
  documentId: string;
  filename: string;
  version?: number;
}

export function buildCompanyDocumentPath({
  documentId,
  filename,
  version = 1,
}: CompanyDocumentPathArgs): string {
  const safeName = sanitizeFilename(filename);
  const token = generateObjectToken();
  const path = `company/${documentId}/v${version}_${token}_${safeName}`;
  assertSafePath(path);
  return path;
}

export interface ExpenseReceiptPathArgs {
  employeeId: string;
  expenseId: string;
  filename: string;
}

export function buildExpenseReceiptPath({
  employeeId,
  expenseId,
  filename,
}: ExpenseReceiptPathArgs): string {
  const safeName = sanitizeFilename(filename);
  const token = generateObjectToken();
  const path = `expenses/${employeeId}/${expenseId}/${token}_${safeName}`;
  assertSafePath(path);
  return path;
}

export interface CandidateCvPathArgs {
  candidateId: string;
  filename: string;
}

export function buildCandidateCvPath({
  candidateId,
  filename,
}: CandidateCvPathArgs): string {
  const safeName = sanitizeFilename(filename);
  const token = generateObjectToken();
  const path = `candidates/${candidateId}/${token}_${safeName}`;
  assertSafePath(path);
  return path;
}

export interface JobOfferPathArgs {
  candidateId: string;
  offerId: string;
  filename: string;
}

export function buildJobOfferPath({
  candidateId,
  offerId,
  filename,
}: JobOfferPathArgs): string {
  const safeName = sanitizeFilename(filename);
  const token = generateObjectToken();
  const path = `offers/${candidateId}/${offerId}/${token}_${safeName}`;
  assertSafePath(path);
  return path;
}
