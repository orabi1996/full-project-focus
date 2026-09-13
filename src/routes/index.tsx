import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AuthGate } from "../components/auth/AuthGate";

export const Route = createFileRoute("/")({
  component: IndexRoute,
});

function IndexRoute() {
  return (
    <AuthGate>
      <Navigate to="/dashboard" replace />
    </AuthGate>
  );
}
