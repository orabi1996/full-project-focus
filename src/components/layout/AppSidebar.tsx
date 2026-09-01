import React from "react";
import { useApp } from "../../lib/context/AppContext";
import { IconSymbol, type IconSource } from "../ui/IconSymbol";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "../ui/badge";
import { canAccessModule } from "../../lib/auth/permissions";

interface AppSidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItemConfig {
  id: string;
  label: string;
  iconName: string;
  iconSource: IconSource;
  badge?: string | number;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
}) => {
  const { language, direction, t, requests, attendanceRecords, currentRole } = useApp();

  const pendingRequestsCount = requests.filter((r) => r.status === "pending_approval").length;
  const lateAttendanceCount = attendanceRecords.filter((a) => a.status === "late").length;

  const navGroups: { groupTitle: string; items: NavItemConfig[] }[] = [
    {
      groupTitle: language === "ar" ? "الرئيسية" : "General",
      items: [
        {
          id: "dashboard",
          label: t.nav.dashboard,
          iconName: "dashboard",
          iconSource: "material",
        },
      ],
    },
    {
      groupTitle: language === "ar" ? "شؤون الموظفين والهيكل" : "Workforce & Org",
      items: [
        {
          id: "organization",
          label: t.nav.organization,
          iconName: "corporate_fare",
          iconSource: "material",
        },
        {
          id: "employees",
          label: t.nav.employees,
          iconName: "badge",
          iconSource: "material",
        },
        {
          id: "rbac",
          label: t.nav.rbac,
          iconName: "admin_panel_settings",
          iconSource: "material",
        },
      ],
    },
    {
      groupTitle: language === "ar" ? "الوقت والعمليات اليومية" : "Time & Operations",
      items: [
        {
          id: "workflow",
          label: t.nav.workflow,
          iconName: "approval_delegation",
          iconSource: "material",
          badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
          badgeVariant: "destructive",
        },
        {
          id: "leaves",
          label: t.nav.leaves,
          iconName: "event_available",
          iconSource: "material",
        },
        {
          id: "attendance",
          label: t.nav.attendance,
          iconName: "schedule",
          iconSource: "material",
          badge: lateAttendanceCount > 0 ? lateAttendanceCount : undefined,
          badgeVariant: "secondary",
        },
        {
          id: "shifts",
          label: t.nav.shifts,
          iconName: "calendar_month",
          iconSource: "material",
        },
      ],
    },
    {
      groupTitle: language === "ar" ? "الرواتب والمالية" : "Payroll & Finance",
      items: [
        {
          id: "payroll",
          label: t.nav.payroll,
          iconName: "account_balance_wallet",
          iconSource: "material",
        },
        {
          id: "loans",
          label: t.nav.loans,
          iconName: "credit_card",
          iconSource: "material",
        },
        {
          id: "expenses",
          label: t.nav.expenses,
          iconName: "receipt_long",
          iconSource: "material",
        },
      ],
    },
    {
      groupTitle: language === "ar" ? "المواهب وتطوير الأداء" : "Talent & Growth",
      items: [
        {
          id: "ats",
          label: t.nav.ats,
          iconName: "person_search",
          iconSource: "material",
        },
        {
          id: "performance",
          label: t.nav.performance,
          iconName: "stars",
          iconSource: "material",
        },
        {
          id: "workforce",
          label: t.nav.workforce,
          iconName: "monitoring",
          iconSource: "material",
        },
      ],
    },
    {
      groupTitle: language === "ar" ? "البيئة المؤسسية والتكامل" : "Ecosystem & Governance",
      items: [
        {
          id: "assets",
          label: t.nav.assets,
          iconName: "devices",
          iconSource: "material",
        },
        {
          id: "reports",
          label: t.nav.reports,
          iconName: "analytics",
          iconSource: "material",
        },
        {
          id: "integrations",
          label: t.nav.integrations,
          iconName: "hub",
          iconSource: "material",
        },
        {
          id: "audit",
          label: t.nav.audit,
          iconName: "verified_user",
          iconSource: "material",
        },
      ],
    },
    {
      groupTitle: language === "ar" ? "الخدمة الذاتية" : "Self-Service",
      items: [
        {
          id: "ess",
          label: t.nav.ess,
          iconName: "smartphone",
          iconSource: "material",
          badge: "ESS",
          badgeVariant: "default",
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed inset-y-0 start-0 z-50 flex flex-col border-e border-border/80 bg-sidebar shadow-xl transition-all duration-300 select-none md:relative md:z-auto md:translate-x-0 md:shadow-none ${
        mobileOpen
          ? "translate-x-0"
          : direction === "rtl"
            ? "translate-x-full"
            : "-translate-x-full"
      } ${collapsed ? "w-20" : "w-72"}`}
    >
      {/* Brand Header (Google Material 3 Style) */}
      <div className="flex h-20 items-center justify-between px-5 border-b border-border/60">
        {!collapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground font-black text-xl shadow-md shadow-primary/25">
              HR
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-black text-foreground tracking-tight truncate flex items-center gap-1.5">
                {t.appName}
                <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500" />
              </span>
              <span className="text-[11px] text-muted-foreground font-medium truncate">
                {t.appTagline}
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground font-black text-xl shadow-md shadow-primary/25">
            HR
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs hover:text-foreground hover:bg-muted md:flex transition-colors"
        >
          {direction === "rtl" ? (
            collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation List with M3 Pill Indicators & Material Symbols */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                {group.groupTitle}
              </p>
            )}
            {group.items
              .filter((item) => canAccessModule(currentRole, item.id))
              .map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onMobileClose?.();
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? "bg-secondary text-secondary-foreground shadow-xs"
                        : "text-foreground/75 hover:bg-muted hover:text-foreground"
                    } ${collapsed ? "justify-center px-0 h-11 w-11 mx-auto" : ""}`}
                  >
                    <IconSymbol
                      name={item.iconName}
                      source={item.iconSource}
                      filled={isActive}
                      size={20}
                      className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? "text-primary font-black" : "text-muted-foreground"
                      }`}
                    />
                    {!collapsed && <span className="flex-1 text-start truncate">{item.label}</span>}
                    {!collapsed && item.badge !== undefined && (
                      <Badge
                        variant={item.badgeVariant || "secondary"}
                        className="h-5 px-2 text-[10px] font-black rounded-full shadow-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                );
              })}
          </div>
        ))}
      </div>

      {/* Footer Status Badge */}
      {!collapsed && (
        <div className="border-t border-border/60 p-4 bg-muted/20">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-semibold">نظام الموارد المؤسسي M3</span>
            <span className="font-mono bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full text-[10px]">
              v2.0 (2026)
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
