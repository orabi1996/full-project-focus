# MadarX Enterprise — Production Operations Runbook

**Version:** 1.0.0-core  
**Target Environment:** Production Cloud (Supabase Enterprise + Nitro Edge / Cloudflare Workers)  
**Compliance Standard:** ISO 27001 / Saudi National Cybersecurity Authority (NCA) Essential Cybersecurity Controls (ECC)  

---

## 1. System Architecture Overview

MadarX is structured as a cloud-native, high-availability enterprise workforce management platform:
- **Frontend / Application Server:** TanStack Start (React 18 + Vite + Nitro Server Engine) delivering server-side rendered (SSR) pages, edge routing, and single-page application (SPA) interactivity.
- **Backend Services:** Supabase Enterprise (PostgreSQL 15+, Supabase Auth with GoTrue, Supabase Storage, Edge Functions, Realtime websockets).
- **Security & Authorization:** Row Level Security (RLS) policies enforced per-tenant (`company_id`), PostgreSQL `SECURITY DEFINER` functions with fixed `search_path = public`, and client-side RBAC validation.
- **Integration Layer:** REST & Webhook APIs with HMAC signature verification, asynchronous outbox event processing, and dead-letter monitoring.

```
+-------------------------------------------------------------+
|                 Clients (Web Desktop & Mobile ESS)          |
+-------------------------------------------------------------+
                               | HTTPS / TLS 1.3
                               v
+-------------------------------------------------------------+
|          Edge Application Tier (Nitro / Cloudflare)         |
|  - SSR Rendering & Static Assets                            |
|  - Runtime Environment Validation                           |
|  - Server Functions & Session Proxy                         |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                 Supabase Enterprise Cloud                   |
|  +---------------------+   +-----------------------------+  |
|  | Supabase Auth / MFA |   | Supabase Storage (Buckets)  |  |
|  +---------------------+   +-----------------------------+  |
|  +-------------------------------------------------------+  |
|  |           PostgreSQL Database Cluster                 |  |
|  |  - Multi-Tenant RLS Policy Engine                     |  |
|  |  - Automated Audit Trail & Hash-Chaining              |  |
|  |  - Operational Task & SLA Countdown Timers            |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

---

## 2. Production Environment Variables Configuration

The application runtime strictly checks environment configuration at startup via `src/lib/config/env-validator.ts`. Deployments with insecure or placeholder variables are blocked from booting.

### Required Variables
| Variable Name | Required | Allowed Value Format | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production runtime optimizations and strict security. |
| `VITE_SUPABASE_URL` | Yes | `https://<project-ref>.supabase.co` | Supabase API gateway URL (must be HTTPS; no localhost/placeholders). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | `sb_publishable_...` | Public browser API key (client-safe; never provide secret keys!). |
| `VITE_ENABLE_DEMO_MODE` | Yes | `false` | Must strictly be `false` in production. Enabling triggers boot blocker. |
| `VITE_APP_URL` | Recommended | `https://app.madarx.com` | Base URL used for email magic links, password resets, and webhooks. |
| `VITE_STORAGE_BUCKET_DOCS` | Optional | `documents` | Private bucket name for legal and corporate employee documents. |
| `SUPABASE_SECRET_KEY` | Server Only | `sb_secret_...` | Privileged admin key for server functions (never expose to client code!). |

---

## 3. Build & Deployment Procedure

### Pre-Deployment Verification
Before triggering deployment, execute all local quality gates:
```bash
# 1. Typecheck
npm run typecheck

# 2. Linter check
npm run lint

# 3. Complete unit & integration test suite (54 suites, 938 tests)
npm run test:unit

# 4. Production build artifact generation
npm run build
```

### Deployment Pipeline
The build produces `.output/` containing both client distribution assets and server worker definitions:
- **Client Assets:** `.output/public/`
- **Nitro Edge Worker:** `.output/server/`

#### Target: Cloudflare Workers / Pages
```bash
# Deploy prebuilt output
npx wrangler deploy
```

#### Target: Node.js Enterprise Container
```bash
# Start standalone Nitro server
node .output/server/index.mjs
```

---

## 4. Database Operations & Migration Management

All migrations reside in `supabase/migrations/` and follow strict enterprise rules:
1. **Idempotence:** Every migration uses `CREATE TABLE IF NOT EXISTS`, conditional constraint additions (`DO $$ BEGIN ... END $$;`), and non-destructive schemas.
2. **Zero Destructive Drops:** `DROP TABLE` or `DROP COLUMN` without safe data migration is prohibited.
3. **Explicit Search Path:** Every `SECURITY DEFINER` function explicitly defines `SET search_path = public`.

### Applying Migrations
```bash
# Link project to production Supabase
supabase link --project-ref <your-production-ref>

# Test migration diff locally
supabase db diff

# Push pending migrations to production
supabase db push
```

---

## 5. Monitoring, Observability & Health Checks

### System Health Endpoints
- **Health Check:** `GET /api/health` returns `200 OK` with database ping status.
- **Outbox Queue Health:** Monitor table `public.outbox_events` where `status = 'failed'` or `retry_count >= 5`.
- **SLA Escalations:** Monitor view `public.v_sla_escalation_alerts` for breaches requiring supervisor attention.

### Audit Trail Integrity
- Query `public.audit_events` to inspect administrative and sensitive activities (salary changes, role assignments, document access).
- Hash integrity check: Verify that `event_hash` aligns with preceding `last_event_hash` to detect any database-level tampering.

---

## 6. Backup & Disaster Recovery (DR)

### Recovery Objectives
- **Recovery Point Objective (RPO):** < 15 minutes.
- **Recovery Time Objective (RTO):** < 2 hours.

### Backup Strategy
1. **Automated Continuous Backups (PITR):** Supabase Enterprise Point-in-Time Recovery enabled for up to 30 days retention.
2. **Daily Logical Dumps:** Automated cronjob executing `pg_dump` with encryption stored in an immutable off-site S3 bucket:
   ```bash
   pg_dump -h <db-host> -U postgres -d postgres -F c -b -v -f madarx_backup_$(date +%Y%m%d_%H%M%S).dump
   ```
3. **Storage Bucket Replication:** Document vault files replicated cross-region with versioning enabled.

### Database Recovery Drill
1. Provision target recovery instance.
2. Restore backup snapshot:
   ```bash
   pg_restore -h <restore-host> -U postgres -d postgres -v madarx_backup_file.dump
   ```
3. Run verification test suite against restore instance.
4. Repoint application connection strings.

---

## 7. Incident Response & Rollback Runbook

### Incident Classification
- **P0 (Critical):** Service unavailable, data corruption risk, payroll calculation failure, or active security breach. Response SLA: < 15 mins.
- **P1 (High):** Major operational module degraded (attendance punches failing, notification delivery halted). Response SLA: < 1 hour.
- **P2 (Medium):** Non-blocking feature issue with available workaround. Response SLA: < 4 hours.

### Application Rollback
If a newly deployed worker release exhibits critical runtime anomalies:
1. Revert to the prior deployment tag in Cloudflare / deployment platform:
   ```bash
   npx wrangler rollback [deployment-id]
   ```
2. Database Schema: Because all migrations are strictly non-destructive and backward-compatible, rolling back application code does not require schema rollbacks.
