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
      className={`relative flex flex-col border-r border-border bg-card transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-lg shadow-sm">
              HR
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-extrabold text-foreground truncate">
                {t.appName}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {t.appTagline}
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-lg shadow-sm">
            HR
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="hidden h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground md:flex"
        >
          {direction === 'rtl' ? (
            collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!collapsed && (
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
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
                  className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  />
                  {!collapsed && (
                    <span className="flex-1 text-start truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge !== undefined && (
                    <Badge
                      variant={item.badgeVariant || 'secondary'}
                      className="h-4 px-1.5 text-[10px] font-bold"
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

      {/* Footer Info */}
      {!collapsed && (
        <div className="border-t p-3 text-[11px] text-muted-foreground text-center">
          <span>الإصدار v1.0 • معتمد للنظام السعودي</span>
        </div>
      )}
    </aside>
  );
};
