# MadarX Enterprise Workforce Platform — Production Rollback & Forward-Fix Policy
**Document Reference:** `PRODUCTION_ROLLBACK_PLAN.md`  
**Release Version:** `v1.0.0-enterprise`  
**Classification:** Operational Governance Runbook  

---

## 1. Decision Criteria & Incident Triage

Rollback or forward-fix procedures are triggered when a production deployment encounters any of the following Sev-0 or Sev-1 conditions:

- **Data Integrity Violation:** Unauthorized cross-tenant data visibility, broken Row-Level Security, or corrupt financial calculations.
- **Service Unavailability:** HTTP `5xx` error rates exceeding $1.0\%$ across critical endpoints for $> 5$ minutes.
- **Catastrophic Core Failure:** Inability to run payroll, clock in attendance, submit leave requests, or complete employee onboarding.
- **Security Breach:** Detected unauthorized privilege escalation or leaked service credentials.

---

## 2. Component Rollback Strategies

### 2.1 Application Runtime Rollback (Stateless Edge / Nitro SSR)
- **Mechanism:** Git commit redeployment via automated CI/CD pipeline or Cloudflare Worker instantaneous deployment re-pointer.
- **Procedure:**
  1. If release `v1.0.0-enterprise` displays frontend regression, trigger redeployment of previous verified tag in CI/CD console.
  2. Rollback execution time: $< 2$ minutes.
  3. Clear CDN edge caches immediately.
  4. Notify operations team via Slack/Teams incident channel.

### 2.2 Database Migration Failures & Non-Destructive Policy
- **Absolute Rule:** **NEVER execute destructive database rollbacks (`DROP TABLE`, `DROP COLUMN`) on a production database.** Published migrations in MadarX are strictly append-only and immutable.
- **Rollback vs Forward-Fix Strategy:**
  1. **Pre-Deployment Failure (during `supabase db push --dry-run`):** The deployment script automatically aborts before applying any change. Zero production impact.
  2. **Migration Failure Mid-Execution:** PostgreSQL transactions wrap DDL operations. If an atomic migration script fails, the transaction rolls back cleanly to the pre-script state.
  3. **Post-Deployment Functional Regression (Forward-Fix):**
     - If a bug is detected in a stored procedure, view, or RLS policy: Create an immediate append-only hotfix migration (e.g., `CREATE OR REPLACE FUNCTION ...` or `ALTER POLICY ...`) and deploy via `supabase db push`.
     - Forward-fix ensures historical records, audit logs, and existing transactions are never corrupted by destructive rollback scripts.

### 2.3 Configuration Rollback
- If environment variable changes cause connection failures (e.g., misconfigured SMTP or invalid webhook secret):
  1. Revert environment variable in server dashboard to previous verified value.
  2. Restart server runtime containers / edge workers ($< 60$ seconds).
  3. Verify health probe (`/api/health`).

### 2.4 Immediate Feature Disabling (Kill Switches)
If an isolated subsystem exhibits unexpected behavior, administrators can selectively disable that subsystem without redeploying the application:
- **AI Copilot Kill Switch:** Set `copilot_enabled = false` in `public.ai_feature_flags` to instantly disable all AI features while keeping the core HRMS 100% operational.
- **External Integration Kill Switch:** Switch connector status from `connected` to `disabled` in `public.external_integrations` or `public.government_connector_configs` to fail-closed safely.
- **Demo Mode Enforcement:** Ensure `VITE_ENABLE_DEMO_MODE = false` is locked in production environment configurations.

---

## 3. Incident Post-Mortem & Review

Following any rollback or forward-fix activation:
1. Conduct root cause analysis (RCA) within 24 hours.
2. Document failure timeline, affected tenant counts, and automated alert response times.
3. Add regression tests covering the defect scenario into the automated Vitest suite before re-attempting release deployment.
