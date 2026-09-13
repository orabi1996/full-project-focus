import React, { Suspense, useState } from "react";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { CommandPalette } from "./CommandPalette";
import { ViewErrorBoundary } from "../ui/ViewErrorBoundary";
import { LayoutDashboard, Users, Clock, CheckSquare, Smartphone } from "lucide-react";

export const AppLayout: React.FC = () => {
  const { direction, requests } = useApp();
  const pendingRequestsCount = requests?.filter((r) => r.status === "pending_approval").length || 0;
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const handleNavigate = (path: string) => {
    void navigate({ to: path as any });
  };

  return (
    <div
      dir={direction}
      className={`flex h-screen w-full overflow-hidden bg-background text-foreground ${
        direction === "rtl" ? "font-sans" : "font-sans"
      }`}
    >
      {/* Global Command Palette */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onNavigate={handleNavigate}
      />

      {/* Sidebar */}
      <AppSidebar
        currentPath={pathname}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden"
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <AppHeader
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
          onNavigate={handleNavigate}
        />

        {/* Dynamic Page Body: TanStack Router Outlet */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-muted/15">
          <div className="w-full">
            <ViewErrorBoundary key={pathname}>
              <Suspense
                fallback={
                  <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                    جاري تحميل الوحدة…
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </ViewErrorBoundary>
          </div>
        </main>

        {/* Mobile Fast Navigation Bar (Classera Pulse Mobile) */}
        <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border/80 bg-card/95 backdrop-blur-xl px-2 py-1.5 md:hidden shadow-lg select-none">
          <button
            type="button"
            onClick={() => handleNavigate("/dashboard")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              pathname === "/dashboard"
                ? "text-primary font-black scale-105"
                : "text-muted-foreground hover:text-foreground font-semibold"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px]">الرئيسية</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate("/employees")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              pathname.startsWith("/employees")
                ? "text-primary font-black scale-105"
                : "text-muted-foreground hover:text-foreground font-semibold"
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px]">الموظفون</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate("/attendance")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              pathname.startsWith("/attendance")
                ? "text-primary font-black scale-105"
                : "text-muted-foreground hover:text-foreground font-semibold"
            }`}
          >
            <Clock className="h-5 w-5" />
            <span className="text-[10px]">الحضور</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate("/workflows")}
            className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              pathname.startsWith("/workflows")
                ? "text-primary font-black scale-105"
                : "text-muted-foreground hover:text-foreground font-semibold"
            }`}
          >
            <CheckSquare className="h-5 w-5" />
            <span className="text-[10px]">الاعتمادات</span>
            {pendingRequestsCount > 0 && (
              <span className="absolute top-0.5 end-2.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNavigate("/ess")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              pathname.startsWith("/ess")
                ? "text-primary font-black scale-105"
                : "text-muted-foreground hover:text-foreground font-semibold"
            }`}
          >
            <Smartphone className="h-5 w-5" />
            <span className="text-[10px]">خدماتي ESS</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
