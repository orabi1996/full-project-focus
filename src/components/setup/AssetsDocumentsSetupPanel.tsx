import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import type { CompanyDocument } from "../../types";
import {
  Laptop,
  FileText,
  Plus,
  ExternalLink,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export const AssetsDocumentsSetupPanel: React.FC = () => {
  const { company, companyDocs, addCompanyDocument, currentRole } = useApp();
  const navigate = useNavigate();
  const canManage =
    canManageModule(currentRole, "setup") || canManageModule(currentRole, "assets");

  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<CompanyDocument["category"]>("policy");
  const [docFileUrl, setDocFileUrl] = useState("");
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  const handleCreateDoc = async () => {
    if (!docTitle.trim()) {
      toast.error("يرجى كتابة عنوان الوثيقة أو اللائحة");
      return;
    }
    if (isSubmittingDoc) return;
    setIsSubmittingDoc(true);

    try {
      const ok = await addCompanyDocument({
        titleAr: docTitle.trim(),
        titleEn: docTitle.trim(),
        category: docCategory,
        version: "v1.0",
        fileUrl: docFileUrl.trim(),
        requiresAcknowledgment: true,
        visibilityScope: "all",
      });
      if (ok) {
        toast.success(`تم نشر اللائحة (${docTitle}) وإتاحتها لجميع الموظفين لتأكيد القراءة!`);
        setIsAddDocOpen(false);
        setDocTitle("");
        setDocFileUrl("");
      }
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              تهيئة اللوائح الداخلية وتصنيفات العهد والوثائق لشركة «{company?.legalNameAr || "الأندلس"}»
            </h2>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">
              شاشة التهيئة والحوكمة
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            نشر اللوائح الداخلية الملزمة بالإقرار، وضبط تصنيفات العهد والوثائق، بينما يتم تسليم العهد وإصدار الشهادات في شاشات التشغيل.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/documents" })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
            مستودع الوثائق والشهادات
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/assets" })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            الانتقال لسجل العهد والأصول المسلمة
          </Button>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setIsAddDocOpen(true)}
              className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              نشر لائحة / سياسة داخلية جديدة
            </Button>
          )}
        </div>
      </div>

      {/* Section 1: Corporate Bylaws & Mandatory Acknowledgments */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              اللوائح والسياسات الداخلية المعتمدة وإقرارات الاطلاع ({companyDocs.length})
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full">
            إلزامية الإقرار الإلكتروني
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {companyDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-4 rounded-2xl border border-border/70 bg-muted/20 space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between">
                <span className="font-black text-foreground text-sm">{doc.titleAr}</span>
                <Badge variant="outline" className="text-[10px] font-mono rounded-full">
                  {doc.version}
                </Badge>
              </div>
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>التصنيف: {doc.category}</span>
                <span className="font-bold text-emerald-600">
                  {doc.acknowledgedCount} إقرار موثق
                </span>
              </div>
            </div>
          ))}
          {companyDocs.length === 0 && (
            <div className="col-span-3 text-center py-6 text-xs text-muted-foreground">
              لم يتم نشر لوائح داخلية بعد. انقر على «نشر لائحة / سياسة داخلية جديدة» لإضافتها.
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Standard Asset & Document Categories Governance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Laptop className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              تصنيفات العهد والأصول المعتمدة لإخلاء الطرف
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {[
              { code: "laptop", name: "حاسب محمول (Laptop)", clearance: "إلزامي لإخلاء الطرف" },
              { code: "phone", name: "هاتف ذكي / شريحة اتصال", clearance: "إلزامي لإخلاء الطرف" },
              { code: "vehicle", name: "مركبة عمل رسمية", clearance: "إلزامي + فحص فني" },
              { code: "security_card", name: "بطاقة دخول أمنية", clearance: "إلزامي لإخلاء الطرف" },
            ].map((item) => (
              <div key={item.code} className="p-3 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
                <span className="font-bold text-foreground block">{item.name}</span>
                <span className="text-[10px] text-emerald-600 font-bold block">{item.clearance}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <FileText className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-black text-foreground">
              فئات المستندات النظامية وتنبيهات الصلاحية
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {[
              { code: "iqama_id", name: "الهوية الوطنية / الإقامة", alert: "تنبيه قبل 60 يوماً" },
              { code: "passport", name: "جواز السفر الساري", alert: "تنبيه قبل 90 يوماً" },
              { code: "contract", name: "عقد العمل الموثق (قوى)", alert: "تنبيه قبل 60 يوماً" },
              { code: "medical", name: "وثيقة التأمين الطبي", alert: "تنبيه قبل 30 يوماً" },
            ].map((item) => (
              <div key={item.code} className="p-3 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
                <span className="font-bold text-foreground block">{item.name}</span>
                <span className="text-[10px] text-amber-600 font-bold block">{item.alert}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Document / Bylaw Modal */}
      <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              نشر لائحة أو سياسة داخلية جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم إتاحة اللائحة لجميع الموظفين مع طلب إقرار إلكتروني بالاطلاع والالتزام
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">عنوان اللائحة / السياسة *</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="مثال: لائحة تنظيم العمل المعتمدة 2026"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">التصنيف</label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as CompanyDocument["category"])}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none"
              >
                <option value="policy">سياسة ولوائح داخلية</option>
                <option value="handbook">دليل الموظف الشامل</option>
                <option value="circular">تعميم إداري</option>
                <option value="form">نموذج رسمي</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">رابط الملف المرجعي (اختياري)</label>
              <input
                type="text"
                value={docFileUrl}
                onChange={(e) => setDocFileUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              disabled={isSubmittingDoc}
              onClick={handleCreateDoc}
              className="rounded-full text-xs classera-btn-primary font-bold px-5 h-9"
            >
              {isSubmittingDoc ? "جاري النشر..." : "نشر واعتماد اللائحة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
