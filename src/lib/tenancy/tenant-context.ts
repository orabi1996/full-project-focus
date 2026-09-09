import { z } from "zod";

export const tenantIdSchema = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const timestampSchema = z.string().datetime({ offset: true });
const settingsSchema = z.object({
  locale: z.enum(["ar", "en"]),
  timezone: z.string().min(1),
  currency_code: z.string().regex(/^[A-Z]{3}$/),
});

/** Validates untrusted transport data before it enters the domain resolver. */
export const membershipContextSchema = z.object({
  id: tenantIdSchema,
  tenant_id: tenantIdSchema,
  user_id: tenantIdSchema,
  status: z.enum(["active", "suspended", "revoked"]),
  starts_at: timestampSchema,
  ends_at: timestampSchema.nullable(),
  archived_at: timestampSchema.nullable(),
  tenant: z
    .object({
      id: tenantIdSchema,
      slug: z.string(),
      legal_name: z.string(),
      status: z.enum(["setup_incomplete", "active", "suspended", "archived"]),
      archived_at: timestampSchema.nullable(),
      settings: settingsSchema.nullable(),
    })
    .nullable(),
});

export type MembershipContext = z.infer<typeof membershipContextSchema>;
export type TenantErrorCode =
  | "method_not_allowed"
  | "unauthorized"
  | "validation_error"
  | "tenant_required"
  | "tenant_access_denied"
  | "service_unavailable";

export class TenantContextError extends Error {
  constructor(public readonly code: TenantErrorCode) {
    super(code);
    this.name = "TenantContextError";
  }
}

/** This snapshot is not an authorization credential and must not be cached as
 * proof of access for a later command. Resolve membership again per request. */
export function resolveTenantContext(
  userId: string,
  requestedTenantId: string | undefined,
  memberships: readonly MembershipContext[],
  now: number,
) {
  if (!Number.isFinite(now)) throw new TenantContextError("service_unavailable");
  const eligible = memberships.filter((membership) => {
    const startsAt = Date.parse(membership.starts_at);
    const endsAt = membership.ends_at === null ? Infinity : Date.parse(membership.ends_at);
    return (
      membership.user_id === userId &&
      membership.status === "active" &&
      membership.archived_at === null &&
      startsAt <= now &&
      now < endsAt &&
      startsAt < endsAt &&
      membership.tenant !== null &&
      membership.tenant_id === membership.tenant.id &&
      membership.tenant.archived_at === null &&
      ["active", "setup_incomplete"].includes(membership.tenant.status) &&
      (!requestedTenantId || membership.tenant_id === requestedTenantId)
    );
  });

  if (eligible.length === 0) throw new TenantContextError("tenant_access_denied");
  if (eligible.length > 1) {
    // A requested tenant must resolve to one row (database uniqueness). Never
    // pick the first result when the user has not chosen a workspace.
    throw new TenantContextError(requestedTenantId ? "service_unavailable" : "tenant_required");
  }

  const membership = eligible[0];
  const tenant = membership.tenant!;
  return {
    user_id: userId,
    membership: { id: membership.id },
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      legal_name: tenant.legal_name,
      status: tenant.status,
    },
    settings: tenant.settings,
  };
}
