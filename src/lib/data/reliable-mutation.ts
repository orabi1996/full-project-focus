export type MutationDataMode = "demo" | "live";

export interface ReliableMutationResult {
  ok: boolean;
  error?: Error;
}

interface ReliableMutationOptions {
  mode: MutationDataMode;
  operation: () => Promise<void>;
  refresh: () => Promise<void>;
  onPendingChange?: (pending: boolean) => void;
  onCommitted?: () => void;
  onRejected?: (error: Error) => void;
}

export function normalizeMutationError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.trim()) return new Error(error);
  return new Error("تعذر حفظ التغييرات");
}

export async function executeReliableMutation({
  mode,
  operation,
  refresh,
  onPendingChange,
  onCommitted,
  onRejected,
}: ReliableMutationOptions): Promise<ReliableMutationResult> {
  if (mode === "demo") {
    onCommitted?.();
    return { ok: true };
  }

  onPendingChange?.(true);

  try {
    await operation();
    await refresh();
    onCommitted?.();
    return { ok: true };
  } catch (error) {
    const normalizedError = normalizeMutationError(error);

    // Re-read the server snapshot so optimistic UI state cannot remain visible
    // after a rejected write.
    try {
      await refresh();
    } catch {
      // Keep the original mutation error visible until a later refresh succeeds.
    }

    onRejected?.(normalizedError);
    return { ok: false, error: normalizedError };
  } finally {
    onPendingChange?.(false);
  }
}
