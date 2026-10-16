// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 35: PRODUCTION ENTERPRISE AI COPILOT & INTELLIGENCE ROUTE
// src/routes/_authenticated/ai-copilot.tsx
// ============================================================================

import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteGuard } from "../../components/auth/RouteGuard";

const AICopilotView = lazy(() =>
  import("../../components/ai/AICopilotView").then((m) => ({
    default: m.AICopilotView,
  })),
);

export const Route = createFileRoute("/_authenticated/ai-copilot")({
  head: () => ({
    meta: [{ title: "مساعد MadarX الذكي ومركز العمليات | MadarX AI" }],
  }),
  component: AICopilotRoute,
});

function AICopilotRoute() {
  return (
    <RouteGuard
      moduleId="ai_copilot"
      moduleNameAr="مساعد MadarX الذكي ومركز العمليات"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">جاري تشغيل مساعد MadarX الذكي...</p>
            </div>
          </div>
        }
      >
        <AICopilotView />
      </Suspense>
    </RouteGuard>
  );
}
