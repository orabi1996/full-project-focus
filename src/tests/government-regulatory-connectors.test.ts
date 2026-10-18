// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 37: LIVE GOVERNMENT, REGULATORY & STATUTORY INTEGRATION CONNECTORS TESTS
// src/tests/government-regulatory-connectors.test.ts
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  ALL_GOVERNMENT_PROVIDER_CODES,
  GOVERNMENT_CONNECTOR_REGISTRY,
  getGovernmentAdaptersByCountry,
  buildCanonicalStatutorySampleRecords,
  buildGovernmentSubmissionIdempotencyKey,
  evaluateCertificateExpiry,
  computeRetryBackoffPolicy,
  verifySeparationOfDuties,
  sanitizeGovernmentAuditPayload,
} from "../lib/integrations/government";
import { hasGovernmentIntegrationPermission } from "../lib/auth/permissions";

describe("Prompt 37 — Government, Regulatory & Statutory Integration Connectors", () => {
  it("registers all 12 authoritative government providers across SA, EG, QA, OM, and BH", () => {
    expect(ALL_GOVERNMENT_PROVIDER_CODES).toHaveLength(12);
    expect(getGovernmentAdaptersByCountry("SA").map((a) => a.spec.provider)).toEqual([
      "GOSI",
      "MUDAD",
      "QIWA",
      "MUQEEM",
    ]);
    expect(getGovernmentAdaptersByCountry("EG").map((a) => a.spec.provider)).toEqual([
      "NOSI",
      "ETA",
    ]);
    expect(getGovernmentAdaptersByCountry("QA").map((a) => a.spec.provider)).toEqual([
      "GRSIA",
      "MADLSA",
    ]);
    expect(getGovernmentAdaptersByCountry("OM").map((a) => a.spec.provider)).toEqual([
      "SPF",
      "CBO",
    ]);
    expect(getGovernmentAdaptersByCountry("BH").map((a) => a.spec.provider)).toEqual([
      "SIO",
      "LMRA",
    ]);
  });

  it("never fakes live government API connectivity when tenant credentials are not configured", () => {
    for (const code of ALL_GOVERNMENT_PROVIDER_CODES) {
      const adapter = GOVERNMENT_CONNECTOR_REGISTRY[code];
      const conn = adapter.testConnection({
        establishmentRegistrationNo: null,
        secretEnvReference: null,
        certificate: null,
        mode: adapter.spec.defaultMode,
      });
      expect(conn.status).toBe("not_configured");
      expect(conn.liveConnected).toBe(false);
    }
  });

  it("validates pre-flight regulatory rules and builds official submission packages for all 5 countries", () => {
    const countries = ["SA", "EG", "QA", "OM", "BH"] as const;
    for (const country of countries) {
      const adapters = getGovernmentAdaptersByCountry(country);
      const records = buildCanonicalStatutorySampleRecords(country);
      for (const adapter of adapters) {
        const input = {
          organizationId: "org-enterprise-01",
          countryCode: country,
          provider: adapter.spec.provider,
          submissionType: adapter.spec.supportedSubmissionTypes[0],
          sourcePeriod: "2026-10",
          sourceReference: "PAYRUN-2026-10",
          establishmentRegistrationNo: `EST-${country}-998877`,
          mode: adapter.spec.defaultMode,
          records,
        };
        const preflight = adapter.preflightValidate(input);
        expect(preflight.passed).toBe(true);
        expect(preflight.blockCount).toBe(0);

        const pkg = adapter.buildSubmissionPackage(input);
        expect(pkg.countryCode).toBe(country);
        expect(pkg.provider).toBe(adapter.spec.provider);
        expect(pkg.recordCount).toBe(records.length);
        expect(pkg.payloadHashSha256).toMatch(/^sha256-/);
        expect(pkg.content).toContain(`HDR|${country}|${adapter.spec.provider}`);
      }
    }
  });

  it("blocks pre-flight validation on invalid national ID, invalid IBAN, or missing establishment registration", () => {
    const mudad = GOVERNMENT_CONNECTOR_REGISTRY.MUDAD;
    const result = mudad.preflightValidate({
      organizationId: "org-enterprise-01",
      countryCode: "SA",
      provider: "MUDAD",
      submissionType: "wps_salary_protection_file",
      sourcePeriod: "2026-10",
      sourceReference: "PAYRUN-2026-10",
      establishmentRegistrationNo: "",
      mode: "official_file_export",
      records: [
        {
          employeeId: "emp-bad",
          employeeNameAr: "موظف تجريبي",
          nationalId: "999", // invalid SA ID
          iban: "SA123", // invalid SA IBAN length
          basicSalary: 5000,
          netSalary: 5000,
        },
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.blockCount).toBeGreaterThanOrEqual(3);
    expect(result.issues.map((i) => i.code)).toContain("MISSING_ESTABLISHMENT_REG_NO");
    expect(result.issues.map((i) => i.code)).toContain("INVALID_NATIONAL_ID");
    expect(result.issues.map((i) => i.code)).toContain("INVALID_IBAN");
  });

  it("enforces deterministic idempotency keys per organization + provider + period + submissionType + sourceReference", () => {
    const key1 = buildGovernmentSubmissionIdempotencyKey({
      organizationId: "ORG-100",
      provider: "GOSI",
      sourcePeriod: "2026-10",
      submissionType: "monthly_social_insurance_declaration",
      sourceReference: "RUN-01",
    });
    const key2 = buildGovernmentSubmissionIdempotencyKey({
      organizationId: "org-100",
      provider: "GOSI",
      sourcePeriod: "2026-10",
      submissionType: "monthly_social_insurance_declaration",
      sourceReference: "run-01",
    });
    const keyDifferentPeriod = buildGovernmentSubmissionIdempotencyKey({
      organizationId: "org-100",
      provider: "GOSI",
      sourcePeriod: "2026-11",
      submissionType: "monthly_social_insurance_declaration",
      sourceReference: "run-01",
    });
    expect(key1).toBe(key2);
    expect(key1).not.toBe(keyDifferentPeriod);
  });

  it("evaluates certificate expiry thresholds at 90, 60, 30, 7 days and blocks expired certificates", () => {
    const refDate = new Date("2026-10-01T00:00:00Z");

    const expired = evaluateCertificateExpiry(
      {
        issuer: "Saudi National Root CA",
        subject: "CN=gosi.company.sa",
        validFrom: "2025-01-01T00:00:00Z",
        validTo: "2026-09-25T00:00:00Z",
        fingerprintSha256: "AA:BB:CC",
        secretEnvReference: "MADARX_SA_GOSI_MTLS_CERT_REF",
      },
      refDate
    );
    expect(expired.status).toBe("expired");
    expect(expired.blocksLiveSubmission).toBe(true);

    const warn7d = evaluateCertificateExpiry(
      {
        issuer: "Saudi National Root CA",
        subject: "CN=gosi.company.sa",
        validFrom: "2025-01-01T00:00:00Z",
        validTo: "2026-10-06T00:00:00Z",
        fingerprintSha256: "AA:BB:CC",
        secretEnvReference: "MADARX_SA_GOSI_MTLS_CERT_REF",
      },
      refDate
    );
    expect(warn7d.status).toBe("expiring_7d");
    expect(warn7d.alertThresholdDays).toBe(7);
    expect(warn7d.blocksLiveSubmission).toBe(false);

    const warn30d = evaluateCertificateExpiry(
      {
        issuer: "Egypt Root CA",
        subject: "CN=eta.company.eg",
        validFrom: "2025-01-01T00:00:00Z",
        validTo: "2026-10-25T00:00:00Z",
        fingerprintSha256: "DD:EE:FF",
        secretEnvReference: "MADARX_EG_ETA_SIGNING_CERT_REF",
      },
      refDate
    );
    expect(warn30d.status).toBe("expiring_30d");
    expect(warn30d.alertThresholdDays).toBe(30);
  });

  it("retries only transient errors with bounded exponential backoff and routes non-retryable errors to DLQ", () => {
    const transientRetry = computeRetryBackoffPolicy(0, 3, "transient_network");
    expect(transientRetry.shouldRetry).toBe(true);
    expect(transientRetry.delaySeconds).toBe(30);
    expect(transientRetry.sendToDeadLetterQueue).toBe(false);

    const validationFail = computeRetryBackoffPolicy(0, 3, "validation_error");
    expect(validationFail.shouldRetry).toBe(false);
    expect(validationFail.sendToDeadLetterQueue).toBe(true);

    const exhaustedRetry = computeRetryBackoffPolicy(3, 3, "portal_timeout");
    expect(exhaustedRetry.shouldRetry).toBe(false);
    expect(exhaustedRetry.sendToDeadLetterQueue).toBe(true);
  });

  it("enforces separation of duties, sanitizes secrets from audit logs, and verifies RBAC permissions", () => {
    const sameActor = verifySeparationOfDuties({
      preparerId: "user-payroll-01",
      submitterId: "user-payroll-01",
      enforceStrictSoD: true,
    });
    expect(sameActor.allowed).toBe(false);

    const distinctActors = verifySeparationOfDuties({
      preparerId: "user-payroll-01",
      reviewerId: "user-hr-02",
      submitterId: "user-finance-03",
      enforceStrictSoD: true,
    });
    expect(distinctActors.allowed).toBe(true);

    const sanitized = sanitizeGovernmentAuditPayload({
      provider: "GOSI",
      client_secret: "TOP_SECRET_VALUE",
      privateKey: "-----BEGIN PRIVATE KEY-----",
      nationalId: "1087654321",
      iban: "SA4420000001234567891234",
    });
    expect(sanitized.client_secret).toBe("[REDACTED_SECRET]");
    expect(sanitized.privateKey).toBe("[REDACTED_SECRET]");
    expect(sanitized.nationalId).toBe("******4321");
    expect(sanitized.iban).toBe("********************1234");

    expect(hasGovernmentIntegrationPermission("super_admin", "government_integrations:configure")).toBe(true);
    expect(hasGovernmentIntegrationPermission("payroll_officer", "government_integrations:submit")).toBe(true);
    expect(hasGovernmentIntegrationPermission("employee", "government_integrations:view")).toBe(false);
  });
});
