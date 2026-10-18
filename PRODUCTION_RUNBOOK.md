# MadarX Enterprise — Production Operations Runbook (`v1.0.0-enterprise`)

**Version:** `1.0.0-enterprise`  
**Target Environment:** Production Cloud (Supabase Enterprise + Nitro Edge / Cloudflare Workers)  
**Security Rule:** Zero secrets, private keys, or customer credentials may ever be stored in this runbook.

---

## 1. Common Incidents & Triage Matrix
| Severity | Scope | SLA | First Action |
| :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Auth outage, tenant isolation breach, payroll calculation corruption | `< 15 mins` | Engage incident commander, inspect `/api/health`, freeze mutations or rollback worker if caused by deploy. |
| **P1 (High)** | Background job stall, government connector auth failure, storage degradation | `< 1 hour` | Inspect `outbox_events`, `connector_health_snapshots`, and DLQ console; trigger safe retry or connector suspension. |
| **P2 (Medium)** | AI copilot unavailability, non-blocking UI/report delay | `< 4 hours` | Verify `executeAIWithSafeFallback` active; HRMS continues operating normally while AI provider recovers. |

---

## 2. Failed Jobs & Dead-Letter Queue (DLQ) Recovery
1. Inspect failed background jobs and integration deliveries in `public.outbox_events` and `public.government_submission_queue` where `status IN ('failed', 'dead_letter')`.
2. Verify root cause via `last_error_code` and `correlation_id` (no secrets are logged).
3. Before replaying any DLQ item, run `validateDlqResubmission` to confirm payload validity, active connector status, valid credentials, and idempotency key uniqueness so duplicate financial or statutory submissions never occur.

---

## 3. Integration Failure & Government Connector Outage
1. Check `public.connector_health_snapshots` and the Country Packs Government Connector Operations console (`GOSI`, `MUDAD`, `QIWA`, `MUQEEM`, `NOSI`, `ETA`, `GRSIA`, `MADLSA`, `SPF`, `CBO`, `SIO`, `LMRA`).
2. If an external government authority experiences an outage (`PROVIDER_UNAVAILABLE` or `NETWORK_ERROR`), bounded exponential backoff (`evaluateRetryDecision`) queues retries up to 5 attempts.
3. If repeated authentication failures (`>= 3`) or certificate expiry occur, `evaluateAutomaticSafetySuspension` automatically suspends only the affected provider while `tenantRemainsOperational: true`.
4. Switch payroll/statutory export workflow to `official_file_export` (`SIF`/`CSV`) if urgent statutory filing is required during an external portal API outage.

---

## 4. Credential & X.509 Certificate Rotation
1. Provision the new OAuth client secret or X.509 certificate/private key in the external secret vault using the canonical reference name (e.g., `MADARX_SA_GOSI_CLIENT_SECRET`, `MADARX_SA_GOSI_MTLS_CERT_REF`).
2. Register the replacement metadata in standby state (`replacement_pending` / `standby_replacement`) using `super_admin` (`government_integrations.credentials.manage`).
3. Run Pre-Flight (`runConnectorActivationPreflight`) and Controlled Connection Test (`verifyCustomerProviderConnection`) in the target environment.
4. Execute `rotateX509CertificateLedger` / atomic lifecycle transition to promote the new credential/certificate to `active` and archive the prior record as `historical_retired`.

---

## 5. Database Connectivity & Recovery
1. Verify PostgreSQL reachability and RLS context via health check (`SELECT 1` and `public.current_company_id()`).
2. If connection pool saturation occurs, inspect long-running queries in `pg_stat_activity` and terminate stalled non-transactional sessions.
3. For disaster recovery (`RPO < 15m`, `RTO < 2h`), restore from Supabase PITR or encrypted off-site `pg_dump` snapshot and run `npm run test:unit` contract verification before reopening traffic.

---

## 6. Deployment Rollback
1. All SQL migrations in `supabase/migrations/` are strictly append-only and backward-compatible.
2. To roll back an application release immediately:
   ```bash
   npx wrangler rollback
   ```
3. Re-run smoke tests on `/login`, `/dashboard`, `/employees`, `/payroll`, and `/country-packs`.

---

## 7. Emergency User Lock & Session Revocation
1. To immediately lock a compromised, terminated, or disabled user account:
   - Set user status to `disabled` / `terminated` in `public.employees` and revoke company membership in `public.user_company_access`.
   - Revoke active refresh tokens in Supabase Auth (`auth.users`).
2. Server-side guards (`AuthContext` and RLS policies) immediately reject any subsequent API or RPC call from stale sessions.

---

## 8. AI Outage Handling
1. If the external LLM provider times out, hits rate limits, or is unreachable, `executeAIWithSafeFallback` automatically traps the error and returns `aiAvailable: false, hrmsOperational: true`.
2. Core HR, Attendance, Leave, Workflow, Payroll, and Country Pack operations remain 100% unaffected.
3. Monitor `aiObservability.getMetricsSummary()` for error rates and latency recovery before restoring live AI provider routing.
