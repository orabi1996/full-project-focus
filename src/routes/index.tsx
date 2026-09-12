import { createFileRoute } from "@tanstack/react-router";
import { AppProvider } from "../lib/context/AppContext";
import { AppLayout } from "../components/layout/AppLayout";
import { AuthGate } from "../components/auth/AuthGate";
import { useAuth } from "../lib/auth/AuthContext";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, isDemo } = useAuth();
  return (
    <AuthGate>
      <AppProvider key={isDemo ? "demo" : (session?.user.id ?? "signed-out")}>
        <AppLayout />
      </AppProvider>
    </AuthGate>
  );
}
