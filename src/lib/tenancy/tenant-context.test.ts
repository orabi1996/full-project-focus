import { describe, expect, it, vi } from "vitest";
import {
  membershipContextSchema,
  resolveTenantContext,
  TenantContextError,
} from "./tenant-context";
import type { MembershipContext } from "./tenant-context";
import { handleTenantContextRequest } from "./tenant-context-handler";
import { createTenantBackend } from "./tenant-context.server";

const USER = "10000000-0000-4000-8000-000000000001";
const OTHER_USER = "10000000-0000-4000-8000-000000000002";
const TENANT_A = "20000000-0000-4000-8000-000000000001";
const TENANT_B = "20000000-0000-4000-8000-000000000002";
const NOW = Date.parse("2026-09-08T12:00:00Z");
const REQUEST_ID = "40000000-0000-4000-8000-000000000001";

function member(overrides: Partial<MembershipContext> = {}): MembershipContext {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    user_id: USER,
    tenant_id: TENANT_A,
    status: "active",
    starts_at: "2026-01-01T00:00:00Z",
    ends_at: null,
    archived_at: null,
    tenant: {
      id: TENANT_A,
      slug: "alpha",
      legal_name: "منشأة اختبار ألف",
      status: "active",
      archived_at: null,
      settings: { locale: "ar", timezone: "Asia/Riyadh", currency_code: "SAR" },
    },
    ...overrides,
  };
}

function dependencies(rows: unknown = [member()]) {
  const backend = {
    authenticatedUserId: vi.fn().mockResolvedValue(USER),
    readMemberships: vi.fn().mockResolvedValue(rows),
  };
  return {
    backend,
    createBackend: vi.fn().mockReturnValue(backend),
    now: () => NOW,
    requestId: () => REQUEST_ID,
  };
}
function request(headers: Record<string, string> = {}) {
  return new Request("https://hr.invalid/api/v1/me", {
    headers: { authorization: "Bearer test-access-token", ...headers },
  });
}

describe("tenant context decisions", () => {
  it("returns only the verified user's membership and safe tenant fields", () => {
    const context = resolveTenantContext(USER, undefined, [member()], NOW);
    expect(context).toEqual({
      user_id: USER,
      membership: { id: member().id },
      tenant: { id: TENANT_A, slug: "alpha", legal_name: "منشأة اختبار ألف", status: "active" },
      settings: { locale: "ar", timezone: "Asia/Riyadh", currency_code: "SAR" },
    });
  });

  it.each([
    ["different actor", { user_id: OTHER_USER }],
    ["suspended membership", { status: "suspended" }],
    ["revoked membership", { status: "revoked" }],
    ["archived membership", { archived_at: "2026-01-02T00:00:00Z" }],
    ["not started", { starts_at: "2026-09-09T00:00:00Z" }],
    ["expired at boundary", { ends_at: "2026-09-08T12:00:00Z" }],
    ["no visible tenant", { tenant: null }],
    ["mismatched foreign key", { tenant_id: TENANT_B }],
  ] as [string, Partial<MembershipContext>][])("denies %s", (_, overrides) => {
    expect(() => resolveTenantContext(USER, undefined, [member(overrides)], NOW)).toThrow(
      "tenant_access_denied",
    );
  });

  it.each(["suspended", "archived"] as const)("denies a %s tenant", (status) => {
    const row = member();
    row.tenant!.status = status;
    expect(() => resolveTenantContext(USER, TENANT_A, [row], NOW)).toThrow("tenant_access_denied");
  });

  it("accepts the start boundary and supports incomplete onboarding without defaults", () => {
    const row = member({ starts_at: "2026-09-08T12:00:00Z" });
    row.tenant!.status = "setup_incomplete";
    row.tenant!.settings = null;
    expect(resolveTenantContext(USER, TENANT_A, [row], NOW).settings).toBeNull();
  });

  it("requires selection with two tenants and never falls back for a forbidden selector", () => {
    const a = member();
    const b = member({ id: "30000000-0000-4000-8000-000000000002", tenant_id: TENANT_B });
    b.tenant!.id = TENANT_B;
    expect(() => resolveTenantContext(USER, undefined, [a, b], NOW)).toThrow("tenant_required");
    expect(resolveTenantContext(USER, TENANT_B, [a, b], NOW).tenant.id).toBe(TENANT_B);
    expect(() => resolveTenantContext(USER, TENANT_B, [a], NOW)).toThrow("tenant_access_denied");
  });

  it("fails closed for duplicate selected rows and invalid server time", () => {
    expect(() => resolveTenantContext(USER, TENANT_A, [member(), member()], NOW)).toThrow(
      "service_unavailable",
    );
    expect(() => resolveTenantContext(USER, TENANT_A, [member()], NaN)).toThrow(
      "service_unavailable",
    );
  });

  it("rejects malformed dates and removes extra sensitive transport properties", () => {
    expect(membershipContextSchema.safeParse(member({ ends_at: "tomorrow" })).success).toBe(false);
    const parsed = membershipContextSchema.parse({ ...member(), salary: 999, token: "private" });
    expect(parsed).not.toHaveProperty("salary");
    expect(parsed).not.toHaveProperty("token");
  });
});

describe("GET /api/v1/me HTTP behavior", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])(
    "rejects %s with 405 instead of falling through to an HTML page",
    async (method) => {
      const deps = dependencies();
      const response = await handleTenantContextRequest(
        new Request("https://hr.invalid/api/v1/me", { method }),
        deps,
      );
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
      expect((await response.json()).error.code).toBe("method_not_allowed");
      expect(deps.createBackend).not.toHaveBeenCalled();
    },
  );
  it("returns no-store and a server-generated request ID", async () => {
    const deps = dependencies();
    const response = await handleTenantContextRequest(
      request({ "x-request-id": "client-text" }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
    expect(await response.json()).toMatchObject({
      data: { user_id: USER },
      meta: { request_id: REQUEST_ID },
    });
    expect(deps.backend.readMemberships).toHaveBeenCalledWith(USER, undefined);
  });

  it.each(["", "Basic password", "Bearer", "Bearer one two", `Bearer ${"x".repeat(8192)}`])(
    "rejects malformed authorization before accessing data",
    async (authorization) => {
      const deps = dependencies();
      const response = await handleTenantContextRequest(request({ authorization }), deps);
      expect(response.status).toBe(401);
      expect(deps.createBackend).not.toHaveBeenCalled();
    },
  );

  it("never trusts user/role fields from query or headers", async () => {
    const deps = dependencies();
    const req = new Request(`https://hr.invalid/api/v1/me?user_id=${OTHER_USER}&role=super_admin`, {
      headers: { authorization: "Bearer test", "x-user-id": OTHER_USER, "x-role": "super_admin" },
    });
    expect((await handleTenantContextRequest(req, deps)).status).toBe(200);
    expect(deps.backend.readMemberships).toHaveBeenCalledWith(USER, undefined);
  });

  it("rejects an invalid tenant selector without performing a membership query", async () => {
    const deps = dependencies();
    const response = await handleTenantContextRequest(
      request({ "x-tenant-id": "alpha,other" }),
      deps,
    );
    expect(response.status).toBe(422);
    expect(deps.backend.readMemberships).not.toHaveBeenCalled();
  });

  it("denies an expired session and does not query memberships", async () => {
    const deps = dependencies();
    deps.backend.authenticatedUserId.mockRejectedValue(new TenantContextError("unauthorized"));
    const response = await handleTenantContextRequest(request(), deps);
    expect(response.status).toBe(401);
    expect(deps.backend.readMemberships).not.toHaveBeenCalled();
  });

  it("maps tenant ambiguity to 409 and a forbidden selector to 403", async () => {
    const b = member({ tenant_id: TENANT_B });
    b.tenant!.id = TENANT_B;
    expect((await handleTenantContextRequest(request(), dependencies([member(), b]))).status).toBe(
      409,
    );
    expect(
      (await handleTenantContextRequest(request({ "x-tenant-id": TENANT_B }), dependencies()))
        .status,
    ).toBe(403);
  });

  it("normalizes UUID selectors and honors English error copy", async () => {
    const deps = dependencies([]);
    const id = "abcdefab-1234-4234-8234-123456789abc";
    const response = await handleTenantContextRequest(
      request({ "x-tenant-id": id.toUpperCase(), "accept-language": "en-US,en;q=0.9" }),
      deps,
    );
    expect(deps.backend.readMemberships).toHaveBeenCalledWith(USER, id);
    const body = await response.json();
    expect(body.error.message).toContain("active membership");
    expect(body.error.retryable).toBe(false);
  });

  it("sanitizes provider errors and malformed rows instead of returning demo data", async () => {
    const deps = dependencies();
    deps.backend.readMemberships.mockRejectedValue(
      new Error("secret=do-not-leak relation payroll salary=10000"),
    );
    const response = await handleTenantContextRequest(request(), deps);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "service_unavailable", retryable: true });
    expect(JSON.stringify(body)).not.toMatch(/secret|payroll|10000/);
    expect((await handleTenantContextRequest(request(), dependencies([{}]))).status).toBe(503);
  });
});

describe("Supabase tenant adapter", () => {
  const config = {
    url: "https://tenant-auth.invalid",
    publishableKey: "sb_publishable_test_public_only",
  };

  it("verifies the user with Auth and queries through the same bearer and public key", async () => {
    const calls: { url: URL; headers: Headers }[] = [];
    const transport: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      calls.push({ url, headers: new Headers(init?.headers) });
      return Response.json(
        url.pathname === "/auth/v1/user"
          ? {
              id: USER,
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: "2026-01-01T00:00:00Z",
            }
          : [member()],
      );
    };
    const backend = createTenantBackend(
      "verified-by-auth",
      new AbortController().signal,
      config,
      transport,
    );
    expect(await backend.authenticatedUserId()).toBe(USER);
    expect(await backend.readMemberships(USER, TENANT_A)).toEqual([member()]);
    expect(calls.map((c) => c.url.pathname)).toEqual([
      "/auth/v1/user",
      "/rest/v1/tenant_memberships",
    ]);
    expect(calls.every((c) => c.headers.get("authorization") === "Bearer verified-by-auth")).toBe(
      true,
    );
    expect(calls.every((c) => c.headers.get("apikey") === config.publishableKey)).toBe(true);
    expect(calls[1].url.searchParams.get("user_id")).toBe(`eq.${USER}`);
    expect(calls[1].url.searchParams.get("tenant_id")).toBe(`eq.${TENANT_A}`);
    expect(calls[1].url.searchParams.get("limit")).toBe("2");
    expect(calls[1].url.searchParams.get("select")).toContain("tenants!inner");
  });

  it("rejects a server secret passed as the public key", () => {
    expect(() =>
      createTenantBackend("x", new AbortController().signal, {
        ...config,
        publishableKey: "sb_secret_private",
      }),
    ).toThrow("public key required");
  });

  it.each([401, 429, 503])(
    "classifies Auth failure %i without disclosing the upstream error",
    async (status) => {
      const transport: typeof fetch = async () =>
        Response.json({ message: "private error", code: "invalid_token" }, { status });
      const backend = createTenantBackend(
        "invalid",
        new AbortController().signal,
        config,
        transport,
      );
      await expect(backend.authenticatedUserId()).rejects.toMatchObject({
        code: status === 401 ? "unauthorized" : "service_unavailable",
      });
    },
  );

  it("maps an unavailable registry to a retryable typed error", async () => {
    const backend = createTenantBackend("valid", new AbortController().signal, config, async () =>
      Response.json({ code: "42P01", message: "private schema detail" }, { status: 404 }),
    );
    await expect(backend.readMemberships(USER)).rejects.toMatchObject({
      code: "service_unavailable",
    });
  });
});
