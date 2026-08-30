import React, { useState, useEffect } from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  Search,
  Users,
  CalendarDays,
  Clock,
  Wallet,
  Receipt,
  Award,
  Briefcase,
  Package,
  FileBarChart,
  Shield,
  Smartphone,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '../ui/dialog';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tabId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  onNavigate,
}) => {
  const { employees, language, t } = useApp();
  const [query, setQuery] = useState('');

  // Keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const quickNav = [
    { id: 'dashboard', labelAr: 'لوحة المتابعة والمؤشرات الرئيسية', icon: FileBarChart, cat: 'الرئيسية' },
    { id: 'employees', labelAr: 'دليل وسجل الموظفين والملفات 360°', icon: Users, cat: 'شؤون الموظفين' },
    { id: 'attendance', labelAr: 'لوحة الحضور والانصراف والبصمات GPS', icon: Clock, cat: 'الوقت والدوام' },
    { id: 'leaves', labelAr: 'أرصدة الإجازات وتقديم طلب إجازة', icon: CalendarDays, cat: 'الوقت والدوام' },
    { id: 'payroll', labelAr: 'مسيرات الرواتب الشهرية وملفات حماية الأجور WPS', icon: Wallet, cat: 'المالية والرواتب' },
    { id: 'loans', labelAr: 'السلف الشهرية ومخالصة نهاية الخدمة EOSB', icon: Wallet, cat: 'المالية والرواتب' },
    { id: 'expenses', labelAr: 'إدارة النفقات ورفع فواتير المصروفات', icon: Receipt, cat: 'المالية والرواتب' },
    { id: 'ats', labelAr: 'التوظيف وتتبع المرشحين (Kanban Pipeline)', icon: Briefcase, cat: 'استقطاب المواهب' },
    { id: 'performance', labelAr: 'تقييمات الأداء ودورات 360° Review', icon: Award, cat: 'استقطاب المواهب' },
    { id: 'assets', labelAr: 'سجل العهد والأجهزة وسياسات الشركة', icon: Package, cat: 'البيئة المؤسسية' },
    { id: 'reports', labelAr: 'كتالوج التقارير ومولد الاستعلامات المخصص', icon: FileBarChart, cat: 'التقارير والإحصائيات' },
    { id: 'integrations', labelAr: 'مركز القيود المحاسبية وتكاملات ERP', icon: Shield, cat: 'التكامل والأمان' },
    { id: 'ess', labelAr: 'بوابة الخدمة الذاتية وتطبيق الجوال الذكي', icon: Smartphone, cat: 'الخدمة الذاتية' },
  ];

  const filteredNav = quickNav.filter(item =>
    item.labelAr.toLowerCase().includes(query.toLowerCase())
  );

  const filteredEmployees = employees.filter(emp =>
    emp.firstNameAr.includes(query) ||
    emp.lastNameAr.includes(query) ||
    emp.employeeNo.toLowerCase().includes(query.toLowerCase()) ||
    emp.jobTitleAr.includes(query)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-2 shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center border-b px-3.5 bg-muted/20">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="ابحث عن موظف، شاشة، مسير رواتب، أو إجراء سريع..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-12 w-full bg-transparent px-3 text-xs focus:outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="hidden sm:inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3 text-xs">
          {/* Navigation Items */}
          {filteredNav.length > 0 && (
            <div className="space-y-1">
              <span className="px-2 text-[10px] font-bold uppercase text-muted-foreground">
                الشاشات والوحدات الوظيفية
              </span>
              {filteredNav.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 hover:bg-primary/10 hover:text-primary transition-colors text-start"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{item.labelAr}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] opacity-70">
                      {item.cat}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}

          {/* Employee Matches */}
          {query.length > 0 && filteredEmployees.length > 0 && (
            <div className="space-y-1 border-t pt-2">
              <span className="px-2 text-[10px] font-bold uppercase text-muted-foreground">
                سجل الموظفين المتطابقين ({filteredEmployees.length})
              </span>
              {filteredEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => {
                    onNavigate('employees');
                    onOpenChange(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 hover:bg-primary/10 transition-colors text-start"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={emp.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={emp.firstNameAr}
                      className="h-6 w-6 rounded-full border object-cover"
                    />
                    <div>
                      <span className="font-bold text-foreground">
                        {emp.firstNameAr} {emp.lastNameAr}
                      </span>
                      <span className="text-[10px] text-muted-foreground mr-2 font-mono">
                        ({emp.employeeNo}) • {emp.jobTitleAr}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-primary">{emp.totalSalary.toLocaleString()} ر.س</span>
                </button>
              ))}
            </div>
          )}

          {filteredNav.length === 0 && filteredEmployees.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-xs">
              لم يتم العثور على نتائج مطابقة لـ "{query}"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
