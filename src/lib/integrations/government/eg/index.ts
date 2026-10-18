// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 37: EGYPT (EG) GOVERNMENT REGULATORY ADAPTERS
// Providers: NOSI, ETA
// src/lib/integrations/government/eg/index.ts
// ============================================================================

import {
  buildGovernmentSubmissionIdempotencyKey,
  computeDeterministicPayloadHash,
  evaluateCertificateExpiry,
  runRegulatoryPreflightValidation,
  type GovernmentConnectorAdapter,
  type GovernmentConnectorProviderSpec,
  type PreflightValidationInput,
} from "../connector-contract";

function createEgAdapter(spec: GovernmentConnectorProviderSpec): GovernmentConnectorAdapter {
  return {
    spec,
    validateConfig(config) {
      const issuesAr: string[] = [];
      if (spec.requiresEstablishmentId && !config.establishmentRegistrationNo?.trim()) {
        issuesAr.push(`يجب إدخال ${spec.establishmentIdLabelAr}`);
      }
      if (config.mode === "api" && !config.secretEnvReference?.trim()) {
        issuesAr.push(
          `الربط الإلكتروني المباشر مع ${spec.portalNameAr} يتطلب ضبط مرجع الشهادة/المفتاح (${spec.credentialsRequiredEnvVars.join(", ")})`
        );
      }
      if (config.mode === "api" && spec.requiresCertificate) {
        const certEval = evaluateCertificateExpiry(config.certificate);
        if (certEval.blocksLiveSubmission) {
          issuesAr.push(certEval.messageAr);
        }
      }
      if (issuesAr.length > 0 && !config.establishmentRegistrationNo?.trim()) {
        return { valid: false, status: "not_configured", issuesAr };
      }
      if (issuesAr.length > 0) {
        return { valid: false, status: "failed", issuesAr };
      }
      return { valid: true, status: "configured", issuesAr: [] };
    },
    testConnection(config) {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return {
          status: validation.status,
          liveConnected: false,
          latencyMs: 14,
          messageAr:
            validation.issuesAr[0] ||
            `الموصل ${spec.portalNameAr} غير مهيأ ببيانات اعتماد حية (NOT_CONFIGURED). متاح التصدير الرسمي المعتمد.`,
        };
      }
      return {
        status: "configured",
        liveConnected: false,
        latencyMs: 22,
        messageAr: `الموصل ${spec.portalNameAr} مهيأ وجاهز لتوليد الحزم التنظيمية المعتمدة (${spec.officialExportFormat}).`,
      };
    },
    preflightValidate(input: PreflightValidationInput) {
      return runRegulatoryPreflightValidation(input);
    },
    buildSubmissionPackage(input: PreflightValidationInput) {
      const idempotencyKey = buildGovernmentSubmissionIdempotencyKey({
        organizationId: input.organizationId,
        provider: spec.provider,
        sourcePeriod: input.sourcePeriod,
        submissionType: input.submissionType,
        sourceReference: input.sourceReference,
      });
      const correlationId = `EG-${spec.provider}-${input.sourcePeriod}-${input.sourceReference.slice(0, 8).toUpperCase()}`;
      const ext = spec.officialExportFormat.toLowerCase();
      const filename = `${spec.provider}_EG_${input.sourcePeriod.replace("-", "")}_${input.sourceReference}.${ext}`;

      const header = `HDR|EG|${spec.provider}|${input.establishmentRegistrationNo || "UNSET"}|${input.sourcePeriod}|${input.records.length}`;
      const rows = input.records.map(
        (r, idx) =>
          `REC|${idx + 1}|${r.nationalId}|${r.basicSalary.toFixed(2)}|${r.netSalary.toFixed(2)}|${(r.socialInsuranceEmployeeShare || 0).toFixed(2)}|${(r.socialInsuranceEmployerShare || 0).toFixed(2)}|${(r.incomeTaxAmount || 0).toFixed(2)}`
      );
      const content = [header, ...rows].join("\n");
      const totalAmount = input.records.reduce((acc, r) => acc + Number(r.netSalary || 0), 0);

      return {
        provider: spec.provider,
        countryCode: "EG",
        submissionType: input.submissionType,
        sourcePeriod: input.sourcePeriod,
        sourceReference: input.sourceReference,
        mode: input.mode,
        idempotencyKey,
        correlationId,
        filename,
        mimeType: "text/csv",
        content,
        payloadHashSha256: computeDeterministicPayloadHash(content),
        recordCount: input.records.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        currencyCode: "EGP",
      };
    },
    parseAcknowledgement(raw) {
      const status =
        raw.rejectedCount === 0
          ? "accepted"
          : raw.acceptedCount > 0
          ? "partially_accepted"
          : "rejected";
      return {
        officialReferenceNumber:
          raw.officialReferenceNumber || `EG-${spec.provider}-ACK-${Date.now().toString().slice(-6)}`,
        acknowledgedAt: new Date().toISOString(),
        status,
        acceptedCount: raw.acceptedCount,
        rejectedCount: raw.rejectedCount,
        rejectionReasons: raw.rejections || [],
        receiptSummaryAr: `إيصال ${spec.portalNameAr}: مقبول (${raw.acceptedCount}) — مرفوض (${raw.rejectedCount})`,
      };
    },
  };
}

export const EGYPT_GOVERNMENT_ADAPTERS: Record<"NOSI" | "ETA", GovernmentConnectorAdapter> = {
  NOSI: createEgAdapter({
    provider: "NOSI",
    countryCode: "EG",
    authorityNameAr: "الهيئة القومية للتأمين الاجتماعي (NOSI)",
    authorityNameEn: "National Organization for Social Insurance (NOSI)",
    portalNameAr: "منظومة التأمينات الاجتماعية المصرية (استمارات 1 و 2 و 6)",
    portalNameEn: "Egypt NOSI Forms 1, 2 & 6 Portal",
    supportedModes: ["official_file_export", "manual_portal"],
    defaultMode: "official_file_export",
    supportedSubmissionTypes: [
      "monthly_social_insurance_declaration",
      "employee_registration",
      "employee_termination",
    ],
    requiresCertificate: false,
    requiresEstablishmentId: true,
    establishmentIdLabelAr: "الرقم التأميني للمنشأة (NOSI Establishment No)",
    officialExportFormat: "CSV",
    liveApiSupportedByAuthority: false,
    credentialsRequiredEnvVars: ["MADARX_EG_NOSI_PORTAL_REF"],
    descriptionAr:
      "تجهيز حزم استمارة (1) اشتراك مؤمن عليه، استمارة (2) تعديل الأجور والاشتراكات السنوية/الشهرية، واستمارة (6) إنهاء الخدمة وفق القانون 148 لسنة 2019.",
  }),
  ETA: createEgAdapter({
    provider: "ETA",
    countryCode: "EG",
    authorityNameAr: "مصلحة الضرائب المصرية — منظومة توحيد أسس ومعايير ضريبة الأجور والمرتبات",
    authorityNameEn: "Egyptian Tax Authority (ETA) — Payroll Tax Core",
    portalNameAr: "بوابة مصلحة الضرائب المصرية (نماذج كسب العمل والتسوية السنوية)",
    portalNameEn: "ETA Salary Tax & Reconciliation Portal",
    supportedModes: ["official_file_export", "api", "manual_portal"],
    defaultMode: "official_file_export",
    supportedSubmissionTypes: ["payroll_withholding_tax_reconciliation"],
    requiresCertificate: true,
    requiresEstablishmentId: true,
    establishmentIdLabelAr: "رقم التسجيل الضريبي الموحد للمنشأة (9 أرقام)",
    officialExportFormat: "CSV",
    liveApiSupportedByAuthority: true,
    credentialsRequiredEnvVars: ["MADARX_EG_ETA_CLIENT_ID", "MADARX_EG_ETA_CLIENT_SECRET", "MADARX_EG_ETA_SIGNING_CERT_REF"],
    descriptionAr:
      "إعداد إقرارات ضريبة المرتبات الشهرية ونماذج التسوية الضريبية وفق القانون 91 لسنة 2005 وتعديلاته بالقانون 7 لسنة 2024.",
  }),
};
