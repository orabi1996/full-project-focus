import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { CommandPalette } from "./CommandPalette";
import { ViewErrorBoundary } from "../ui/ViewErrorBoundary";
import { canAccessModule } from "../../lib/auth/permissions";
import { LayoutDashboard, Users, Clock, CheckSquare, Smartphone } from "lucide-react";

const DashboardView = lazy(() =>
  import("../dashboard/DashboardView").then((module) => ({ default: module.DashboardView })),
);
const OrganizationView = lazy(() =>
  import("../organization/OrganizationView").then((module) => ({
    default: module.OrganizationView,
  })),
);
const EmployeesView = lazy(() =>
  import("../employees/EmployeesView").then((module) => ({ default: module.EmployeesView })),
);
const DocumentVaultView = lazy(() =>
  import("../documents/DocumentVaultView").then((module) => ({
    default: module.DocumentVaultView,
  })),
);
const RbacView = lazy(() =>
  import("../rbac/RbacView").then((module) => ({ default: module.RbacView })),
);
const WorkflowView = lazy(() =>
  import("../workflow/WorkflowView").then((module) => ({ default: module.WorkflowView })),
);
const LeavesView = lazy(() =>
  import("../leaves/LeavesView").then((module) => ({ default: module.LeavesView })),
);
const AttendanceView = lazy(() =>
  import("../attendance/AttendanceView").then((module) => ({ default: module.AttendanceView })),
);
const ShiftsView = lazy(() =>
  import("../shifts/ShiftsView").then((module) => ({ default: module.ShiftsView })),
);
const PayrollView = lazy(() =>
  import("../payroll/PayrollView").then((module) => ({ default: module.PayrollView })),
);
const ExpensesView = lazy(() =>
  import("../expenses/ExpensesView").then((module) => ({ default: module.ExpensesView })),
);
const PerformanceView = lazy(() =>
  import("../performance/PerformanceView").then((module) => ({ default: module.PerformanceView })),
);
const RecruitmentView = lazy(() =>
  import("../recruitment/RecruitmentView").then((module) => ({ default: module.RecruitmentView })),
);
const AssetsView = lazy(() =>
  import("../assets/AssetsView").then((module) => ({ default: module.AssetsView })),
);
const ReportsView = lazy(() =>
  import("../reports/ReportsView").then((module) => ({ default: module.ReportsView })),
);
const IntegrationsView = lazy(() =>
  import("../integrations/IntegrationsView").then((module) => ({
    default: module.IntegrationsView,
  })),
);
const AuditView = lazy(() =>
  import("../audit/AuditView").then((module) => ({ default: module.AuditView })),
);
const EssMobileView = lazy(() =>
  import("../ess/EssMobileView").then((module) => ({ default: module.EssMobileView })),
);

const VALID_TABS = new Set([
  "dashboard",
  "organization",
  "employees",
  "documents",
  "rbac",
  "workflow",
  "leaves",
  "attendance",
  "shifts",
  "payroll",
  "loans",
  "expenses",
  "performance",
  "ats",
  "workforce",
  "assets",
  "reports",
  "integrations",
  "audit",
  "ess",
]);

export const AppLayout: React.FC = () => {
  const { direction, currentRole, requests, dataMode, isDataLoading, dataError, refreshCoreData } =
    useApp();
  const pendingRequestsCount = requests?.filter((r) => r.status === "pending_approval").length || 0;
  const initialTab =
    typeof window === "undefined" ? "dashboard" : window.location.hash.replace("#", "");
  const [currentTab, setCurrentTab] = useState(
    VALID_TABS.has(initialTab) ? initialTab : "dashboard",
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const selectTab = useCallback(
    (tab: string) => {
      const nextTab = VALID_TABS.has(tab) && canAccessModule(currentRole, tab) ? tab : "dashboard";
      setCurrentTab(nextTab);
      if (typeof window !== "undefined" && window.location.hash !== `#${nextTab}`) {
        window.history.pushState(null, "", `#${nextTab}`);
      }
    },
    [currentRole],
  );

  useEffect(() => {
    const syncFromUrl = () => {
      const tab = window.location.hash.replace("#", "");
      setCurrentTab(VALID_TABS.has(tab) && canAccessModule(currentRole, tab) ? tab : "dashboard");
    };
    window.addEventListener("hashchange", syncFromUrl);
    return () => window.removeEventListener("hashchange", syncFromUrl);
  }, [currentRole]);

  useEffect(() => {
    if (!canAccessModule(currentRole, currentTab)) selectTab("dashboard");
  }, [currentRole, currentTab, selectTab]);

  const renderActiveView = () => {
    switch (currentTab) {
      case "dashboard":
        return <DashboardView onNavigate={selectTab} />;
      case "organization":
        return <OrganizationView />;
      case "employees":
        return <EmployeesView />;
      case "documents":
        return dataMode === "demo" ? (
          <DocumentVaultView />
        ) : (
          <div role="status" className="rounded-2xl border bg-card p-8 text-center text-sm">
            مستودع الوثائق متاح للعرض التجريبي. رفع الملفات وحفظها للحسابات الحقيقية لم يُربط بخدمة
            التخزين بعد.
          </div>
        );
      case "rbac":
        return <RbacView />;
      case "workflow":
        return <WorkflowView />;
      case "leaves":
        return <LeavesView />;
      case "attendance":
        return <AttendanceView />;
      case "shifts":
        return <ShiftsView />;
      case "payroll":
        return <PayrollView key="payroll" section="payroll" />;
      case "loans":
        return <PayrollView key="loans" section="loans" />;
      case "expenses":
        return <ExpensesView />;
      case "performance":
        return <PerformanceView />;
      case "ats":
        return <RecruitmentView key="ats" section="ats" />;
      case "workforce":
        return <RecruitmentView key="workforce" section="workforce" />;
      case "assets":
        return <AssetsView />;
      case "reports":
        return <ReportsView />;
      case "integrations":
        return <IntegrationsView />;
      case "audit":
        return <AuditView />;
      case "ess":
        return <EssMobileView onNavigate={selectTab} />;
      default:
        return <DashboardView onNavigate={selectTab} />;
    }
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
        onNavigate={selectTab}
      />

      {/* Sidebar */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={selectTab}
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
          onSelectTab={selectTab}
        />

        {/* Dynamic Page Body */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-muted/15">
          <div className="w-full">
            <ViewErrorBoundary key={currentTab}>
              <Suspense
                fallback={
                  <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                    جاري تحميل الوحدة…
                  </div>
                }
              >
                {dataMode === "live" && (isDataLoading || dataError) ? (
                  <div
                    role={dataError ? "alert" : "status"}
                    className="rounded-2xl border bg-card p-8 text-center text-sm"
                  >
                    <p>
                      {isDataLoading
                        ? "جارٍ تحميل بيانات المؤسسة…"
                        : "تعذر تحميل بيانات المؤسسة. تحقق من الاتصال أو الصلاحيات."}
                    </p>
                    {!isDataLoading && dataError && (
                      <button
                        type="button"
                        className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
                        onClick={() => void refreshCoreData().catch(() => undefined)}
                      >
                        إعادة المحاولة
                      </button>
                    )}
                  </div>
                ) : (
                  renderActiveView()
                )}
              </Suspense>
            </ViewErrorBoundary>
          </div>
        </main>

        {/* Mobile Fast Navigation Bar (Classera Pulse Mobile) */}
        <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border/80 bg-card/95 backdrop-blur-xl px-2 py-1.5 md:hidden shadow-lg select-none">
          <button
            type="button"
            onClick={() => selectTab("dashboard")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              currentTab === "dashboard"
                ? "text-primary font-black scale-105"
                : "text-muted-foreground hover:text-foreground font-semibold"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px]">الرئيسية</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab("employees")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              currentTab === "employees"
                ? "text-primary font-black scale-105"
                : "text-muted-foreground hover:text-foreground font-semibold"
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px]">الموظفون</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab("attendance")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              currentTab === "attendance"
                ? "text-primary font-black scale-105"
                : "text-muted-foreground hover:text-foreground font-semibold"
            }`}
          >
            <Clock className="h-5 w-5" />
            <span className="text-[10px]">الحضور</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab("workflow")}
            className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              currentTab === "workflow"
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
            onClick={() => selectTab("ess")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              currentTab === "ess"
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
