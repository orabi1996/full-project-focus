import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { IconSymbol } from "../ui/IconSymbol";
import { OfficialDocumentModal, type DocType } from "./OfficialDocumentModal";
import {
  FileText,
  Upload,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Trash2,
  Plus,
  ShieldCheck,
  Building2,
  Users,
  FileCheck,
  Calendar,
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

export interface StoredDocument {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  category: "iqama_id" | "passport" | "contract" | "gosi" | "medical" | "license" | "company";
  fileName: string;
  fileSize: string;
  uploadDate: string;
  expiryDate?: string;
  status: "valid" | "expiring_soon" | "expired";
  fileUrl?: string;
}

export const DocumentVaultView: React.FC = () => {
  const { employees, company, language, t } = useApp();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isOfficialDocModalOpen, setIsOfficialDocModalOpen] = useState(false);
  const [officialDocType, setOfficialDocType] = useState<DocType>("salary_certificate");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id || "");

  // Mock initial enterprise documents
  const [documents, setDocuments] = useState<StoredDocument[]>([
    {
      id: "doc-1",
      employeeId: employees[0]?.id || "emp-1",
      employeeName: "م. عبد العزيز الفهد",
      title: "الهوية الوطنية للمدير التنفيذي",
      category: "iqama_id",
      fileName: "national_id_ceo.pdf",
      fileSize: "1.4 MB",
      uploadDate: "2026-01-15",
      expiryDate: "2030-05-20",
      status: "valid",
    },
    {
      id: "doc-2",
      employeeId: employees[1]?.id || "emp-2",
      employeeName: "د. طارق المنصور",
      title: "جواز السفر المعتمد",
      category: "passport",
      fileName: "passport_cto.pdf",
      fileSize: "2.1 MB",
      uploadDate: "2025-08-10",
      expiryDate: "2026-09-25",
      status: "expiring_soon",
    },
    {
      id: "doc-3",
      employeeId: employees[2]?.id || "emp-3",
      employeeName: "أ. نورة التميمي",
      title: "عقد العمل الموثق عبر منصة قوى (Qiwa)",
      category: "contract",
      fileName: "qiwa_contract_chro.pdf",
      fileSize: "850 KB",
      uploadDate: "2026-02-01",
      expiryDate: "2027-02-01",
      status: "valid",
    },
    {
      id: "doc-4",
      employeeId: employees[3]?.id || "emp-4",
      employeeName: "م. ريان القحطاني",
      title: "شهادة التأمينات الاجتماعية (GOSI)",
      category: "gosi",
      fileName: "gosi_certificate_ryan.pdf",
      fileSize: "620 KB",
      uploadDate: "2026-03-12",
      status: "valid",
    },
    {
      id: "doc-5",
      employeeId: employees[4]?.id || "emp-5",
      employeeName: "أ. هيفاء الشهري",
      title: "شهادة الفحص الطبي المهني",
      category: "medical",
      fileName: "medical_fitness_haifa.pdf",
      fileSize: "1.1 MB",
      uploadDate: "2025-08-01",
      expiryDate: "2026-08-01",
      status: "expired",
    },
    {
      id: "doc-6",
      employeeId: "company-hq",
      employeeName: company.legalNameAr || "شركة فوكس القابضة",
      title: "السجل التجاري الرئيسي للمنشأة (CR)",
      category: "company",
      fileName: "commercial_registration_2026.pdf",
      fileSize: "3.2 MB",
      uploadDate: "2026-01-01",
      expiryDate: "2027-01-01",
      status: "valid",
    },
  ]);

  // Upload Form State
  const [newDoc, setNewDoc] = useState({
    employeeId: employees[0]?.id || "",
    title: "",
    category: "iqama_id" as StoredDocument["category"],
    expiryDate: "",
    fileName: "",
  });

  const handleUploadSubmit = () => {
    if (!newDoc.title) {
      alert("يرجى كتابة عنوان الوثيقة");
      return;
    }
    const emp = employees.find((e) => e.id === newDoc.employeeId);
    const docItem: StoredDocument = {
      id: `doc-${Date.now()}`,
      employeeId: newDoc.employeeId,
      employeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : company.legalNameAr,
      title: newDoc.title,
      category: newDoc.category,
      fileName: newDoc.fileName || `${newDoc.title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
      fileSize: "1.2 MB",
      uploadDate: new Date().toISOString().split("T")[0],
      expiryDate: newDoc.expiryDate || undefined,
      status: newDoc.expiryDate && new Date(newDoc.expiryDate) < new Date() ? "expired" : "valid",
    };

    setDocuments([docItem, ...documents]);
    alert("تم رفع وحفظ الوثيقة في المستودع السحابي الآمن بنجاح");
    setIsUploadModalOpen(false);
    setNewDoc({
      employeeId: employees[0]?.id || "",
      title: "",
      category: "iqama_id",
      expiryDate: "",
      fileName: "",
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الوثيقة نهائياً؟")) {
      setDocuments(documents.filter((d) => d.id !== id));
    }
  };

  // Filtered Documents
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "expiring" && (doc.status === "expiring_soon" || doc.status === "expired")) ||
      (activeTab === "contracts" && doc.category === "contract") ||
      (activeTab === "ids" && (doc.category === "iqama_id" || doc.category === "passport"));

    return matchesSearch && matchesCategory && matchesTab;
  });

  const expiringCount = documents.filter(
    (d) => d.status === "expiring_soon" || d.status === "expired",
  ).length;

  const selectedEmp = employees.find((e) => e.id === selectedEmployeeId) || employees[0];

  const openOfficialGenerator = (type: DocType) => {
    setOfficialDocType(type);
    setIsOfficialDocModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="folder_open" source="material" filled size={24} className="text-primary" />
            مستودع الوثائق والمستندات السحابي (M16)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            الأرشفة الإلكترونية المشفرة للهويات، الإقامات، الجوازات، عقود قوى، وتنبيهات انتهاء الصلاحيات
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
          >
            <Upload className="h-4 w-4" />
            رفع مستند جديد
          </Button>

          <Button
            onClick={() => openOfficialGenerator("salary_certificate")}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <FileCheck className="h-4 w-4 text-primary" />
            إصدار تعريف بالراتب
          </Button>

          <Button
            onClick={() => openOfficialGenerator("employment_contract")}
            variant="secondary"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
          >
            <FileText className="h-4 w-4 text-primary" />
            طباعة عقد عمل (قوى)
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي الوثائق المؤرشفة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">{documents.length} وثائق رقمية</h4>
            <span className="text-[10px] text-emerald-600 font-bold">مشفرة ومحمية بالكامل</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <IconSymbol name="cloud_done" source="material" size={22} />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">عقود العمل الموثقة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">
              {documents.filter((d) => d.category === "contract").length} عقود سارية
            </h4>
            <span className="text-[10px] text-primary font-bold">متوافقة مع منصة قوى</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <IconSymbol name="history_edu" source="material" size={22} />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">تنبيهات انتهاء الصلاحية</span>
            <h4 className="text-xl font-black text-amber-600 mt-0.5">{expiringCount} وثائق تحتاج تجديد</h4>
            <span className="text-[10px] text-amber-600 font-bold">خلال 30 يوماً / منتهية</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">مساحة التخزين السحابي</span>
            <h4 className="text-xl font-black text-foreground mt-0.5">14.8 MB مستخدمة</h4>
            <span className="text-[10px] text-purple-600 font-bold">سعة غير محدودة (M16)</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
            <IconSymbol name="database" source="material" size={22} />
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Toolbar */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-muted/60 p-1 rounded-full border border-border/60">
              <TabsTrigger value="all" className="rounded-full text-xs font-bold py-1.5 px-4 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                جميع الوثائق ({documents.length})
              </TabsTrigger>
              <TabsTrigger value="expiring" className="rounded-full text-xs font-bold py-1.5 px-4 data-[state=active]:bg-card data-[state=active]:text-amber-600 data-[state=active]:shadow-xs">
                منتهية وقريبة الانتهاء ({expiringCount})
              </TabsTrigger>
              <TabsTrigger value="contracts" className="rounded-full text-xs font-bold py-1.5 px-4 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                عقود العمل
              </TabsTrigger>
              <TabsTrigger value="ids" className="rounded-full text-xs font-bold py-1.5 px-4 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الهويات والجوازات
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم، الموظف، الملف..."
                className="w-full h-9 rounded-full border border-border/80 bg-background pr-9 pl-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 rounded-full border border-border/80 bg-background px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            >
              <option value="all">كل التصنيفات</option>
              <option value="iqama_id">هويات وإقامات</option>
              <option value="passport">جوازات سفر</option>
              <option value="contract">عقود عمل</option>
              <option value="gosi">تأمينات GOSI</option>
              <option value="medical">فحوصات طبية</option>
              <option value="company">وثائق المنشأة</option>
            </select>
          </div>
        </div>

        {/* Documents Table */}
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">عنوان المستند</th>
                <th className="py-3 px-4 text-start">صاحب الوثيقة / الموظف</th>
                <th className="py-3 px-4 text-start">التصنيف</th>
                <th className="py-3 px-4 text-start">تاريخ الرفع</th>
                <th className="py-3 px-4 text-start">تاريخ الانتهاء</th>
                <th className="py-3 px-4 text-start">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    لا توجد وثائق مطابقة للبحث أو التصفية الحالية
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="block">{doc.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {doc.fileName} • {doc.fileSize}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-foreground">{doc.employeeName}</td>

                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] rounded-full px-2.5 font-bold">
                        {doc.category === "iqama_id"
                          ? "هوية / إقامة"
                          : doc.category === "passport"
                          ? "جواز سفر"
                          : doc.category === "contract"
                          ? "عقد عمل"
                          : doc.category === "gosi"
                          ? "تأمينات"
                          : doc.category === "medical"
                          ? "فحص طبي"
                          : "منشأة"}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 font-mono text-muted-foreground">{doc.uploadDate}</td>

                    <td className="py-3 px-4 font-mono">
                      {doc.expiryDate ? (
                        <span
                          className={
                            doc.status === "expired"
                              ? "text-destructive font-bold"
                              : doc.status === "expiring_soon"
                              ? "text-amber-600 font-bold"
                              : "text-foreground"
                          }
                        >
                          {doc.expiryDate}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">غير محدد</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {doc.status === "valid" && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200 rounded-full font-bold">
                          ساري المفعول
                        </Badge>
                      )}
                      {doc.status === "expiring_soon" && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-200 rounded-full font-bold">
                          ينتهي قريباً
                        </Badge>
                      )}
                      {doc.status === "expired" && (
                        <Badge variant="destructive" className="text-[10px] rounded-full font-black">
                          منتهي الصلاحية
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => alert(`جارٍ فتح وتحميل الوثيقة: ${doc.fileName}`)}
                          className="h-8 w-8 rounded-full text-primary hover:bg-secondary"
                          title="عرض وتنزيل"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc.id)}
                          className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Document Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              رفع وثيقة رسمية جديدة للمستودع
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              أرشفة الوثيقة في ملف الموظف مع ضبط منبهات انتهاء الصلاحية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الموظف المعني / المنشأة *</label>
              <select
                value={newDoc.employeeId}
                onChange={(e) => setNewDoc({ ...newDoc, employeeId: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                <option value="company-hq">{company.legalNameAr || "شركة فوكس القابضة"} (وثيقة منشأة)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} — {emp.jobTitleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">عنوان الوثيقة / المستند *</label>
              <input
                type="text"
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                placeholder="مثال: الإقامة المجددة 1448هـ"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">تصنيف الوثيقة *</label>
                <select
                  value={newDoc.category}
                  onChange={(e) =>
                    setNewDoc({ ...newDoc, category: e.target.value as StoredDocument["category"] })
                  }
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="iqama_id">هوية / إقامة</option>
                  <option value="passport">جواز سفر</option>
                  <option value="contract">عقد عمل موثق</option>
                  <option value="gosi">تأمينات اجتماعية</option>
                  <option value="medical">شهادة صحية</option>
                  <option value="license">رخصة قيادة/مهنية</option>
                  <option value="company">مستندات المنشأة</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">تاريخ انتهاء الصلاحية</label>
                <input
                  type="date"
                  value={newDoc.expiryDate}
                  onChange={(e) => setNewDoc({ ...newDoc, expiryDate: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Dropzone Simulation */}
            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/20 p-5 text-center space-y-2 cursor-pointer hover:bg-secondary/40 transition-colors">
              <Upload className="mx-auto h-7 w-7 text-primary" />
              <p className="font-bold text-foreground">اسحب الملف هنا أو اضغط للاختيار</p>
              <p className="text-[10px] text-muted-foreground font-mono">يدعم PDF, PNG, JPG بحد أقصى 15MB</p>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleUploadSubmit}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              تأكيد وحفظ الوثيقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Certificate & Contract Printable PDF Modal */}
      {selectedEmp && (
        <OfficialDocumentModal
          isOpen={isOfficialDocModalOpen}
          onClose={() => setIsOfficialDocModalOpen(false)}
          employee={selectedEmp}
          documentType={officialDocType}
        />
      )}
    </div>
  );
};
