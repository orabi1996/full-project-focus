import React from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  GitPullRequest,
  CalendarDays,
  Clock,
  CalendarCheck,
  Wallet,
  Receipt,
  Award,
  TrendingUp,
  UserPlus,
  Package,
  FileBarChart,
  Network,
  History,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../ui/badge';

interface AppSidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
}) => {
  const { language, direction, t, requests, attendanceRecords } = useApp();

  const pendingRequestsCount = requests.filter(r => r.status === 'pending_approval').length;
  const lateAttendanceCount = attendanceRecords.filter(a => a.status === 'late').length;

  const navGroups = [
    {
      groupTitle: language === 'ar' ? 'الرئيسية' : 'General',
      items: [
        { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard, badge: undefined },
      ],
    },
    {
      groupTitle: language === 'ar' ? 'شؤون الموظفين والهيكل' : 'Workforce & Org',
      items: [
        { id: 'organization', label: t.nav.organization, icon: Building2, badge: undefined },
        { id: 'employees', label: t.nav.employees, icon: Users, badge: undefined },
        { id: 'rbac', label: t.nav.rbac, icon: ShieldCheck, badge: undefined },
      ],
    },
    {
      groupTitle: language === 'ar' ? 'الوقت والعمليات اليومية' : 'Time & Operations',
      items: [
        {
          id: 'workflow',
          label: t.nav.workflow,
          icon: GitPullRequest,
          badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
          badgeVariant: 'destructive' as const,
        },
        { id: 'leaves', label: t.nav.leaves, icon: CalendarDays, badge: undefined },
        {
          id: 'attendance',
          label: t.nav.attendance,
          icon: Clock,
          badge: lateAttendanceCount > 0 ? lateAttendanceCount : undefined,
          badgeVariant: 'secondary' as const,
        },
        { id: 'shifts', label: t.nav.shifts, icon: CalendarCheck, badge: undefined },
      ],
    },
    {
      groupTitle: language === 'ar' ? 'الرواتب والمالية' : 'Payroll & Finance',
      items: [
        { id: 'payroll', label: t.nav.payroll, icon: Wallet, badge: undefined },
        { id: 'loans', label: t.nav.loans, icon: Wallet, badge: undefined },
        { id: 'expenses', label: t.nav.expenses, icon: Receipt, badge: undefined },
      ],
    },
    {
      groupTitle: language === 'ar' ? 'المواهب وتطوير الأداء' : 'Talent & Growth',
      items: [
        { id: 'ats', label: t.nav.ats, icon: UserPlus, badge: undefined },
        { id: 'performance', label: t.nav.performance, icon: Award, badge: undefined },
        { id: 'workforce', label: t.nav.workforce, icon: TrendingUp, badge: undefined },
      ],
    },
    {
      groupTitle: language === 'ar' ? 'البيئة المؤسسية والتكامل' : 'Ecosystem & Governance',
      items: [
        { id: 'assets', label: t.nav.assets, icon: Package, badge: undefined },
        { id: 'reports', label: t.nav.reports, icon: FileBarChart, badge: undefined },
        { id: 'integrations', label: t.nav.integrations, icon: Network, badge: undefined },
        { id: 'audit', label: t.nav.audit, icon: History, badge: undefined },
      ],
    },
    {
      groupTitle: language === 'ar' ? 'الخدمة الذاتية' : 'Self-Service',
      items: [
        { id: 'ess', label: t.nav.ess, icon: Smartphone, badge: 'ESS' as const, badgeVariant: 'default' as const },
      ],
    },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-border/80 bg-sidebar transition-all duration-300 select-none ${
        collapsed ? 'w-20' : 'w-72'
      }`}
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
          {direction === 'rtl' ? (
            collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation List with M3 Pill Indicators */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                {group.groupTitle}
              </p>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex w-full items-center gap-3.5 rounded-full px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-secondary text-secondary-foreground shadow-xs'
                      : 'text-foreground/75 hover:bg-muted hover:text-foreground'
                  } ${collapsed ? 'justify-center px-0 h-11 w-11 mx-auto' : ''}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  {!collapsed && (
                    <span className="flex-1 text-start truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge !== undefined && (
                    <Badge
                      variant={item.badgeVariant || 'secondary'}
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
