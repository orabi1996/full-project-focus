import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
} from "../../integrations/supabase/public-config";
import { assertValidSupabasePublicConfig } from "../config/runtime-config";
import { TenantContextError } from "./tenant-context";
import { handleTenantContextRequest } from "./tenant-context-handler";
import type { TenantBackend } from "./tenant-context-handler";

const CONTEXT_COLUMNS = `
  id, tenant_id, user_id, status, starts_at, ends_at, archived_at,
  tenant:tenants!inner(
    id, slug, legal_name, status, archived_at,
    settings:tenant_settings(locale, timezone, currency_code)
  )
`;

/** A user-authenticated client only; service-role clients must never enter this
 * adapter. PostgREST RLS checks current membership on each database request. */
export function createTenantBackend(
  token: string,
  signal: AbortSignal,
  config = {
    url: process.env["SUPABASE_URL"] || DEFAULT_SUPABASE_URL,
    publishableKey: process.env["SUPABASE_PUBLISHABLE_KEY"] || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  },
  transport: typeof fetch = fetch,
): TenantBackend {
  assertValidSupabasePublicConfig(config);
  const supabase = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) =>
        transport(input, {
          ...init,
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(8_000),
            ...(init?.signal ? [init.signal] : []),
          ]),
        }),
    },
  });
  return {
    async authenticatedUserId() {
      // getUser verifies the bearer with Auth, instead of trusting a decoded JWT
      // or a browser-provided role/user identifier.
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        const status = error.status ?? 0;
        throw new TenantContextError(
          status >= 400 && status < 500 && status !== 429 ? "unauthorized" : "service_unavailable",
        );
      }
      if (!data.user) throw new TenantContextError("unauthorized");
      return data.user.id;
    },
    async readMemberships(userId, tenantId) {
      let query = supabase
        .from("tenant_memberships")
        .select(CONTEXT_COLUMNS)
        .eq("user_id", userId)
        .order("tenant_id")
        .limit(2);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw new TenantContextError("service_unavailable");
      return data;
    },
  };
}

export function getTenantContext(request: Request): Promise<Response> {
  return handleTenantContextRequest(request, {
    createBackend: createTenantBackend,
    now: Date.now,
    requestId: () => crypto.randomUUID(),
  });
}
