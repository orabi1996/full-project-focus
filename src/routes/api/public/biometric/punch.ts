import { createFileRoute } from "@tanstack/react-router";
import { recomputeDay } from "@/lib/business/attendance.functions";
import { parseBiometricPayload } from "@/lib/business/biometric-payload";

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
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const parsed = parseBiometricPayload(body, request.headers.get("x-device-token"));
        if (!parsed.success) return json({ error: "invalid punch payload" }, 400);
        const payload = parsed.data;
        const deviceId = payload.device_id;
        const token = payload.token;
        const employeeRef = payload.employee_no ?? payload.employee_id!;
        const punchType = payload.punch_type;
        const punchTime = payload.punch_time
          ? new Date(payload.punch_time).toISOString()
          : new Date().toISOString();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: device } = await supabaseAdmin
          .from("biometric_devices")
          .select("device_id, device_token, status, auto_approve, total_punches")
          .eq("device_id", deviceId)
          .maybeSingle();

        if (!device || device.device_token !== token || device.status !== "active") {
          return json({ error: "unauthorized device" }, 401);
        }

        const isUuid = /^[0-9a-f-]{36}$/i.test(employeeRef);
        const { data: employee } = await supabaseAdmin
          .from("employees")
          .select("id, full_name, employee_no")
          .eq(isUuid ? "id" : "employee_no", employeeRef)
          .maybeSingle();
        if (!employee) return json({ error: "employee not found" }, 404);

        const { error } = await supabaseAdmin.from("punches").insert({
          employee_id: employee.id,
          punch_time: punchTime,
          punch_type: punchType,
          source: "biometric",
          device_id: deviceId,
          latitude: payload?.latitude ?? null,
          longitude: payload?.longitude ?? null,
          approval_status: device.auto_approve ? "approved" : "pending",
        });
        if (error) return json({ error: "unable to store punch" }, 500);

        await supabaseAdmin
          .from("biometric_devices")
          .update({
            last_seen_at: new Date().toISOString(),
            total_punches: Number(device.total_punches ?? 0) + 1,
          })
          .eq("device_id", deviceId);

        if (device.auto_approve) {
          await recomputeDay(supabaseAdmin as any, employee.id, punchTime.slice(0, 10));
        }

        return json({
          ok: true,
          employee: employee.full_name,
          employee_no: employee.employee_no,
          punch_type: punchType,
          status: device.auto_approve ? "approved" : "pending",
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
