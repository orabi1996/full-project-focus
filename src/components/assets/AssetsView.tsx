import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import type { HardwareAsset, CompanyDocument } from "../../types";
import { toast } from "sonner";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Package,
  FileText,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Download,
  Plus,
  Shield,
  Upload,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export const AssetsView: React.FC = () => {
  const {
    assets,
    companyDocs,
    employees,
    addAsset,
    addCompanyDocument,
    acknowledgeDocument,
    openEmployeeProfile,
    currentRole,
    language,
    t,
  } = useApp();
  const canManage = canManageModule(currentRole, "assets");
  const [activeTab, setActiveTab] = useState("assets");

  // Modals state
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);

  // Asset Form State
  const [assetName, setAssetName] = useState("");
  const [assetCategory, setAssetCategory] = useState<HardwareAsset["category"]>("laptop");
  const [assetSerial, setAssetSerial] = useState(
    `SN-${Math.floor(100000 + Math.random() * 900000)}`,
  );
  const [assignedEmpId, setAssignedEmpId] = useState(employees[0]?.id || "");

  // Doc Form State
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<CompanyDocument["category"]>("policy");
  const [docFileUrl, setDocFileUrl] = useState("");

  const handleCreateAsset = () => {
    if (!assetName) {
      toast.error("يرجى كتابة اسم العهدة / الجهاز");
      return;
    }
    const emp = employees.find((e) => e.id === assignedEmpId);
    addAsset({
      assetTag: `TAG-${Math.floor(1000 + Math.random() * 9000)}`,
      nameAr: assetName,
      nameEn: assetName,
      category: assetCategory,
      serialNumber: assetSerial,
      assignedToEmployeeId: emp?.id,
      assignedToEmployeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : undefined,
      status: emp ? "assigned" : "available",
      assignedDate: emp ? new Date().toISOString().split("T")[0] : undefined,
    });
    toast.success(`تم تسجيل العهدة (${assetName}) بنجاح!`);
    setIsAddAssetOpen(false);
    setAssetName("");
  };

  const handleCreateDoc = () => {
    if (!docTitle || !docFileUrl) {
      toast.error("يرجى كتابة عنوان الوثيقة وإضافة رابط الملف");
      return;
    }
    addCompanyDocument({
      titleAr: docTitle,
      titleEn: docTitle,
      category: docCategory,
      version: "v1.0 (2026)",
      fileUrl: docFileUrl,
      requiresAcknowledgment: true,
      visibilityScope: "all",
    });
    toast.success(`تم نشر الوثيقة (${docTitle}) وإتاحتها لجميع الموظفين لتأكيد القراءة!`);
    setIsAddDocOpen(false);
    setDocTitle("");
    setDocFileUrl("");
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="devices" source="material" filled size={24} className="text-primary" />
            {t.assets.catalog} ومستندات المنشأة (M11)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            إدارة عهد الموظفين والأجهزة، تتبع إخلاء الطرف، واللوائح الداخلية وإقرارات الموظفين
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => setIsAddAssetOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              تسجيل عهدة جديدة
            </Button>
            <Button
              onClick={() => setIsAddDocOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <Plus className="h-4 w-4 text-primary" />
              نشر لائحة / وثيقة جديدة
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-xs bg-muted/60 p-1 rounded-full border border-border/60">
          <TabsTrigger value="assets" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.assets.catalog} ({assets.length})
          </TabsTrigger>
          <TabsTrigger value="docs" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.assets.companyDocs} ({companyDocs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Hardware Assets */}
        <TabsContent value="assets" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((ast) => (
              <div key={ast.id} className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Laptop className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-xs text-foreground">{ast.nameAr}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground block">
                        {ast.assetTag}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] rounded-full px-2.5 font-bold ${
                      ast.status === "assigned"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                        : "bg-blue-500/10 text-blue-700 border-blue-200"
                    }`}
                  >
                    {ast.status === "assigned" ? "مسند لموظف" : "متاح في المستودع"}
                  </Badge>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5 text-muted-foreground font-mono">
                  <div className="flex justify-between">
                    <span>الرقم التسلسلي:</span>
                    <span className="font-bold text-foreground">{ast.serialNumber}</span>
                  </div>
                  {ast.assignedToEmployeeName && (
                    <div className="flex justify-between font-sans items-center">
                      <span>المستلم:</span>
                      <button
                        type="button"
                        onClick={() => ast.assignedToEmployeeId && openEmployeeProfile(ast.assignedToEmployeeId)}
                        className="font-bold text-foreground hover:text-primary hover:underline cursor-pointer"
                      >
                        {ast.assignedToEmployeeName}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Company Documents */}
        <TabsContent value="docs" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {companyDocs.map((doc) => (
              <div key={doc.id} className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between">
                  <FileText className="h-5 w-5 text-primary" />
                  <Badge variant="outline" className="text-[10px] rounded-full px-2 font-mono">
                    {doc.version}
                  </Badge>
                </div>

                <h3 className="font-black text-xs text-foreground">{doc.titleAr}</h3>
                <p className="text-[11px] text-muted-foreground font-medium">
                  إقرار بالاطلاع: {doc.acknowledgedCount} موظف أكد القراءة
                </p>

                <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(`جاري تنزيل ملف ${doc.titleAr}`)}
                    className="h-8 text-xs font-bold gap-1 text-primary rounded-full border-border/80 hover:bg-secondary px-3"
                  >
                    <Download className="h-3.5 w-3.5" />
                    تنزيل الملف
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      acknowledgeDocument(doc.id);
                      toast.success("تم تسجيل إقرارك بالاطلاع على اللائحة بنجاح");
                    }}
                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-3 shadow-xs"
                  >
                    تأكيد القراءة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Asset Modal */}
      <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Laptop className="h-5 w-5 text-primary" />
              تسجيل عهدة / جهاز جديد
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تسجيل بيانات الجهاز والرقم التسلسلي وإسناده لموظف
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الجهاز / العهدة *</label>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="مثال: MacBook Pro 16 M3 Max"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">تصنيف العهدة</label>
              <select
                value={assetCategory}
                onChange={(e) => setAssetCategory(e.target.value as HardwareAsset["category"])}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="laptop">حاسب محمول</option>
                <option value="phone">هاتف</option>
                <option value="vehicle">مركبة</option>
                <option value="security_card">بطاقة أمنية</option>
                <option value="access_key">مفتاح دخول</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">الرقم التسلسلي (Serial Number) *</label>
              <input
                type="text"
                value={assetSerial}
                onChange={(e) => setAssetSerial(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">الموظف المستلم (اختياري)</label>
              <select
                value={assignedEmpId}
                onChange={(e) => setAssignedEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">بدون إسناد (متاح في المستودع)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleCreateAsset} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              تأكيد وتسجيل العهدة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Document Modal */}
      <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              نشر لائحة / وثيقة تنظيمية جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              إتاحة الوثيقة للموظفين مع تفعيل خاصية الإقرار بالقراءة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">عنوان الوثيقة / اللائحة *</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="مثال: سياسة العمل عن بعد وتنظيم أوقات الدوام 2026"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">رابط ملف الوثيقة *</label>
              <input
                type="url"
                value={docFileUrl}
                onChange={(e) => setDocFileUrl(e.target.value)}
                placeholder="https://example.com/policy.pdf"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">التصنيف</label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as CompanyDocument["category"])}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="policy">لوائح الموارد البشرية والعمل</option>
                <option value="regulation">لوائح تنظيمية</option>
                <option value="handbook">دليل الموظف</option>
                <option value="form">النماذج الرسمية المعتمدة</option>
                <option value="announcement">إعلان</option>
              </select>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleCreateDoc} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              نشر الوثيقة للموظفين
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
