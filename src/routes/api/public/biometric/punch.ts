import { createFileRoute } from "@tanstack/react-router";
import { recomputeDay } from "@/lib/business/attendance.functions";
import {
  createBiometricPunchIdempotencyKey,
  recomputeBiometricAttendanceDay,
} from "@/lib/business/biometric-punch-idempotency";

/**
 * Endpoint for physical fingerprint terminals.
 *
 * The device posts:
 *   { device_id, token, employee_no, punch_type: "in" | "out", punch_time? }
 *
 * The token is verified against the registered device row before anything is
 * written, then the punch is stored and the employee's attendance day for that
 * date is rebuilt so payroll picks the change up immediately.
 */
export const Route = createFileRoute("/api/public/biometric/punch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const deviceId = String(payload?.device_id ?? "").trim();
        const token = String(payload?.token ?? request.headers.get("x-device-token") ?? "").trim();
        const employeeRef = String(payload?.employee_no ?? payload?.employee_id ?? "").trim();
        const punchType = payload?.punch_type;
        const requestedTime = payload?.punch_time == null ? new Date() : new Date(payload.punch_time);
        const now = new Date();

        if (!deviceId || !token || !employeeRef) {
          return json({ error: "device_id, token and employee_no are required" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: device } = await supabaseAdmin
          .from("biometric_devices")
          .select("device_id, device_token, status, auto_approve, total_punches, work_location_id")
          .eq("device_id", deviceId)
          .maybeSingle();

        if (!device || device.device_token !== token || device.status !== "active") {
          return json({ error: "unauthorized device" }, 401);
        }

        if (punchType !== "in" && punchType !== "out") {
          return json({ error: "punch_type must be in or out" }, 400);
        }
        if (!device.work_location_id) {
          return json({ error: "device location is not configured" }, 409);
        }
        if (Number.isNaN(requestedTime.getTime())) {
          return json({ error: "punch_time is invalid" }, 400);
        }
        const ageMs = now.getTime() - requestedTime.getTime();
        if (ageMs > 24 * 60 * 60 * 1000 || ageMs < -5 * 60 * 1000) {
          return json({ error: "punch_time is outside the allowed 24-hour offline window" }, 400);
        }
        const punchTime = requestedTime.toISOString();

        const isUuid = /^[0-9a-f-]{36}$/i.test(employeeRef);
        const { data: employee } = await supabaseAdmin
          .from("employees")
          .select("id, full_name, employee_no, company_id, work_location_id")
          .eq(isUuid ? "id" : "employee_no", employeeRef)
          .maybeSingle();
        if (!employee) return json({ error: "employee not found" }, 404);
        if (employee.work_location_id !== device.work_location_id) {
          return json({ error: "employee is not assigned to this device location" }, 403);
        }

        const { data: location } = await supabaseAdmin
          .from("work_locations")
          .select("id, company_id")
          .eq("id", device.work_location_id)
          .maybeSingle();
        if (!location || !employee.company_id || location.company_id !== employee.company_id) {
          return json({ error: "device and employee company do not match" }, 403);
        }

        const idempotencyKey = await createBiometricPunchIdempotencyKey({
          companyId: employee.company_id,
          deviceId,
          employeeId: employee.id,
          punchTime,
          punchType,
        });

        const { data: duplicate } = await supabaseAdmin
          .from("punches")
          .select("id, approval_status")
          .eq("company_id", employee.company_id)
          .eq("employee_id", employee.id)
          .eq("device_id", deviceId)
          .eq("punch_time", punchTime)
          .eq("punch_type", punchType)
          .limit(1)
          .maybeSingle();
        if (duplicate) {
          const status = duplicate.approval_status;
          if (
            status === "approved" &&
            !(await recomputeBiometricAttendanceDay(() =>
              recomputeDay(supabaseAdmin as any, employee.id, punchTime.slice(0, 10)),
            ))
          ) {
            return json({ error: "punch recorded; attendance recalculation will retry", retryable: true }, 503);
          }
          return json({ ok: true, duplicate: true, status });
        }

        const { data: insertedPunch, error } = await supabaseAdmin.from("punches").insert({
          employee_id: employee.id,
          company_id: employee.company_id,
          location_id: employee.work_location_id,
          punch_time: punchTime,
          punch_type: punchType,
          source: "biometric",
          device_id: deviceId,
          latitude: payload?.latitude ?? null,
          longitude: payload?.longitude ?? null,
          approval_status: device.auto_approve ? "approved" : "pending",
          idempotency_key: idempotencyKey,
        } as any).select("id, approval_status").single();
        if (error) {
          // Another identical request may have inserted between the read and
          // write. Resolve the unique-key conflict as a retry, not as a failure.
          if (error.code === "23505") {
            const { data: concurrentDuplicate } = await supabaseAdmin
              .from("punches")
              .select("id, approval_status")
              .eq("company_id", employee.company_id)
              .eq("idempotency_key", idempotencyKey)
              .maybeSingle();
            if (concurrentDuplicate) {
              if (
                concurrentDuplicate.approval_status === "approved" &&
                !(await recomputeBiometricAttendanceDay(() =>
                  recomputeDay(supabaseAdmin as any, employee.id, punchTime.slice(0, 10)),
                ))
              ) {
                return json({ error: "punch recorded; attendance recalculation will retry", retryable: true }, 503);
              }
              return json({ ok: true, duplicate: true, status: concurrentDuplicate.approval_status });
            }
          }
          return json({ error: error.message }, 500);
        }

        await supabaseAdmin
          .from("biometric_devices")
          .update({
            last_seen_at: new Date().toISOString(),
            total_punches: Number(device.total_punches ?? 0) + 1,
          })
          .eq("device_id", deviceId);

        if (insertedPunch.approval_status === "approved") {
          if (
            !(await recomputeBiometricAttendanceDay(() =>
              recomputeDay(supabaseAdmin as any, employee.id, punchTime.slice(0, 10)),
            ))
          ) {
            // The event is durable. Returning retryable 503 is safe because a
            // device retry will reach the duplicate branch and rebuild the day.
            return json({ error: "punch recorded; attendance recalculation will retry", retryable: true }, 503);
          }
        }

        return json({
          ok: true,
          punch_type: punchType,
          status: insertedPunch.approval_status,
        });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
