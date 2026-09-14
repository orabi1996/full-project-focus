export type MutationDataMode = "demo" | "live";

export type MutationErrorKind =
  | "validation"
  | "authorization"
  | "conflict"
  | "network"
  | "backend"
  | "duplicate"
  | "unknown";

export class AppMutationError extends Error {
  readonly kind: MutationErrorKind;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    kind: MutationErrorKind = "backend",
    options?: { code?: string; details?: unknown; cause?: unknown },
  ) {
    super(message);
    this.name = "AppMutationError";
    this.kind = kind;
    this.code = options?.code;
    this.details = options?.details;
    if (options?.cause) this.cause = options.cause;
  }
}

export interface ReliableMutationResult<T = void> {
  ok: boolean;
  data?: T;
  error?: AppMutationError;
}

export interface ReliableMutationOptions<T = void> {
  mode: MutationDataMode;
  mutationKey?: string;
  operation: () => Promise<T>;
  demoOperation?: () => Promise<T> | T;
  refresh?: () => Promise<void>;
  onPendingChange?: (pending: boolean) => void;
  onCommitted?: (data?: T) => void | Promise<void>;
  onRejected?: (error: AppMutationError) => void | Promise<void>;
  onAudit?: (data?: T) => void | Promise<void>;
}

// In-flight mutation key registry to prevent duplicate concurrent submissions
const inFlightMutationKeys = new Set<string>();

/**
 * Checks whether a mutation with the given key is currently executing.
 */
export function isMutationPending(key: string): boolean {
  return inFlightMutationKeys.has(key);
}

/**
 * Clears all in-flight mutation keys (used for tests or session resets).
 */
export function clearInFlightMutations(): void {
  inFlightMutationKeys.clear();
}

/**
 * Normalizes any caught error into a structured AppMutationError with classified kind.
 */
export function normalizeMutationError(error: unknown, defaultMessage?: string): AppMutationError {
  if (error instanceof AppMutationError) return error;

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : "";

  const anyErr = error as { code?: string; details?: unknown; status?: number; message?: string } | null;
  const code = anyErr?.code;

  let kind: MutationErrorKind = "backend";

  // 1. Duplicate / in-flight check
  if (rawMessage.includes("قيد التنفيذ") || rawMessage.toLowerCase().includes("duplicate submission")) {
    kind = "duplicate";
  }
  // 2. Postgres / Supabase Unique constraint violation (23505)
  else if (code === "23505" || rawMessage.toLowerCase().includes("unique constraint")) {
    kind = "conflict";
  }
  // 3. Postgres Foreign Key violation (23503)
  else if (code === "23503" || rawMessage.toLowerCase().includes("foreign key constraint")) {
    kind = "conflict";
  }
  // 4. Authorization / RLS violation (42501 or 403 or PGRST301)
  else if (
    code === "42501" ||
    code === "PGRST301" ||
    anyErr?.status === 403 ||
    rawMessage.includes("RLS") ||
    rawMessage.toLowerCase().includes("permission denied") ||
    rawMessage.toLowerCase().includes("not authorized")
  ) {
    kind = "authorization";
  }
  // 5. Network connection failures
  else if (
    rawMessage.includes("Failed to fetch") ||
    rawMessage.includes("NetworkError") ||
    rawMessage.includes("net::ERR") ||
    rawMessage.toLowerCase().includes("network") ||
    rawMessage.toLowerCase().includes("timeout") ||
    rawMessage.toLowerCase().includes("connection") ||
    rawMessage.toLowerCase().includes("econnrefused") ||
    rawMessage.toLowerCase().includes("econnreset")
  ) {
    kind = "network";
  }
  // 6. Validation / Invalid Parameter value (22023)
  else if (code === "22023" || rawMessage.toLowerCase().includes("validation")) {
    kind = "validation";
  }

  const finalMessage = rawMessage || defaultMessage || "تعذر حفظ التغييرات";

  if (error instanceof AppMutationError) {
    return error;
  }

  if (error instanceof Error) {
    const mutable = error as unknown as AppMutationError;
    Object.setPrototypeOf(mutable, AppMutationError.prototype);
    (mutable as { kind: MutationErrorKind }).kind = kind;
    (mutable as { name: string }).name = "AppMutationError";
    if (code) (mutable as { code?: string }).code = code;
    if (anyErr?.details) (mutable as { details?: unknown }).details = anyErr.details;
    return mutable;
  }

  return new AppMutationError(finalMessage, kind, {
    code,
    details: anyErr?.details,
    cause: error,
  });
}

/**
 * Standard production mutation coordinator:
 * 1. Checks in-flight mutation keys to reject rapid duplicate submissions.
 * 2. In Live mode: executes operation, confirms refresh, triggers audit, and notifies committed.
 * 3. In Demo mode: executes demoOperation locally (or skips network operation) and marks committed.
 * 4. On Live failure: recovers authoritative server state via refresh, notifies rejection, and guarantees no fake success.
 */
export async function executeReliableMutation<T = void>({
  mode,
  mutationKey,
  operation,
  demoOperation,
  refresh,
  onPendingChange,
  onCommitted,
  onRejected,
  onAudit,
}: ReliableMutationOptions<T>): Promise<ReliableMutationResult<T>> {
  // Demo Mode: run demoOperation in-memory, skip live network/backend calls
  if (mode === "demo") {
    let demoData: T | undefined;
    if (demoOperation) {
      demoData = await demoOperation();
    }
    if (onAudit) {
      try {
        await onAudit(demoData);
      } catch {
        // Audit recording non-blocking for business return
      }
    }
    await onCommitted?.(demoData);
    return { ok: true, data: demoData };
  }

  // Live Mode: In-flight deduplication protection
  if (mutationKey) {
    if (inFlightMutationKeys.has(mutationKey)) {
      const duplicateError = new AppMutationError(
        "عملية مماثلة قيد التنفيذ بالفعل؛ يرجى الانتظار",
        "duplicate",
      );
      await onRejected?.(duplicateError);
      return { ok: false, error: duplicateError };
    }
    inFlightMutationKeys.add(mutationKey);
  }

  onPendingChange?.(true);

  try {
    const data = await operation();

    // Authoritative confirmation refresh
    if (refresh) {
      await refresh();
    }

    // Confirmed write: trigger audit if defined
    if (onAudit) {
      try {
        await onAudit(data);
      } catch {
        // Audit recording non-blocking for business return, but does not revert write
      }
    }

    await onCommitted?.(data);
    return { ok: true, data };
  } catch (error) {
    const normalizedError = normalizeMutationError(error);

    // Re-read server snapshot so optimistic/partial UI state cannot remain visible after failure
    if (refresh) {
      try {
        await refresh();
      } catch {
        // Preserve original mutation error if refresh also fails
      }
    }

    await onRejected?.(normalizedError);
    return { ok: false, error: normalizedError };
  } finally {
    if (mutationKey) {
      inFlightMutationKeys.delete(mutationKey);
    }
    onPendingChange?.(false);
  }
}
