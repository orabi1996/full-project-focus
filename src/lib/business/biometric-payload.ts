import { z } from "zod";

const identifier = z.string().trim().min(1).max(200);
const punchSchema = z
  .object({
    device_id: identifier,
    token: z.string().trim().min(1).max(4096),
    employee_no: identifier.optional(),
    employee_id: identifier.optional(),
    punch_type: z.enum(["in", "out"]),
    punch_time: z.string().datetime({ offset: true }).optional(),
    latitude: z.number().finite().min(-90).max(90).nullable().optional(),
    longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  })
  .refine((data) => data.employee_no || data.employee_id, "Employee identifier is required")
  .refine(
    (data) => (data.latitude == null) === (data.longitude == null),
    "Both coordinates are required",
  );

/** Validate before accessing privileged storage or converting dates. */
export function parseBiometricPayload(payload: unknown, headerToken: string | null) {
  const candidate =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...payload, token: (payload as Record<string, unknown>).token ?? headerToken }
      : payload;
  return punchSchema.safeParse(candidate);
}
