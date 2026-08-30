import { createFileRoute } from "@tanstack/react-router";
import { AppProvider } from "../lib/context/AppContext";
import { AppLayout } from "../components/layout/AppLayout";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}

