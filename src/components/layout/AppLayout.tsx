import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { CommandPalette } from './CommandPalette';
import { DashboardView } from '../dashboard/DashboardView';
import { OrganizationView } from '../organization/OrganizationView';
import { EmployeesView } from '../employees/EmployeesView';
import { RbacView } from '../rbac/RbacView';
import { WorkflowView } from '../workflow/WorkflowView';
import { LeavesView } from '../leaves/LeavesView';
import { AttendanceView } from '../attendance/AttendanceView';
import { ShiftsView } from '../shifts/ShiftsView';
import { PayrollView } from '../payroll/PayrollView';
import { ExpensesView } from '../expenses/ExpensesView';
import { PerformanceView } from '../performance/PerformanceView';
import { RecruitmentView } from '../recruitment/RecruitmentView';
import { AssetsView } from '../assets/AssetsView';
import { ReportsView } from '../reports/ReportsView';
import { IntegrationsView } from '../integrations/IntegrationsView';
import { AuditView } from '../audit/AuditView';
import { EssMobileView } from '../ess/EssMobileView';

export const AppLayout: React.FC = () => {
  const { language, direction } = useApp();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentTab} />;
      case 'organization':
        return <OrganizationView />;
      case 'employees':
        return <EmployeesView />;
      case 'rbac':
        return <RbacView />;
      case 'workflow':
        return <WorkflowView />;
      case 'leaves':
        return <LeavesView />;
      case 'attendance':
        return <AttendanceView />;
      case 'shifts':
        return <ShiftsView />;
      case 'payroll':
      case 'loans':
        return <PayrollView />;
      case 'expenses':
        return <ExpensesView />;
      case 'performance':
        return <PerformanceView />;
      case 'ats':
      case 'workforce':
        return <RecruitmentView />;
      case 'assets':
        return <AssetsView />;
      case 'reports':
        return <ReportsView />;
      case 'integrations':
        return <IntegrationsView />;
      case 'audit':
        return <AuditView />;
      case 'ess':
        return <EssMobileView onNavigate={setCurrentTab} />;
      default:
        return <DashboardView onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div
      dir={direction}
      className={`flex h-screen w-full overflow-hidden bg-background text-foreground ${
        direction === 'rtl' ? 'font-sans' : 'font-sans'
      }`}
    >
      {/* Global Command Palette */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onNavigate={setCurrentTab}
      />

      {/* Sidebar */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <AppHeader onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

        {/* Dynamic Page Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/15">
          <div className="mx-auto max-w-7xl">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
};
