import React, { useState, useEffect } from 'react';
import { useApp } from '../../lib/context/AppContext';
import type { UserRole } from '../../types';
import {
  Bell,
  Search,
  Globe,
  Sun,
  Moon,
  ChevronDown,
  Shield,
  Check,
  Clock,
  Sparkles,
  Command,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

interface AppHeaderProps {
  onOpenCommandPalette?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onOpenCommandPalette }) => {
  const {
    currentUser,
    currentRole,
    setCurrentRole,
    language,
    setLanguage,
    notifications,
    markNotificationRead,
    t,
  } = useApp();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());

  // Live Clock (AST / Riyadh Time)
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const roleLabels: Record<UserRole, { ar: string; en: string }> = {
    super_admin: { ar: 'مدير عام النظام (Super Admin)', en: 'Super Admin' },
    hr_manager: { ar: 'مدير الموارد البشرية (HR Manager)', en: 'HR Manager' },
    payroll_specialist: { ar: 'أخصائي الرواتب (Payroll)', en: 'Payroll Specialist' },
    line_manager: { ar: 'مدير مباشر (Line Manager)', en: 'Line Manager' },
    employee: { ar: 'موظف (Employee ESS)', en: 'Employee (ESS)' },
    recruiter: { ar: 'مسؤول توظيف (Recruiter)', en: 'Recruiter' },
    finance_auditor: { ar: 'مدقق مالي (Finance Auditor)', en: 'Finance Auditor' },
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-card/80 px-4 md:px-6 backdrop-blur-md">
      {/* Search & Fast Command Bar */}
      <div className="flex items-center gap-3 w-72 md:w-96">
        <button
          onClick={onOpenCommandPalette}
          className="flex h-9 w-full items-center justify-between rounded-lg border bg-muted/40 px-3 text-xs text-muted-foreground hover:bg-muted/70 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>بحث سريع في المنظومة...</span>
          </div>
          <kbd className="hidden sm:inline-block rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Controls & Live Time */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Live Saudi Clock */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-lg border bg-muted/20 px-3 py-1.5 text-xs font-mono text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
          <span>
            {liveTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (الرياض)
          </span>
        </div>

        {/* Dynamic Role Switcher (Super Admin, HR, Manager, ESS) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-primary/30 bg-primary/5 text-xs font-bold text-primary hover:bg-primary/10"
            >
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{roleLabels[currentRole][language]}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              تبديل الدور لمحاكاة الصلاحيات:
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(roleLabels) as UserRole[]).map(r => (
              <DropdownMenuItem
                key={r}
                onClick={() => setCurrentRole(r)}
                className="flex items-center justify-between text-xs font-medium cursor-pointer"
              >
                <span>{roleLabels[r][language]}</span>
                {currentRole === r && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language Switcher */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="h-9 w-9 text-xs font-bold"
          title={language === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
        >
          <Globe className="h-4 w-4" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="h-9 w-9 text-muted-foreground"
        >
          {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-80 sm:w-96">
            <SheetHeader>
              <SheetTitle className="text-base font-bold flex items-center justify-between">
                <span>{language === 'ar' ? 'التنبيهات' : 'Notifications'}</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} جديد
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription className="text-xs">
                الإشعارات والتنبيهات المباشرة لطلبات الاعتماد وحركات الموظفين
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">لا توجد إشعارات</p>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={`rounded-xl border p-3 text-xs transition-colors cursor-pointer ${
                      n.isRead ? 'bg-card text-muted-foreground' : 'bg-primary/5 border-primary/20 text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{language === 'ar' ? n.titleAr : n.titleEn}</span>
                      <span className="text-[10px] text-muted-foreground">منذ قليل</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      {language === 'ar' ? n.messageAr : n.messageEn}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 border-s ps-3">
          <img
            src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={currentUser.firstNameAr}
            className="h-8 w-8 rounded-full border object-cover shadow-xs"
          />
          <div className="hidden xl:block text-start">
            <span className="text-xs font-bold text-foreground block leading-none">
              {language === 'ar'
                ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`
                : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`}
            </span>
            <span className="text-[10px] text-muted-foreground">{currentUser.jobTitleAr}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
