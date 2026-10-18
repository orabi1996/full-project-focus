# MADARX ENTERPRISE WORKFORCE PLATFORM — GO-LIVE ENTERPRISE CHECKLIST (`v1.0.0-enterprise`)

## 1. Security
- [x] Tenant Row-Level Security (`company_id = public.current_company_id()`) enforced across all domain tables.
- [x] `SECURITY DEFINER` RPCs hardened with `SET search_path = public` and explicit role checks.
- [x] Field-level masking active for salary, IBAN, national ID/Iqama, disciplinary evidence, and talent ratings.
- [x] Sensitive exports (CSV/PDF/SIF) enforce the same RBAC and field permissions as server/UI queries.

## 2. Database
- [x] All migrations (`20260901000000` through `20261020000000`) are append-only, idempotent, and non-destructive.
- [x] Production composite indexes created for `(company_id, status)`, `(company_id, employee_id)`, `(company_id, effective_date)`, `(company_id, period)`, and `(company_id, created_at DESC)`.
- [x] Concurrency guards (`FOR UPDATE` row locking and idempotency keys) verified on leave reservations, payroll finalization, loan disbursements, expense transfers, and workflow transitions.

## 3. Auth
- [x] Supabase Auth session validation, token refresh, logout session revocation, and password reset flows verified.
- [x] Disabled or terminated users and revoked company-access memberships immediately lose active route and RPC authorization.

## 4. Storage
- [x] Sensitive employee and corporate documents stored in private bucket (`documents`) with signed URL access only.
- [x] No unrestricted public URLs for IDs, contracts, certificates, disciplinary evidence, salary letters, or statutory packages.

## 5. Payroll
- [x] Decimal-safe calculations enforced for basic salary, allowances, prorated adjustments, loans, EOSB, and statutory social insurance/tax deductions.
- [x] Finalized payroll runs (`approved` / `locked`) are immutable and protected against duplicate posting or retroactive mutation.

## 6. Integrations
- [x] Outbox event dispatcher, bounded exponential backoff retry, and Dead-Letter Queue (DLQ) replay validation active.
- [x] Webhook/callback endpoints verify HMAC-SHA256 signatures, 5-minute timestamp windows, and unique nonces.

## 7. Country Packs
- [x] Authoritative Country Packs active for **Saudi Arabia (`SA`)**, **Egypt (`EG`)**, **Qatar (`QA`)**, **Oman (`OM`)**, and **Bahrain (`BH`)**.
- [x] All 12 government regulatory connectors (`GOSI`, `MUDAD`, `QIWA`, `MUQEEM`, `NOSI`, `ETA`, `GRSIA`, `MADLSA`, `SPF`, `CBO`, `SIO`, `LMRA`) enforce fail-closed submission gates and report `WAITING_FOR_CUSTOMER_CREDENTIALS` until tenant-owned credentials/certificates are supplied.

## 8. Backups
- [x] Point-in-Time Recovery (PITR) and encrypted daily logical `pg_dump` backups configured (`RPO < 15m`, `RTO < 2h`).
- [x] Cross-region storage replication and backup verification procedures documented in `DISASTER_RECOVERY.md`.

## 9. Monitoring
- [x] Health check engine monitors application runtime, PostgreSQL database, storage buckets, background queues, and AI copilot availability independently from external government provider status.
- [x] Operational dashboards surface failed jobs, DLQ items, auth failures, and X.509 certificate expiry thresholds (`90/60/30/14/7/0` days).

## 10. AI
- [x] Enterprise AI Copilot restricted to governed tools (`GOVERNED_AI_TOOLS`) with server-side tenant, role, self-scope, manager hierarchy, and sensitive-domain authorization.
- [x] AI HR actions only prepare drafts (`PREPARED_DRAFT_REQUIRES_HUMAN_APPROVAL`); direct mutation bypass is impossible.
- [x] AI outage degrades gracefully (`hrmsOperational: true`) without impacting core HR or Payroll availability.

## 11. Secrets
- [x] Repository secret scan verified: `0` active credentials, private keys, or bearer tokens in tracked files.
- [x] Government connector credentials and X.509 private keys stored exclusively as vault/environment references (`secret_reference`), never returned to browser clients or printed in logs.

## 12. Environment Variables
- [x] Startup validator (`src/lib/config/env-validator.ts`) verifies `NODE_ENV=production`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and blocks boot if `VITE_ENABLE_DEMO_MODE=true`.

## 13. Deployment
- [x] Production build (`npm run build`) generates verified client assets (`.output/public/`) and Nitro server bundle (`.output/server/index.mjs`).

## 14. Rollback
- [x] Zero-downtime worker rollback (`npx wrangler rollback`) and backward-compatible append-only database schema verified.

## 15. Smoke Tests
- [x] Post-deployment smoke verification covers authentication, tenant switch, employee directory pagination, attendance check-in, leave request workflow, payroll run preview, country pack SIF/CSV generation, and AI copilot health.
