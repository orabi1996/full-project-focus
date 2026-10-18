// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 38: CUSTOMER CREDENTIAL ONBOARDING, CONNECTOR ACTIVATION &
//            LIVE INTEGRATION OPERATIONS CONTRACT & SECURITY TESTS
// src/tests/customer-connector-credential-activation.test.ts
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  ALL_GOVERNMENT_PROVIDER_CODES,
  PROVIDER_ONBOARDING_REQUIREMENTS,
  createSafeCredentialMetadataView,
  enforceTenantAndProviderIsolation,
  validateX509CertificateOnboarding,
  rotateX509CertificateLedger,
  acquireOAuthTokenRefreshLock,
  releaseOAuthTokenRefreshLock,
  runConnectorActivationPreflight,
  verifyCustomerProviderConnection,
  evaluateConnectorActivationGuard,
  enforceSubmissionGate,
  evaluateAutomaticSafetySuspension,
  verifyGovernmentCallbackSecurity,
  validateDlqResubmission,
  buildRegulatoryPackageManifestAndPreview,
  buildProviderOnboardingChecklist,
  computeGovernmentIntegrationGovernedMetrics,
  createSanitizedConnectorAuditEvent,
  evaluateCertificateExpiry,
} from "../lib/integrations/government";
import { hasGovernmentIntegrationPermission } from "../lib/auth/permissions";

describe("Prompt 38 — Customer Credential Onboarding, Connector Activation & Live Operations", () => {
  it("exposes explicit provider-specific onboarding requirements for all 12 providers without duplicating registry", () => {
    expect(Object.keys(PROVIDER_ONBOARDING_REQUIREMENTS)).toHaveLength(12);
    for (const code of ALL_GOVERNMENT_PROVIDER_CODES) {
      const req = PROVIDER_ONBOARDING_REQUIREMENTS[code];
      expect(req.provider).toBe(code);
      expect(req.customerActionItemsAr.length).toBeGreaterThan(0);
      expect(req.onboardingGuidanceAr.length).toBeGreaterThan(10);
    }
    expect(PROVIDER_ONBOARDING_REQUIREMENTS.GOSI.requires_x509).toBe(true);
    expect(PROVIDER_ONBOARDING_REQUIREMENTS.MUDAD.requires_sif).toBe(true);
    expect(PROVIDER_ONBOARDING_REQUIREMENTS.ETA.requires_tax_number).toBe(true);
  });

  it("never exposes raw secret values in credential metadata views and masks key suffixes safely", () => {
    const view = createSafeCredentialMetadataView({
      companyId: "tenant-a",
      providerCode: "GOSI",
      environment: "production",
      credentialType: "oauth_client_secret",
      secretReference: "MADARX_SA_GOSI_CLIENT_SECRET",
      keyIdentifier: "GOSI-PROD-KEY-01",
      rawSecretValueForSuffixOnly: "super-secret-value-9876",
    });

    expect(view.secretReference).toBe("MADARX_SA_GOSI_CLIENT_SECRET");
    expect(view.maskedKeySuffix).toBe("****9876");
    expect(JSON.stringify(view)).not.toContain("super-secret-value");
  });

  it("enforces strict tenant isolation and prevents cross-provider credential reuse", () => {
    const crossTenant = enforceTenantAndProviderIsolation({
      requestingTenantId: "tenant-a",
      resourceTenantId: "tenant-b",
      requestingProvider: "GOSI",
      credentialProvider: "GOSI",
    });
    expect(crossTenant.allowed).toBe(false);
    expect(crossTenant.violationCode).toBe("CROSS_TENANT_ACCESS_DENIED");

    const crossProvider = enforceTenantAndProviderIsolation({
      requestingTenantId: "tenant-a",
      resourceTenantId: "tenant-a",
      requestingProvider: "MUDAD",
      credentialProvider: "GOSI",
    });
    expect(crossProvider.allowed).toBe(false);
    expect(crossProvider.violationCode).toBe("CROSS_PROVIDER_CREDENTIAL_REUSE_DENIED");
  });

  it("validates X.509 certificates, supports 90/60/30/14/7/expired thresholds, and rotates standby certificates preserving audit history", () => {
    const refDate = new Date("2026-10-01T00:00:00Z");

    const warn14d = evaluateCertificateExpiry(
      {
        issuer: "Saudi National Root CA",
        subject: "CN=gosi.company.sa",
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2026-10-12T00:00:00Z", // 11 days remaining -> 14d threshold
        fingerprintSha256: "SHA256:AABBCCDD1122",
        secretEnvReference: "MADARX_SA_GOSI_MTLS_CERT_REF",
      },
      refDate
    );
    expect(warn14d.status).toBe("expiring_14d");
    expect(warn14d.alertThresholdDays).toBe(14);

    const invalidAlg = validateX509CertificateOnboarding(
      {
        providerCode: "GOSI",
        subject: "CN=gosi.company.sa",
        issuer: "Saudi National Root CA",
        serialNumber: "SN-01",
        fingerprintSha256: "SHA256:1234567890",
        algorithm: "MD5-WEAK",
        privateKeySecretRef: "MADARX_SA_GOSI_KEY",
        privateKeyCompatible: false,
        validFrom: "2026-01-01T00:00:00Z",
        validTo: "2027-01-01T00:00:00Z",
      },
      refDate
    );
    expect(invalidAlg.valid).toBe(false);
    expect(invalidAlg.errorsAr.length).toBeGreaterThanOrEqual(2);

    const rotation = rotateX509CertificateLedger({
      currentActiveCertificate: {
        providerCode: "GOSI",
        subject: "CN=old.company.sa",
        issuer: "Saudi Root CA",
        serialNumber: "SN-OLD",
        fingerprintSha256: "SHA256:OLD123456",
        algorithm: "RSA-2048",
        privateKeySecretRef: "VAULT_OLD_KEY",
        privateKeyCompatible: true,
        validFrom: "2025-01-01T00:00:00Z",
        validTo: "2026-10-15T00:00:00Z",
      },
      standbyReplacementCertificate: {
        providerCode: "GOSI",
        subject: "CN=new.company.sa",
        issuer: "Saudi Root CA",
        serialNumber: "SN-NEW",
        fingerprintSha256: "SHA256:NEW987654",
        algorithm: "RSA-4096",
        privateKeySecretRef: "VAULT_NEW_KEY",
        privateKeyCompatible: true,
        validFrom: "2026-09-01T00:00:00Z",
        validTo: "2028-09-01T00:00:00Z",
      },
      referenceDate: refDate,
    });
    expect(rotation.rotated).toBe(true);
    expect(rotation.newActive.certificateRole).toBe("active");
    expect(rotation.historicalRetired.certificateRole).toBe("historical_retired");
  });

  it("prevents duplicate OAuth token refresh storms via deterministic in-flight locking", () => {
    const first = acquireOAuthTokenRefreshLock({
      companyId: "tenant-01",
      providerCode: "GOSI",
      environment: "production",
      correlationId: "CORR-1",
      nowMs: 1_000_000,
    });
    expect(first.acquired).toBe(true);
    expect(first.deduplicatedInFlight).toBe(false);

    const stormAttempt = acquireOAuthTokenRefreshLock({
      companyId: "tenant-01",
      providerCode: "GOSI",
      environment: "production",
      correlationId: "CORR-2",
      nowMs: 1_005_000,
    });
    expect(stormAttempt.acquired).toBe(false);
    expect(stormAttempt.deduplicatedInFlight).toBe(true);

    releaseOAuthTokenRefreshLock("tenant-01", "GOSI", "production");
  });

  it("returns WAITING_FOR_CUSTOMER_CREDENTIALS when actual customer credentials are absent and never fabricates live success", () => {
    for (const code of ALL_GOVERNMENT_PROVIDER_CODES) {
      const res = verifyCustomerProviderConnection({
        companyId: "tenant-01",
        providerCode: code,
        environment: "production",
        hasActualCustomerCredentials: false,
        establishmentIdentifier: "EST-700100",
      });
      expect(res.outcome).toBe("WAITING_FOR_CUSTOMER_CREDENTIALS");
      expect(res.liveHandshakeVerified).toBe(false);
    }
  });

  it("blocks production activation when only sandbox is verified or approval is missing, and enforces fail-closed submission gate", () => {
    const sandboxToProdGuard = evaluateConnectorActivationGuard({
      targetEnvironment: "production",
      preflightStatus: "PASS",
      connectionOutcome: "VERIFIED",
      verifiedEnvironment: "sandbox", // sandbox cannot promote to production without prod verification
      workflowApprovalCompleted: true,
      credentialsValid: true,
    });
    expect(sandboxToProdGuard.canActivate).toBe(false);

    const suspendedGate = enforceSubmissionGate({
      activationStatus: "suspended",
      environment: "production",
      credentialExpired: false,
      certificateExpired: false,
    });
    expect(suspendedGate.allowed).toBe(false);
    expect(suspendedGate.code).toBe("SUBMISSION_BLOCKED_CONNECTOR_SUSPENDED");

    const expiredCertGate = enforceSubmissionGate({
      activationStatus: "active",
      environment: "production",
      credentialExpired: false,
      certificateExpired: true,
    });
    expect(expiredCertGate.allowed).toBe(false);
    expect(expiredCertGate.code).toBe("SUBMISSION_BLOCKED_CERTIFICATE_EXPIRED");

    const activeGate = enforceSubmissionGate({
      activationStatus: "active",
      environment: "production",
      credentialExpired: false,
      certificateExpired: false,
    });
    expect(activeGate.allowed).toBe(true);
  });

  it("automatically triggers safety suspension on repeated auth failures without disabling the tenant", () => {
    const autoSuspend = evaluateAutomaticSafetySuspension({
      credentialExpired: false,
      certificateExpired: false,
      consecutiveAuthFailures: 3,
      providerReportedInvalidCredential: false,
    });
    expect(autoSuspend.shouldAutoSuspend).toBe(true);
    expect(autoSuspend.reason).toBe("repeated_authentication_failure");
    expect(autoSuspend.tenantRemainsOperational).toBe(true);
  });

  it("verifies callback signatures, prevents replay attacks, validates DLQ resubmissions, masks payload previews, and enforces secret RBAC", () => {
    const nowMs = Date.parse("2026-10-18T12:00:00Z");
    const validCb = verifyGovernmentCallbackSecurity({
      expectedTenantId: "tenant-01",
      payloadTenantId: "tenant-01",
      expectedProvider: "GOSI",
      payloadProvider: "GOSI",
      signatureHeader: "HMAC-SHA256-VALID",
      expectedSignature: "HMAC-SHA256-VALID",
      timestampIso: "2026-10-18T11:59:30Z",
      nonce: "NONCE-UNIQUE-100",
      correlationId: "CB-100",
      nowMs,
    });
    expect(validCb.verified).toBe(true);

    // Replay with same nonce must be blocked
    const replayCb = verifyGovernmentCallbackSecurity({
      expectedTenantId: "tenant-01",
      payloadTenantId: "tenant-01",
      expectedProvider: "GOSI",
      payloadProvider: "GOSI",
      signatureHeader: "HMAC-SHA256-VALID",
      expectedSignature: "HMAC-SHA256-VALID",
      timestampIso: "2026-10-18T11:59:30Z",
      nonce: "NONCE-UNIQUE-100",
      correlationId: "CB-101",
      nowMs,
    });
    expect(replayCb.verified).toBe(false);
    expect(replayCb.reasonCode).toBe("CALLBACK_DUPLICATE_NONCE_REPLAY_BLOCKED");

    const dlqBlocked = validateDlqResubmission({
      payloadValid: true,
      connectorActivationStatus: "suspended",
      credentialsValid: true,
      alreadyAcceptedForIdempotencyKey: false,
    });
    expect(dlqBlocked.canResubmit).toBe(false);

    const preview = buildRegulatoryPackageManifestAndPreview({
      provider: "MUDAD",
      countryCode: "SA",
      filename: "MUDAD_SA_202610.sif",
      rawContent: "HDR|SA|MUDAD|7001|2026-10|1\nREC|1|1087654321|SA4420000001234567891234|12000.00|14820.00",
      recordCount: 1,
      canViewUnmaskedIdentifiers: false,
    });
    expect(preview.maskedPreviewContent).toContain("******4321");
    expect(preview.maskedPreviewContent).not.toContain("1087654321");
    expect(preview.crc32Checksum).toMatch(/^CRC32-/);

    const checklist = buildProviderOnboardingChecklist("GOSI", {
      companyMasterDataComplete: true,
      credentialsConfigured: false,
    });
    expect(checklist).toHaveLength(11);

    const preflight = runConnectorActivationPreflight({
      companyId: "tenant-01",
      countryCode: "SA",
      providerCode: "GOSI",
      environment: "production",
      companyMasterDataComplete: true,
      countryEnabled: true,
      establishmentIdentifier: "7001234567",
      payrollRegistrationNumber: "PAY-01",
      callbackUrl: "https://api.example.com/cb",
      payrollMappingsComplete: true,
      employeeIdentifiersComplete: true,
      bankConfigurationComplete: true,
      credentialsConfigured: false,
      connectionVerifiedInEnvironment: false,
      workflowApproved: false,
    });
    expect(preflight.goLiveStatus).toBe("CUSTOMER_ACTION_REQUIRED");

    const metrics = computeGovernmentIntegrationGovernedMetrics({
      totalConnectors: 12,
      activeConnectors: 0,
      verifiedConnectors: 0,
      totalSubmissions: 4,
      successfulSubmissions: 4,
      authFailureCount: 0,
      dlqCount: 0,
      expiringOrExpiredCertificatesCount: 0,
      averageReadinessScore: preflight.readinessBreakdown.totalScore,
    });
    expect(metrics.GOV_CONNECTOR_ACTIVE_RATE).toBe(0);
    expect(metrics.GOV_SUBMISSION_SUCCESS_RATE).toBe(100);

    const auditEvt = createSanitizedConnectorAuditEvent({
      companyId: "tenant-01",
      providerCode: "GOSI",
      environment: "production",
      actionType: "credential_configured",
      actorId: "admin-01",
      metadata: {
        secretReference: "MADARX_SA_GOSI_CLIENT_SECRET",
        client_secret: "RAW_SECRET_NEVER_LOGGED",
      },
    });
    expect(auditEvt.sanitizedMetadata.client_secret).toBe("[REDACTED_SECRET]");

    // Section 57: Secret management permission strictly isolated
    expect(
      hasGovernmentIntegrationPermission("super_admin", "government_integrations.credentials.manage")
    ).toBe(true);
    expect(
      hasGovernmentIntegrationPermission("hr_manager", "government_integrations.credentials.manage")
    ).toBe(false);
    expect(
      hasGovernmentIntegrationPermission("payroll_officer", "government_integrations.credentials.manage")
    ).toBe(false);
  });
});
