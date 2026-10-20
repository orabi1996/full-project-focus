# MadarX Enterprise Platform — Disaster Recovery & Business Continuity Runbook (`DISASTER_RECOVERY_RUNBOOK.md`)

**Release:** `v1.0.0-enterprise-rc`  
**Scope:** Multi-Tenant Database, Storage Buckets, Payroll/Statutory Ledgers, and AI Governance Logs

---

## 1. Recovery Objectives (RPO / RTO)

| Tier | Component | Target RPO | Target RTO | Mechanism |
|---|---|---|---|---|
| **Tier 0 — Critical Financial & Identity** | PostgreSQL (`employees`, `payroll_runs`, `payroll_items`, `country_pack_versions`, `audit_logs`, `user_roles`) | **< 5 minutes** | **< 30 minutes** | Supabase Point-in-Time Recovery (PITR) + Daily Logical Snapshots |
| **Tier 1 — Core Operations** | Leave, Attendance, Workflows, Contracts, Compensation, Employee Relations | **< 15 minutes** | **< 1 hour** | PITR + Idempotent Migration Chain Replay |
| **Tier 2 — Document Vault** | Private Supabase Storage Buckets (`employee-documents`, `company-documents`, `payroll-exports`) | **< 1 hour** | **< 2 hours** | Cross-zone object replication & metadata checksum verification |
| **Tier 3 — AI Copilot & Telemetry** | `ai_conversations`, `ai_messages`, `ai_tool_calls`, `ai_usage` | **< 1 hour** | **< 2 hours** | Graceful offline fallback (`executeAIWithSafeFallback`) keeps HRMS 100% operational during AI outage |

---

## 2. Backup Procedures

### 2.1 Automated Database Backups
1. Enable **Point-in-Time Recovery (PITR)** on the production Supabase PostgreSQL instance.
2. Schedule daily encrypted logical dumps (`pg_dump --format=custom --no-owner --no-acl`) to an immutable off-site backup bucket with 35-day retention.
3. Verify backup integrity weekly by restoring the latest snapshot into an isolated staging verification instance.

### 2.2 Schema & Migration Reproducibility
- All 66 database migrations in `supabase/migrations/` are strictly chronological, idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS`), and non-destructive.

---

## 3. Incident Response & Recovery Playbooks

### Scenario A: AI Provider Outage or Latency Spike
1. **Automatic Protection:** `executeAIWithSafeFallback` automatically traps provider timeouts and switches to safe fallback mode while keeping all deterministic HRMS/Payroll operations 100% online.
2. **Manual Kill Switch:** Tenant administrators or DevOps can immediately disable external LLM invocation via `ai_feature_flags` (`external_llm_allowed = false` or `copilot_enabled = false`).

### Scenario B: Accidental Configuration or Statutory Pack Change
1. Inspect `country_pack_compliance_logs` and `audit_logs` to identify the exact `version_code` and actor timestamp.
2. Use the Country Pack Version Lifecycle engine to restore the prior `published` effective-dated legislation version without altering historical finalized `payroll_run_country_snapshots`.

### Scenario C: Full Database Point-in-Time Restore
1. Put the frontend into maintenance notice mode.
2. Trigger Supabase PITR restore to the exact pre-incident timestamp.
3. Run post-restore verification checks:
   - Verify RLS enabled on all public tables.
   - Verify finalized payroll runs match immutable snapshots (`payroll_run_country_snapshots`).
   - Run smoke tests (`npm test`) and reopen traffic.
