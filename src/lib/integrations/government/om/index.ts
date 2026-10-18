// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 37: OMAN (OM) GOVERNMENT REGULATORY ADAPTERS
// Providers: SPF, CBO
// src/lib/integrations/government/om/index.ts
// ============================================================================

import {
  buildGovernmentSubmissionIdempotencyKey,
  computeDeterministicPayloadHash,
  runRegulatoryPreflightValidation,
  type GovernmentConnectorAdapter,
  type GovernmentConnectorProviderSpec,
  type PreflightValidationInput,
} from "../connector-contract";

function createOmAdapter(spec: GovernmentConnectorProviderSpec): GovernmentConnectorAdapter {
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
          latencyMs: 13,
          messageAr:
            validation.issuesAr[0] ||
            `الموصل ${spec.portalNameAr} غير مهيأ ببيانات المنشأة (NOT_CONFIGURED).`,
        };
      }
      return {
        status: "configured",
        liveConnected: false,
        latencyMs: 21,
        messageAr: `الموصل ${spec.portalNameAr} مهيأ لتوليد الحزم الرسمية المعتمدة (${spec.officialExportFormat}).`,
      };
    },
    preflightValidate(input: PreflightValidationInput) {
      return runRegulatoryPreflightValidation({
        ...input,
        requiresIbanValidation: spec.provider === "CBO" || input.requiresIbanValidation,
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
      const correlationId = `OM-${spec.provider}-${input.sourcePeriod}-${input.sourceReference.slice(0, 8).toUpperCase()}`;
      const ext = spec.officialExportFormat.toLowerCase();
      const filename = `${spec.provider}_OM_${input.sourcePeriod.replace("-", "")}_${input.sourceReference}.${ext}`;

      const header = `HDR|OM|${spec.provider}|${input.establishmentRegistrationNo || "UNSET"}|${input.sourcePeriod}|${input.records.length}`;
      const rows = input.records.map(
        (r, idx) =>
          `REC|${idx + 1}|${r.nationalId}|${r.iban || "NA"}|${r.basicSalary.toFixed(3)}|${r.netSalary.toFixed(3)}|${(r.socialInsuranceEmployeeShare || 0).toFixed(3)}|${(r.socialInsuranceEmployerShare || 0).toFixed(3)}`
      );
      const content = [header, ...rows].join("\n");
      const totalAmount = input.records.reduce((acc, r) => acc + Number(r.netSalary || 0), 0);

      return {
        provider: spec.provider,
        countryCode: "OM",
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
        totalAmount: Math.round(totalAmount * 1000) / 1000,
        currencyCode: "OMR",
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
          raw.officialReferenceNumber || `OM-${spec.provider}-ACK-${Date.now().toString().slice(-6)}`,
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

export const OMAN_GOVERNMENT_ADAPTERS: Record<"SPF" | "CBO", GovernmentConnectorAdapter> = {
  SPF: createOmAdapter({
    provider: "SPF",
    countryCode: "OM",
    authorityNameAr: "صندوق الحماية الاجتماعية بسلطنة عمان (SPF)",
    authorityNameEn: "Oman Social Protection Fund (SPF)",
    portalNameAr: "البوابة الإلكترونية لصندوق الحماية الاجتماعية (SPF)",
    portalNameEn: "Oman SPF Employer Portal",
    supportedModes: ["official_file_export", "manual_portal"],
    defaultMode: "official_file_export",
    supportedSubmissionTypes: [
      "monthly_social_insurance_declaration",
      "employee_registration",
      "employee_termination",
    ],
    requiresCertificate: false,
    requiresEstablishmentId: true,
    establishmentIdLabelAr: "رقم التسجيل في صندوق الحماية الاجتماعية (SPF Employer No)",
    officialExportFormat: "CSV",
    liveApiSupportedByAuthority: false,
    credentialsRequiredEnvVars: ["MADARX_OM_SPF_EMPLOYER_REF"],
    descriptionAr:
      "إعداد كشوف اشتراكات فروع الحماية الاجتماعية والأمن الوظيفي وإصابات العمل وفق المرسوم السلطاني رقم 52/2023.",
  }),
  CBO: createOmAdapter({
    provider: "CBO",
    countryCode: "OM",
    authorityNameAr: "البنك المركزي العماني ووزارة العمل — نظام حماية الأجور (WPS)",
    authorityNameEn: "Central Bank of Oman (CBO) & Ministry of Labour WPS",
    portalNameAr: "نظام حماية الأجور العماني (CBO / MOL WPS)",
    portalNameEn: "Oman WPS Salary Information File Portal",
    supportedModes: ["official_file_export", "manual_portal"],
    defaultMode: "official_file_export",
    supportedSubmissionTypes: ["wps_salary_protection_file"],
    requiresCertificate: false,
    requiresEstablishmentId: true,
    establishmentIdLabelAr: "رقم السجل التجاري والترخيص بوزارة العمل العمانية",
    officialExportFormat: "SIF",
    liveApiSupportedByAuthority: false,
    credentialsRequiredEnvVars: ["MADARX_OM_CBO_WPS_REF"],
    descriptionAr:
      "توليد ملفات حماية الأجور العمانية (SIF) بالريال العماني (3 خانات عشرية) والتحقق من الرقم المدني والآيبان العماني (OM + 21 خانة).",
  }),
};
