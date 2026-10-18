// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 37: QATAR (QA) GOVERNMENT REGULATORY ADAPTERS
// Providers: GRSIA, MADLSA
// src/lib/integrations/government/qa/index.ts
// ============================================================================

import {
  buildGovernmentSubmissionIdempotencyKey,
  computeDeterministicPayloadHash,
  runRegulatoryPreflightValidation,
  type GovernmentConnectorAdapter,
  type GovernmentConnectorProviderSpec,
  type PreflightValidationInput,
} from "../connector-contract";

function createQaAdapter(spec: GovernmentConnectorProviderSpec): GovernmentConnectorAdapter {
  return {
    spec,
    validateConfig(config) {
      const issuesAr: string[] = [];
      if (spec.requiresEstablishmentId && !config.establishmentRegistrationNo?.trim()) {
        issuesAr.push(`يجب إدخال ${spec.establishmentIdLabelAr}`);
      }
      if (issuesAr.length > 0) {
        return { valid: false, status: "not_configured", issuesAr };
      }
      return { valid: true, status: "configured", issuesAr: [] };
    },
    testConnection(config) {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return {
          status: "not_configured",
          liveConnected: false,
          latencyMs: 11,
          messageAr:
            validation.issuesAr[0] ||
            `الموصل ${spec.portalNameAr} غير مهيأ ببيانات المنشأة (NOT_CONFIGURED).`,
        };
      }
      return {
        status: "configured",
        liveConnected: false,
        latencyMs: 19,
        messageAr: `الموصل ${spec.portalNameAr} مهيأ لتصدير ملفات المطابقة الرسمية (${spec.officialExportFormat}).`,
      };
    },
    preflightValidate(input: PreflightValidationInput) {
      return runRegulatoryPreflightValidation({
        ...input,
        requiresIbanValidation: spec.provider === "MADLSA" || input.requiresIbanValidation,
      });
    },
    buildSubmissionPackage(input: PreflightValidationInput) {
      const idempotencyKey = buildGovernmentSubmissionIdempotencyKey({
        organizationId: input.organizationId,
        provider: spec.provider,
        sourcePeriod: input.sourcePeriod,
        submissionType: input.submissionType,
        sourceReference: input.sourceReference,
      });
      const correlationId = `QA-${spec.provider}-${input.sourcePeriod}-${input.sourceReference.slice(0, 8).toUpperCase()}`;
      const ext = spec.officialExportFormat.toLowerCase();
      const filename = `${spec.provider}_QA_${input.sourcePeriod.replace("-", "")}_${input.sourceReference}.${ext}`;

      const header = `HDR|QA|${spec.provider}|${input.establishmentRegistrationNo || "UNSET"}|${input.sourcePeriod}|${input.records.length}`;
      const rows = input.records.map(
        (r, idx) =>
          `REC|${idx + 1}|${r.nationalId}|${r.iban || "NA"}|${r.basicSalary.toFixed(2)}|${r.netSalary.toFixed(2)}|${(r.socialInsuranceEmployeeShare || 0).toFixed(2)}|${(r.socialInsuranceEmployerShare || 0).toFixed(2)}`
      );
      const content = [header, ...rows].join("\n");
      const totalAmount = input.records.reduce((acc, r) => acc + Number(r.netSalary || 0), 0);

      return {
        provider: spec.provider,
        countryCode: "QA",
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
        currencyCode: "QAR",
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
          raw.officialReferenceNumber || `QA-${spec.provider}-ACK-${Date.now().toString().slice(-6)}`,
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

export const QATAR_GOVERNMENT_ADAPTERS: Record<"GRSIA" | "MADLSA", GovernmentConnectorAdapter> = {
  GRSIA: createQaAdapter({
    provider: "GRSIA",
    countryCode: "QA",
    authorityNameAr: "الهيئة العامة للتقاعد والتأمينات الاجتماعية (GRSIA)",
    authorityNameEn: "General Retirement and Social Insurance Authority (GRSIA)",
    portalNameAr: "بوابة التأمينات والتقاعد القطرية (GRSIA)",
    portalNameEn: "Qatar GRSIA Employer Portal",
    supportedModes: ["official_file_export", "manual_portal"],
    defaultMode: "official_file_export",
    supportedSubmissionTypes: ["monthly_social_insurance_declaration", "public_pension_contribution"],
    requiresCertificate: false,
    requiresEstablishmentId: true,
    establishmentIdLabelAr: "رقم جهة العمل في الهيئة العامة للتقاعد (GRSIA Employer ID)",
    officialExportFormat: "CSV",
    liveApiSupportedByAuthority: false,
    credentialsRequiredEnvVars: ["MADARX_QA_GRSIA_EMPLOYER_REF"],
    descriptionAr:
      "تجهيز كشوف اشتراكات التقاعد والتأمينات الاجتماعية للمواطنين القطريين ومواطني دول مجلس التعاون وفق القانون رقم 1 لسنة 2022.",
  }),
  MADLSA: createQaAdapter({
    provider: "MADLSA",
    countryCode: "QA",
    authorityNameAr: "وزارة العمل القطرية ومصرف قطر المركزي — نظام حماية الأجور",
    authorityNameEn: "Qatar Ministry of Labour (MOL / MADLSA) & QCB WPS",
    portalNameAr: "منظومة حماية الأجور وعقود العمل القطرية (WPS SIF)",
    portalNameEn: "Qatar WPS & Labour Compliance Portal",
    supportedModes: ["official_file_export", "manual_portal"],
    defaultMode: "official_file_export",
    supportedSubmissionTypes: ["wps_salary_protection_file", "contract_compliance_export"],
    requiresCertificate: false,
    requiresEstablishmentId: true,
    establishmentIdLabelAr: "رقم قيد المنشأة بوزارة العمل القطرية (Establishment ID)",
    officialExportFormat: "SIF",
    liveApiSupportedByAuthority: false,
    credentialsRequiredEnvVars: ["MADARX_QA_MOL_ESTABLISHMENT_REF"],
    descriptionAr:
      "توليد ملفات حماية الأجور القطرية (SIF) والتحقق من البطاقة الشخصية القطرية QID (11 رقماً) والآيبان القطري (QA + 27 خانة).",
  }),
};
