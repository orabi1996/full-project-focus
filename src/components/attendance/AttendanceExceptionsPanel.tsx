import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  Clock,
  MapPin,
  XCircle,
  FileText,
  UserCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  useAttendanceExceptions,
  useAttendanceMutations,
} from "../../lib/domains/attendance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

interface Props {
  canManage: boolean;
}

export const AttendanceExceptionsPanel: React.FC<Props> = ({ canManage }) => {
  const [filterResolved, setFilterResolved] = useState<"all" | "open" | "resolved">("open");
  const [searchTerm, setSearchTerm] = useState("");

  const filters = {
    resolved: filterResolved === "all" ? undefined : filterResolved === "resolved",
  };
  const { exceptions, isLoading } = useAttendanceExceptions(filters);
  const { resolveException } = useAttendanceMutations();

  const [activeExceptionId, setActiveExceptionId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredExceptions = exceptions.filter((exc) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      exc.employeeName?.toLowerCase().includes(term) ||
      exc.employeeNo?.toLowerCase().includes(term) ||
      exc.description?.toLowerCase().includes(term)
    );
  });

  const handleResolve = async () => {
    if (!activeExceptionId || !resolutionNote.trim()) return;
    setIsSubmitting(true);
    try {
      await resolveException(activeExceptionId, resolutionNote.trim());
      setActiveExceptionId(null);
      setResolutionNote("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExceptionBadge = (type: string) => {
    switch (type) {
      case "late_arrival":
        return <Badge className="bg-amber-500/10 text-amber-700 border-amber-300">تأخر في الحضور</Badge>;
      case "early_departure":
        return <Badge className="bg-orange-500/10 text-orange-700 border-orange-300">انصراف مبكر</Badge>;
      case "missing_in":
      case "missing_out":
        return <Badge className="bg-rose-500/10 text-rose-700 border-rose-300">بصمة ناقصة</Badge>;
      case "geofence_breach":
        return <Badge className="bg-purple-500/10 text-purple-700 border-purple-300">تجاوز النطاق الجغرافي</Badge>;
      case "unexcused_absence":
        return <Badge className="bg-red-500/10 text-red-700 border-red-300">غياب غير مبرر</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        جاري تحميل الاستثناءات والمخالفات…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl border border-border/80 bg-card shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث بالموظف، الرقم الوظيفي…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/60 text-xs">
            <button
              onClick={() => setFilterResolved("open")}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterResolved === "open"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              المعلقة (قيد المعالجة)
            </button>
            <button
              onClick={() => setFilterResolved("resolved")}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterResolved === "resolved"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              المعالجة والمعتمدة
            </button>
            <button
              onClick={() => setFilterResolved("all")}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filterResolved === "all"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              الكل
            </button>
          </div>
        </div>

        <Badge variant="outline" className="text-xs rounded-full">
          {filteredExceptions.length} حالة مسجلة
        </Badge>
      </div>

      {/* Exceptions List */}
      {filteredExceptions.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-3xl space-y-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
          <p className="font-bold text-foreground">لا توجد مخالفات أو استثناءات مطابقة للبحث</p>
          <p className="text-[11px]">سجلات الحضور والانصراف مطابقة لسياسات الدوام المعتمدة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExceptions.map((exc) => (
            <div
              key={exc.id}
              className={`p-5 rounded-3xl border transition-all space-y-3.5 bg-card shadow-xs ${
                exc.resolved ? "border-border/60 opacity-80" : "border-amber-500/30 hover:border-amber-500/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-foreground">{exc.employeeName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{exc.employeeNo}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{exc.departmentName}</div>
                </div>
                {getExceptionBadge(exc.exceptionType)}
              </div>

              <div className="p-3 rounded-2xl bg-muted/40 border border-border/50 text-xs text-muted-foreground leading-relaxed">
                {exc.description}
                {exc.minutes > 0 && (
                  <span className="font-bold text-foreground block mt-1 font-mono">
                    المدة: {exc.minutes} دقيقة
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                <span className="text-muted-foreground font-mono">
                  تاريخ الدوام: {exc.workDate}
                </span>

                {exc.resolved ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    تمت المعالجة: {exc.resolutionNote}
                  </Badge>
                ) : canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveExceptionId(exc.id)}
                    className="h-7 text-xs rounded-xl border-primary text-primary hover:bg-primary/10 gap-1 font-bold"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    معالجة الاستثناء
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                    بانتظار مراجعة المشرف
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve Exception Modal */}
      <Dialog open={Boolean(activeExceptionId)} onOpenChange={(open) => !open && setActiveExceptionId(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <UserCheck className="h-5 w-5 text-primary" />
              معالجة استثناء الدوام
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
              سجل ملاحظة أو مبرر المشرف لاعتماد أو تسوية هذا الاستثناء (مثل: إذن رسمي، عذر مروري، مهمة خارجية).
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <label className="text-xs font-bold text-foreground block">
              قرار وملاحظة المشرف *
            </label>
            <textarea
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="اكتب مبرر الاعتماد (مثال: تم قبول العذر لوجود تكليف ميداني رسمي خارج المقر)…"
              className="w-full p-3 rounded-2xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-start pt-4">
            <Button
              onClick={handleResolve}
              disabled={isSubmitting || !resolutionNote.trim()}
              className="rounded-2xl font-bold text-xs gap-1.5"
            >
              {isSubmitting ? "جاري الحفظ…" : "اعتماد وتسوية الاستثناء"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveExceptionId(null)}
              className="rounded-2xl text-xs"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
