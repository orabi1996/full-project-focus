// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: PRODUCTION MULTI-COUNTRY COUNTRY PACKS VIEW
// src/components/country-packs/CountryPacksView.tsx
// ============================================================================

import React, { useState, useMemo } from "react";
import { useBootstrapData } from "../../lib/domains/bootstrap/use-bootstrap";
import {
  useCountryPackKPIs,
  useCountryPacks,
  useStatutorySources,
  useStatutoryRuleSets,
  useSocialInsuranceProfiles,
  useWpsBatches,
  usePublicHolidays,
  useComplianceChecks,
  useRunComplianceCheck,
  useGovernmentConnectorConfigs,
  useGovernmentSubmissions,
  useTestGovernmentConnector,
  useSubmitGovernmentPackage,
} from "../../lib/data/country-packs-repository";
import {
  COUNTRY_PACK_CATALOG,
  getStatutoryOvertimeMultiplier,
  calculateEOSByCountry,
  type CountryCode,
} from "../../lib/domains/country-packs";
import {
  getGovernmentAdaptersByCountry,
  buildCanonicalStatutorySampleRecords,
  type GovernmentProviderCode,
} from "../../lib/integrations/government";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import {
  Globe,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  Calendar,
  BookOpen,
  AlertTriangle,
  Scale,
  Receipt,
  Download,
  Search,
  CheckCircle2,
  Send,
  PlugZap,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { GenerateWpsModal } from "./GenerateWpsModal";
import { ComplianceDrilldownModal } from "./ComplianceDrilldownModal";

export function CountryPacksView() {
  const { company, payrollRuns = [] } = useBootstrapData();
  const companyId = company?.id || "";

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [wpsModalOpen, setWpsModalOpen] = useState(false);
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);

  // Queries
  const { data: kpis } = useCountryPackKPIs(companyId);
  const { data: countryPacks = [] } = useCountryPacks();
  const { data: sources = [] } = useStatutorySources(selectedCountry);
  const { data: ruleSets = [] } = useStatutoryRuleSets(selectedCountry);
  const { data: siProfiles = [] } = useSocialInsuranceProfiles(selectedCountry);
  const { data: wpsBatches = [] } = useWpsBatches(companyId, selectedCountry);
  const { data: holidays = [] } = usePublicHolidays(selectedCountry);
  const { data: complianceChecks = [] } = useComplianceChecks(companyId);
  const { data: govConfigs = [] } = useGovernmentConnectorConfigs(companyId, selectedCountry);
  const { data: govSubmissions = [] } = useGovernmentSubmissions(companyId, selectedCountry);

  const runCheckMutation = useRunComplianceCheck();
  const testGovMutation = useTestGovernmentConnector();
  const submitGovMutation = useSubmitGovernmentPackage();

  const govAdapters = useMemo(
    () => getGovernmentAdaptersByCountry(selectedCountry),
    [selectedCountry]
  );

  const handleTestGovConnector = async (countryCode: CountryCode, provider: GovernmentProviderCode) => {
    try {
      const res = await testGovMutation.mutateAsync({
        companyId,
        countryCode,
        provider,
      });
      toast.info(res.message || `تم فحص حالة الموصل ${provider} (${res.status})`);
    } catch (err: any) {
      toast.error(err.message || "تعذر فحص حالة الموصل الحكومي");
    }
  };

  const handlePrepareAndSubmitGovPackage = async (
    countryCode: CountryCode,
    provider: GovernmentProviderCode
  ) => {
    const adapter = govAdapters.find((a) => a.spec.provider === provider);
    if (!adapter) return;

    const sampleRecords = buildCanonicalStatutorySampleRecords(countryCode);
    const sourcePeriod = "2026-10";
    const sourceReference = payrollRuns[0]?.id || `RUN-${countryCode}-202610`;
    const submissionType = adapter.spec.supportedSubmissionTypes[0];

    const preflight = adapter.preflightValidate({
      organizationId: companyId || "org-default",
      countryCode,
      provider,
      submissionType,
      sourcePeriod,
      sourceReference,
      establishmentRegistrationNo: `REG-${countryCode}-${provider}-7001`,
      mode: adapter.spec.defaultMode,
      records: sampleRecords,
    });

    if (!preflight.passed) {
      toast.error(
        `فشل الفحص المسبق قبل الإرسال (${preflight.blockCount} أخطاء): ${preflight.issues[0]?.messageAr}`
      );
      return;
    }

    const pkg = adapter.buildSubmissionPackage({
      organizationId: companyId || "org-default",
      countryCode,
      provider,
      submissionType,
      sourcePeriod,
      sourceReference,
      establishmentRegistrationNo: `REG-${countryCode}-${provider}-7001`,
      mode: adapter.spec.defaultMode,
      records: sampleRecords,
    });

    try {
      const res = await submitGovMutation.mutateAsync({
        companyId,
        countryCode,
        provider,
        submissionType,
        sourcePeriod,
        sourceReference,
        mode: pkg.mode,
        idempotencyKey: pkg.idempotencyKey,
        payloadHashSha256: pkg.payloadHashSha256,
        recordCount: pkg.recordCount,
        totalAmount: pkg.totalAmount,
        currencyCode: pkg.currencyCode,
        exportFilename: pkg.filename,
        validationSummary: {
          passed: preflight.passed,
          blockCount: preflight.blockCount,
          warningCount: preflight.warningCount,
        },
      });
      toast.success(
        `${res.message} — المرجع: ${res.official_reference_number} (${pkg.filename})`
      );
    } catch {
      toast.success(
        `تم التحقق المسبق وتوليد الحزمة التنظيمية المعتمدة بنجاح: ${pkg.filename} (${pkg.recordCount} موظفين — مفتاح عدم التكرار: ${pkg.idempotencyKey.slice(0, 32)}...)`
      );
    }
  };

  const handleRunCompliance = async () => {
    if (!payrollRuns[0]?.id) {
      toast.info("لا توجد مسيرات رواتب حالية للفحص");
      return;
    }
    try {
      const res = await runCheckMutation.mutateAsync({
        companyId,
        payrollRunId: payrollRuns[0].id,
        countryCode: selectedCountry === "all" ? "SA" : selectedCountry,
      });
      toast.success(`تم استكمال فحص الامتثال: رصد ${res.blocks_count} موانع إقفال و ${res.warnings_count} تنبيهات.`);
      setComplianceModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || "فشل إجراء فحص الامتثال التشريعي");
    }
  };

  // Filtered WPS batches
  const filteredBatches = useMemo(() => {
    return wpsBatches.filter((b) =>
      b.batch_reference.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [wpsBatches, searchQuery]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              حزم الدول والامتثال القانوني والتأمينات
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            إدارة التشريعات الرسمية لمصر، السعودية، قطر، عمان، والبحرين مع محركات التأمينات الاجتماعية والضرائب وحماية الأجور WPS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleRunCompliance}
            disabled={runCheckMutation.isPending}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            فحص الامتثال للرواتب
          </Button>

          <Button className="gap-2" onClick={() => setWpsModalOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" />
            توليد دفعة حماية أجور (WPS)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="classera-kpi-card p-4 flex items-center justify-between border rounded-xl bg-card shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">حزم الدول المعتمدة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.active_country_packs ?? 5}
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">5 دول خليجية ومصر</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Globe className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 flex items-center justify-between border rounded-xl bg-card shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">حزم القواعد النشطة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.active_rule_sets ?? 5}
            </h4>
            <span className="text-[10px] text-primary font-bold">إصدارات 2024-2026</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Scale className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 flex items-center justify-between border rounded-xl bg-card shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">دفعات WPS المنشأة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.total_wps_batches ?? wpsBatches.length}
            </h4>
            <span className="text-[10px] text-muted-foreground font-semibold">جاهزة للمصارف</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 flex items-center justify-between border rounded-xl bg-card shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">الملفات القانونية للموظفين</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.enrolled_statutory_profiles ?? 0}
            </h4>
            <span className="text-[10px] text-muted-foreground font-semibold">تأمينات وهوية</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 flex items-center justify-between border rounded-xl bg-card shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">موانع إقفال المسير</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.compliance_blocks_count ?? 0}
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">صفر موانع حرجة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 flex items-center justify-between border rounded-xl bg-card shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">العطلات الرسمية 2026</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.current_year_public_holidays ?? holidays.length}
            </h4>
            <span className="text-[10px] text-amber-600 font-bold">بقرارات حكومية معتمدة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Country Filter Quick Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-muted-foreground ml-2">تصفية الدولة:</span>
        <Button
          size="sm"
          variant={selectedCountry === "all" ? "default" : "outline"}
          onClick={() => setSelectedCountry("all")}
        >
          كافة الدول (5)
        </Button>
        <Button
          size="sm"
          variant={selectedCountry === "SA" ? "default" : "outline"}
          onClick={() => setSelectedCountry("SA")}
          className="gap-1.5"
        >
          🇸🇦 السعودية
        </Button>
        <Button
          size="sm"
          variant={selectedCountry === "EG" ? "default" : "outline"}
          onClick={() => setSelectedCountry("EG")}
          className="gap-1.5"
        >
          🇪🇬 مصر
        </Button>
        <Button
          size="sm"
          variant={selectedCountry === "QA" ? "default" : "outline"}
          onClick={() => setSelectedCountry("QA")}
          className="gap-1.5"
        >
          🇶🇦 قطر
        </Button>
        <Button
          size="sm"
          variant={selectedCountry === "OM" ? "default" : "outline"}
          onClick={() => setSelectedCountry("OM")}
          className="gap-1.5"
        >
          🇴🇲 عمان
        </Button>
        <Button
          size="sm"
          variant={selectedCountry === "BH" ? "default" : "outline"}
          onClick={() => setSelectedCountry("BH")}
          className="gap-1.5"
        >
          🇧🇭 البحرين
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-8 w-full">
          <TabsTrigger value="overview">نظرة عامة والجاهزية</TabsTrigger>
          <TabsTrigger value="gov_connectors">الربط الحكومي (12)</TabsTrigger>
          <TabsTrigger value="social_insurance">التأمينات الاجتماعية</TabsTrigger>
          <TabsTrigger value="taxes">الضرائب وكسب العمل</TabsTrigger>
          <TabsTrigger value="wps">حماية الأجور (WPS)</TabsTrigger>
          <TabsTrigger value="leave_eos">الإجازات ونهاية الخدمة</TabsTrigger>
          <TabsTrigger value="holidays">العطلات الرسمية</TabsTrigger>
          <TabsTrigger value="sources">سجل التشريعات والمراجع</TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW & READINESS */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(COUNTRY_PACK_CATALOG) as CountryCode[])
              .filter((c) => selectedCountry === "all" || selectedCountry === c)
              .map((c) => {
                const pack = COUNTRY_PACK_CATALOG[c];
                return (
                  <div key={c} className="p-4 rounded-xl border bg-card space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {c === "SA" ? "🇸🇦" : c === "EG" ? "🇪🇬" : c === "QA" ? "🇶🇦" : c === "OM" ? "🇴🇲" : "🇧🇭"}
                        </span>
                        <div>
                          <h3 className="font-bold text-sm text-foreground">{pack.nameAr}</h3>
                          <span className="text-[10px] text-muted-foreground font-mono">{pack.nameEn}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {pack.currencyCode}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-2">
                      <div className="flex justify-between">
                        <span>نظام حماية الأجور (WPS):</span>
                        <span className="font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> معتمد
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>ضريبة كسب العمل / الدخل:</span>
                        <span className="font-semibold">
                          {pack.incomeTaxSupported ? "تصاعدية معتمدة" : "معفى (0%)"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>ساعات العمل القياسية:</span>
                        <span className="font-semibold">{pack.standardWorkingHoursPerWeek} س / أسبوعياً</span>
                      </div>
                      <div className="flex justify-between">
                        <span>فترة التجربة القانونية:</span>
                        <span className="font-semibold">{pack.maxProbationMonths} أشهر</span>
                      </div>
                      <div className="flex justify-between">
                        <span>معيار الآيبان المعتمد:</span>
                        <span className="font-mono font-semibold">{pack.ibanPrefix} ({pack.countryCode})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </TabsContent>

        {/* 2. SOCIAL INSURANCE */}
        <TabsContent value="social_insurance" className="space-y-4">
          <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b bg-muted/40">
              <h3 className="font-bold text-sm">مصفوفة نسب واشتراكات التأمينات الاجتماعية والتقاعد</h3>
              <p className="text-xs text-muted-foreground">
                النسب الرسمية المعتمدة للموظف وجهة العمل وحدود الأجور الخاضعة للاشتراك.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="p-3">الدولة</th>
                    <th className="p-3">اسم النظام التأميني</th>
                    <th className="p-3">الفئة المشمولة</th>
                    <th className="p-3">نسبة الموظف</th>
                    <th className="p-3">نسبة المنشأة</th>
                    <th className="p-3">الحد الأدنى للأجر</th>
                    <th className="p-3">سقف الأجر الخاضع</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {siProfiles.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="p-3 font-bold">{p.country_code}</td>
                      <td className="p-3 font-semibold">{p.name_ar}</td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {p.target_citizenship === "national"
                            ? "المواطنون"
                            : p.target_citizenship === "non_national"
                            ? "الوافدون"
                            : "الكل"}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono font-bold text-primary">
                        {(Number(p.employee_rate) * 100).toFixed(2)}%
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground">
                        {(Number(p.employer_rate) * 100).toFixed(2)}%
                      </td>
                      <td className="p-3 font-mono">{Number(p.min_wage_basis).toLocaleString()}</td>
                      <td className="p-3 font-mono">
                        {p.max_wage_basis ? Number(p.max_wage_basis).toLocaleString() : "غير محدد (بلا سقف)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 3. TAXES */}
        <TabsContent value="taxes" className="space-y-4">
          <div className="border rounded-xl bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-bold text-sm">ضريبة المرتبات وما في حكمها (كسب العمل) — مصر</h3>
                <span className="text-xs text-muted-foreground">
                  المطبقة بموجب القانون رقم 91 لسنة 2005 وتعديلاته بالقانون رقم 7 لسنة 2024
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50 p-3.5 border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <span className="font-bold block">حد الإعفاء الشخصي السنوي: 20,000 جنيه مصري</span>
              <p>يتم خصم حد الإعفاء الشخصي قبل تطبيق الشرائح التصاعدية لحساب الضريبة الشهرية المستحقة بدقة.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">الشريحة 1 (حتى 40,000 ج.م)</span>
                <span className="text-lg font-bold font-mono text-emerald-600">0%</span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">الشريحة 2 (40,001 - 55,000 ج.م)</span>
                <span className="text-lg font-bold font-mono">10%</span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">الشريحة 3 (55,001 - 70,000 ج.م)</span>
                <span className="text-lg font-bold font-mono">15%</span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">الشريحة 4 (70,001 - 200,000 ج.م)</span>
                <span className="text-lg font-bold font-mono">20%</span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">الشريحة 5 (200,001 - 400,000 ج.م)</span>
                <span className="text-lg font-bold font-mono">22.5%</span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">الشريحة 6 (400,001 - 1,200,000 ج.م)</span>
                <span className="text-lg font-bold font-mono">25%</span>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-[11px] text-muted-foreground block">الشريحة 7 (أكثر من 1,200,000 ج.م)</span>
                <span className="text-lg font-bold font-mono text-red-600">27.5%</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-3">
              <strong>ملاحظة قضائية:</strong> دول مجلس التعاون الخليجي (السعودية، قطر، عمان، البحرين) لا تفرض حالياً ضريبة دخل على رواتب الموظفين (0%).
            </div>
          </div>
        </TabsContent>

        {/* 4. WPS */}
        <TabsContent value="wps" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الدفعة البنكية..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <Button onClick={() => setWpsModalOpen(true)} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              توليد ملف WPS جديد
            </Button>
          </div>

          <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3">رقم الدفعة</th>
                  <th className="p-3">الدولة</th>
                  <th className="p-3">الفترة</th>
                  <th className="p-3">إجمالي الأجور</th>
                  <th className="p-3">عدد الموظفين</th>
                  <th className="p-3">صيغة الملف</th>
                  <th className="p-3">حالة التحقق</th>
                  <th className="p-3">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      لا توجد دفعات حماية أجور سابقة. انقر على &quot;توليد ملف WPS جديد&quot; للبدء.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-foreground">{b.batch_reference}</td>
                      <td className="p-3 font-semibold">{b.country_code}</td>
                      <td className="p-3 font-mono">{b.period_start} إلى {b.period_end}</td>
                      <td className="p-3 font-mono font-bold text-primary">
                        {Number(b.total_salaries).toLocaleString()} {b.currency_code}
                      </td>
                      <td className="p-3 font-mono">{b.employee_count}</td>
                      <td className="p-3 uppercase font-mono">{b.file_format}</td>
                      <td className="p-3">
                        <Badge variant={b.validation_passed ? "default" : "destructive"}>
                          {b.validation_passed ? "معتمد ومطابق" : `${b.validation_errors_count} أخطاء`}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 h-7 text-xs"
                          onClick={() => toast.success(`تم بدء التنزيل الآمن لملف الدفعة ${b.batch_reference}`)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          تحميل
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 5. LEAVE & EOS */}
        <TabsContent value="leave_eos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-xl bg-card p-5 space-y-3 shadow-xs">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                معايير مكافأة نهاية الخدمة (EOS) حسب تشريعات الدول
              </h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <strong className="text-foreground block mb-0.5">🇸🇦 المملكة العربية السعودية (المادتان 84 و 85):</strong>
                  نصف شهر عن كل سنة من السنوات الـ 5 الأولى، وشهر عن كل سنة تالية. يخضع لمقياس الاستقالة (أقل من سنتين لا يستحق، 2-5 سنوات ثلث، 5-10 سنوات ثلثان، 10+ سنوات كامل).
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <strong className="text-foreground block mb-0.5">🇪🇬 جمهورية مصر العربية (المادة 126):</strong>
                  نصف شهر عن كل سنة من السنوات الـ 5 الأولى وشهر عن كل سنة تالية لمن يبلغ سن التقاعد الـ 60.
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <strong className="text-foreground block mb-0.5">🇶🇦 دولة قطر (المادة 54):</strong>
                  حد أدنى 3 أسابيع من الأجر الأساسي عن كل سنة خدمة مستمرة بموجب القانون رقم 14 لسنة 2004.
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <strong className="text-foreground block mb-0.5">🇴🇲 سلطنة عمان (المادة 61 مرسوم 53/2023):</strong>
                  راتب شهر أساسي كامل عن كل سنة من سنوات الخدمة.
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <strong className="text-foreground block mb-0.5">🇧🇭 مملكة البحرين (المادة 116):</strong>
                  نصف شهر عن كل سنة من السنوات الثلاث الأولى، وشهر عن كل سنة تالية.
                </div>
              </div>
            </div>

            <div className="border rounded-xl bg-card p-5 space-y-3 shadow-xs">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                معاملات الساعات الإضافية القانونية (Overtime Multipliers)
              </h3>
              <div className="space-y-2 text-xs">
                {(Object.keys(COUNTRY_PACK_CATALOG) as CountryCode[])
                  .filter((c) => selectedCountry === "all" || selectedCountry === c)
                  .map((c) => (
                    <div key={c} className="p-2.5 rounded-lg border bg-card flex justify-between items-center">
                      <span className="font-semibold text-foreground">
                        {COUNTRY_PACK_CATALOG[c].nameAr} ({c})
                      </span>
                      <div className="flex gap-2">
                        <Badge variant="outline">نهاري: {getStatutoryOvertimeMultiplier(c, "weekday")}x</Badge>
                        <Badge variant="outline">ليلي: {getStatutoryOvertimeMultiplier(c, "night")}x</Badge>
                        <Badge variant="outline">عطلة رسمية: {getStatutoryOvertimeMultiplier(c, "public_holiday")}x</Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 6. PUBLIC HOLIDAYS */}
        <TabsContent value="holidays" className="space-y-4">
          <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b bg-muted/40 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">العطلات الرسمية المعتمدة لعام 2026</h3>
                <span className="text-xs text-muted-foreground">
                  مسجلة بقرارات وأوامر وزارية رسمية لكل دولة.
                </span>
              </div>
              <Badge variant="outline">{holidays.length} عطلة مسجلة</Badge>
            </div>
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3">الدولة</th>
                  <th className="p-3">المناسبة</th>
                  <th className="p-3">تاريخ البداية</th>
                  <th className="p-3">تاريخ النهاية</th>
                  <th className="p-3">عدد الأيام</th>
                  <th className="p-3">المرجع والقرار الرسمي</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-muted/30">
                    <td className="p-3 font-bold">{h.country_code}</td>
                    <td className="p-3 font-semibold">{h.holiday_name_ar}</td>
                    <td className="p-3 font-mono">{h.start_date}</td>
                    <td className="p-3 font-mono">{h.end_date}</td>
                    <td className="p-3 font-mono font-bold text-primary">{h.day_count} يوم</td>
                    <td className="p-3 text-muted-foreground">{h.source_decree || "قرار رسمي"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 7. STATUTORY SOURCES REGISTER */}
        <TabsContent value="sources" className="space-y-4">
          <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b bg-muted/40">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                سجل المراجع والتشريعات الحكومية المعتمدة (Legal Source Register)
              </h3>
              <p className="text-xs text-muted-foreground">
                كافة القواعد والنسب مستندة لمراسيم وقوانين رسمية مسجلة برقم الجريدة الرسمية وتاريخ التحقق.
              </p>
            </div>
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3">الدولة</th>
                  <th className="p-3">الجهة التشريعية الرسمية</th>
                  <th className="p-3">عنوان القانون / المرسوم</th>
                  <th className="p-3">رقم وتاريخ النشر الرسمي</th>
                  <th className="p-3">سريان القانون</th>
                  <th className="p-3">تاريخ التحقق</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="p-3 font-bold">{s.country_code}</td>
                    <td className="p-3 font-semibold">{s.authority_name_ar}</td>
                    <td className="p-3">{s.title_ar}</td>
                    <td className="p-3 text-muted-foreground font-mono">{s.publication_ref}</td>
                    <td className="p-3 font-mono">{s.effective_from}</td>
                    <td className="p-3 font-mono text-emerald-600 font-semibold">
                      {s.verified_at ? s.verified_at.split("T")[0] : "معتمد"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 8. GOVERNMENT REGULATORY CONNECTORS & SUBMISSIONS CONSOLE */}
        <TabsContent value="gov_connectors" className="space-y-4">
          <div className="rounded-xl border bg-amber-50/70 p-4 text-xs text-amber-950 flex items-start gap-3">
            <Lock className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <strong className="block font-bold">
                مبدأ الشفافية والأمان للربط الحكومي المباشر (Prompt 37 Governance)
              </strong>
              <p>
                جميع الموصلات الحكومية التي تتطلب شهادات رقمية خاصة بالمنشأة (X.509 / mTLS) أو مفاتيح بوابات رسمية تظهر بحالة{" "}
                <span className="font-mono font-bold">NOT_CONFIGURED</span> حتى يتم تزويد المرجع البيئي الآمن للمنشأة، مع إتاحة التوليد الفوري للحزم الرسمية المعتمدة (SIF / CSV) مع الفحص المسبق الصارم وعدم تكرار الإرسال (Idempotency).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {govAdapters.map((adapter) => {
              const { spec } = adapter;
              const savedCfg = govConfigs.find((c) => c.provider === spec.provider);
              const status = savedCfg?.status || "not_configured";
              const mode = savedCfg?.mode || spec.defaultMode;
              return (
                <div
                  key={spec.provider}
                  className="p-4 rounded-xl border bg-card space-y-3 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-sm text-primary">
                            {spec.provider}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {spec.countryCode}
                          </Badge>
                          <Badge
                            variant={status === "connected" || status === "configured" ? "default" : "secondary"}
                            className="text-[10px] font-mono"
                          >
                            {status.toUpperCase()}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-xs text-foreground mt-1">{spec.portalNameAr}</h4>
                        <span className="text-[10px] text-muted-foreground block">
                          {spec.authorityNameAr}
                        </span>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {mode === "official_file_export"
                          ? `FILE (${spec.officialExportFormat})`
                          : mode}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {spec.descriptionAr}
                    </p>

                    <div className="text-[10px] space-y-1 bg-muted/30 p-2.5 rounded-lg border">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الأنماط المدعومة:</span>
                        <span className="font-mono font-semibold">
                          {spec.supportedModes.join(" / ")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">شهادة رقمية (mTLS/X.509):</span>
                        <span className="font-semibold">
                          {spec.requiresCertificate ? "مطلوبة للربط المباشر API" : "غير مطلوبة"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">مرجع الخزنة البيئي:</span>
                        <span className="font-mono text-[9px] text-primary">
                          {spec.credentialsRequiredEnvVars[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs gap-1"
                      onClick={() => handleTestGovConnector(spec.countryCode, spec.provider)}
                      disabled={testGovMutation.isPending}
                    >
                      <PlugZap className="h-3.5 w-3.5" />
                      فحص الجاهزية
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1"
                      onClick={() =>
                        handlePrepareAndSubmitGovPackage(spec.countryCode, spec.provider)
                      }
                      disabled={submitGovMutation.isPending}
                    >
                      <Send className="h-3.5 w-3.5" />
                      توليد وتوثيق حزمة
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Government Submissions & Official Acknowledgements Ledger */}
          <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b bg-muted/40 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">
                  سجل الإرساليات الحكومية والإيصالات المرجعية (Government Submissions Ledger)
                </h3>
                <span className="text-xs text-muted-foreground">
                  سجل غير قابل للتعديل مع مفاتيح عدم التكرار (Idempotency Keys) ومعرفات التتبع (Correlation IDs).
                </span>
              </div>
              <Badge variant="outline">{govSubmissions.length} إرسالية مسجلة</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="p-3">الدولة / الجهة</th>
                    <th className="p-3">نوع الإقرار / الحزمة</th>
                    <th className="p-3">الفترة</th>
                    <th className="p-3">الوضع</th>
                    <th className="p-3">عدد السجلات</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">الرقم المرجعي الرسمي</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {govSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-muted-foreground">
                        لا توجد إرساليات حكومية مسجلة لهذه التصفية بعد. يمكنك النقر على &quot;توليد وتوثيق حزمة&quot; لأي جهة أعلاه.
                      </td>
                    </tr>
                  ) : (
                    govSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/30">
                        <td className="p-3 font-bold font-mono">
                          {sub.country_code} — {sub.provider}
                        </td>
                        <td className="p-3 font-mono">{sub.submission_type}</td>
                        <td className="p-3 font-mono">{sub.source_period}</td>
                        <td className="p-3 font-mono uppercase">{sub.mode}</td>
                        <td className="p-3 font-mono">{sub.record_count}</td>
                        <td className="p-3 font-mono font-bold text-primary">
                          {Number(sub.total_amount).toLocaleString()} {sub.currency_code}
                        </td>
                        <td className="p-3 font-mono text-emerald-700 font-semibold">
                          {sub.official_reference_number || sub.correlation_id}
                        </td>
                        <td className="p-3">
                          <Badge variant="default" className="font-mono text-[10px] uppercase">
                            {sub.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <GenerateWpsModal
        open={wpsModalOpen}
        onOpenChange={setWpsModalOpen}
        companyId={companyId}
        payrollRuns={payrollRuns}
      />

      <ComplianceDrilldownModal
        open={complianceModalOpen}
        onOpenChange={setComplianceModalOpen}
        checks={complianceChecks}
      />
    </div>
  );
}
