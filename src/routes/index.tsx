import { createFileRoute } from "@tanstack/react-router";
import { AppProvider } from "../lib/context/AppContext";
import { AppLayout } from "../components/layout/AppLayout";
import { AuthGate } from "../components/auth/AuthGate";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <AuthGate>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </AuthGate>
  );
}
