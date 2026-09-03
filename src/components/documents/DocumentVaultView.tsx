import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import { IconSymbol } from "../ui/IconSymbol";
import { OfficialDocumentModal, type DocType } from "./OfficialDocumentModal";
import { exportToCSV } from "../../lib/utils/export-helpers";
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
  QrCode,
  ExternalLink,
  Printer,
  RefreshCw,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  FileSpreadsheet,
  ShieldAlert,
  Folder,
  Tag,
  AlertCircle,
  ArrowUpRight,
  Share2,
  Layers,
  Lock,
  FileCode,
  FileImage,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
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
  category:
    | "iqama_id"
    | "passport"
    | "contract"
    | "gosi"
    | "medical"
    | "license"
    | "company";
  docNumber?: string;
  issuingAuthority?: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  expiryDate?: string;
  status: "valid" | "expiring_soon" | "expired";
  fileUrl?: string;
  notes?: string;
}

type ViewMode = "grid" | "table";

export const DocumentVaultView: React.FC = () => {
  const { employees, company, language, t } = useApp();

  // Primary State
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Selection & Bulk Actions
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Modals State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isOfficialDocModalOpen, setIsOfficialDocModalOpen] = useState(false);
  const [officialDocType, setOfficialDocType] = useState<DocType>("salary_certificate");
  const [selectedEmployeeForDoc, setSelectedEmployeeForDoc] = useState(employees[0]?.id || "");

  // Interactive Document Preview State
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<StoredDocument | null>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [newRenewalExpiry, setNewRenewalExpiry] = useState("2027-12-31");

  // Comprehensive Enterprise Initial Documents
  const [documents, setDocuments] = useState<StoredDocument[]>([
    {
      id: "doc-1",
      employeeId: employees[0]?.id || "emp-1",
      employeeName: employees[0] ? `${employees[0].firstNameAr} ${employees[0].lastNameAr}` : "م. عبد العزيز الفهد",
      title: "الهوية الوطنية المعتمدة للمدير التنفيذي",
      category: "iqama_id",
      docNumber: "1098234112",
      issuingAuthority: "الأحوال المدنية - أبشر",
      fileName: "national_id_ceo.pdf",
      fileSize: "1.4 MB",
      uploadDate: "2026-01-15",
      expiryDate: "2030-05-20",
      status: "valid",
    },
    {
      id: "doc-2",
      employeeId: employees[1]?.id || "emp-2",
      employeeName: employees[1] ? `${employees[1].firstNameAr} ${employees[1].lastNameAr}` : "د. طارق المنصور",
      title: "جواز السفر الدبلوماسي/المهني",
      category: "passport",
      docNumber: "P-8829103",
      issuingAuthority: "المديرية العامة للجوازات",
      fileName: "passport_cto.pdf",
      fileSize: "2.1 MB",
      uploadDate: "2025-08-10",
      expiryDate: "2026-09-25",
      status: "expiring_soon",
    },
    {
      id: "doc-3",
      employeeId: employees[2]?.id || "emp-3",
      employeeName: employees[2] ? `${employees[2].firstNameAr} ${employees[2].lastNameAr}` : "أ. نورة التميمي",
      title: "عقد العمل الموثق عبر منصة قوى (Qiwa)",
      category: "contract",
      docNumber: "QIWA-2026-9812",
      issuingAuthority: "وزارة الموارد البشرية والتنمية الاجتماعية",
      fileName: "qiwa_contract_chro.pdf",
      fileSize: "850 KB",
      uploadDate: "2026-02-01",
      expiryDate: "2027-02-01",
      status: "valid",
    },
    {
      id: "doc-4",
      employeeId: employees[3]?.id || "emp-4",
      employeeName: employees[3] ? `${employees[3].firstNameAr} ${employees[3].lastNameAr}` : "م. ريان القحطاني",
      title: "شهادة بيان مدد وأجور التأمينات (GOSI)",
      category: "gosi",
      docNumber: "GOSI-449102",
      issuingAuthority: "المؤسسة العامة للتأمينات الاجتماعية",
      fileName: "gosi_certificate_ryan.pdf",
      fileSize: "620 KB",
      uploadDate: "2026-03-12",
      status: "valid",
    },
    {
      id: "doc-5",
      employeeId: employees[4]?.id || "emp-5",
      employeeName: employees[4] ? `${employees[4].firstNameAr} ${employees[4].lastNameAr}` : "أ. هيفاء الشهري",
      title: "شهادة الفحص الطبي المهني والإقامة",
      category: "medical",
      docNumber: "MED-2025-88",
      issuingAuthority: "مجلس الضمان الصحي CCHI",
      fileName: "medical_fitness_haifa.pdf",
      fileSize: "1.1 MB",
      uploadDate: "2025-08-01",
      expiryDate: "2026-08-01",
      status: "expired",
    },
    {
      id: "doc-6",
      employeeId: "company-hq",
      employeeName: company.legalNameAr || "شركة فوكس للحلول والتقنية",
      title: "السجل التجاري الرئيسي للمنشأة (CR)",
      category: "company",
      docNumber: "1010098765",
      issuingAuthority: "وزارة التجارة - المركز السعودي للأعمال",
      fileName: "commercial_registration_2026.pdf",
      fileSize: "3.2 MB",
      uploadDate: "2026-01-01",
      expiryDate: "2027-01-01",
      status: "valid",
    },
    {
      id: "doc-7",
      employeeId: "company-hq",
      employeeName: company.legalNameAr || "شركة فوكس للحلول والتقنية",
      title: "شهادة تسجيل ضريبة القيمة المضافة (ZATCA)",
      category: "company",
      docNumber: "300098127300003",
      issuingAuthority: "هيئة الزكاة والضريبة والجمارك",
      fileName: "vat_certificate_zatca.pdf",
      fileSize: "780 KB",
      uploadDate: "2026-01-10",
      status: "valid",
    },
    {
      id: "doc-8",
      employeeId: "company-hq",
      employeeName: company.legalNameAr || "شركة فوكس للحلول والتقنية",
      title: "شهادة السعودة ونطاقات المعتمدة (بلاتيني)",
      category: "company",
      docNumber: "SAUD-2026-0091",
      issuingAuthority: "وزارة الموارد البشرية - قوى",
      fileName: "saudization_certificate_2026.pdf",
      fileSize: "950 KB",
      uploadDate: "2026-02-15",
      expiryDate: "2026-09-20",
      status: "expiring_soon",
    },
  ]);

  // Upload Form State
  const [newDoc, setNewDoc] = useState({
    employeeId: employees[0]?.id || "company-hq",
    title: "",
    category: "iqama_id" as StoredDocument["category"],
    docNumber: "",
    issuingAuthority: "",
    expiryDate: "",
    fileName: "",
  });

  // Calculate Metrics
  const totalCount = documents.length;
  const expiringSoonCount = useMemo(
    () => documents.filter((d) => d.status === "expiring_soon").length,
    [documents],
  );
  const expiredCount = useMemo(
    () => documents.filter((d) => d.status === "expired").length,
    [documents],
  );
  const contractsCount = useMemo(
    () => documents.filter((d) => d.category === "contract").length,
    [documents],
  );
  const companyDocsCount = useMemo(
    () => documents.filter((d) => d.category === "company").length,
    [documents],
  );

  // Filter Logic
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Search
      const term = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !term ||
        doc.title.toLowerCase().includes(term) ||
        doc.employeeName.toLowerCase().includes(term) ||
        doc.fileName.toLowerCase().includes(term) ||
        (doc.docNumber && doc.docNumber.toLowerCase().includes(term)) ||
        (doc.issuingAuthority && doc.issuingAuthority.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      // Category filter
      if (selectedCategory !== "all" && doc.category !== selectedCategory) return false;

      // Employee filter
      if (selectedEmployeeFilter !== "all" && doc.employeeId !== selectedEmployeeFilter)
        return false;

      // Status filter
      if (selectedStatusFilter !== "all" && doc.status !== selectedStatusFilter) return false;

      // Quick Tabs filter
      if (activeTab === "expiring" && doc.status !== "expiring_soon" && doc.status !== "expired")
        return false;
      if (activeTab === "contracts" && doc.category !== "contract") return false;
      if (activeTab === "ids" && doc.category !== "iqama_id" && doc.category !== "passport")
        return false;
      if (activeTab === "company" && doc.category !== "company") return false;

      return true;
    });
  }, [
    documents,
    searchQuery,
    selectedCategory,
    selectedEmployeeFilter,
    selectedStatusFilter,
    activeTab,
  ]);

  // Bulk Selection Handlers
  const isAllSelected =
    filteredDocs.length > 0 && selectedDocIds.length === filteredDocs.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredDocs.map((d) => d.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleExportSelectedOrAll = () => {
    const listToExport =
      selectedDocIds.length > 0
        ? filteredDocs.filter((d) => selectedDocIds.includes(d.id))
        : filteredDocs;

    const exportData = listToExport.map((d) => ({
      "عنوان الوثيقة": d.title,
      "صاحب الوثيقة / المنشأة": d.employeeName,
      "رقم الوثيقة / المرجع": d.docNumber || "غير محدد",
      "الجهة المصدرة": d.issuingAuthority || "رسمي",
      "التصنيف":
        d.category === "iqama_id"
          ? "هوية / إقامة"
          : d.category === "passport"
            ? "جواز سفر"
            : d.category === "contract"
              ? "عقد عمل قوى"
              : d.category === "gosi"
                ? "تأمينات GOSI"
                : d.category === "medical"
                  ? "فحص طبي"
                  : d.category === "license"
                    ? "رخصة مهنية"
                    : "وثائق المنشأة",
      "اسم الملف": d.fileName,
      "حجم الملف": d.fileSize,
      "تاريخ الرفع": d.uploadDate,
      "تاريخ الانتهاء": d.expiryDate || "غير محدد",
      "الحالة":
        d.status === "valid"
          ? "ساري المفعول"
          : d.status === "expiring_soon"
            ? "ينتهي قريباً"
            : "منتهي الصلاحية",
    }));

    exportToCSV(`مستودع_الوثائق_${new Date().toISOString().slice(0, 10)}`, exportData);
    toast.success(`تم تصدير بيان (${listToExport.length}) وثيقة بنجاح!`);
  };

  const handleDeleteSelected = () => {
    if (selectedDocIds.length === 0) return;
    const count = selectedDocIds.length;
    setDocuments((prev) => prev.filter((d) => !selectedDocIds.includes(d.id)));
    setSelectedDocIds([]);
    toast.success(`تم حذف (${count}) وثائق بنجاح من المستودع!`);
  };

  const handleDeleteSingle = (id: string) => {
    const doc = documents.find((d) => d.id === id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    toast.success(`تم حذف الوثيقة (${doc?.title || ""}) بنجاح`);
    if (selectedDocForPreview?.id === id) {
      setSelectedDocForPreview(null);
    }
  };

  // Upload Submit
  const handleUploadSubmit = () => {
    if (!newDoc.title.trim()) {
      toast.error("يرجى إدخال عنوان الوثيقة");
      return;
    }

    const emp = employees.find((e) => e.id === newDoc.employeeId);
    const ownerName =
      newDoc.employeeId === "company-hq"
        ? company.legalNameAr || "شركة فوكس للحلول والتقنية"
        : emp
          ? `${emp.firstNameAr} ${emp.lastNameAr}`
          : "موظف عام";

    const docItem: StoredDocument = {
      id: `doc-${Date.now()}`,
      employeeId: newDoc.employeeId,
      employeeName: ownerName,
      title: newDoc.title,
      category: newDoc.category,
      docNumber: newDoc.docNumber || `DOC-${Math.floor(100000 + Math.random() * 900000)}`,
      issuingAuthority: newDoc.issuingAuthority || "الجهة المعتمدة",
      fileName: newDoc.fileName || `${newDoc.title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
      fileSize: "1.4 MB",
      uploadDate: new Date().toISOString().split("T")[0],
      expiryDate: newDoc.expiryDate || undefined,
      status:
        newDoc.expiryDate && new Date(newDoc.expiryDate) < new Date()
          ? "expired"
          : newDoc.expiryDate &&
              new Date(newDoc.expiryDate).getTime() - new Date().getTime() <
                30 * 24 * 60 * 60 * 1000
            ? "expiring_soon"
            : "valid",
    };

    setDocuments([docItem, ...documents]);
    toast.success(`تمت أرشفة وحفظ (${newDoc.title}) في المستودع السحابي المشفر بنجاح!`);
    setIsUploadModalOpen(false);
    setNewDoc({
      employeeId: employees[0]?.id || "company-hq",
      title: "",
      category: "iqama_id",
      docNumber: "",
      issuingAuthority: "",
      expiryDate: "",
      fileName: "",
    });
  };

  // Renew Document
  const handleRenewDocument = () => {
    if (!selectedDocForPreview) return;
    if (!newRenewalExpiry) {
      toast.error("يرجى تحديد تاريخ انتهاء الصلاحية الجديد");
      return;
    }

    const isExpiringSoon =
      new Date(newRenewalExpiry).getTime() - new Date().getTime() <
      30 * 24 * 60 * 60 * 1000;

    const newStatus: StoredDocument["status"] =
      new Date(newRenewalExpiry) < new Date()
        ? "expired"
        : isExpiringSoon
          ? "expiring_soon"
          : "valid";

    const updated = documents.map((d) =>
      d.id === selectedDocForPreview.id
        ? {
            ...d,
            expiryDate: newRenewalExpiry,
            status: newStatus,
          }
        : d,
    );

    setDocuments(updated);
    setSelectedDocForPreview({
      ...selectedDocForPreview,
      expiryDate: newRenewalExpiry,
      status: newStatus,
    });
    setIsRenewModalOpen(false);
    toast.success(`تم تجديد صلاحية (${selectedDocForPreview.title}) حتى ${newRenewalExpiry} بنجاح!`);
  };

  const openOfficialGenerator = (type: DocType) => {
    setOfficialDocType(type);
    setIsOfficialDocModalOpen(true);
  };

  const selectedEmployeeObj =
    employees.find((e) => e.id === selectedEmployeeForDoc) || employees[0];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol
              name="folder_open"
              source="material"
              filled
              size={26}
              className="text-primary"
            />
            مستودع الوثائق والمستندات السحابي المشفر (Cloud Vault)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            الأرشفة الرقمية المشفرة لوثائق الموظفين، عقود قوى، السجلات التجارية، وتنبيهات انتهاء الصلاحية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleExportSelectedOrAll}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            تصدير كشف الأرشيف (CSV)
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
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <FileText className="h-4 w-4 text-primary" />
            طباعة عقد قوى الموحد
          </Button>

          <Button
            onClick={() => setIsUploadModalOpen(true)}
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-5"
          >
            <Upload className="h-4 w-4" />
            رفع وثيقة جديدة
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي الوثائق المؤرشفة</span>
            <p className="text-2xl font-black text-foreground mt-0.5">{totalCount} وثائق</p>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
              <Lock className="h-3 w-3" /> تشفير سحابي AES-256
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <IconSymbol name="cloud_done" source="material" size={26} />
          </div>
        </div>

        {/* Qiwa Contracts */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">عقود العمل الموثقة</span>
            <p className="text-2xl font-black text-foreground mt-0.5">{contractsCount} عقود</p>
            <span className="text-[10px] text-primary font-bold flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="h-3 w-3" /> معتمدة بمنصة قوى (Qiwa)
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <IconSymbol name="history_edu" source="material" size={26} />
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="rounded-3xl border border-amber-300 bg-amber-500/10 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-800">قاربت على الانتهاء</span>
            <p className="text-2xl font-black text-amber-700 mt-0.5">{expiringSoonCount} وثائق</p>
            <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" /> أقل من 30 يوماً للتجديد
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-600/20 flex items-center justify-center text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        {/* Expired / Critical */}
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-destructive">منتهية الصلاحية (مخالفة)</span>
            <p className="text-2xl font-black text-destructive mt-0.5">{expiredCount} وثائق</p>
            <span className="text-[10px] text-destructive font-bold flex items-center gap-1 mt-0.5">
              <ShieldAlert className="h-3 w-3" /> غرامات عمل وتأمينات
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-destructive/20 flex items-center justify-center text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Compliance Expiry Urgent Warning Banner */}
      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="rounded-3xl border border-amber-300 bg-amber-500/10 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-900">
                تنبيه امتثال رسمي: يوجد {expiredCount + expiringSoonCount} وثائق تتطلب التجديد الفوري
              </h4>
              <p className="text-[11px] text-amber-800 font-medium">
                تجنب مخالفات وزارة الموارد البشرية والجوازات، بتجديد الإقامات، عقود قوى، والشهادات الصحية في الوقت المحدد.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setActiveTab("expiring");
              setSelectedStatusFilter("all");
            }}
            className="rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white h-8 px-4 self-end md:self-center shadow-xs"
          >
            عرض الوثائق الحرجة ({expiredCount + expiringSoonCount})
          </Button>
        </div>
      )}

      {/* Control Bar: Tabs, Search, Filters, View Mode */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        {/* Row 1: Quick Tabs + View Mode Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-secondary"
              }`}
            >
              جميع الوثائق ({totalCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("expiring")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                activeTab === "expiring"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-muted/40 text-amber-700 hover:bg-amber-500/20"
              }`}
            >
              ⚠️ منتهية وقريبة الانتهاء ({expiringSoonCount + expiredCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("contracts")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                activeTab === "contracts"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-secondary"
              }`}
            >
              📄 عقود قوى ({contractsCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ids")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                activeTab === "ids"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-secondary"
              }`}
            >
              🪪 الهويات والجوازات
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("company")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                activeTab === "company"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-secondary"
              }`}
            >
              🏢 وثائق المنشأة ({companyDocsCount})
            </button>
          </div>

          {/* View Mode Switcher: Grid vs Table */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-full border border-border/80 self-end">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === "grid"
                  ? "bg-card text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              شبكة بطاقات
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === "table"
                  ? "bg-card text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              جدول تفصيلي
            </button>
          </div>
        </div>

        {/* Row 2: Search + Multi-dimensional Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، الموظف، رقم الوثيقة، الملف..."
              className="w-full h-10 rounded-full border border-border/80 bg-muted/30 pr-10 pl-3 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            />
          </div>

          {/* Employee Filter */}
          <div>
            <select
              value={selectedEmployeeFilter}
              onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
              className="w-full h-10 rounded-full border border-border/80 bg-muted/30 px-3.5 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            >
              <option value="all">كافة الموظفين والمنشأة</option>
              <option value="company-hq">🏢 {company.legalNameAr || "وثائق المنشأة"}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  👤 {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-10 rounded-full border border-border/80 bg-muted/30 px-3.5 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            >
              <option value="all">كافة التصنيفات</option>
              <option value="iqama_id">هويات وإقامات</option>
              <option value="passport">جوازات سفر</option>
              <option value="contract">عقود عمل موثقة</option>
              <option value="gosi">شهادات التأمينات (GOSI)</option>
              <option value="medical">فحوصات وشهادات طبية</option>
              <option value="license">رخص مهنية وقيادة</option>
              <option value="company">مستندات وسجلات الشركة</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full h-10 rounded-full border border-border/80 bg-muted/30 px-3.5 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            >
              <option value="all">كافة الحالات</option>
              <option value="valid">ساري المفعول</option>
              <option value="expiring_soon">ينتهي قريباً (أقل من 30 يوم)</option>
              <option value="expired">منتهي الصلاحية</option>
            </select>
          </div>
        </div>

        {/* Results Info Bar */}
        <div className="flex justify-between items-center px-1 text-xs border-t border-border/60 pt-3">
          <span className="font-bold text-muted-foreground">
            النتائج المطابقة:{" "}
            <span className="text-foreground font-black font-mono">{filteredDocs.length}</span> من أصل{" "}
            <span className="font-mono">{totalCount}</span> وثيقة
          </span>

          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="text-xs text-primary font-bold hover:underline"
          >
            {isAllSelected ? "إلغاء تحديد الكل" : "تحديد كافة النتائج"}
          </button>
        </div>
      </div>

      {/* VIEW 1: SMART CARDS GRID VIEW */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocs.map((doc) => {
            const isSelected = selectedDocIds.includes(doc.id);
            return (
              <div
                key={doc.id}
                className={`rounded-3xl border bg-card p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/50 flex flex-col justify-between space-y-4 relative ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]"
                    : "border-border/80"
                }`}
              >
                {/* Card Top: Checkbox, Badge, Category */}
                <div className="flex items-center justify-between">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelectOne(doc.id)}
                    className="rounded accent-primary cursor-pointer h-4 w-4"
                  />

                  <Badge
                    variant="outline"
                    className={`text-[10px] rounded-full px-2.5 py-0.5 font-bold ${
                      doc.status === "valid"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                        : doc.status === "expiring_soon"
                          ? "bg-amber-500/10 text-amber-700 border-amber-200"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                    }`}
                  >
                    {doc.status === "valid"
                      ? "ساري المفعول"
                      : doc.status === "expiring_soon"
                        ? "ينتهي قريباً"
                        : "منتهي الصلاحية"}
                  </Badge>
                </div>

                {/* Card Body: Thumbnail, Title, Owner */}
                <div
                  onClick={() => setSelectedDocForPreview(doc)}
                  className="cursor-pointer group space-y-2 text-center"
                >
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-secondary flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    {doc.category === "contract" ? (
                      <IconSymbol name="history_edu" source="material" size={32} />
                    ) : doc.category === "passport" ? (
                      <IconSymbol name="flight" source="material" size={32} />
                    ) : doc.category === "company" ? (
                      <Building2 className="h-8 w-8 text-purple-600" />
                    ) : (
                      <FileText className="h-8 w-8 text-primary" />
                    )}
                  </div>

                  <div>
                    <h3 className="font-black text-sm text-foreground group-hover:text-primary group-hover:underline transition-colors line-clamp-1">
                      {doc.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-semibold mt-0.5 flex items-center justify-center gap-1">
                      <Users className="h-3 w-3" />
                      {doc.employeeName}
                    </p>
                  </div>
                </div>

                {/* Document Metadata Details Box */}
                <div className="rounded-2xl bg-muted/25 border border-border/60 p-3 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم الوثيقة:</span>
                    <span className="font-mono font-bold text-foreground">
                      {doc.docNumber || "غير متوفر"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الملف والحجم:</span>
                    <span className="font-mono text-muted-foreground truncate max-w-[120px]">
                      {doc.fileName} ({doc.fileSize})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                    <span
                      className={`font-mono font-bold ${
                        doc.status === "expired"
                          ? "text-destructive"
                          : doc.status === "expiring_soon"
                            ? "text-amber-600"
                            : "text-foreground"
                      }`}
                    >
                      {doc.expiryDate || "غير محدد"}
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    onClick={() => setSelectedDocForPreview(doc)}
                    className="flex-1 rounded-full text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground h-8 shadow-xs"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    معاينة
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedDocForPreview(doc);
                      setNewRenewalExpiry("2027-12-31");
                      setIsRenewModalOpen(true);
                    }}
                    className="rounded-full text-xs font-bold h-8 w-8 p-0 border-border/80 hover:bg-secondary"
                    title="تجديد الصلاحية"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success(`جارٍ تنزيل الوثيقة الرسمية: ${doc.fileName}`)}
                    className="rounded-full text-xs font-bold h-8 w-8 p-0 border-border/80 hover:bg-secondary"
                    title="تنزيل الملف"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSingle(doc.id)}
                    className="rounded-full text-xs font-bold h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                    title="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: DETAILED TABLE VIEW */}
      {viewMode === "table" && (
        <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs p-5 space-y-3">
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded accent-primary cursor-pointer h-4 w-4"
                    />
                  </th>
                  <th className="py-3 px-4 text-start">عنوان الوثيقة والمستند</th>
                  <th className="py-3 px-4 text-start">صاحب الوثيقة / المنشأة</th>
                  <th className="py-3 px-4 text-start">التصنيف والمرجع</th>
                  <th className="py-3 px-4 text-start">الجهة المصدرة</th>
                  <th className="py-3 px-4 text-start">تاريخ الرفع</th>
                  <th className="py-3 px-4 text-start">تاريخ الانتهاء</th>
                  <th className="py-3 px-4 text-start">حالة السريان</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDocs.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-muted/20 transition-colors group ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(doc.id)}
                          className="rounded accent-primary cursor-pointer h-4 w-4"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedDocForPreview(doc)}
                          className="flex items-center gap-3 text-start hover:text-primary transition-colors cursor-pointer"
                        >
                          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            {doc.category === "contract" ? (
                              <IconSymbol name="history_edu" source="material" size={20} />
                            ) : doc.category === "passport" ? (
                              <IconSymbol name="flight" source="material" size={20} />
                            ) : doc.category === "company" ? (
                              <Building2 className="h-5 w-5 text-purple-600" />
                            ) : (
                              <FileText className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-foreground block group-hover:text-primary group-hover:underline">
                              {doc.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {doc.fileName} • {doc.fileSize}
                            </span>
                          </div>
                        </button>
                      </td>

                      <td className="py-3 px-4 font-semibold text-foreground">
                        {doc.employeeName}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="text-[10px] rounded-full px-2.5 font-bold block w-fit mb-1"
                        >
                          {doc.category === "iqama_id"
                            ? "هوية / إقامة"
                            : doc.category === "passport"
                              ? "جواز سفر"
                              : doc.category === "contract"
                                ? "عقد عمل قوى"
                                : doc.category === "gosi"
                                  ? "تأمينات GOSI"
                                  : doc.category === "medical"
                                    ? "فحص طبي"
                                    : doc.category === "license"
                                      ? "رخصة مهنية"
                                      : "وثائق المنشأة"}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {doc.docNumber || "—"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-muted-foreground font-medium">
                        {doc.issuingAuthority || "رسمي"}
                      </td>

                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {doc.uploadDate}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {doc.expiryDate ? (
                          <span
                            className={
                              doc.status === "expired"
                                ? "text-destructive font-black"
                                : doc.status === "expiring_soon"
                                  ? "text-amber-600 font-black"
                                  : "text-foreground font-semibold"
                            }
                          >
                            {doc.expiryDate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-medium">غير محدد</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] rounded-full px-2.5 font-bold ${
                            doc.status === "valid"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                              : doc.status === "expiring_soon"
                                ? "bg-amber-500/10 text-amber-700 border-amber-200"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                          }`}
                        >
                          {doc.status === "valid"
                            ? "ساري المفعول"
                            : doc.status === "expiring_soon"
                              ? "ينتهي قريباً"
                              : "منتهي الصلاحية"}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedDocForPreview(doc)}
                            className="h-8 w-8 rounded-full text-primary hover:bg-secondary"
                            title="معاينة"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedDocForPreview(doc);
                              setNewRenewalExpiry("2027-12-31");
                              setIsRenewModalOpen(true);
                            }}
                            className="h-8 w-8 rounded-full text-primary hover:bg-secondary"
                            title="تجديد الصلاحية"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toast.success(`جارٍ تنزيل الوثيقة الرسمية: ${doc.fileName}`)
                            }
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                            title="تنزيل الملف"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSingle(doc.id)}
                            className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedDocIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-foreground text-background px-6 py-3 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-black">
            تم تحديد <span className="text-primary font-mono">{selectedDocIds.length}</span> وثائق
          </span>

          <div className="h-4 w-px bg-background/30" />

          <Button
            size="sm"
            onClick={handleExportSelectedOrAll}
            className="rounded-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3.5 shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير كشف المحدد (CSV)
          </Button>

          <Button
            size="sm"
            onClick={() => {
              toast.success(`جارٍ تنزيل أرشيف مضغوط ZIP لـ (${selectedDocIds.length}) وثائق مختارة...`);
            }}
            className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3.5 shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            تنزيل الملفات المحددة
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={handleDeleteSelected}
            className="rounded-full text-xs font-bold gap-1.5 h-8 px-3.5 shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف المحدد
          </Button>

          <button
            type="button"
            onClick={() => setSelectedDocIds([])}
            className="text-xs font-bold text-muted-foreground hover:text-background transition-colors mr-2"
          >
            إلغاء التحديد
          </button>
        </div>
      )}

      {/* MODAL 1: High-Fidelity Interactive Document Preview */}
      {selectedDocForPreview && (
        <Dialog
          open={!!selectedDocForPreview}
          onOpenChange={(open) => !open && setSelectedDocForPreview(null)}
        >
          <DialogContent className="max-w-2xl rounded-3xl p-6">
            <DialogHeader>
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-base font-black flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    معاينة الوثيقة: {selectedDocForPreview.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium mt-0.5">
                    صاحب المستند: {selectedDocForPreview.employeeName}
                  </DialogDescription>
                </div>
                <Badge
                  className={`rounded-full px-3 py-0.5 text-[10px] font-bold ${
                    selectedDocForPreview.status === "valid"
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                      : selectedDocForPreview.status === "expiring_soon"
                        ? "bg-amber-500/10 text-amber-700 border-amber-300"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                  }`}
                >
                  {selectedDocForPreview.status === "valid"
                    ? "ساري المفعول"
                    : selectedDocForPreview.status === "expiring_soon"
                      ? "ينتهي قريباً"
                      : "منتهي الصلاحية"}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2">
              {/* Document Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-muted/30 border border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[10px]">رقم الوثيقة:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedDocForPreview.docNumber || "غير متوفر"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">الجهة المصدرة:</span>
                  <span className="font-bold text-foreground">
                    {selectedDocForPreview.issuingAuthority || "رسمي"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">حجم الملف:</span>
                  <span className="font-mono font-bold">{selectedDocForPreview.fileSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">تاريخ الانتهاء:</span>
                  <span className="font-mono font-black text-primary">
                    {selectedDocForPreview.expiryDate || "غير محدد"}
                  </span>
                </div>
              </div>

              {/* Certified Visual Document Sheet with Security Watermark */}
              <div className="rounded-2xl border-2 border-primary/20 bg-card p-6 space-y-4 relative overflow-hidden shadow-inner text-center">
                {/* Background Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                  <span className="text-7xl font-black rotate-[-25deg]">FOCUS HRMS</span>
                </div>

                <div className="flex justify-between items-center border-b border-border/60 pb-3">
                  <div className="text-start">
                    <span className="text-xs font-black text-foreground block">
                      {company.legalNameAr || "شركة فوكس للحلول والتقنية"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      مستودع الأرشفة الرقمية الموحد
                    </span>
                  </div>
                  <Badge variant="secondary" className="rounded-full text-[10px] font-mono">
                    SHA-256 Verified
                  </Badge>
                </div>

                <div className="py-6 space-y-2.5">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h3 className="text-sm font-black text-foreground">
                    {selectedDocForPreview.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium max-w-md mx-auto">
                    تم توثيق وأرشفة هذا المستند إلكترونياً وتشفيره وفقاً للأنظمة واللوائح السعودية
                    المعتمدة بمعيار AES-256 السحابي.
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>المستند مطابق للأصل وموثق رسمياً</span>
                  </div>
                  <span className="font-mono">REF: {selectedDocForPreview.id.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-wrap gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewRenewalExpiry("2027-12-31");
                  setIsRenewModalOpen(true);
                }}
                className="text-xs font-bold gap-1.5 rounded-full border-border/80 h-9"
              >
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                تجديد الصلاحية
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                variant="outline"
                className="text-xs font-bold gap-1.5 rounded-full border-border/80 h-9"
              >
                <Printer className="h-3.5 w-3.5" />
                طباعة
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  toast.success(`جارٍ تنزيل: ${selectedDocForPreview.fileName}`)
                }
                className="text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-9 px-4"
              >
                <Download className="h-3.5 w-3.5" />
                تنزيل الملف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 2: Renew Document Expiry Date */}
      <Dialog open={isRenewModalOpen} onOpenChange={setIsRenewModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              تجديد وتحديث تاريخ الصلاحية
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديث مدة سريان الوثيقة بعد استلامها من الجهات المختصة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">تاريخ الانتهاء الجديد *</label>
              <input
                type="date"
                value={newRenewalExpiry}
                onChange={(e) => setNewRenewalExpiry(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleRenewDocument}
              className="w-full rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-9"
            >
              حفظ التجديد وتحديث السجل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Comprehensive Document Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              أرشفة ورفع وثيقة رسمية جديدة للمستودع
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تسجيل الوثيقة في ملف الموظف أو سجلات المنشأة مع منبهات انتهاء الصلاحية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            {/* Target Owner */}
            <div className="space-y-1.5">
              <label className="font-bold">صاحب الوثيقة / المنشأة *</label>
              <select
                value={newDoc.employeeId}
                onChange={(e) => setNewDoc({ ...newDoc, employeeId: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                <option value="company-hq">
                  🏢 {company.legalNameAr || "شركة فوكس القابضة"} (وثائق المنشأة)
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    👤 {emp.firstNameAr} {emp.lastNameAr} — {emp.jobTitleAr} ({emp.employeeNo})
                  </option>
                ))}
              </select>
            </div>

            {/* Document Title */}
            <div className="space-y-1.5">
              <label className="font-bold">عنوان الوثيقة / المستند *</label>
              <input
                type="text"
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                placeholder="مثال: تجديد رخصة العمل والإقامة 1448هـ"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Document Number & Issuing Authority */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label className="font-bold">رقم الوثيقة / المرجع</label>
                <input
                  type="text"
                  value={newDoc.docNumber}
                  onChange={(e) => setNewDoc({ ...newDoc, docNumber: e.target.value })}
                  placeholder="24XXXXXXXX"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">الجهة المصدرة</label>
                <input
                  type="text"
                  value={newDoc.issuingAuthority}
                  onChange={(e) => setNewDoc({ ...newDoc, issuingAuthority: e.target.value })}
                  placeholder="الجوازات / قوى / التجارة"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Category & Expiry Date */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label className="font-bold">تصنيف الوثيقة *</label>
                <select
                  value={newDoc.category}
                  onChange={(e) =>
                    setNewDoc({
                      ...newDoc,
                      category: e.target.value as StoredDocument["category"],
                    })
                  }
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
                >
                  <option value="iqama_id">هوية وطنية / إقامة</option>
                  <option value="passport">جواز سفر</option>
                  <option value="contract">عقد عمل موثق (قوى)</option>
                  <option value="gosi">تأمينات اجتماعية (GOSI)</option>
                  <option value="medical">فحص طبي / شهادة صحية</option>
                  <option value="license">رخصة قيادة / مهنية</option>
                  <option value="company">مستندات وسجلات الشركة</option>
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

            {/* Drag & Drop Simulation */}
            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/20 p-5 text-center space-y-2 cursor-pointer hover:bg-secondary/40 transition-colors">
              <Upload className="mx-auto h-7 w-7 text-primary" />
              <p className="font-bold text-foreground">اسحب الملف هنا أو اضغط للاختيار من جهازك</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                يدعم ملفات PDF, PNG, JPG بحد أقصى 25MB مشفرة
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleUploadSubmit}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-9 shadow-xs"
            >
              تأكيد وأرشفة الوثيقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Official Printable PDF Documents Generator Modal */}
      {selectedEmployeeObj && (
        <OfficialDocumentModal
          isOpen={isOfficialDocModalOpen}
          onClose={() => setIsOfficialDocModalOpen(false)}
          employee={selectedEmployeeObj}
          documentType={officialDocType}
        />
      )}
    </div>
  );
};
