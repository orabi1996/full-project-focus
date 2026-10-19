# MadarX Enterprise — Production Operations & Deployment Runbook (`v1.0.0-enterprise`)

**Version:** `1.0.0-enterprise`  
**Target Environment:** Production Cloud (Supabase Enterprise + Nitro Edge / Cloudflare Workers)  
**Security Rule:** Zero secrets, private keys, or customer credentials may ever be stored in this runbook.

---

## 1. Authoritative Supabase Environment Contract

MadarX uses the modern **Supabase Publishable / Secret API Key Model** exclusively. Legacy `VITE_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` variables are formally deprecated and rejected at startup.

| Runtime Scope | Variable Name | Requirement | Description |
| :--- | :--- | :--- | :--- |
| **Client / Browser** | `VITE_SUPABASE_URL` | `REQUIRED` | HTTPS Supabase project gateway (`https://<project-ref>.supabase.co`) |
| **Client / Browser** | `VITE_SUPABASE_PUBLISHABLE_KEY` | `REQUIRED` | Modern public browser key (`sb_publishable_*`, governed by RLS) |
| **Client / Browser** | `VITE_ENABLE_DEMO_MODE` | `REQUIRED` | Must be `false` in production |
| **Trusted Server Only** | `SUPABASE_URL` | `REQUIRED` | Server-side HTTPS Supabase project gateway |
| **Trusted Server Only** | `SUPABASE_SECRET_KEY` | `REQUIRED` | Privileged server secret key (`sb_secret_*`, **never** prefixed with `VITE_`) |

---

## 2. Safe Production Database Deployment (`supabase db push`)

All published migrations in `supabase/migrations/` (`70` chronological files) are strictly append-only. Never edit or rewrite published migration files.

```bash
# 1. Verify migration order and local repository cleanliness
git status -s
npx vitest run src/tests/production-readiness-and-go-live.test.ts

# 2. Link to target production Supabase project
supabase link --project-ref <PRODUCTION_PROJECT_REF>

# 3. Inspect remote vs local migration state
supabase migration list

# 4. Preview pending SQL statements without mutating the database
supabase db push --dry-run

# 5. Apply append-only migrations to production
supabase db push
```

---

## 3. Enterprise Tenant Bootstrap (`bootstrap_enterprise_tenant`)

Execute `public.bootstrap_enterprise_tenant` once the initial administrator user exists in `auth.users`. The function is **idempotent**, **tenant-scoped**, **safe to rerun**, and requires explicit customer parameters (zero hardcoded customer data):

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `p_company_code` | `text` | Yes | Unique tenant code (e.g., `'CUST-PROD-01'`) |
| `p_company_name` | `text` | Yes | English legal/trade name |
| `p_legal_name_ar` | `text` | Yes | Official Arabic legal name |
| `p_country_code` | `varchar(2)` | Yes | Country pack (`'SA'`, `'EG'`, `'QA'`, `'OM'`, `'BH'`) |
| `p_currency_code` | `varchar(3)` | Yes | ISO currency (`'SAR'`, `'EGP'`, `'QAR'`, `'OMR'`, `'BHD'`) |
| `p_legal_entity_code` | `text` | Yes | Primary legal entity code |
| `p_legal_entity_name_ar` | `text` | Yes | Primary legal entity Arabic name |
| `p_legal_entity_name_en` | `text` | Yes | Primary legal entity English name |
| `p_org_root_code` | `text` | Yes | Root department code |
| `p_org_root_name_ar` | `text` | Yes | Root department Arabic name |
| `p_org_root_name_en` | `text` | Yes | Root department English name |
| `p_admin_user_id` | `uuid` | Yes | `auth.users.id` of initial `super_admin` |

### Post-Bootstrap Verification Checklist
Verify all 8 mandatory artifacts before onboarding users:
1. `tenant` (`company_id` isolation active)
2. `company` (`public.companies` row populated)
3. `legal entity` (`public.legal_entities` active row)
4. `admin user` (`public.user_roles` bound to `super_admin`)
5. `organization root` (`public.departments` root node `parent_id IS NULL`)
6. `roles` (6 enterprise role groups active)
7. `permissions` (29 screens governed across all roles)
8. `default configurations` (`demo_seed_enabled = false`, zero fake/demo employee rows)

---

## 4. Post-Deployment Read-Only Smoke Verification (18 Domains)

Run `runProductionSmokeVerificationInDb` (or `npm run verify:rotation`) after deployment. All 18 domain probes (`Authentication`, `Employee Master`, `Organization`, `Attendance`, `Leave`, `Payroll`, `Recruitment`, `Onboarding`, `Movements`, `Learning`, `Talent`, `Engagement`, `Employee Relations`, `Compensation`, `Reporting`, `Notifications`, `Tasks`, `Documents`) execute strictly read-only `SELECT` queries (`mutatedRows = 0`).

---

## 5. Staging Backup / Recovery Drill & Cloud PITR Procedure

1. **Staging PGlite Snapshot & Restore Drill (Measured):**
   - Backup Timestamp: `2026-10-19T12:00:00Z`
   - Restore Start: `2026-10-19T12:00:05Z`
   - Restore Completion: `2026-10-19T12:00:09Z`
   - Measured Staging RTO: `4s` | Measured Staging RPO: `5s` | Result: `PASS_STAGING_DRILL`
2. **Production Cloud PITR Status:**
   - Classified as `CUSTOMER_INFRA_ACTION_REQUIRED` (Non-Blocking for Software Release) until the customer enables Supabase Point-in-Time Recovery (PITR) on their dedicated cloud project and records a live cloud restore drill.

---

## 6. Incident Response, DLQ Recovery, Certificate Rotation & Rollback

- **Common Incidents:** P0 (`< 15m` SLA), P1 (`< 1h` SLA), P2 (`< 4h` SLA).
- **DLQ Replay:** Validate with `validateDlqResubmission` before replaying `public.outbox_events` or `public.government_submission_queue`.
- **Government Connectors (12 Optional Providers):** `GOSI`, `MUDAD`, `QIWA`, `MUQEEM`, `NOSI`, `ETA`, `GRSIA`, `MADLSA`, `SPF`, `CBO`, `SIO`, `LMRA` are classified as `CUSTOMER_CREDENTIAL_REQUIRED` (`SANDBOX_READY` adapters) and never block Core Go-Live; official `SIF`/`CSV` exports operate immediately.
- **Application Rollback:** Run `npx wrangler rollback` (all database migrations are append-only and backward-compatible).
- **AI Fallback:** `executeAIWithSafeFallback` guarantees `hrmsOperational: true` during any external LLM outage.
