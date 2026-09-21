import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AuthGate } from "../components/auth/AuthGate";
import { getLegacyHashRedirect } from "../lib/router/legacy-hash";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  const legacyTarget =
    typeof window === "undefined" ? null : getLegacyHashRedirect(window.location.hash);

  return (
    <AuthGate>
      <Navigate to={(legacyTarget || "/dashboard") as never} replace />
    </AuthGate>
  );
}
