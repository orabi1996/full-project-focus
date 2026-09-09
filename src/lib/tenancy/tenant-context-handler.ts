import { z } from "zod";
import {
  membershipContextSchema,
  resolveTenantContext,
  TenantContextError,
  tenantIdSchema,
} from "./tenant-context";
import type { TenantErrorCode } from "./tenant-context";

export interface TenantBackend {
  authenticatedUserId(): Promise<string>;
  readMemberships(userId: string, tenantId?: string): Promise<unknown>;
}

export interface TenantHandlerDependencies {
  createBackend(token: string, signal: AbortSignal): TenantBackend;
  now(): number;
  requestId(): string;
}

const errors: Record<TenantErrorCode, { status: number; ar: string; en: string }> = {
  method_not_allowed: {
    status: 405,
    ar: "هذا الإجراء غير متاح لهذا الرابط.",
    en: "This request method is not supported.",
  },
  unauthorized: {
    status: 401,
    ar: "انتهت الجلسة أو تعذر التحقق منها. سجّل الدخول مرة أخرى.",
    en: "Your session could not be verified. Sign in again.",
  },
  validation_error: {
    status: 422,
    ar: "معرّف المنشأة غير صالح.",
    en: "The workspace identifier is invalid.",
  },
  tenant_required: {
    status: 409,
    ar: "اختر المنشأة التي تريد العمل داخلها.",
    en: "Choose a workspace to continue.",
  },
  tenant_access_denied: {
    status: 403,
    ar: "لا توجد عضوية سارية تتيح الوصول إلى هذه المنشأة.",
    en: "You do not have an active membership for this workspace.",
  },
  service_unavailable: {
    status: 503,
    ar: "تعذر تحميل بيانات المنشأة الآن. أعد المحاولة لاحقًا.",
    en: "Workspace details are temporarily unavailable. Try again later.",
  },
};

/** The HTTP layer accepts a tenant selector, never a user identity or role. */
export async function handleTenantContextRequest(
  request: Request,
  dependencies: TenantHandlerDependencies,
): Promise<Response> {
  const requestId = dependencies.requestId();
  const locale = /^en\b/i.test(request.headers.get("accept-language") ?? "") ? "en" : "ar";
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store",
    vary: "Authorization, X-Tenant-Id, Accept-Language",
    "x-request-id": requestId,
  };
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      throw new TenantContextError("method_not_allowed");
    }
    const authorization = request.headers.get("authorization") ?? "";
    const match = /^Bearer ([^\s,]+)$/i.exec(authorization);
    if (!match || authorization.length > 8192) throw new TenantContextError("unauthorized");

    const backend = dependencies.createBackend(match[1], request.signal);
    const authenticatedId = await backend.authenticatedUserId();
    const userId = tenantIdSchema.parse(authenticatedId);
    const rawTenantId = request.headers.get("x-tenant-id");
    const parsedTenantId = rawTenantId === null ? undefined : tenantIdSchema.safeParse(rawTenantId);
    if (parsedTenantId && !parsedTenantId.success) throw new TenantContextError("validation_error");
    const tenantId = parsedTenantId?.success ? parsedTenantId.data : undefined;
    const rows = await backend.readMemberships(userId, tenantId);
    // A limit of two distinguishes zero/one/multiple memberships without an
    // unbounded tenant list. Full workspace selection has its own later query.
    const memberships = z.array(membershipContextSchema).max(2).parse(rows);
    const data = resolveTenantContext(userId, tenantId, memberships, dependencies.now());
    return new Response(JSON.stringify({ data, meta: { request_id: requestId } }), { headers });
  } catch (error) {
    const code = error instanceof TenantContextError ? error.code : "service_unavailable";
    const definition = errors[code];
    if (code === "method_not_allowed") headers["allow"] = "GET, HEAD";
    return new Response(
      JSON.stringify({
        error: {
          code,
          message_key: `errors.${code}`,
          message: definition[locale],
          retryable: code === "service_unavailable",
          request_id: requestId,
        },
      }),
      { status: definition.status, headers },
    );
  }
}
