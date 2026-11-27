/**
 * Stable per-event key for retries from physical terminals. Include all fields
 * that define one event so a real second punch is never deduplicated.
 */
export async function createBiometricPunchIdempotencyKey(input: {
  companyId: string;
  deviceId: string;
  employeeId: string;
  punchTime: string;
  punchType: "in" | "out";
}): Promise<string> {
  const material = JSON.stringify([
    input.companyId,
    input.deviceId,
    input.employeeId,
    input.punchTime,
    input.punchType,
  ]);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A durable punch can be retried through the duplicate path if day rebuild fails. */
export async function recomputeBiometricAttendanceDay(recompute: () => Promise<unknown>): Promise<boolean> {
  try {
    await recompute();
    return true;
  } catch (error) {
    console.error("[biometric-punch] attendance recompute failed; retry is safe", error);
    return false;
  }
}
