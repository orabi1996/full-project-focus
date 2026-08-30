import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import type { UserRole } from '../../types';
import {
  Bell,
  Globe,
  Sun,
  Moon,
  Search,
  UserCheck,
  Shield,
  Briefcase,
  CheckCircle2,
  Clock,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

export const AppHeader: React.FC<{ onMobileMenuToggle?: () => void }> = () => {
  const {
    language,
    direction,
    toggleLanguage,
    t,
    currentRole,
    setCurrentRole,
    currentUser,
    notifications,
    markNotificationRead,
  } = useApp();

  const [isDark, setIsDark] = useState(false);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const roleLabels: Record<UserRole, { ar: string; en: string; icon: any }> = {
    super_admin: { ar: 'مشرف النظام (Super Admin)', en: 'Super Admin', icon: Shield },
    hr_manager: { ar: 'مدير الموارد البشرية (HR Manager)', en: 'HR Manager', icon: Briefcase },
    payroll_officer: { ar: 'مشرف الرواتب (Payroll Officer)', en: 'Payroll Officer', icon: UserCheck },
    attendance_officer: { ar: 'مسؤول الحضور (Attendance Officer)', en: 'Attendance Officer', icon: Clock },
    line_manager: { ar: 'مدير مباشر (Line Manager)', en: 'Line Manager', icon: Briefcase },
    recruiter: { ar: 'مسؤول التوظيف (Recruiter)', en: 'Recruiter', icon: UserCheck },
    finance_officer: { ar: 'مسؤول المالية (Finance Officer)', en: 'Finance Officer', icon: UserCheck },
    performance_lead: { ar: 'مسؤول الأداء (Performance Lead)', en: 'Performance Lead', icon: UserCheck },
    employee: { ar: 'الخدمة الذاتية (Employee ESS)', en: 'Employee (ESS)', icon: UserCheck },
    auditor: { ar: 'مدقق (Auditor Read-only)', en: 'Auditor', icon: Shield },
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-card/90 px-4 backdrop-blur-md transition-colors md:px-6">
      {/* Search Bar */}
      <div className="flex flex-1 items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search
            className={`absolute top-2.5 h-4 w-4 text-muted-foreground ${
              direction === 'rtl' ? 'right-3' : 'left-3'
            }`}
          />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            className={`h-9 w-full rounded-full border bg-muted/40 text-sm transition-colors focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              direction === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'
            }`}
          />
        </div>
      </div>

      {/* Action Controls & Role Switcher */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Role Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden gap-2 sm:flex">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">
                {language === 'ar' ? roleLabels[currentRole]?.ar : roleLabels[currentRole]?.en}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={direction === 'rtl' ? 'start' : 'end'} className="w-64">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t.switchRole}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(roleLabels) as UserRole[]).map(roleKey => (
              <DropdownMenuItem
                key={roleKey}
                onClick={() => setCurrentRole(roleKey)}
                className={`flex items-center justify-between text-xs cursor-pointer ${
                  currentRole === roleKey ? 'bg-primary/10 font-bold text-primary' : ''
                }`}
              >
                <span>{language === 'ar' ? roleLabels[roleKey].ar : roleLabels[roleKey].en}</span>
                {currentRole === roleKey && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language Switcher */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLanguage}
          title={language === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
          className="rounded-full"
        >
          <Globe className="h-4 w-4 text-foreground" />
          <span className="sr-only">Language</span>
        </Button>

        {/* Dark Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          title={isDark ? t.lightMode : t.darkMode}
          className="rounded-full"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-700" />}
          <span className="sr-only">Theme</span>
        </Button>

        {/* Notifications Sheet Drawer */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-full">
              <Bell className="h-4 w-4 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side={direction === 'rtl' ? 'left' : 'right'} className="w-80 sm:w-96 p-4">
            <SheetHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-base font-bold">{t.notifications}</SheetTitle>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} جديد
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-xs">
                تحديثات فورية حول اعتماداتك ومسيرات الرواتب والحضور
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-140px)]">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">{t.noData}</div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => markNotificationRead(notif.id)}
                    className={`rounded-lg border p-3 text-xs transition-colors cursor-pointer ${
                      notif.isRead ? 'bg-background opacity-75' : 'bg-primary/5 border-primary/20 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <span className="font-semibold text-foreground">
                        {language === 'ar' ? notif.titleAr : notif.titleEn}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(notif.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      {language === 'ar' ? notif.messageAr : notif.messageEn}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* User Avatar Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 rounded-full p-1 hover:bg-muted">
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={currentUser.firstNameEn}
                className="h-8 w-8 rounded-full border object-cover shadow-sm"
              />
              <div className="hidden text-start md:block">
                <p className="text-xs font-bold leading-none text-foreground">
                  {language === 'ar'
                    ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`
                    : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{currentUser.jobTitleAr}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={direction === 'rtl' ? 'start' : 'end'} className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">
                  {language === 'ar'
                    ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`
                    : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`}
                </span>
                <span className="text-[10px] text-muted-foreground">{currentUser.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs cursor-pointer">
              <UserCheck className="mr-2 h-3.5 w-3.5" />
              {t.nav.ess}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer">
              <Shield className="mr-2 h-3.5 w-3.5" />
              {t.nav.rbac}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-destructive cursor-pointer">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
