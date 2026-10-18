// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 37: BAHRAIN (BH) GOVERNMENT REGULATORY ADAPTERS
// Providers: SIO, LMRA
// src/lib/integrations/government/bh/index.ts
// ============================================================================

import {
  buildGovernmentSubmissionIdempotencyKey,
  computeDeterministicPayloadHash,
  runRegulatoryPreflightValidation,
  type GovernmentConnectorAdapter,
  type GovernmentConnectorProviderSpec,
  type PreflightValidationInput,
} from "../connector-contract";

function createBhAdapter(spec: GovernmentConnectorProviderSpec): GovernmentConnectorAdapter {
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
          latencyMs: 12,
          messageAr:
            validation.issuesAr[0] ||
            `الموصل ${spec.portalNameAr} غير مهيأ ببيانات المنشأة (NOT_CONFIGURED).`,
        };
      }
      return {
        status: "configured",
        liveConnected: false,
        latencyMs: 20,
        messageAr: `الموصل ${spec.portalNameAr} مهيأ لتوليد الحزم الرسمية المعتمدة (${spec.officialExportFormat}).`,
      };
    },
    preflightValidate(input: PreflightValidationInput) {
      return runRegulatoryPreflightValidation({
        ...input,
        requiresIbanValidation: spec.provider === "LMRA" || input.requiresIbanValidation,
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
      const correlationId = `BH-${spec.provider}-${input.sourcePeriod}-${input.sourceReference.slice(0, 8).toUpperCase()}`;
      const ext = spec.officialExportFormat.toLowerCase();
      const filename = `${spec.provider}_BH_${input.sourcePeriod.replace("-", "")}_${input.sourceReference}.${ext}`;

      const header = `HDR|BH|${spec.provider}|${input.establishmentRegistrationNo || "UNSET"}|${input.sourcePeriod}|${input.records.length}`;
      const rows = input.records.map(
        (r, idx) =>
          `REC|${idx + 1}|${r.nationalId}|${r.iban || "NA"}|${r.basicSalary.toFixed(3)}|${r.netSalary.toFixed(3)}|${(r.socialInsuranceEmployeeShare || 0).toFixed(3)}|${(r.socialInsuranceEmployerShare || 0).toFixed(3)}`
      );
      const content = [header, ...rows].join("\n");
      const totalAmount = input.records.reduce((acc, r) => acc + Number(r.netSalary || 0), 0);

      return {
        provider: spec.provider,
        countryCode: "BH",
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
        currencyCode: "BHD",
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
          raw.officialReferenceNumber || `BH-${spec.provider}-ACK-${Date.now().toString().slice(-6)}`,
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

export const BAHRAIN_GOVERNMENT_ADAPTERS: Record<"SIO" | "LMRA", GovernmentConnectorAdapter> = {
  SIO: createBhAdapter({
    provider: "SIO",
    countryCode: "BH",
    authorityNameAr: "الهيئة العامة للتأمين الاجتماعي بمملكة البحرين (SIO)",
    authorityNameEn: "Bahrain Social Insurance Organization (SIO)",
    portalNameAr: "البوابة الإلكترونية للتأمين الاجتماعي (SIO)",
    portalNameEn: "Bahrain SIO Employer Portal",
    supportedModes: ["official_file_export", "manual_portal"],
    defaultMode: "official_file_export",
    supportedSubmissionTypes: [
      "monthly_social_insurance_declaration",
      "employee_registration",
      "employee_termination",
    ],
    requiresCertificate: false,
    requiresEstablishmentId: true,
    establishmentIdLabelAr: "رقم المنشأة في الهيئة العامة للتأمين الاجتماعي (SIO Employer No)",
    officialExportFormat: "CSV",
    liveApiSupportedByAuthority: false,
    credentialsRequiredEnvVars: ["MADARX_BH_SIO_EMPLOYER_REF"],
    descriptionAr:
      "تجهيز كشوف اشتراكات التأمين الاجتماعي والتعطل ضد البطالة وإصابات العمل للمواطنين والوافدين وفق القانون رقم 24 لسنة 1976 وتعديلاته.",
  }),
  LMRA: createBhAdapter({
    provider: "LMRA",
    countryCode: "BH",
    authorityNameAr: "هيئة تنظيم سوق العمل البحرينية ونظام حماية الأجور (LMRA / CBB)",
    authorityNameEn: "Bahrain Labour Market Regulatory Authority (LMRA) & WPS",
    portalNameAr: "منظومة إدارة العمالة الوافدة وحماية الأجور البحرينية (LMRA EMS / WPS)",
    portalNameEn: "Bahrain LMRA EMS & Wage Protection Portal",
    supportedModes: ["official_file_export", "manual_portal"],
    defaultMode: "official_file_export",
    supportedSubmissionTypes: ["wps_salary_protection_file", "work_permit_residency_status"],
    requiresCertificate: false,
    requiresEstablishmentId: true,
    establishmentIdLabelAr: "رقم السجل التجاري البحريني (CR) ورقم وحدة LMRA",
    officialExportFormat: "SIF",
    liveApiSupportedByAuthority: false,
    credentialsRequiredEnvVars: ["MADARX_BH_LMRA_CR_REF"],
    descriptionAr:
      "توليد حزم حماية الأجور البحرينية بالدينار البحريني (3 خانات عشرية) والتحقق من الرقم الشخصي البحريني CPR (9 أرقام) والآيبان (BH + 20 خانة).",
  }),
};
