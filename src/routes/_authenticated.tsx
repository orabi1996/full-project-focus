import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthGate } from "../components/auth/AuthGate";
import { AppProvider } from "../lib/context/AppContext";
import { AppLayout } from "../components/layout/AppLayout";
import { getLegacyHashRedirect } from "../lib/router/legacy-hash";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();

  // Legacy hash compatibility migration on startup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const targetRoute = getLegacyHashRedirect(hash);
    if (targetRoute) {
      window.history.replaceState(null, "", targetRoute);
      void navigate({ to: targetRoute as never, replace: true });
    }
  }, [navigate]);

  return (
    <AuthGate>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </AuthGate>
  );
}
