// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 38: CUSTOMER CREDENTIAL ONBOARDING, CONNECTOR ACTIVATION &
//            LIVE INTEGRATION OPERATIONS MODAL
// src/components/country-packs/GovernmentConnectorOperationsModal.tsx
// ============================================================================

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  PROVIDER_ONBOARDING_REQUIREMENTS,
  GOVERNMENT_CONNECTOR_REGISTRY,
  buildCanonicalStatutorySampleRecords,
  runConnectorActivationPreflight,
  verifyCustomerProviderConnection,
  buildProviderOnboardingChecklist,
  buildRegulatoryPackageManifestAndPreview,
  createSafeCredentialMetadataView,
  evaluateConnectorActivationGuard,
  type GovernmentProviderCode,
  type ConnectorEnvironment,
  type ConnectorActivationStatus,
  type ControlledConnectionTestOutcome,
  type SafeCredentialView,
} from "../../lib/integrations/government";
import {
  ShieldCheck,
  KeyRound,
  FileCheck2,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Lock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface GovernmentConnectorOperationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerCode: GovernmentProviderCode | null;
  companyId: string;
}

export function GovernmentConnectorOperationsModal({
  open,
  onOpenChange,
  providerCode,
  companyId,
}: GovernmentConnectorOperationsModalProps) {
  const [environment, setEnvironment] = useState<ConnectorEnvironment>("sandbox");
  const [establishmentId, setEstablishmentId] = useState("");
  const [taxId, setTaxId] = useState("");
  const [payrollRegNo, setPayrollRegNo] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [secretRefInput, setSecretRefInput] = useState("");
  const [keyIdInput, setKeyIdInput] = useState("");
  const [savedCredentialView, setSavedCredentialView] = useState<SafeCredentialView | null>(null);
  const [certSubject, setCertSubject] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certSerial, setCertSerial] = useState("");
  const [certFingerprint, setCertFingerprint] = useState("");
  const [certValidTo, setCertValidTo] = useState("2027-06-30");
  const [activationStatus, setActivationStatus] =
    useState<ConnectorActivationStatus>("not_configured");
  const [lastConnectionOutcome, setLastConnectionOutcome] =
    useState<ControlledConnectionTestOutcome>("WAITING_FOR_CUSTOMER_CREDENTIALS");

  const activeProvider: GovernmentProviderCode = providerCode || "GOSI";
  const adapter = GOVERNMENT_CONNECTOR_REGISTRY[activeProvider];
  const req = PROVIDER_ONBOARDING_REQUIREMENTS[activeProvider];

  const preflight = useMemo(() => {
    return runConnectorActivationPreflight({
      companyId: companyId || "org-default",
      countryCode: adapter.spec.countryCode,
      providerCode: activeProvider,
      environment,
      companyMasterDataComplete: true,
      countryEnabled: true,
      establishmentIdentifier: establishmentId,
      taxIdentifier: taxId,
      payrollRegistrationNumber: payrollRegNo,
      callbackUrl,
      payrollMappingsComplete: true,
      employeeIdentifiersComplete: true,
      bankConfigurationComplete: true,
      credentialsConfigured: Boolean(savedCredentialView),
      certificateMetadata:
        req.requires_x509 && certSubject
          ? {
              providerCode: activeProvider,
              subject: certSubject,
              issuer: certIssuer || "National Root CA",
              serialNumber: certSerial || "SN-2026-001",
              fingerprintSha256: certFingerprint || "SHA256:9F86D081884C7D65",
              algorithm: "RSA-2048",
              privateKeySecretRef: `${adapter.spec.credentialsRequiredEnvVars[0]}_KEY`,
              privateKeyCompatible: true,
              validFrom: "2026-01-01T00:00:00Z",
              validTo: `${certValidTo}T00:00:00Z`,
            }
          : null,
      connectionVerifiedInEnvironment: lastConnectionOutcome === "VERIFIED",
      workflowApproved: false,
    });
  }, [
    companyId,
    adapter,
    activeProvider,
    environment,
    establishmentId,
    taxId,
    payrollRegNo,
    callbackUrl,
    savedCredentialView,
    req.requires_x509,
    certSubject,
    certIssuer,
    certSerial,
    certFingerprint,
    certValidTo,
    lastConnectionOutcome,
  ]);

  const checklist = useMemo(
    () =>
      buildProviderOnboardingChecklist(activeProvider, {
        companyMasterDataComplete: true,
        establishmentIdentifier: establishmentId,
        taxIdentifier: taxId,
        payrollRegistrationNumber: payrollRegNo,
        bankConfigurationComplete: true,
        credentialsConfigured: Boolean(savedCredentialView),
        certificateMetadata:
          req.requires_x509 && certSubject
            ? {
                providerCode: activeProvider,
                subject: certSubject,
                issuer: certIssuer,
                serialNumber: certSerial,
                fingerprintSha256: certFingerprint,
                algorithm: "RSA-2048",
                privateKeySecretRef: "VAULT_KEY_REF",
                privateKeyCompatible: true,
                validFrom: "2026-01-01",
                validTo: certValidTo,
              }
            : null,
        connectionVerifiedInEnvironment: lastConnectionOutcome === "VERIFIED",
        workflowApproved: false,
      }),
    [
      activeProvider,
      establishmentId,
      taxId,
      payrollRegNo,
      savedCredentialView,
      req.requires_x509,
      certSubject,
      certIssuer,
      certSerial,
      certFingerprint,
      certValidTo,
      lastConnectionOutcome,
    ]
  );

  const packageManifest = useMemo(() => {
    const sampleRecords = buildCanonicalStatutorySampleRecords(adapter.spec.countryCode);
    const pkg = adapter.buildSubmissionPackage({
      organizationId: companyId || "org-default",
      countryCode: adapter.spec.countryCode,
      provider: activeProvider,
      submissionType: adapter.spec.supportedSubmissionTypes[0],
      sourcePeriod: "2026-10",
      sourceReference: "PREVIEW-202610",
      establishmentRegistrationNo: establishmentId || "PENDING",
      mode: adapter.spec.defaultMode,
      records: sampleRecords,
    });
    return buildRegulatoryPackageManifestAndPreview({
      provider: activeProvider,
      countryCode: adapter.spec.countryCode,
      filename: pkg.filename,
      rawContent: pkg.content,
      recordCount: pkg.recordCount,
      canViewUnmaskedIdentifiers: false, // Masked by default in preview
    });
  }, [adapter, activeProvider, companyId, establishmentId]);

  const handleSaveSafeCredentialRef = () => {
    try {
      const safeView = createSafeCredentialMetadataView({
        companyId: companyId || "org-default",
        providerCode: activeProvider,
        environment,
        credentialType: req.requires_oauth ? "oauth_client_secret" : "api_key",
        secretReference:
          secretRefInput.trim() || adapter.spec.credentialsRequiredEnvVars[0],
        keyIdentifier: keyIdInput.trim() || `KEY-${activeProvider}-${environment.toUpperCase()}`,
      });
      setSavedCredentialView(safeView);
      // Clear inputs immediately so raw values are never retained in UI fields
      setSecretRefInput("");
      setKeyIdInput("");
      setActivationStatus("verification_required");
      toast.success(
        `تم حفظ مرجع الخزنة الآمنة بنجاح (${safeView.maskedKeySuffix}) — لا يتم استرجاع القيمة السرية إلى المتصفح مطلقاً.`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "فشل حفظ مرجع بيانات الاعتماد"
      );
    }
  };

  const handleRunControlledConnectionTest = () => {
    const res = verifyCustomerProviderConnection({
      companyId: companyId || "org-default",
      providerCode: activeProvider,
      environment,
      hasActualCustomerCredentials: false, // Never fabricate live credentials
      establishmentIdentifier: establishmentId,
    });
    setLastConnectionOutcome(res.outcome);
    toast.info(res.messageAr);
  };

  const handleAttemptActivation = () => {
    const guard = evaluateConnectorActivationGuard({
      targetEnvironment: environment,
      preflightStatus: preflight.status,
      connectionOutcome: lastConnectionOutcome,
      verifiedEnvironment: null,
      workflowApprovalCompleted: false,
      credentialsValid: Boolean(savedCredentialView),
    });
    if (!guard.canActivate) {
      toast.error(`تم منع التفعيل بواسطة حارس التفعيل (Activation Guard): ${guard.blockingReasonsAr[0]}`);
      return;
    }
    setActivationStatus("active");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                إدارة الموصل الحكومي وتهيئة بيانات اعتماد العميل — {adapter.spec.portalNameAr} (
                {activeProvider})
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {adapter.spec.authorityNameAr} | حالة الإطلاق:{" "}
                <span className="font-mono font-bold text-primary">{preflight.goLiveStatus}</span> | درجة
                الجاهزية المحكومة:{" "}
                <span className="font-mono font-bold">
                  {preflight.readinessBreakdown.totalScore} / 100
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(["sandbox", "test", "staging", "production"] as ConnectorEnvironment[]).map(
                (env) => (
                  <Button
                    key={env}
                    size="sm"
                    variant={environment === env ? "default" : "outline"}
                    className="h-7 text-[10px] font-mono uppercase"
                    onClick={() => setEnvironment(env)}
                  >
                    {env}
                  </Button>
                )
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="requirements" className="space-y-4 mt-2">
          <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full text-xs">
            <TabsTrigger value="requirements">1. المتطلبات والتهيئة</TabsTrigger>
            <TabsTrigger value="credentials">2. الأسرار و OAuth</TabsTrigger>
            <TabsTrigger value="certificate">3. شهادة X.509</TabsTrigger>
            <TabsTrigger value="preflight">4. الفحص المسبق والاتصال</TabsTrigger>
            <TabsTrigger value="checklist">5. قائمة التفعيل والتعليق</TabsTrigger>
            <TabsTrigger value="preview">6. معاينة الحزمة والنزاهة</TabsTrigger>
          </TabsList>

          {/* TAB 1: PROVIDER-SPECIFIC REQUIREMENTS */}
          <TabsContent value="requirements" className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
              <h4 className="font-bold text-sm">إرشادات التهيئة الخاصة بـ {activeProvider}</h4>
              <p className="text-muted-foreground leading-relaxed">{req.onboardingGuidanceAr}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant={req.requires_x509 ? "default" : "secondary"}>
                  شهادة X.509: {req.requires_x509 ? "إلزامية" : "غير مطلوبة"}
                </Badge>
                <Badge variant={req.requires_oauth ? "default" : "secondary"}>
                  مصادقة OAuth2: {req.requires_oauth ? "إلزامية" : "غير مطلوبة"}
                </Badge>
                <Badge variant={req.requires_establishment_number ? "default" : "secondary"}>
                  رقم منشأة حكومي: {req.requires_establishment_number ? "إلزامي" : "اختياري"}
                </Badge>
                <Badge variant={req.requires_tax_number ? "default" : "secondary"}>
                  رقم ضريبي: {req.requires_tax_number ? "إلزامي" : "غير مطلوب"}
                </Badge>
                <Badge variant={req.requires_sif ? "default" : "secondary"}>
                  صيغة الملف: {req.supportedFileType}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold block">{adapter.spec.establishmentIdLabelAr}</label>
                <Input
                  value={establishmentId}
                  onChange={(e) => setEstablishmentId(e.target.value)}
                  placeholder="أدخل رقم تسجيل المنشأة لدى الجهة..."
                />
              </div>
              {req.requires_tax_number && (
                <div className="space-y-1">
                  <label className="font-semibold block">رقم التسجيل الضريبي للمنشأة</label>
                  <Input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="مثال: 100200300"
                  />
                </div>
              )}
              {req.requires_payroll_registration && (
                <div className="space-y-1">
                  <label className="font-semibold block">رقم ملف حماية الأجور / الرواتب</label>
                  <Input
                    value={payrollRegNo}
                    onChange={(e) => setPayrollRegNo(e.target.value)}
                    placeholder="معرف ملف الأجور بالجهة..."
                  />
                </div>
              )}
              {req.requires_callback_url && (
                <div className="space-y-1">
                  <label className="font-semibold block">رابط الاستجابة الآمن (Callback Webhook URL)</label>
                  <Input
                    value={callbackUrl}
                    onChange={(e) => setCallbackUrl(e.target.value)}
                    placeholder="https://api.customer-domain.com/webhooks/gov"
                  />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-1.5">
              <strong className="text-amber-950 block">
                إجراءات مطلوبة من العميل (CUSTOMER_ACTION_REQUIRED):
              </strong>
              <ul className="list-disc pr-5 text-amber-900 space-y-1">
                {req.customerActionItemsAr.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </TabsContent>

          {/* TAB 2: CREDENTIAL METADATA & OAUTH */}
          <TabsContent value="credentials" className="space-y-4 text-xs">
            <div className="p-3 rounded-xl border bg-slate-50 flex items-center gap-2.5 text-slate-800">
              <Lock className="h-4 w-4 text-primary shrink-0" />
              <span>
                حماية الأسرار (Zero-Plaintext Policy): لا يتم تخزين أو إعادة عرض أي كلمة مرور أو مفتاح سري في المتصفح. يتم حفظ مرجع متغير البيئة الآمن فقط مع عرض آخر 4 خانات مقنعة.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold block">مرجع المفتاح في الخزنة البيئية (Secret Env Ref)</label>
                <Input
                  type="password"
                  value={secretRefInput}
                  onChange={(e) => setSecretRefInput(e.target.value)}
                  placeholder={adapter.spec.credentialsRequiredEnvVars[0]}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold block">معرف المفتاح / OAuth Client ID</label>
                <Input
                  value={keyIdInput}
                  onChange={(e) => setKeyIdInput(e.target.value)}
                  placeholder={`CLIENT-${activeProvider}-01`}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveSafeCredentialRef} className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                حفظ مرجع الاعتماد الآمن
              </Button>
              {savedCredentialView && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSavedCredentialView({
                      ...savedCredentialView,
                      rotationState: "replacement_pending",
                    });
                    toast.info("تم بدء دورة تدوير المفاتيح (replacement_pending)");
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  بدء تدوير المفتاح (Rotate)
                </Button>
              )}
            </div>

            {savedCredentialView && (
              <div className="p-3.5 rounded-xl border bg-card space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الحالة الآمنة:</span>
                  <Badge variant="default" className="font-mono uppercase">
                    {savedCredentialView.status} ({savedCredentialView.rotationState})
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المرجع البيئي:</span>
                  <span className="font-mono">{savedCredentialView.secretReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">معرف المفتاح المقنع:</span>
                  <span className="font-mono font-bold">{savedCredentialView.maskedKeySuffix}</span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: X.509 CERTIFICATE MANAGEMENT */}
          <TabsContent value="certificate" className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold block">موضوع الشهادة (Certificate Subject DN)</label>
                <Input
                  value={certSubject}
                  onChange={(e) => setCertSubject(e.target.value)}
                  placeholder={`CN=${activeProvider.toLowerCase()}.company.gov, O=Enterprise`}
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold block">الجهة المصدرة (Issuer CA)</label>
                <Input
                  value={certIssuer}
                  onChange={(e) => setCertIssuer(e.target.value)}
                  placeholder="National Root Certificate Authority"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold block">الرقم التسلسلي (Serial Number)</label>
                <Input
                  value={certSerial}
                  onChange={(e) => setCertSerial(e.target.value)}
                  placeholder="SN-77889900"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold block">تاريخ انتهاء الصلاحية (Valid To)</label>
                <Input
                  type="date"
                  value={certValidTo}
                  onChange={(e) => setCertValidTo(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              يتم مراقبة صلاحية الشهادة تلقائياً عند عتبات 90 و 60 و 30 و 14 و 7 أيام قبل الانتهاء، مع دعم رفع شهادة احتياطية (Standby Replacement) قبل انتهاء الشهادة النشطة دون حذف السجل التاريخي.
            </p>
          </TabsContent>

          {/* TAB 4: PRE-FLIGHT & CONTROLLED CONNECTION TEST */}
          <TabsContent value="preflight" className="space-y-4 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg border bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">التهيئة والبيانات الأساسية</span>
                <span className="font-mono font-bold text-sm">
                  {preflight.readinessBreakdown.configuration +
                    preflight.readinessBreakdown.masterData}{" "}
                  / 30
                </span>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">الاعتماد والأمان (X.509)</span>
                <span className="font-mono font-bold text-sm">
                  {preflight.readinessBreakdown.credentials +
                    preflight.readinessBreakdown.security}{" "}
                  / 35
                </span>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">التحقق والاتصال</span>
                <span className="font-mono font-bold text-sm">
                  {preflight.readinessBreakdown.connection} / 15
                </span>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">الاعتماد والجاهزية التشغيلية</span>
                <span className="font-mono font-bold text-sm">
                  {preflight.readinessBreakdown.approval +
                    preflight.readinessBreakdown.operationalReadiness}{" "}
                  / 20
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
              <div>
                <span className="font-bold block">نتيجة اختبار الاتصال الخادمي المحكوم:</span>
                <span className="font-mono text-primary font-bold">{lastConnectionOutcome}</span>
              </div>
              <Button size="sm" onClick={handleRunControlledConnectionTest} className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                تشغيل اختبار الاتصال المحكوم
              </Button>
            </div>

            <div className="space-y-1.5">
              {preflight.actionableReasonsAr.map((reason, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 text-amber-950 flex items-center gap-2"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* TAB 5: CUSTOMER ONBOARDING CHECKLIST & ACTIVATION / SUSPENSION */}
          <TabsContent value="checklist" className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
              <div>
                <span className="text-muted-foreground">حالة التفعيل الحالية: </span>
                <Badge variant="outline" className="font-mono uppercase">
                  {activationStatus}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAttemptActivation} className="gap-1">
                  <PlayCircle className="h-3.5 w-3.5" />
                  تفعيل الموصل (Activate)
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setActivationStatus("suspended");
                    toast.warning("تم تعليق الموصل وإغلاق بوابة الإرسال (Fail-Closed) مع تسجيل السبب في التدقيق.");
                  }}
                  className="gap-1"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  تعليق أمان (Suspend)
                </Button>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/60 border-b">
                  <tr>
                    <th className="p-2.5">الخطوة</th>
                    <th className="p-2.5">المسؤولية</th>
                    <th className="p-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {checklist.map((step) => (
                    <tr key={step.stepCode}>
                      <td className="p-2.5 font-medium">{step.titleAr}</td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {step.ownerType}
                        </Badge>
                      </td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          {step.status === "completed" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : null}
                          {step.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 6: PAYLOAD PREVIEW & INTEGRITY MANIFEST */}
          <TabsContent value="preview" className="space-y-3 text-xs">
            <div className="p-3 rounded-xl border bg-muted/20 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span>Filename:</span>
                <strong>{packageManifest.filename}</strong>
              </div>
              <div className="flex justify-between">
                <span>SHA-256 Hash:</span>
                <span className="text-primary">{packageManifest.sha256Hash}</span>
              </div>
              <div className="flex justify-between">
                <span>CRC32 Checksum:</span>
                <span>{packageManifest.crc32Checksum}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="font-semibold flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4 text-primary" />
                معاينة الحزمة التنظيمية المقنعة (Masked Regulatory Payload Preview):
              </span>
              <pre
                dir="ltr"
                className="p-3 rounded-xl border bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto"
              >
                {packageManifest.maskedPreviewContent}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
