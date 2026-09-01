import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import type { HardwareAsset, CompanyDocument } from "../../types";
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
      alert("يرجى كتابة اسم العهدة / الجهاز");
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
    alert(`تم تسجيل العهدة (${assetName}) بنجاح!`);
    setIsAddAssetOpen(false);
    setAssetName("");
  };

  const handleCreateDoc = () => {
    if (!docTitle || !docFileUrl) {
      alert("يرجى كتابة عنوان الوثيقة وإضافة رابط الملف");
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
    alert(`تم نشر الوثيقة (${docTitle}) وإتاحتها لجميع الموظفين لتأكيد القراءة!`);
    setIsAddDocOpen(false);
    setDocTitle("");
    setDocFileUrl("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t.assets.catalog} ومستندات المنشأة (M16)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة عهد الموظفين والأجهزة، تتبع إخلاء الطرف، واللوائح الداخلية وإقرارات الموظفين
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setIsAddAssetOpen(true)}
              size="sm"
              className="font-bold text-xs gap-1.5 bg-primary"
            >
              <Plus className="h-4 w-4" />
              تسجيل عهدة جديدة
            </Button>
            <Button
              onClick={() => setIsAddDocOpen(true)}
              variant="outline"
              size="sm"
              className="font-bold text-xs gap-1.5"
            >
              <Plus className="h-4 w-4" />
              نشر لائحة / وثيقة جديدة
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-xs">
          <TabsTrigger value="assets" className="text-xs font-bold">
            {t.assets.catalog} ({assets.length})
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs font-bold">
            {t.assets.companyDocs} ({companyDocs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Hardware Assets */}
        <TabsContent value="assets" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((ast) => (
              <div key={ast.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-primary" />
                    <div>
                      <h3 className="font-bold text-xs text-foreground">{ast.nameAr}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {ast.assetTag}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      ast.status === "assigned"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                        : "bg-blue-500/10 text-blue-700 border-blue-200"
                    }`}
                  >
                    {ast.status === "assigned" ? "مسند لموظف" : "متاح في المستودع"}
                  </Badge>
                </div>

                <div className="rounded-lg border bg-muted/20 p-2.5 text-xs space-y-1 text-muted-foreground font-mono">
                  <div className="flex justify-between">
                    <span>الرقم التسلسلي:</span>
                    <span className="font-bold text-foreground">{ast.serialNumber}</span>
                  </div>
                  {ast.assignedToEmployeeName && (
                    <div className="flex justify-between">
                      <span>المستلم:</span>
                      <span className="font-bold text-foreground">
                        {ast.assignedToEmployeeName}
                      </span>
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
              <div key={doc.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <FileText className="h-5 w-5 text-primary" />
                  <Badge variant="outline" className="text-[10px]">
                    {doc.version}
                  </Badge>
                </div>

                <h3 className="font-bold text-xs text-foreground">{doc.titleAr}</h3>
                <p className="text-[11px] text-muted-foreground">
                  إقرار بالاطلاع: {doc.acknowledgedCount} موظف أكد القراءة
                </p>

                <div className="border-t pt-2 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => alert(`جاري تنزيل ملف ${doc.titleAr}`)}
                    className="h-7 text-xs font-bold gap-1 text-primary"
                  >
                    <Download className="h-3 w-3" />
                    تنزيل الملف
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      acknowledgeDocument(doc.id);
                      alert("تم تسجيل إقرارك بالاطلاع على اللائحة بنجاح");
                    }}
                    className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Laptop className="h-5 w-5 text-primary" />
              تسجيل عهدة / جهاز جديد
            </DialogTitle>
            <DialogDescription className="text-xs">
              تسجيل بيانات الجهاز والرقم التسلسلي وإسناده لموظف
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">اسم الجهاز / العهدة *</label>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="مثال: MacBook Pro 16 M3 Max"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">تصنيف العهدة</label>
              <select
                value={assetCategory}
                onChange={(e) => setAssetCategory(e.target.value as HardwareAsset["category"])}
                className="w-full h-8 rounded border px-2.5"
              >
                <option value="laptop">حاسب محمول</option>
                <option value="phone">هاتف</option>
                <option value="vehicle">مركبة</option>
                <option value="security_card">بطاقة أمنية</option>
                <option value="access_key">مفتاح دخول</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold">الرقم التسلسلي (Serial Number) *</label>
              <input
                type="text"
                value={assetSerial}
                onChange={(e) => setAssetSerial(e.target.value)}
                className="w-full h-8 rounded border px-2.5 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">الموظف المستلم (اختياري)</label>
              <select
                value={assignedEmpId}
                onChange={(e) => setAssignedEmpId(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
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

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateAsset} className="text-xs bg-primary font-bold">
              تأكيد وتسجيل العهدة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Document Modal */}
      <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              نشر لائحة / وثيقة تنظيمية جديدة
            </DialogTitle>
            <DialogDescription className="text-xs">
              إتاحة الوثيقة للموظفين مع تفعيل خاصية الإقرار بالقراءة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">عنوان الوثيقة / اللائحة *</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="مثال: سياسة العمل عن بعد وتنظيم أوقات الدوام 2026"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">رابط ملف الوثيقة *</label>
              <input
                type="url"
                value={docFileUrl}
                onChange={(e) => setDocFileUrl(e.target.value)}
                placeholder="https://example.com/policy.pdf"
                className="w-full h-8 rounded border px-2.5 ltr:text-left"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">التصنيف</label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as CompanyDocument["category"])}
                className="w-full h-8 rounded border px-2.5"
              >
                <option value="policy">لوائح الموارد البشرية والعمل</option>
                <option value="regulation">لوائح تنظيمية</option>
                <option value="handbook">دليل الموظف</option>
                <option value="form">النماذج الرسمية المعتمدة</option>
                <option value="announcement">إعلان</option>
              </select>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateDoc} className="text-xs bg-primary font-bold">
              نشر الوثيقة للموظفين
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
