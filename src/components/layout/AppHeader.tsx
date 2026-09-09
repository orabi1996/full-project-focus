import React, { useState, useEffect } from "react";
import { useApp } from "../../lib/context/AppContext";
import type { UserRole } from "../../types";
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
  Command,
  LogOut,
  Database,
  Menu,
  User,
  Smartphone,
  FileText,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { AppLogo, BrandLogoSwitcher } from "../common/AppLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { AccountSecurityModal } from "./AccountSecurityModal";

interface AppHeaderProps {
  onOpenCommandPalette?: () => void;
  onToggleMobileMenu?: () => void;
  onSelectTab?: (tabId: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenCommandPalette,
  onToggleMobileMenu,
  onSelectTab,
}) => {
  const {
    currentUser,
    currentRole,
    setCurrentRole,
    language,
    setLanguage,
    notifications,
    markNotificationRead,
    openEmployeeProfile,
    t,
    dataMode,
    isDataLoading,
    dataError,
    isSaving,
    pendingMutationCount,
    lastSavedAt,
  } = useApp();
  const { session, isDemo, signOut, leaveDemo } = useAuth();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // Live Clock (AST / Riyadh Time)
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const roleLabels: Record<UserRole, { ar: string; en: string }> = {
    super_admin: { ar: "مدير عام النظام (Super Admin)", en: "Super Admin" },
    hr_manager: { ar: "مدير الموارد البشرية (HR Manager)", en: "HR Manager" },
    payroll_officer: { ar: "أخصائي الرواتب (Payroll)", en: "Payroll Specialist" },
    attendance_officer: { ar: "مسؤول الحضور (Attendance)", en: "Attendance Officer" },
    performance_lead: { ar: "مسؤول الأداء (Performance)", en: "Performance Lead" },
    auditor: { ar: "مدقق (Auditor)", en: "Auditor" },
    line_manager: { ar: "مدير مباشر (Line Manager)", en: "Line Manager" },
    employee: { ar: "موظف (Employee ESS)", en: "Employee (ESS)" },
    recruiter: { ar: "مسؤول توظيف (Recruiter)", en: "Recruiter" },
    finance_officer: { ar: "مسؤول المالية (Finance)", en: "Finance Officer" },
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-border/70 bg-card/90 px-4 md:px-8 backdrop-blur-xl transition-all">
      {/* Search & Fast Command Bar with Mobile Menu Toggle */}
      <div className="flex items-center gap-2.5 w-72 md:w-96 lg:w-[440px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleMobileMenu}
          className="h-10 w-10 shrink-0 md:hidden rounded-full hover:bg-muted"
          title="فتح القائمة الرئيسية"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile Brand Logo */}
        <div className="md:hidden flex items-center shrink-0 bg-white rounded-xl px-1.5 py-1 border border-border/60 shadow-2xs">
          <AppLogo height={24} />
        </div>

        {/* Google M3 Unified Pill Search */}
        <button
          onClick={onOpenCommandPalette}
          className="flex h-11 w-full items-center justify-between rounded-full bg-muted/50 px-4 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#00B5FF]/50 border border-border/50 transition-all shadow-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">بحث سريع في الموظفين والعمليات...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] font-mono text-muted-foreground border shadow-xs shrink-0">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Controls & Status */}
      <div className="flex items-center gap-2.5 md:gap-3">
        {/* Subtle Live Data Connection Status Indicator */}
        <div
          className="hidden md:inline-flex items-center gap-2 h-9 rounded-full px-3.5 border border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground"
          title={
            dataError
              ? `الوضع المحلي: ${dataError}`
              : dataMode === "live"
                ? "متصل بالنظام السحابي المباشر"
                : "النسخة التجريبية التفاعلية"
          }
        >
          <span
            className={`h-2 w-2 rounded-full ${
              dataError
                ? "bg-amber-500"
                : dataMode === "live"
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  : "bg-primary shadow-[0_0_8px_rgba(0,181,255,0.5)]"
            }`}
          />
          <span className="text-[11px] font-medium">
            {dataError
              ? "الوضع المحلي"
              : dataMode === "live"
                ? isSaving
                  ? "جارٍ المزامنة..."
                  : "سحابي مباشر"
                : "نسخة تجريبية"}
          </span>
        </div>

        {/* Executive Riyadh Time */}
        <div className="hidden 2xl:flex items-center gap-1.5 text-xs font-mono text-muted-foreground px-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>
            {liveTime.toLocaleTimeString("ar-SA", {
              timeZone: "Asia/Riyadh",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            (الرياض)
          </span>
        </div>

        {/* Dynamic Role Indicator / Switcher Pill */}
        {isDemo ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full gap-2 border-primary/20 bg-secondary/70 text-xs font-bold text-secondary-foreground hover:bg-secondary shadow-2xs px-3.5"
              >
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">{roleLabels[currentRole][language]}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-2xl p-2 shadow-xl border-border/80"
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
                تبديل الدور لمحاكاة الصلاحيات:
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(roleLabels) as UserRole[]).map((r) => (
                <DropdownMenuItem
                  key={r}
                  onClick={() => setCurrentRole(r)}
                  className="flex items-center justify-between text-xs font-bold rounded-xl px-3 py-2 cursor-pointer transition-colors"
                >
                  <span>{roleLabels[r][language]}</span>
                  {currentRole === r && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge
            variant="outline"
            className="hidden lg:inline-flex h-9 rounded-full px-3.5 border-primary/25 bg-primary/5 text-primary text-xs font-bold gap-1.5 shadow-2xs"
          >
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span>{roleLabels[currentRole][language]}</span>
          </Badge>
        )}

        {/* Language Switcher Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          className="h-10 w-10 rounded-full hover:bg-muted font-bold text-xs"
          title={language === "ar" ? "Switch to English" : "التحويل للعربية"}
        >
          <Globe className="h-4 w-4" />
        </Button>

        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="h-10 w-10 rounded-full hover:bg-muted text-muted-foreground"
        >
          {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications Sheet Button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-full hover:bg-muted"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-black text-destructive-foreground ring-2 ring-card">
                  {unreadCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side={language === "ar" ? "left" : "right"}
            className="w-80 sm:w-96 rounded-3xl sm:m-3 p-5 shadow-2xl border-border"
          >
            <SheetHeader>
              <SheetTitle className="text-base font-black flex items-center justify-between">
                <span>{language === "ar" ? "التنبيهات" : "Notifications"}</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs font-bold rounded-full px-2.5">
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
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={`rounded-2xl border p-3.5 text-xs transition-all cursor-pointer shadow-xs ${
                      n.isRead
                        ? "bg-card text-muted-foreground"
                        : "bg-secondary/60 border-primary/20 text-foreground font-semibold"
                    }`}
                  >
                    <div className="flex items-center justify-between font-black">
                      <span>{language === "ar" ? n.titleAr : n.titleEn}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        منذ قليل
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      {language === "ar" ? n.messageAr : n.messageEn}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Interactive Enterprise User Account Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-2.5 rounded-full border border-border/80 bg-card/90 py-1 pe-3 ps-1.5 hover:bg-muted/60 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs cursor-pointer"
            >
              <div className="relative">
                <img
                  src={
                    currentUser.avatarUrl ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                  }
                  alt={currentUser.firstNameAr}
                  className="h-9 w-9 rounded-full border-2 border-primary/40 object-cover shadow-xs"
                />
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                  title="متصل الآن"
                />
              </div>

              <div className="hidden xl:flex flex-col text-start leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-foreground">
                    {language === "ar"
                      ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`.replace(/\(مدير النظام\)/g, "").trim()
                      : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`.replace(/\(مدير النظام\)/g, "").trim()}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </div>
                <span className="text-[10px] font-semibold text-primary/90 truncate max-w-[150px]">
                  {currentUser.jobTitleAr || roleLabels[currentRole][language]}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align={language === "ar" ? "start" : "end"}
            className="w-80 rounded-3xl p-3 shadow-2xl border-border/80 space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header: User Identity Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-muted/40 border border-primary/15 space-y-2.5 text-start">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    src={
                      currentUser.avatarUrl ||
                      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                    }
                    alt={currentUser.firstNameAr}
                    className="h-12 w-12 rounded-2xl border-2 border-primary/40 object-cover shadow-sm"
                  />
                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  <h4 className="text-xs font-black text-foreground truncate">
                    {language === "ar"
                      ? `${currentUser.firstNameAr} ${currentUser.lastNameAr}`.replace(/\(مدير النظام\)/g, "").trim()
                      : `${currentUser.firstNameEn} ${currentUser.lastNameEn}`.replace(/\(مدير النظام\)/g, "").trim()}
                  </h4>
                  <p className="text-[11px] font-mono text-primary font-bold truncate">
                    {session?.user?.email?.includes("focus-hrms")
                      ? "hr.admin@classera.com"
                      : session?.user?.email || (currentUser.email?.includes("focus-hrms") ? "hr.admin@classera.com" : currentUser.email) || "hr.admin@classera.com"}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium truncate">
                    {currentUser.jobTitleAr || "مدير عام المنظومة"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px]">
                <span className="font-mono text-muted-foreground">
                  رقم: {currentUser.employeeNo || "CLS-0001"}
                </span>
                <Badge variant="default" className="text-[9px] font-bold rounded-full px-2">
                  {roleLabels[currentRole][language]}
                </Badge>
              </div>
            </div>

            {/* Quick Actions Menu */}
            <div className="space-y-0.5">
              <DropdownMenuItem
                onClick={() => openEmployeeProfile(currentUser.id)}
                className="flex items-center gap-2.5 rounded-xl text-xs font-bold px-3 py-2 cursor-pointer hover:bg-secondary"
              >
                <User className="h-4 w-4 text-primary" />
                <span>الملف الشخصي والبيانات الوظيفية</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onSelectTab?.("ess")}
                className="flex items-center gap-2.5 rounded-xl text-xs font-bold px-3 py-2 cursor-pointer hover:bg-secondary"
              >
                <Smartphone className="h-4 w-4 text-emerald-600" />
                <div className="flex flex-col text-start">
                  <span>بوابة الخدمة الذاتية (ESS)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    طلب إجازة، قسيمة الراتب، الحضور، والعهد
                  </span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onSelectTab?.("documents")}
                className="flex items-center gap-2.5 rounded-xl text-xs font-bold px-3 py-2 cursor-pointer hover:bg-secondary"
              >
                <FileText className="h-4 w-4 text-blue-600" />
                <div className="flex flex-col text-start">
                  <span>مستودع وثائقي وشهاداتي</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    استعراض وطباعة الوثائق والتعاريف الرسمية
                  </span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onSelectTab?.("workflow")}
                className="flex items-center gap-2.5 rounded-xl text-xs font-bold px-3 py-2 cursor-pointer hover:bg-secondary"
              >
                <Clock className="h-4 w-4 text-amber-600" />
                <div className="flex flex-col text-start">
                  <span>طلباتي واعتماداتي</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    متابعة سير الموافقات والقرارات الإدارية
                  </span>
                </div>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator />

            {/* Brand Logo Options in Dropdown */}
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
              <span className="text-[10px] font-black text-muted-foreground block text-start">
                تفضيل نموذج الهوية والشعار:
              </span>
              <BrandLogoSwitcher className="w-full justify-center" />
            </div>

            <DropdownMenuSeparator />

            {/* Settings & Security */}
            <div className="space-y-0.5">
              <DropdownMenuItem
                onClick={() => setIsSecurityModalOpen(true)}
                className="flex items-center gap-2.5 rounded-xl text-xs font-bold px-3 py-2 cursor-pointer hover:bg-secondary"
              >
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>إعدادات الحساب والأمان وكلمة المرور</span>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator />

            {/* Sign out / Leave Demo */}
            <DropdownMenuItem
              onClick={() => (isDemo ? leaveDemo() : void signOut())}
              className="flex items-center gap-2.5 rounded-xl text-xs font-bold px-3 py-2 cursor-pointer text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>{isDemo ? "إغلاق النسخة التجريبية" : "تسجيل الخروج من الحساب"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Account & Security Modal */}
        <AccountSecurityModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
          userEmail={session?.user?.email || currentUser.email || "hr.admin@classera.com"}
        />
      </div>
    </header>
  );
};
