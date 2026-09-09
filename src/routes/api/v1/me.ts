import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/me")({
  server: {
    handlers: {
      // ANY keeps unsupported API methods out of the framework's page fallback.
      // The handler permits GET/HEAD and returns 405 for every other method.
      ANY: async ({ request }) => {
        const { getTenantContext } = await import("@/lib/tenancy/tenant-context.server");
        return getTenantContext(request);
      },
    },
  },
});
