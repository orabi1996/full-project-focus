import React, { useState, useMemo, useRef } from "react";
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
  Send,
  Check,
  X,
  ChevronRight,
  DollarSign,
  Wallet,
  HelpCircle,
  UserCheck,
  UserX,
  FilePlus,
  BookOpen,
  Shield,
  History,
  Stamp,
  BadgePercent,
  Briefcase,
  Paperclip,
  Award,
  CreditCard,
  Globe,
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

export interface DocumentVersion {
  version: string;
  uploadDate: string;
  fileName: string;
  fileSize: string;
  uploadedBy: string;
  notes?: string;
}

export interface StoredDocument {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo?: string;
  departmentName?: string;
  title: string;
  category:
    | "iqama_id"
    | "passport"
    | "contract"
    | "gosi"
    | "medical"
    | "license"
    | "company"
    | "policy";
  docNumber?: string;
  issuingAuthority?: string;
  fileName: string;
  fileSize: string;
  uploadDate: string;
  expiryDate?: string;
  issueDate?: string;
  status: "valid" | "expiring_soon" | "expired" | "pending_review" | "rejected";
  confidentiality: "public" | "internal" | "confidential" | "strictly_confidential";
  fileUrl?: string;
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  renewalFeeEstimated?: number;
  versions?: DocumentVersion[];
}

export interface DocumentRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  documentTitle: string;
  category: string;
  dueDate: string;
  requestedAt: string;
  status: "pending" | "fulfilled" | "overdue";
  notes?: string;
}

export interface CompanyPolicy {
  id: string;
  title: string;
  category: "hr_bylaws" | "penalties" | "security" | "remote_work" | "compliance";
  version: string;
  effectiveDate: string;
  fileSize: string;
  status: "active" | "draft" | "under_review";
  approvedByMinistry: boolean;
  description: string;
}

type MainTab = "vault" | "letters" | "audit_pipeline" | "compliance_radar" | "company_policies";
type ViewMode = "grid" | "table";

export function generateDocumentHtml(
  doc: StoredDocument,
  company: { legalNameAr?: string },
): string {
  const currentDate = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const refNo = doc.docNumber || `DOC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title} - ${doc.employeeName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 36px;
      background: #f8fafc;
      color: #0f172a;
      direction: rtl;
    }
    .sheet {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px 48px;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 17px;
      font-weight: 900;
      margin: 0 0 4px 0;
      color: #0f172a;
    }
    .header p {
      font-size: 11px;
      color: #475569;
      margin: 2px 0;
    }
    .meta {
      text-align: left;
      font-family: monospace;
      font-size: 11px;
    }
    .title-banner {
      background: #f1f5f9;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      padding: 10px;
      text-align: center;
      margin-bottom: 20px;
    }
    .title-banner h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .grid div {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 4px;
    }
    .grid div span.label {
      color: #64748b;
      font-weight: 600;
    }
    .grid div span.val {
      color: #0f172a;
      font-weight: 700;
    }
    .content-box {
      font-size: 12px;
      line-height: 1.8;
      color: #1e293b;
      margin-bottom: 28px;
      text-align: justify;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 2px solid #0f172a;
      padding-top: 20px;
      margin-top: 32px;
    }
    .stamp {
      border: 2px dashed #059669;
      color: #059669;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 900;
      display: inline-block;
      transform: rotate(-3deg);
      margin-top: 6px;
    }
    .qr-box {
      text-align: center;
      font-size: 9px;
      color: #64748b;
    }
    .qr-placeholder {
      width: 56px;
      height: 56px;
      border: 2px solid #0f172a;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 4px auto;
      font-weight: 900;
      font-size: 9px;
      background: #f1f5f9;
    }
    @media print {
      body {
        padding: 0;
        background: #fff;
      }
      .sheet {
        box-shadow: none;
        border: none;
        padding: 20px;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1>${company.legalNameAr || "شركة فوكس للحلول والتقنية المحدودة"}</h1>
        <p>سجل تجاري: 1010789654 • الرقم الضريبي: 300098765400003</p>
        <p>المملكة العربية السعودية - الرياض - المقر الرئيسي</p>
      </div>
      <div class="meta">
        <p><strong>المرجع:</strong> ${refNo}</p>
        <p><strong>التاريخ:</strong> ${currentDate}</p>
      </div>
    </div>

    <div class="title-banner">
      <h2>شهادة وتوثيق مستند رسمي: ${doc.title}</h2>
    </div>

    <div class="grid">
      <div><span class="label">صاحب الوثيقة / المنشأة:</span><span class="val">${doc.employeeName}</span></div>
      <div><span class="label">الرقم الوظيفي:</span><span class="val font-mono">${doc.employeeNo || "منشأة"}</span></div>
      <div><span class="label">رقم الوثيقة / السجل:</span><span class="val font-mono">${doc.docNumber || "—"}</span></div>
      <div><span class="label">الجهة الحكومية / المصدرة:</span><span class="val">${doc.issuingAuthority || "رسمي"}</span></div>
      <div><span class="label">تصنيف المستند:</span><span class="val">${doc.category}</span></div>
      <div><span class="label">تاريخ الإصدار / الرفع:</span><span class="val font-mono">${doc.uploadDate}</span></div>
      <div><span class="label">تاريخ انتهاء الصلاحية:</span><span class="val font-mono">${doc.expiryDate || "ساري بدون انتهاء"}</span></div>
      <div><span class="label">مستوى السرية والوصول:</span><span class="val">${doc.confidentiality}</span></div>
      <div><span class="label">حالة الصلاحية:</span><span class="val">${doc.status === "valid" ? "ساري المفعول وموثق" : doc.status === "expiring_soon" ? "ينتهي قريباً" : "منتهي الصلاحية"}</span></div>
      <div><span class="label">المعتمد والمراجع:</span><span class="val">${doc.verifiedBy || "إدارة الموارد البشرية"}</span></div>
    </div>

    <div class="content-box">
      <p>تشهد إدارة الموارد البشرية والشؤون الإدارية بأن هذا المستند معتمد ومحفوظ رسمياً بالأرشيف السحابي المشفر للشركة وفقاً للأنظمة واللوائح والقرارات الوزارية المعمول بها في المملكة العربية السعودية.</p>
      ${doc.notes ? `<p><strong>ملاحظات التوثيق الرسمية:</strong> ${doc.notes}</p>` : ""}
      <p style="font-size: 10px; color: #64748b;">تم التحقق من الوثيقة إلكترونياً برقم الأرشيف المعتمد (${doc.id.toUpperCase()}) بمعيار الأمان المشفر AES-256.</p>
    </div>

    <div class="footer">
      <div>
        <p style="font-weight: bold; margin: 0; font-size: 12px;">إدارة الموارد البشرية والتدقيق السحابي</p>
        <p style="font-size: 10px; color: #64748b; margin: 2px 0;">شركة فوكس للحلول والتقنية المحدودة</p>
        <div class="stamp">ختم الموارد البشرية المعتمد ✓</div>
      </div>
      <div class="qr-box">
        <div class="qr-placeholder">QR CODE</div>
        <span>رمز التحقق الإلكتروني</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const DocumentVaultView: React.FC = () => {
  const { employees, company, language, t } = useApp();

  // Navigation State
  const [mainTab, setMainTab] = useState<MainTab>("vault");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedConfidentiality, setSelectedConfidentiality] = useState<string>("all");

  // Bulk Selection
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Modals & Side Sheet State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isOfficialDocModalOpen, setIsOfficialDocModalOpen] = useState(false);
  const [officialDocType, setOfficialDocType] = useState<DocType>("salary_certificate");
  const [selectedEmployeeForDoc, setSelectedEmployeeForDoc] = useState(employees[0]?.id || "");
  const [isRequestDocModalOpen, setIsRequestDocModalOpen] = useState(false);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<StoredDocument | null>(null);
  const [sidePrintDoc, setSidePrintDoc] = useState<StoredDocument | null>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [newRenewalExpiry, setNewRenewalExpiry] = useState("2027-12-31");
  const [rejectReasonModalDoc, setRejectReasonModalDoc] = useState<StoredDocument | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");

  // Initial Enterprise Documents
  const [documents, setDocuments] = useState<StoredDocument[]>([
    {
      id: "doc-1",
      employeeId: employees[0]?.id || "emp-1",
      employeeName: employees[0] ? `${employees[0].firstNameAr} ${employees[0].lastNameAr}` : "م. عبد العزيز الفهد",
      employeeNo: employees[0]?.employeeNo || "EMP-1001",
      departmentName: employees[0]?.departmentName || "الإدارة التنفيذية",
      title: "الهوية الوطنية المعتمدة للمدير التنفيذي",
      category: "iqama_id",
      docNumber: "1098234112",
      issuingAuthority: "الأحوال المدنية - منصة أبشر",
      fileName: "national_id_ceo.pdf",
      fileSize: "1.4 MB",
      uploadDate: "2026-01-15",
      expiryDate: "2030-05-20",
      status: "valid",
      confidentiality: "confidential",
      verifiedBy: "أ. نورة التميمي (مدير الموارد البشرية)",
      verifiedAt: "2026-01-16",
      renewalFeeEstimated: 0,
      versions: [
        {
          version: "v1.0",
          uploadDate: "2021-02-10",
          fileName: "national_id_prev.pdf",
          fileSize: "1.1 MB",
          uploadedBy: "م. عبد العزيز الفهد",
          notes: "نسخة الهوية السابقة قبل التجديد",
        },
      ],
    },
    {
      id: "doc-2",
      employeeId: employees[1]?.id || "emp-2",
      employeeName: employees[1] ? `${employees[1].firstNameAr} ${employees[1].lastNameAr}` : "د. طارق المنصور",
      employeeNo: employees[1]?.employeeNo || "EMP-1002",
      departmentName: employees[1]?.departmentName || "تقنية المعلومات",
      title: "جواز السفر الدبلوماسي والمهني",
      category: "passport",
      docNumber: "P-8829103",
      issuingAuthority: "المديرية العامة للجوازات",
      fileName: "passport_cto.pdf",
      fileSize: "2.1 MB",
      uploadDate: "2025-08-10",
      expiryDate: "2026-09-25",
      status: "expiring_soon",
      confidentiality: "confidential",
      verifiedBy: "أ. نورة التميمي",
      verifiedAt: "2025-08-11",
      renewalFeeEstimated: 300,
    },
    {
      id: "doc-3",
      employeeId: employees[2]?.id || "emp-2",
      employeeName: employees[2] ? `${employees[2].firstNameAr} ${employees[2].lastNameAr}` : "أ. نورة التميمي",
      employeeNo: employees[2]?.employeeNo || "EMP-1003",
      departmentName: employees[2]?.departmentName || "الموارد البشرية",
      title: "عقد العمل الموحد الموثق إلكترونياً (منصة قوى)",
      category: "contract",
      docNumber: "QIWA-2026-9812",
      issuingAuthority: "وزارة الموارد البشرية والتنمية الاجتماعية",
      fileName: "qiwa_contract_chro.pdf",
      fileSize: "850 KB",
      uploadDate: "2026-02-01",
      expiryDate: "2027-02-01",
      status: "valid",
      confidentiality: "internal",
      verifiedBy: "النظام الآلي - ربط API قوى",
      verifiedAt: "2026-02-01",
      renewalFeeEstimated: 120,
    },
    {
      id: "doc-4",
      employeeId: employees[3]?.id || "emp-3",
      employeeName: employees[3] ? `${employees[3].firstNameAr} ${employees[3].lastNameAr}` : "م. ريان القحطاني",
      employeeNo: employees[3]?.employeeNo || "EMP-1004",
      departmentName: employees[3]?.departmentName || "الهندسة والعمليات",
      title: "شهادة بيان مدد وأجور التأمينات الاجتماعية (GOSI)",
      category: "gosi",
      docNumber: "GOSI-449102",
      issuingAuthority: "المؤسسة العامة للتأمينات الاجتماعية",
      fileName: "gosi_certificate_ryan.pdf",
      fileSize: "620 KB",
      uploadDate: "2026-03-12",
      status: "valid",
      confidentiality: "internal",
      verifiedBy: "أ. سارة الحربي",
      verifiedAt: "2026-03-13",
      renewalFeeEstimated: 0,
    },
    {
      id: "doc-5",
      employeeId: employees[4]?.id || "emp-4",
      employeeName: employees[4] ? `${employees[4].firstNameAr} ${employees[4].lastNameAr}` : "أ. هيفاء الشهري",
      employeeNo: employees[4]?.employeeNo || "EMP-1005",
      departmentName: employees[4]?.departmentName || "التسويق والمبيعات",
      title: "شهادة الفحص الطبي المهني المعتمد (إصدار الإقامة)",
      category: "medical",
      docNumber: "MED-2025-88",
      issuingAuthority: "مجلس الضمان الصحي CCHI",
      fileName: "medical_fitness_haifa.pdf",
      fileSize: "1.1 MB",
      uploadDate: "2025-08-01",
      expiryDate: "2026-08-01",
      status: "expired",
      confidentiality: "confidential",
      renewalFeeEstimated: 450,
      notes: "يتطلب إعادة الفحص الطبي الدوري لتجديد الإقامة بدون غرامة",
    },
    {
      id: "doc-6",
      employeeId: "company-hq",
      employeeName: company.legalNameAr || "شركة فوكس للحلول والتقنية المحدودة",
      title: "السجل التجاري الرئيسي للمنشأة (CR)",
      category: "company",
      docNumber: "1010098765",
      issuingAuthority: "وزارة التجارة - المركز السعودي للأعمال",
      fileName: "commercial_registration_2026.pdf",
      fileSize: "3.2 MB",
      uploadDate: "2026-01-01",
      expiryDate: "2027-01-01",
      status: "valid",
      confidentiality: "internal",
      verifiedBy: "الإدارة القانونية",
      verifiedAt: "2026-01-02",
      renewalFeeEstimated: 1200,
    },
    {
      id: "doc-7",
      employeeId: "company-hq",
      employeeName: company.legalNameAr || "شركة فوكس للحلول والتقنية المحدودة",
      title: "شهادة تسجيل ضريبة القيمة المضافة (ZATCA)",
      category: "company",
      docNumber: "300098127300003",
      issuingAuthority: "هيئة الزكاة والضريبة والجمارك",
      fileName: "vat_certificate_zatca.pdf",
      fileSize: "780 KB",
      uploadDate: "2026-01-10",
      status: "valid",
      confidentiality: "internal",
      renewalFeeEstimated: 0,
    },
    {
      id: "doc-8",
      employeeId: "company-hq",
      employeeName: company.legalNameAr || "شركة فوكس للحلول والتقنية المحدودة",
      title: "شهادة السعودة والامتثال بنطاقات (النطاق البلاتيني)",
      category: "company",
      docNumber: "SAUD-2026-0091",
      issuingAuthority: "وزارة الموارد البشرية - قوى",
      fileName: "saudization_certificate_2026.pdf",
      fileSize: "950 KB",
      uploadDate: "2026-02-15",
      expiryDate: "2026-09-20",
      status: "expiring_soon",
      confidentiality: "public",
      renewalFeeEstimated: 0,
    },
    {
      id: "doc-9",
      employeeId: employees[0]?.id || "emp-1",
      employeeName: employees[0] ? `${employees[0].firstNameAr} ${employees[0].lastNameAr}` : "م. عبد العزيز الفهد",
      employeeNo: employees[0]?.employeeNo || "EMP-1001",
      departmentName: "الإدارة التنفيذية",
      title: "شهادة الاعتماد المهني - الهيئة السعودية للمهندسين (SCE)",
      category: "license",
      docNumber: "SCE-892110",
      issuingAuthority: "الهيئة السعودية للمهندسين",
      fileName: "sce_engineering_license.pdf",
      fileSize: "1.3 MB",
      uploadDate: "2026-03-01",
      expiryDate: "2026-10-15",
      status: "valid",
      confidentiality: "internal",
      renewalFeeEstimated: 500,
    },
    {
      id: "doc-10",
      employeeId: employees[1]?.id || "emp-2",
      employeeName: employees[1] ? `${employees[1].firstNameAr} ${employees[1].lastNameAr}` : "د. طارق المنصور",
      employeeNo: employees[1]?.employeeNo || "EMP-1002",
      departmentName: "تقنية المعلومات",
      title: "تحديث العنوان الوطني الموحد (SPL)",
      category: "iqama_id",
      docNumber: "SPL-RIY-9901",
      issuingAuthority: "البريد السعودي - سبل",
      fileName: "national_address_spl.pdf",
      fileSize: "420 KB",
      uploadDate: "2026-03-02",
      status: "pending_review",
      confidentiality: "confidential",
      notes: "تم رفع العنوان الوطني الجديد من قبل الموظف وبانتظار اعتماد مسؤولي الموارد البشرية",
    },
  ]);

  // Document Requests Pipeline State
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([
    {
      id: "req-1",
      employeeId: employees[4]?.id || "emp-5",
      employeeName: employees[4] ? `${employees[4].firstNameAr} ${employees[4].lastNameAr}` : "أ. هيفاء الشهري",
      documentTitle: "تحديث شهادة الفحص الطبي الدوري السنوي",
      category: "medical",
      dueDate: "2026-09-15",
      requestedAt: "2026-09-01",
      status: "pending",
      notes: "مطلوبة لتجديد الإقامة قبل تاريخ الاستحقاق لتجنب غرامة الـ 500 ر.س",
    },
    {
      id: "req-2",
      employeeId: employees[1]?.id || "emp-2",
      employeeName: employees[1] ? `${employees[1].firstNameAr} ${employees[1].lastNameAr}` : "د. طارق المنصور",
      documentTitle: "تجديد جواز السفر المهني",
      category: "passport",
      dueDate: "2026-09-20",
      requestedAt: "2026-08-25",
      status: "pending",
      notes: "صلاحية الجواز الحالي أقل من شهرين",
    },
    {
      id: "req-3",
      employeeId: employees[3]?.id || "emp-4",
      employeeName: employees[3] ? `${employees[3].firstNameAr} ${employees[3].lastNameAr}` : "م. ريان القحطاني",
      documentTitle: "شهادة الآيبان البنكي الصادرة من البنك",
      category: "gosi",
      dueDate: "2026-08-30",
      requestedAt: "2026-08-15",
      status: "overdue",
      notes: "تأخر الموظف عن تزويد الموارد البشرية بشهادة الحساب",
    },
  ]);

  // Company Bylaws & Policies
  const [companyPolicies, setCompanyPolicies] = useState<CompanyPolicy[]>([
    {
      id: "pol-1",
      title: "لائحة تنظيم العمل الموحدة المعتمدة من وزارة الموارد البشرية",
      category: "hr_bylaws",
      version: "v3.2",
      effectiveDate: "2026-01-01",
      fileSize: "4.8 MB",
      status: "active",
      approvedByMinistry: true,
      description: "اللائحة الرسمية المنظمة لعلاقات العمل وساعات الدوام والعطلات الرسمية ومكافآت نهاية الخدمة المعتمدة عبر منصة قوى.",
    },
    {
      id: "pol-2",
      title: "لائحة الجزاءات والتحقيقات التأديبية والمكافآت",
      category: "penalties",
      version: "v2.0",
      effectiveDate: "2025-10-01",
      fileSize: "2.1 MB",
      status: "active",
      approvedByMinistry: true,
      description: "جدول المخالفات المرورية والمسلكية وضوابط التحقيق الإداري والخصومات المتوافقة مع نظام العمل السعودي.",
    },
    {
      id: "pol-3",
      title: "سياسة العمل عن بعد والدوام الهجين وحماية البيانات",
      category: "remote_work",
      version: "v1.5",
      effectiveDate: "2026-02-01",
      fileSize: "1.6 MB",
      status: "active",
      approvedByMinistry: false,
      description: "ضوابط العمل خارج المقر، توثيق ساعات الحضور عبر تطبيق الجوال، وسياسات الأمن السيبراني ومكافحة تسريب البيانات.",
    },
    {
      id: "pol-4",
      title: "مصفوفة الصلاحيات والتفويض الإداري والمالي (DoA)",
      category: "compliance",
      version: "v4.0",
      effectiveDate: "2026-01-01",
      fileSize: "3.4 MB",
      status: "active",
      approvedByMinistry: false,
      description: "حدود الاعتمادات المالية والمشتريات والتوظيف والترقيات وسلسلة الموافقات المعتمدة من مجلس الإدارة.",
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
    confidentiality: "internal" as StoredDocument["confidentiality"],
    fileName: "",
    notes: "",
  });

  // Local File Upload Ref & State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [selectedUploadFileSize, setSelectedUploadFileSize] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const processSelectedFile = (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("حجم الملف يجب ألا يتجاوز 25 ميغابايت");
      return;
    }
    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    setSelectedUploadFile(file);
    setSelectedUploadFileSize(sizeStr);

    const cleanTitle = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]/g, " ")
      .trim();

    setNewDoc((prev) => ({
      ...prev,
      fileName: file.name,
      title: prev.title.trim() ? prev.title : cleanTitle,
    }));

    toast.success(`تم اختيار الملف بنجاح: ${file.name} (${sizeStr})`);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Request Form State
  const [newRequest, setNewRequest] = useState({
    employeeId: employees[0]?.id || "",
    documentTitle: "",
    category: "iqama_id",
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
  });

  // Metric Computations
  const totalCount = documents.length;
  const expiringSoonCount = useMemo(
    () => documents.filter((d) => d.status === "expiring_soon").length,
    [documents],
  );
  const expiredCount = useMemo(
    () => documents.filter((d) => d.status === "expired").length,
    [documents],
  );
  const pendingReviewCount = useMemo(
    () => documents.filter((d) => d.status === "pending_review").length,
    [documents],
  );
  const contractsCount = useMemo(
    () => documents.filter((d) => d.category === "contract").length,
    [documents],
  );
  const totalEstimatedFees = useMemo(
    () =>
      documents
        .filter((d) => d.status === "expiring_soon" || d.status === "expired")
        .reduce((sum, d) => sum + (d.renewalFeeEstimated || 0), 0),
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

      // Folder / Category
      if (selectedFolder !== "all" && doc.category !== selectedFolder) return false;

      // Employee
      if (selectedEmployeeFilter !== "all" && doc.employeeId !== selectedEmployeeFilter)
        return false;

      // Status
      if (selectedStatusFilter !== "all" && doc.status !== selectedStatusFilter) return false;

      // Confidentiality
      if (selectedConfidentiality !== "all" && doc.confidentiality !== selectedConfidentiality)
        return false;

      return true;
    });
  }, [
    documents,
    searchQuery,
    selectedFolder,
    selectedEmployeeFilter,
    selectedStatusFilter,
    selectedConfidentiality,
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
      "الرقم الوظيفي": d.employeeNo || "منشأة",
      "الإدارة": d.departmentName || "عام",
      "رقم الوثيقة / المرجع": d.docNumber || "غير محدد",
      "الجهة المصدرة": d.issuingAuthority || "رسمي",
      "التصنيف": d.category,
      "مستوى السرية": d.confidentiality,
      "اسم الملف": d.fileName,
      "حجم الملف": d.fileSize,
      "تاريخ الرفع": d.uploadDate,
      "تاريخ الانتهاء": d.expiryDate || "غير محدد",
      "الحالة": d.status,
      "المراجع المعتمد": d.verifiedBy || "غير معتمد",
    }));

    exportToCSV(`سجل_مستودع_الوثائق_${new Date().toISOString().slice(0, 10)}`, exportData);
    toast.success(`تم تصدير كشف (${listToExport.length}) وثائق بنجاح!`);
  };

  const handleDeleteSelected = () => {
    if (selectedDocIds.length === 0) return;
    const count = selectedDocIds.length;
    setDocuments((prev) => prev.filter((d) => !selectedDocIds.includes(d.id)));
    setSelectedDocIds([]);
    toast.success(`تم حذف (${count}) وثائق من المستودع السحابي!`);
  };

  const handleDeleteSingle = (id: string) => {
    const doc = documents.find((d) => d.id === id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    toast.success(`تم حذف الوثيقة (${doc?.title || ""}) بنجاح`);
    if (selectedDocForPreview?.id === id) {
      setSelectedDocForPreview(null);
    }
    if (sidePrintDoc?.id === id) {
      setSidePrintDoc(null);
    }
  };

  // Real File Download Handler
  const handleDownloadDocument = (doc: StoredDocument) => {
    if (doc.fileUrl) {
      const link = document.createElement("a");
      link.href = doc.fileUrl;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`تم بدء تنزيل المستند (${doc.fileName}) وحفظه على جهازك بنجاح!`);
      return;
    }

    const htmlContent = generateDocumentHtml(doc, company);
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const baseName = doc.fileName.replace(/\.[^/.]+$/, "");
    link.download = `${baseName}_وثيقة_رسمية.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`تم بدء تنزيل المستند (${doc.title}) وحفظه على جهازك بنجاح!`);
  };

  // Isolated Clean Document Print Handler
  const handlePrintIsolated = (doc: StoredDocument) => {
    const printWindow = window.open("", "_blank", "width=850,height=1100");
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة لإتمام الطباعة المباشرة");
      return;
    }
    const content = generateDocumentHtml(doc, company);
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Bulk Download Handler
  const handleDownloadBulk = () => {
    if (selectedDocIds.length === 0) return;
    const docsToDownload = filteredDocs.filter((d) => selectedDocIds.includes(d.id));
    docsToDownload.forEach((doc, idx) => {
      setTimeout(() => {
        handleDownloadDocument(doc);
      }, idx * 250);
    });
    toast.success(`جاري تنزيل وحفظ (${docsToDownload.length}) وثائق على جهازك...`);
  };

  // Verification Pipeline Actions
  const handleApproveDocument = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              status: "valid",
              verifiedBy: "أ. نورة التميمي (مسؤول الموارد البشرية)",
              verifiedAt: new Date().toLocaleDateString("ar-SA"),
            }
          : d,
      ),
    );
    toast.success("تم اعتماد وتوثيق الوثيقة بنجاح وإشعار الموظف!");
  };

  const handleOpenRejectModal = (doc: StoredDocument) => {
    setRejectReasonModalDoc(doc);
    setRejectReasonInput("الصورة غير واضحة / المستند منتهي الصلاحية");
  };

  const handleConfirmReject = () => {
    if (!rejectReasonModalDoc) return;
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === rejectReasonModalDoc.id
          ? {
              ...d,
              status: "rejected",
              rejectionReason: rejectReasonInput,
            }
          : d,
      ),
    );
    toast.error(`تم رفض الوثيقة وإرسال إشعار للموظف: ${rejectReasonInput}`);
    setRejectReasonModalDoc(null);
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
        ? company.legalNameAr || "شركة فوكس للحلول والتقنية المحدودة"
        : emp
          ? `${emp.firstNameAr} ${emp.lastNameAr}`
          : "موظف عام";

    const docItem: StoredDocument = {
      id: `doc-${Date.now()}`,
      employeeId: newDoc.employeeId,
      employeeName: ownerName,
      employeeNo: emp?.employeeNo,
      departmentName: emp?.departmentName,
      title: newDoc.title,
      category: newDoc.category,
      docNumber: newDoc.docNumber || `DOC-${Math.floor(100000 + Math.random() * 900000)}`,
      issuingAuthority: newDoc.issuingAuthority || "الجهة المعتمدة",
      fileName: selectedUploadFile
        ? selectedUploadFile.name
        : (newDoc.fileName || `${newDoc.title.toLowerCase().replace(/\s+/g, "_")}.pdf`),
      fileSize: selectedUploadFileSize || "1.4 MB",
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
      confidentiality: newDoc.confidentiality,
      notes: newDoc.notes,
      verifiedBy: "مسؤول الموارد البشرية",
      verifiedAt: new Date().toLocaleDateString("ar-SA"),
      renewalFeeEstimated: newDoc.category === "iqama_id" ? 650 : newDoc.category === "contract" ? 120 : 0,
      fileUrl: selectedUploadFile ? URL.createObjectURL(selectedUploadFile) : undefined,
      versions: [],
    };

    setDocuments([docItem, ...documents]);
    toast.success(`تمت أرشفة وحفظ (${newDoc.title}) في الخزينة السحابية بنجاح!`);
    setIsUploadModalOpen(false);
    setSelectedUploadFile(null);
    setSelectedUploadFileSize("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setNewDoc({
      employeeId: employees[0]?.id || "company-hq",
      title: "",
      category: "iqama_id",
      docNumber: "",
      issuingAuthority: "",
      expiryDate: "",
      confidentiality: "internal",
      fileName: "",
      notes: "",
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

    // Archive current version
    const previousVersion: DocumentVersion = {
      version: `v${(selectedDocForPreview.versions?.length || 0) + 1}.0`,
      uploadDate: selectedDocForPreview.uploadDate,
      fileName: selectedDocForPreview.fileName,
      fileSize: selectedDocForPreview.fileSize,
      uploadedBy: selectedDocForPreview.verifiedBy || "مسؤول الأرشفة",
      notes: `نسخة سابقة انتهت في ${selectedDocForPreview.expiryDate || "غير محدد"}`,
    };

    const updated = documents.map((d) =>
      d.id === selectedDocForPreview.id
        ? {
            ...d,
            expiryDate: newRenewalExpiry,
            status: newStatus,
            versions: [previousVersion, ...(d.versions || [])],
          }
        : d,
    );

    setDocuments(updated);
    setSelectedDocForPreview({
      ...selectedDocForPreview,
      expiryDate: newRenewalExpiry,
      status: newStatus,
      versions: [previousVersion, ...(selectedDocForPreview.versions || [])],
    });
    setIsRenewModalOpen(false);
    toast.success(`تم تجديد صلاحية (${selectedDocForPreview.title}) حتى ${newRenewalExpiry} وأرشفة النسخة السابقة بنجاح!`);
  };

  // Submit Document Request
  const handleCreateDocumentRequest = () => {
    if (!newRequest.documentTitle.trim()) {
      toast.error("يرجى إدخال مسمى الوثيقة المطلوبة");
      return;
    }
    const emp = employees.find((e) => e.id === newRequest.employeeId);
    if (!emp) {
      toast.error("يرجى اختيار الموظف");
      return;
    }

    const reqItem: DocumentRequest = {
      id: `req-${Date.now()}`,
      employeeId: emp.id,
      employeeName: `${emp.firstNameAr} ${emp.lastNameAr}`,
      documentTitle: newRequest.documentTitle,
      category: newRequest.category,
      dueDate: newRequest.dueDate,
      requestedAt: new Date().toISOString().split("T")[0],
      status: "pending",
      notes: newRequest.notes,
    };

    setDocumentRequests([reqItem, ...documentRequests]);
    toast.success(`تم إرسال طلب استيفاء (${newRequest.documentTitle}) للموظف (${emp.firstNameAr}) بنجاح!`);
    setIsRequestDocModalOpen(false);
    setNewRequest({
      employeeId: employees[0]?.id || "",
      documentTitle: "",
      category: "iqama_id",
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: "",
    });
  };

  const openOfficialGenerator = (type: DocType, empId?: string) => {
    setOfficialDocType(type);
    if (empId) setSelectedEmployeeForDoc(empId);
    setIsOfficialDocModalOpen(true);
  };

  const selectedEmployeeObj =
    employees.find((e) => e.id === selectedEmployeeForDoc) || employees[0];

  return (
    <div className="space-y-6">
      {/* Enterprise Header Section */}
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
            خزينة ومستودع الوثائق السحابي المؤسسي (Enterprise Document Vault)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            الأرشفة الرقمية المشفرة، حوكمة عقود قوى، رادار الامتثال وتكاليف التجديد، ومركز إصدار الخطابات المعتمدة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsRequestDocModalOpen(true)}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <Send className="h-4 w-4 text-primary" />
            طلب وثيقة من موظف
          </Button>

          <Button
            onClick={() => openOfficialGenerator("salary_certificate")}
            variant="outline"
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
          >
            <Stamp className="h-4 w-4 text-primary" />
            إصدار خطاب معتمد
          </Button>

          <Button
            onClick={() => setIsUploadModalOpen(true)}
            size="sm"
            className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-5"
          >
            <Upload className="h-4 w-4" />
            رفع وأرشفة وثيقة
          </Button>
        </div>
      </div>

      {/* Top 5 High-Impact KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Documents */}
        <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي الوثائق والأرشفة</span>
            <p className="text-xl font-black text-foreground mt-0.5">{totalCount} وثيقة</p>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
              <Lock className="h-3 w-3" /> تشفير سحابي AES-256
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <IconSymbol name="cloud_done" source="material" size={24} />
          </div>
        </div>

        {/* Qiwa Contracts */}
        <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">عقود قوى الموثقة</span>
            <p className="text-xl font-black text-foreground mt-0.5">{contractsCount} عقود</p>
            <span className="text-[10px] text-primary font-bold flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="h-3 w-3" /> امتثال 100% لوزارة العمل
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <IconSymbol name="history_edu" source="material" size={24} />
          </div>
        </div>

        {/* Expiring Soon (<30 Days) */}
        <div className="rounded-3xl border border-amber-300 bg-amber-500/10 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-800">تنبيهات التجديد (&lt;30 يوم)</span>
            <p className="text-xl font-black text-amber-700 mt-0.5">{expiringSoonCount} وثائق</p>
            <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" /> تكلفة متوقعة: {totalEstimatedFees.toLocaleString()} ر.س
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-amber-600/20 flex items-center justify-center text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Expired Docs */}
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-destructive">وثائق منتهية (مخالفة)</span>
            <p className="text-xl font-black text-destructive mt-0.5">{expiredCount} وثائق</p>
            <span className="text-[10px] text-destructive font-bold flex items-center gap-1 mt-0.5">
              <ShieldAlert className="h-3 w-3" /> خطر غرامات مالية
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-destructive/20 flex items-center justify-center text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Pending HR Review */}
        <div className="rounded-3xl border border-purple-300 bg-purple-500/10 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-purple-800">بانتظار تدقيق واعتماد HR</span>
            <p className="text-xl font-black text-purple-700 mt-0.5">{pendingReviewCount} وثيقة</p>
            <span className="text-[10px] text-purple-700 font-bold flex items-center gap-1 mt-0.5">
              <History className="h-3 w-3" /> مرفوعة من الموظفين
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-purple-600/20 flex items-center justify-center text-purple-700">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main 5 Navigation Tabs (Enterprise Business Modules) */}
      <div className="border-b border-border/80">
        <nav className="flex space-x-2 rtl:space-x-reverse overflow-x-auto text-xs font-bold pb-2">
          <button
            type="button"
            onClick={() => setMainTab("vault")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all whitespace-nowrap ${
              mainTab === "vault"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Folder className="h-4 w-4" />
            الخزينة والأرشيف الرقمي ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setMainTab("letters")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all whitespace-nowrap ${
              mainTab === "letters"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Stamp className="h-4 w-4" />
            مركز إصدار الخطابات المعتمدة
          </button>

          <button
            type="button"
            onClick={() => setMainTab("audit_pipeline")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all whitespace-nowrap ${
              mainTab === "audit_pipeline"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <UserCheck className="h-4 w-4" />
            مسار تدقيق واعتماد الوثائق
            {pendingReviewCount > 0 && (
              <Badge className="bg-purple-600 text-white rounded-full text-[10px] h-5 px-1.5 font-bold">
                {pendingReviewCount}
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab("compliance_radar")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all whitespace-nowrap ${
              mainTab === "compliance_radar"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Wallet className="h-4 w-4" />
            رادار الامتثال وتكاليف التجديد الحكومي
          </button>

          <button
            type="button"
            onClick={() => setMainTab("company_policies")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all whitespace-nowrap ${
              mainTab === "company_policies"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            اللوائح والسياسات المؤسسية ({companyPolicies.length})
          </button>
        </nav>
      </div>

      {/* TAB 1: DOCUMENT VAULT */}
      {mainTab === "vault" && (
        <div className="space-y-4">
          {/* Quick Folders Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-xs font-black text-muted-foreground whitespace-nowrap ml-1 flex items-center gap-1">
              <Folder className="h-3.5 w-3.5 text-primary" />
              المجلدات:
            </span>
            <button
              type="button"
              onClick={() => setSelectedFolder("all")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                selectedFolder === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
              }`}
            >
              كافة الوثائق ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolder("iqama_id")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                selectedFolder === "iqama_id"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
              }`}
            >
              🇸🇦 الهويات والإقامات
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolder("passport")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                selectedFolder === "passport"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
              }`}
            >
              🛂 جوازات السفر
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolder("contract")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                selectedFolder === "contract"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
              }`}
            >
              📄 عقود قوى ({contractsCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolder("gosi")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                selectedFolder === "gosi"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
              }`}
            >
              🏢 التأمينات (GOSI)
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolder("medical")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                selectedFolder === "medical"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
              }`}
            >
              🏥 الفحوصات والشهادات الصحية
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolder("license")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                selectedFolder === "license"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
              }`}
            >
              📜 الرخص المهنية (SCE / SOCPA)
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolder("company")}
              className={`rounded-full px-3.5 py-1.5 font-bold transition-all whitespace-nowrap ${
                selectedFolder === "company"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-secondary"
              }`}
            >
              🏛️ وثائق وسجلات المنشأة
            </button>
          </div>

          {/* Search, Multi-Filters & View Mode Toolbar */}
          <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم، الموظف، المرجع..."
                  className="w-full h-10 rounded-full border border-border/80 bg-muted/30 pr-10 pl-3 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                />
              </div>

              {/* Employee Filter */}
              <div>
                <select
                  value={selectedEmployeeFilter}
                  onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                  className="w-full h-10 rounded-full border border-border/80 bg-muted/30 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
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

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full h-10 rounded-full border border-border/80 bg-muted/30 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                >
                  <option value="all">كافة حالات السريان</option>
                  <option value="valid">ساري المفعول</option>
                  <option value="expiring_soon">ينتهي قريباً (&lt;30 يوم)</option>
                  <option value="expired">منتهي الصلاحية</option>
                  <option value="pending_review">بانتظار تدقيق HR</option>
                  <option value="rejected">مرفوض للتصحيح</option>
                </select>
              </div>

              {/* Confidentiality Level */}
              <div>
                <select
                  value={selectedConfidentiality}
                  onChange={(e) => setSelectedConfidentiality(e.target.value)}
                  className="w-full h-10 rounded-full border border-border/80 bg-muted/30 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                >
                  <option value="all">كافة مستويات السرية</option>
                  <option value="public">🌐 عام (متاح للموظفين)</option>
                  <option value="internal">🏢 داخلي للمنشأة</option>
                  <option value="confidential">🔒 سري (HR والمالية)</option>
                  <option value="strictly_confidential">🛡️ سري للغاية (C-Level)</option>
                </select>
              </div>

              {/* View Switcher & Action */}
              <div className="flex items-center justify-end gap-2">
                <div className="flex items-center bg-muted/60 p-0.5 rounded-full border border-border/80">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      viewMode === "grid"
                        ? "bg-card text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    بطاقات
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      viewMode === "table"
                        ? "bg-card text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    جدول
                  </button>
                </div>

                <Button
                  onClick={handleExportSelectedOrAll}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs font-bold h-10 px-3.5 border-border/80 hover:bg-secondary"
                  title="تصدير كشف CSV"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                </Button>
              </div>
            </div>

            {/* Results bar */}
            <div className="flex justify-between items-center px-1 text-xs border-t border-border/60 pt-2.5">
              <span className="font-bold text-muted-foreground">
                عرض <span className="text-foreground font-black font-mono">{filteredDocs.length}</span> وثيقة
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-xs text-primary font-bold hover:underline"
              >
                {isAllSelected ? "إلغاء تحديد الكل" : "تحديد كافة المعروض"}
              </button>
            </div>
          </div>

          {/* VIEW 1: SMART CARDS GRID */}
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
                    {/* Top Bar: Checkbox & Status */}
                    <div className="flex items-center justify-between">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(doc.id)}
                        className="rounded accent-primary cursor-pointer h-4 w-4"
                      />

                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] rounded-full px-2.5 py-0.5 font-bold ${
                            doc.status === "valid"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                              : doc.status === "expiring_soon"
                                ? "bg-amber-500/10 text-amber-700 border-amber-200"
                                : doc.status === "expired"
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : doc.status === "pending_review"
                                    ? "bg-purple-500/10 text-purple-700 border-purple-200"
                                    : "bg-red-500/10 text-red-700 border-red-200"
                          }`}
                        >
                          {doc.status === "valid"
                            ? "ساري المفعول"
                            : doc.status === "expiring_soon"
                              ? "ينتهي قريباً"
                              : doc.status === "expired"
                                ? "منتهي الصلاحية"
                                : doc.status === "pending_review"
                                  ? "بانتظار تدقيق HR"
                                  : "مرفوض"}
                        </Badge>
                      </div>
                    </div>

                    {/* Card Body: Thumbnail & Info */}
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
                        ) : doc.category === "license" ? (
                          <Award className="h-8 w-8 text-amber-600" />
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

                    {/* Metadata Summary Box */}
                    <div className="rounded-2xl bg-muted/25 border border-border/60 p-3 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">رقم الوثيقة:</span>
                        <span className="font-mono font-bold text-foreground">
                          {doc.docNumber || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الجهة المصدرة:</span>
                        <span className="font-semibold text-foreground truncate max-w-[120px]">
                          {doc.issuingAuthority || "رسمي"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                        <span
                          className={`font-mono font-bold ${
                            doc.status === "expired"
                              ? "text-destructive font-black"
                              : doc.status === "expiring_soon"
                                ? "text-amber-600 font-black"
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
                        onClick={() => setSidePrintDoc(doc)}
                        className="rounded-full text-xs font-bold h-8 w-8 p-0 border-border/80 hover:bg-secondary text-primary"
                        title="معاينة وطباعة المستند في الصفحة الجانبية"
                      >
                        <Printer className="h-3.5 w-3.5" />
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
                        onClick={() => handleDownloadDocument(doc)}
                        className="rounded-full text-xs font-bold h-8 w-8 p-0 border-border/80 hover:bg-secondary"
                        title="تنزيل الملف وحفظه على جهازك"
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
                      <th className="py-3 px-4 text-start">عنوان الوثيقة والملف</th>
                      <th className="py-3 px-4 text-start">صاحب الوثيقة / المنشأة</th>
                      <th className="py-3 px-4 text-start">الرقم المرجعي والجهة</th>
                      <th className="py-3 px-4 text-start">التصنيف والسرية</th>
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
                              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <FileText className="h-4 w-4" />
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
                            <span className="font-mono font-bold text-foreground block">
                              {doc.docNumber || "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {doc.issuingAuthority || "رسمي"}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className="text-[10px] rounded-full px-2 font-bold block w-fit mb-1"
                            >
                              {doc.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-bold">
                              {doc.confidentiality === "confidential"
                                ? "🔒 سري"
                                : doc.confidentiality === "strictly_confidential"
                                  ? "🛡️ سري للغاية"
                                  : "🏢 داخلي"}
                            </span>
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
                              <span className="text-muted-foreground">غير محدد</span>
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
                                    : doc.status === "expired"
                                      ? "bg-destructive/10 text-destructive border-destructive/30"
                                      : "bg-purple-500/10 text-purple-700 border-purple-200"
                              }`}
                            >
                              {doc.status === "valid"
                                ? "ساري المفعول"
                                : doc.status === "expiring_soon"
                                  ? "ينتهي قريباً"
                                  : doc.status === "expired"
                                    ? "منتهي الصلاحية"
                                    : "بانتظار تدقيق HR"}
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
                                onClick={() => setSidePrintDoc(doc)}
                                className="h-8 w-8 rounded-full text-primary hover:bg-secondary"
                                title="معاينة وطباعة المستند في الصفحة الجانبية"
                              >
                                <Printer className="h-4 w-4" />
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
                                onClick={() => handleDownloadDocument(doc)}
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
                                title="تنزيل الملف وحفظه على جهازك"
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
        </div>
      )}

      {/* TAB 2: OFFICIAL LETTERS ISSUANCE STUDIO */}
      {mainTab === "letters" && (
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <Stamp className="h-5 w-5 text-primary" />
                مركز إصدار الخطابات والشهادات الرسمية المعتمدة (Corporate Letterhead Generator)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                توليد الخطابات المعتمدة رقمياً باللغتين العربية والإنجليزية مع الأختام ورموز التحقق QR
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Template Card 1 */}
            <div className="rounded-3xl border border-border/80 p-5 bg-card hover:border-primary/60 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="font-black text-sm text-foreground">شهادة تعريف وتفاصيل الراتب</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-5">
                  خطاب رسمي يوضح الراتب الأساسي والبدلات الشهرية موجه للبنوك، شركات التمويل، أو السفارات.
                </p>
              </div>
              <Button
                onClick={() => openOfficialGenerator("salary_certificate")}
                className="w-full rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-9 shadow-xs"
              >
                إصدار الشهادة الآن
              </Button>
            </div>

            {/* Template Card 2 */}
            <div className="rounded-3xl border border-border/80 p-5 bg-card hover:border-primary/60 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h3 className="font-black text-sm text-foreground">خطاب فتح حساب بنكي وتحويل راتب</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-5">
                  خطاب موجه للبنوك والمصارف السعودية لفتح حساب جاري للرواتب والالتزام بنظام حماية الأجور WPS.
                </p>
              </div>
              <Button
                onClick={() => openOfficialGenerator("bank_account_letter")}
                className="w-full rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-9 shadow-xs"
              >
                إصدار الخطاب البنكي
              </Button>
            </div>

            {/* Template Card 3 */}
            <div className="rounded-3xl border border-border/80 p-5 bg-card hover:border-primary/60 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-3">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="font-black text-sm text-foreground">خطاب طلب تأشيرة وسفارة (شنغن / بريطانيا)</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-5">
                  شهادة عمل باللغة الإنجليزية (No Objection Certificate) موجهة للقنصليات والسفارات لطلب تأشيرة سفر سياحية أو عمل.
                </p>
              </div>
              <Button
                onClick={() => openOfficialGenerator("embassy_visa_letter")}
                className="w-full rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white h-9 shadow-xs"
              >
                إصدار خطاب السفارة (English)
              </Button>
            </div>

            {/* Template Card 4 */}
            <div className="rounded-3xl border border-border/80 p-5 bg-card hover:border-primary/60 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mb-3">
                  <IconSymbol name="history_edu" source="material" size={28} />
                </div>
                <h3 className="font-black text-sm text-foreground">عقد عمل سعودي موحد (قوى)</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-5">
                  نسخة طبق الأصل من عقد العمل الموثق مع منصة قوى وفق أحدث تعديلات نظام العمل السعودي.
                </p>
              </div>
              <Button
                onClick={() => openOfficialGenerator("employment_contract")}
                className="w-full rounded-full text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white h-9 shadow-xs"
              >
                طباعة عقد العمل المعتمد
              </Button>
            </div>

            {/* Template Card 5 */}
            <div className="rounded-3xl border border-border/80 p-5 bg-card hover:border-primary/60 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
                  <Award className="h-6 w-6" />
                </div>
                <h3 className="font-black text-sm text-foreground">شهادة خبرة وخدمة عمل رسمية</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-5">
                  شهادة رسمية توضح مدة خدمة الموظف، المسمى الوظيفي، والقطاع المهني لإثبات الخبرة.
                </p>
              </div>
              <Button
                onClick={() => openOfficialGenerator("experience_certificate")}
                className="w-full rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white h-9 shadow-xs"
              >
                إصدار شهادة الخبرة
              </Button>
            </div>

            {/* Template Card 6 */}
            <div className="rounded-3xl border border-border/80 p-5 bg-card hover:border-primary/60 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-black text-sm text-foreground">شهادة إخلاء طرف ومخالصة نهائية</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-5">
                  إبراء ذمة الموظف بعد انتهاء الخدمة وتسليم العهد وفق المادتين 84 و 85 من نظام العمل السعودي.
                </p>
              </div>
              <Button
                onClick={() => openOfficialGenerator("clearance_letter")}
                className="w-full rounded-full text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground h-9 shadow-xs"
              >
                إصدار المخالصة وإخلاء الطرف
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT & VERIFICATION PIPELINE */}
      {mainTab === "audit_pipeline" && (
        <div className="space-y-6">
          {/* Section A: Pending Document Verification */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-600" />
                  الوثائق المرفوعة من الموظفين وبانتظار تدقيق واعتماد HR ({pendingReviewCount})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  مراجعة الوثائق المرفوعة حديثاً من تطبيق الخدمة الذاتية (ESS) والتأكد من مطابقتها قبل اعتمادها
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {documents
                .filter((d) => d.status === "pending_review")
                .map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-purple-200 bg-purple-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="h-11 w-11 rounded-2xl bg-purple-600/10 text-purple-700 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-foreground">{doc.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          الموظف: <span className="font-bold text-foreground">{doc.employeeName}</span> ({doc.employeeNo}) • {doc.departmentName}
                        </p>
                        <p className="text-[11px] text-purple-700 font-medium mt-1">
                          ملاحظات الموظف: {doc.notes || "لا توجد ملاحظات"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedDocForPreview(doc)}
                        className="rounded-full text-xs font-bold gap-1 h-9 px-3.5 border-border/80"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        معاينة الملف
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleApproveDocument(doc.id)}
                        className="rounded-full text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-4 shadow-xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        اعتماد وتوثيق
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleOpenRejectModal(doc)}
                        className="rounded-full text-xs font-bold gap-1 h-9 px-3.5 shadow-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                        رفض وتصحيح
                      </Button>
                    </div>
                  </div>
                ))}

              {pendingReviewCount === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs font-medium">
                  🎉 رائع! تم تدقيق واعتماد كافة الوثائق المرفوعة من الموظفين بنجاح ولا توجد طلبات معلقة.
                </div>
              )}
            </div>
          </div>

          {/* Section B: Document Requests Tracker */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  متابعة طلبات استيفاء الوثائق المرسلة للموظفين ({documentRequests.length})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تتبع مهام رفع المستندات المفقودة أو المجددة والمواعيد النهائية المحددة للموظفين
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsRequestDocModalOpen(true)}
                className="rounded-full text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4"
              >
                <Plus className="h-4 w-4" />
                طلب وثيقة جديدة
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 text-start">الموظف المعني</th>
                    <th className="py-3 px-4 text-start">الوثيقة المطلوبة</th>
                    <th className="py-3 px-4 text-start">تاريخ الإرسال</th>
                    <th className="py-3 px-4 text-start">الموعد النهائي (Deadline)</th>
                    <th className="py-3 px-4 text-start">حالة الطلب</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {documentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-foreground">{req.employeeName}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-foreground block">{req.documentTitle}</span>
                        <span className="text-[10px] text-muted-foreground">{req.notes}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{req.requestedAt}</td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">{req.dueDate}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] rounded-full px-2.5 font-bold ${
                            req.status === "pending"
                              ? "bg-amber-500/10 text-amber-700 border-amber-200"
                              : req.status === "overdue"
                                ? "bg-destructive/10 text-destructive border-destructive/30"
                                : "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {req.status === "pending"
                            ? "بانتظار الرفع"
                            : req.status === "overdue"
                              ? "متأخر عن الموعد"
                              : "تم الاستيفاء"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toast.success(`تم إرسال تذكير عاجل للموظف (${req.employeeName}) بنجاح!`)}
                          className="rounded-full text-xs font-bold gap-1 border-border/80 hover:bg-secondary h-8 px-3"
                        >
                          <Send className="h-3 w-3 text-primary" />
                          إرسال تذكير
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMPLIANCE RADAR & STATUTORY COST ESTIMATOR */}
      {mainTab === "compliance_radar" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                  رادار الامتثال الحكومي وتقدير رسوم التجديد (Compliance & Government Fees Radar)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  حساب التكاليف الحكومية لرسوم الإقامات، عقود قوى، السجلات التجارية، وتفادي الغرامات المالية
                </p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-200 rounded-2xl p-3 px-5 text-center">
                <span className="text-[11px] font-bold text-emerald-800 block">إجمالي رسوم التجديد المتوقعة</span>
                <span className="text-xl font-black text-emerald-700 font-mono">
                  {totalEstimatedFees.toLocaleString()} ر.س
                </span>
              </div>
            </div>

            {/* Expiring Documents Financial Breakdown */}
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 text-start">الوثيقة والمستند</th>
                    <th className="py-3 px-4 text-start">المستفيد / المنشأة</th>
                    <th className="py-3 px-4 text-start">تاريخ انتهاء الصلاحية</th>
                    <th className="py-3 px-4 text-start">الجهة الحكومية المختصة</th>
                    <th className="py-3 px-4 text-start">الرسوم الحكومية التقديرية</th>
                    <th className="py-3 px-4 text-start">الغرامة المتوقعة في حال التأخير</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {documents
                    .filter((d) => d.status === "expiring_soon" || d.status === "expired")
                    .map((doc) => (
                      <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-foreground">{doc.title}</td>
                        <td className="py-3 px-4">{doc.employeeName}</td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-700">{doc.expiryDate}</td>
                        <td className="py-3 px-4 font-medium text-muted-foreground">{doc.issuingAuthority}</td>
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          {doc.renewalFeeEstimated ? `${doc.renewalFeeEstimated.toLocaleString()} ر.س` : "رسوم دورية"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-destructive">
                          {doc.category === "iqama_id"
                            ? "500 ر.س (تتضاعف للتكرار)"
                            : doc.category === "company"
                              ? "1,000 ر.س"
                              : "100 ر.س"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedDocForPreview(doc);
                              setNewRenewalExpiry("2027-12-31");
                              setIsRenewModalOpen(true);
                            }}
                            className="rounded-full text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3.5 shadow-xs"
                          >
                            <RefreshCw className="h-3 w-3" />
                            تجديد الآن
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: COMPANY POLICIES & BYLAWS */}
      {mainTab === "company_policies" && (
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                لوائح وسياسات المنشأة المعتمدة (Company Policies & Handbooks)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                اللوائح المعتمدة من وزارة الموارد البشرية، لائحة تنظيم العمل، دليل الجزاءات، وسياسات الحوكمة
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companyPolicies.map((policy) => (
              <div
                key={policy.id}
                className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3 flex flex-col justify-between hover:border-primary/50 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="rounded-full font-mono text-[10px] font-bold">
                      {policy.version}
                    </Badge>
                    {policy.approvedByMinistry && (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px] font-bold rounded-full">
                        ✓ معتمدة من وزارة الموارد البشرية
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-black text-sm text-foreground">{policy.title}</h3>
                  <p className="text-xs text-muted-foreground leading-5">{policy.description}</p>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground text-[11px]">
                    سارية من: {policy.effectiveDate} • {policy.fileSize}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success(`جارٍ تحميل وثيقة: ${policy.title}`)}
                    className="rounded-full text-xs font-bold gap-1 border-border/80 hover:bg-secondary h-8 px-3.5"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    تحميل اللائحة PDF
                  </Button>
                </div>
              </div>
            ))}
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
            onClick={handleDownloadBulk}
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

      {/* MODAL 1: High-Fidelity Interactive Document Preview with Versioning */}
      {selectedDocForPreview && (
        <Dialog
          open={!!selectedDocForPreview}
          onOpenChange={(open) => !open && setSelectedDocForPreview(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
            <DialogHeader>
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-base font-black flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    معاينة وتدقيق الوثيقة: {selectedDocForPreview.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium mt-0.5">
                    صاحب المستند: {selectedDocForPreview.employeeName} ({selectedDocForPreview.employeeNo || "المنشأة"})
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

            <div className="space-y-4 text-xs py-2">
              {/* Document Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-muted/30 border border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[10px]">رقم الوثيقة / المرجع:</span>
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
                  <span className="text-muted-foreground block text-[10px]">حجم ونوع الملف:</span>
                  <span className="font-mono font-bold">{selectedDocForPreview.fileSize} (PDF)</span>
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
                      {company.legalNameAr || "شركة فوكس للحلول والتقنية المحدودة"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      مستودع الأرشفة الرقمية والحوكمة السحابية
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

              {/* Version History Table */}
              {selectedDocForPreview.versions && selectedDocForPreview.versions.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-primary" />
                    الأرشيف التاريخي للإصدارات السابقة:
                  </h4>
                  <div className="space-y-1 text-[11px]">
                    {selectedDocForPreview.versions.map((ver, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-2 rounded-xl bg-card border border-border/40"
                      >
                        <span className="font-mono font-bold">{ver.version}</span>
                        <span className="text-muted-foreground">{ver.uploadDate}</span>
                        <span className="text-muted-foreground">{ver.fileName} ({ver.fileSize})</span>
                        <span className="text-primary font-medium">{ver.notes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                onClick={() => setSidePrintDoc(selectedDocForPreview)}
                variant="outline"
                className="text-xs font-bold gap-1.5 rounded-full border-border/80 h-9"
              >
                <Printer className="h-3.5 w-3.5" />
                طباعة المستند
              </Button>
              <Button
                size="sm"
                onClick={() => handleDownloadDocument(selectedDocForPreview)}
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
              تحديث مدة سريان الوثيقة بعد استلامها من الجهات المختصة وأرشفة النسخة القديمة
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
              className="w-full rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-9 shadow-xs"
            >
              حفظ التجديد وتحديث السجل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Send Document Request to Employee */}
      <Dialog open={isRequestDocModalOpen} onOpenChange={setIsRequestDocModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              إرسال طلب استيفاء وثيقة للموظف
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              إشعار الموظف برفع مستند إلزامي عبر تطبيق الخدمة الذاتية مع تحديد الموعد النهائي
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الموظف المعني *</label>
              <select
                value={newRequest.employeeId}
                onChange={(e) => setNewRequest({ ...newRequest, employeeId: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    👤 {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo}) - {emp.jobTitleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">مسمى الوثيقة المطلوبة *</label>
              <input
                type="text"
                value={newRequest.documentTitle}
                onChange={(e) => setNewRequest({ ...newRequest, documentTitle: e.target.value })}
                placeholder="مثال: الإقامة المجددة 1448هـ / رخصة القيادة المهنية"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">الموعد النهائي للرفع (Deadline) *</label>
              <input
                type="date"
                value={newRequest.dueDate}
                onChange={(e) => setNewRequest({ ...newRequest, dueDate: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">ملاحظات وتعليمات للموظف</label>
              <textarea
                value={newRequest.notes}
                onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
                placeholder="يرجى التأكد من وضوح الصورة وتطابق البيانات مع الأصل..."
                rows={3}
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleCreateDocumentRequest}
              className="w-full rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-9 shadow-xs"
            >
              إرسال الطلب والتنبيه للموظف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Reject Reason Dialog */}
      <Dialog
        open={!!rejectReasonModalDoc}
        onOpenChange={(open) => !open && setRejectReasonModalDoc(null)}
      >
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" />
              سبب رفض الوثيقة وإشعار الموظف
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم إشعار الموظف بسبب الرفض وإتاحة إعادة الرفع مجدداً
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">سبب الرفض *</label>
              <textarea
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmReject}
              className="w-full rounded-full text-xs font-bold h-9 shadow-xs"
            >
              تأكيد الرفض وإشعار الموظف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: Comprehensive Document Upload Modal */}
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

          <div className="space-y-3 text-xs py-2">
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
                  <option value="license">رخصة مهنية / قيادة</option>
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

            {/* Confidentiality Level */}
            <div className="space-y-1.5">
              <label className="font-bold">مستوى السرية والوصول</label>
              <select
                value={newDoc.confidentiality}
                onChange={(e) =>
                  setNewDoc({
                    ...newDoc,
                    confidentiality: e.target.value as StoredDocument["confidentiality"],
                  })
                }
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                <option value="internal">🏢 داخلي للمنشأة (Internal)</option>
                <option value="confidential">🔒 سري للموارد البشرية والمالية (Confidential)</option>
                <option value="strictly_confidential">🛡️ سري للغاية - الإدارة العليا (Strictly Confidential)</option>
                <option value="public">🌐 متاح لجميع الموظفين (Public)</option>
              </select>
            </div>

            {/* Real Interactive Drag & Drop File Upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-4 text-center space-y-2 cursor-pointer transition-all ${
                isDragging
                  ? "border-primary bg-primary/10 scale-[1.01]"
                  : selectedUploadFile
                    ? "border-emerald-500/60 bg-emerald-500/5"
                    : "border-primary/40 bg-secondary/20 hover:bg-secondary/40"
              }`}
            >
              {selectedUploadFile ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-emerald-300 shadow-xs">
                  <div className="flex items-center gap-2.5 text-start">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-foreground block truncate max-w-[220px]">
                        {selectedUploadFile.name}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold font-mono">
                        {selectedUploadFileSize} • ✓ جاهز للأرشفة والتشفير
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUploadFile(null);
                      setSelectedUploadFileSize("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="h-7 px-2.5 text-[11px] text-destructive hover:bg-destructive/10 rounded-full font-bold"
                  >
                    تغيير الملف
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-7 w-7 text-primary" />
                  <p className="font-bold text-foreground text-xs">
                    اسحب الملف هنا أو اضغط للاختيار من جهازك
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    يدعم ملفات PDF, PNG, JPG, DOCX بحد أقصى 25MB مشفرة
                  </p>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2">
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

      {/* MODAL 6: Official Printable PDF Documents Generator Modal */}
      {selectedEmployeeObj && (
        <OfficialDocumentModal
          isOpen={isOfficialDocModalOpen}
          onClose={() => setIsOfficialDocModalOpen(false)}
          employee={selectedEmployeeObj}
          documentType={officialDocType}
        />
      )}

      {/* SIDE DRAWER: Full Document Side Preview & Isolated Print Panel */}
      {sidePrintDoc && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          {/* Backdrop Click to Close */}
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setSidePrintDoc(null)}
          />

          {/* Side Drawer Container */}
          <div className="w-full max-w-2xl sm:max-w-3xl bg-card h-full shadow-2xl flex flex-col border-r border-border/80 animate-in slide-in-from-left duration-300 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-muted/40 border-b border-border/80 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-foreground">
                    صفحة معاينة وطباعة المستند الرسمي
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium truncate max-w-xs sm:max-w-sm">
                    {sidePrintDoc.title} • {sidePrintDoc.employeeName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handlePrintIsolated(sidePrintDoc)}
                  className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3.5 shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  طباعة رسمية A4
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadDocument(sidePrintDoc)}
                  className="rounded-full text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary h-8 px-3"
                  title="تنزيل الملف وحفظه على جهازك"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  حفظ على الجهاز
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSidePrintDoc(null)}
                  className="rounded-full h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="إغلاق الصفحة الجانبية"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Document Body Viewport (Clean A4 Paper Sheet) */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950">
              {sidePrintDoc.fileUrl &&
              (sidePrintDoc.fileName.toLowerCase().endsWith(".png") ||
                sidePrintDoc.fileName.toLowerCase().endsWith(".jpg") ||
                sidePrintDoc.fileName.toLowerCase().endsWith(".jpeg")) ? (
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 max-w-xl mx-auto text-slate-900">
                  <div className="flex items-center justify-between border-b pb-3 text-xs font-bold">
                    <span>مستند مرفق: {sidePrintDoc.fileName}</span>
                    <Badge variant="outline">{sidePrintDoc.fileSize}</Badge>
                  </div>
                  <img
                    src={sidePrintDoc.fileUrl}
                    alt={sidePrintDoc.title}
                    className="w-full max-h-[600px] object-contain rounded-lg mx-auto shadow-sm"
                  />
                </div>
              ) : (
                <div className="bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 p-8 max-w-xl mx-auto space-y-6 font-sans text-xs leading-relaxed">
                  {/* Official Header */}
                  <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                    <div className="space-y-1 text-start">
                      <h1 className="text-base font-black text-slate-900">
                        {company.legalNameAr || "شركة فوكس للحلول والتقنية المحدودة"}
                      </h1>
                      <p className="text-[11px] text-slate-600 font-medium">
                        سجل تجاري: 1010789654 • الرقم الضريبي: 300098765400003
                      </p>
                      <p className="text-[11px] text-slate-600">المملكة العربية السعودية - الرياض</p>
                    </div>
                    <div className="text-end space-y-1 font-mono text-[11px]">
                      <p className="font-bold text-slate-900">
                        المرجع: {sidePrintDoc.docNumber || "DOC-2026"}
                      </p>
                      <p className="text-slate-600">
                        التاريخ: {new Date().toLocaleDateString("ar-SA")}
                      </p>
                    </div>
                  </div>

                  {/* Document Title Banner */}
                  <div className="text-center py-2.5 border-y-2 border-slate-900 bg-slate-50">
                    <h2 className="text-base font-black text-slate-900 tracking-wide">
                      شهادة وتوثيق مستند رسمي: {sidePrintDoc.title}
                    </h2>
                  </div>

                  {/* Metadata Table */}
                  <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-semibold text-slate-600">صاحب الوثيقة / المنشأة:</span>{" "}
                        <span className="font-bold text-slate-900">{sidePrintDoc.employeeName}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">الرقم الوظيفي:</span>{" "}
                        <span className="font-bold font-mono text-slate-900">
                          {sidePrintDoc.employeeNo || "منشأة"}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">رقم الوثيقة / السجل:</span>{" "}
                        <span className="font-bold font-mono text-slate-900">
                          {sidePrintDoc.docNumber || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">الجهة الحكومية / المصدرة:</span>{" "}
                        <span className="font-bold text-slate-900">
                          {sidePrintDoc.issuingAuthority || "رسمي"}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">تاريخ الرفع:</span>{" "}
                        <span className="font-bold font-mono text-slate-900">
                          {sidePrintDoc.uploadDate}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600">تاريخ انتهاء الصلاحية:</span>{" "}
                        <span className="font-bold font-mono text-slate-900">
                          {sidePrintDoc.expiryDate || "ساري بدون انتهاء"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Certification Body Text */}
                  <div className="space-y-3 text-justify text-slate-800 text-xs leading-6">
                    <p>
                      تشهد إدارة الموارد البشرية والشؤون القانونية بشركة فوكس للحلول والتقنية بأن المستند الموضح أعلاه معتمد وموثق رسمياً بالأرشيف السحابي للمنشأة، ومطابق لكافة الأنظمة والتعليمات المنصوص عليها بنظام العمل في المملكة العربية السعودية.
                    </p>
                    {sidePrintDoc.notes && (
                      <p className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-700 font-medium">
                        <strong>ملاحظات التوثيق:</strong> {sidePrintDoc.notes}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 font-mono">
                      معرف التوثيق الرقمي: {sidePrintDoc.id.toUpperCase()} • مشفر بمعيار AES-256
                    </p>
                  </div>

                  {/* Official Footer with Stamp and QR Code */}
                  <div className="border-t-2 border-slate-900 pt-5 mt-6 flex justify-between items-end">
                    <div className="space-y-1 text-start">
                      <p className="font-bold text-slate-900">إدارة الموارد البشرية والتدقيق</p>
                      <p className="text-[11px] text-slate-600">شركة فوكس للحلول والتقنية المحدودة</p>
                      <div className="h-14 w-32 border-2 border-dashed border-emerald-600 rounded-lg flex items-center justify-center text-emerald-700 font-black text-[10px] mt-1 rotate-[-3deg]">
                        ختم الموارد البشرية المعتمد
                      </div>
                    </div>

                    <div className="text-center space-y-1">
                      <div className="h-14 w-14 mx-auto border-2 border-slate-900 rounded-lg p-1 flex items-center justify-center">
                        <QrCode className="h-10 w-10 text-slate-900" />
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 block">
                        رمز التوثيق الإلكتروني
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Side Drawer Footer */}
            <div className="p-4 bg-muted/30 border-t border-border/80 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground font-medium">
                جاهز للطباعة بحجم A4 قياسي بدون هوامش إضافية
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadDocument(sidePrintDoc)}
                  className="rounded-full text-xs font-bold gap-1 border-border/80 h-9 px-4"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  تنزيل كملف
                </Button>
                <Button
                  size="sm"
                  onClick={() => handlePrintIsolated(sidePrintDoc)}
                  className="rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-5 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  طباعة المستند الآن
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
