import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/cron/run" && request.method === "POST") {
        const expectedSecret = process.env["CRON_SECRET"];
        const authHeader = request.headers.get("authorization");
        const providedSecret =
          request.headers.get("x-cron-secret") ||
          (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader);

        if (expectedSecret && providedSecret !== expectedSecret) {
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized cron trigger" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const {
          executeAutomatedDailyAttendanceRollup,
          executeAutomatedMonthlyLeaveAccrual,
          processQueuedBackgroundJobs,
        } = await import("./lib/business/cron.functions");

        const task = body.task || "all";
        const report: Record<string, unknown> = {};

        if (task === "leave_accrual" || task === "all") {
          report.leaveAccrual = await executeAutomatedMonthlyLeaveAccrual(supabaseAdmin, {
            companyId: body.companyId,
            year: body.year,
            month: body.month,
          });
        }

        if (task === "attendance_rollup" || task === "all") {
          report.attendanceRollup = await executeAutomatedDailyAttendanceRollup(supabaseAdmin, {
            companyId: body.companyId,
            date: body.date,
          });
        }

        if (task === "queue_worker" || task === "all") {
          report.queueWorker = await processQueuedBackgroundJobs(supabaseAdmin, {
            companyId: body.companyId,
          });
        }

        return new Response(
          JSON.stringify({
            ok: true,
            executedAt: new Date().toISOString(),
            report,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },

  async scheduled(event: { cron?: string; scheduledTime?: number }, env: unknown, ctx: unknown) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const {
        executeAutomatedDailyAttendanceRollup,
        executeAutomatedMonthlyLeaveAccrual,
        processQueuedBackgroundJobs,
      } = await import("./lib/business/cron.functions");

      await processQueuedBackgroundJobs(supabaseAdmin, { batchSize: 20 });
      await executeAutomatedDailyAttendanceRollup(supabaseAdmin);

      const now = new Date(event?.scheduledTime || Date.now());
      if (now.getUTCDate() === 1) {
        await executeAutomatedMonthlyLeaveAccrual(supabaseAdmin, {
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
        });
      }
    } catch (cronErr) {
      console.error("[CloudflareScheduled] Cron handler error:", cronErr);
    }
  },
};
