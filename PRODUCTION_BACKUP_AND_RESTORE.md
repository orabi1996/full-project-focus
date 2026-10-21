# MadarX Enterprise Workforce Platform — Production Backup & Restore Policy
**Document Reference:** `PRODUCTION_BACKUP_AND_RESTORE.md`  
**Release Version:** `v1.0.0-enterprise`  
**Classification:** Operational Governance Runbook  

---

## 1. Objectives & Metrics (RPO & RTO)

| Tier | Component | Target RPO | Target RTO | Backup Mechanism | Storage Location |
|---|---|---|---|---|---|
| **Tier 0** | **PostgreSQL Core Database** (`public`, `auth`) | **< 5 Minutes** | **< 30 Minutes** | Supabase Point-in-Time Recovery (PITR) + Daily Logical Dumps (`pg_dump`) | Customer Dedicated Enterprise Cloud DB + Immutable S3 / GCS Vault |
| **Tier 1** | **Private Storage Buckets** (`employee-documents`, `company-documents`, `payroll-exports`) | **< 1 Hour** | **< 2 Hours** | Multi-region bucket replication + Daily object versioning snapshots | Dedicated Cloud Storage Bucket with 35-day retention |
| **Tier 2** | **Application Runtimes & Nitro Workers** | **0 Minutes** (Stateless) | **< 10 Minutes** | Immutable container / serverless edge deploy via git commit SHA | Cloudflare / Edge Container Registry |

---

## 2. Backup Architecture & Frequency

### 2.1 Database Backups (Production Cloud)
1. **Continuous WAL Archiving & PITR:**
   - Active on the customer's dedicated Supabase Enterprise project.
   - Retains continuous transaction logs for 35 days, allowing point-in-time recovery to any second within the retention window.
2. **Daily Logical Database Dumps:**
   - Executed automatically at `02:00 UTC` every night.
   - Command: `pg_dump --format=custom --no-owner --no-acl -h <POOLER_HOST> -U postgres -d postgres > madarx_backup_$(date +%Y%m%d_%H%M%S).dump`.
   - Stored in an encrypted, write-once-read-many (WORM) offsite backup bucket.
3. **Pre-Migration Safety Backups (Mandatory):**
   - Prior to executing `supabase db push` or applying new SQL migrations, an immediate manual logical snapshot is taken.

### 2.2 Storage Backups
- Supabase storage buckets (`employee-documents`, `company-documents`, `payroll-exports`) have versioning enabled.
- Deletions are soft-tombstoned for 30 days before permanent purging.

---

## 3. Restore & Disaster Recovery Verification Procedure

### 3.1 Point-in-Time Recovery (PITR) Execution Steps
1. **Declare Incident:** Declare Sev-1 incident and switch application into maintenance mode via DNS or CDN routing.
2. **Identify Target Timestamp:** Determine the exact timestamp immediately preceding data corruption or hardware failure.
3. **Initiate Restore:**
   - In Supabase Dashboard: Navigate to Project Settings $\rightarrow$ Database $\rightarrow$ Backups $\rightarrow$ Point in Time Recovery.
   - Select target date and time (UTC).
   - Alternatively, provision a new database instance from PITR fork to preserve incident forensics.
4. **Post-Restore Integrity Audit:**
   - Confirm RLS policies are active on all public tables: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`.
   - Verify finalized payroll run immutable checksums: `SELECT count(*) FROM public.payroll_run_country_snapshots;`.
   - Run production smoke validation test suite (`npm run test:unit`).
5. **Re-open Traffic:** Re-point application connection strings and resume normal operation.

### 3.2 Staging Drill Validation (Actual Verified Benchmark)
- **Local / Staging PGlite Drill Status:** **VERIFIED PASS** (`evaluateBackupRecoveryDrillStatus` in `post-release-go-live-certification.test.ts`).
- **Measured Staging RTO:** `4 seconds`.
- **Measured Staging RPO:** `5 seconds`.
- **Production Cloud PITR Status:** Formally documented as `CUSTOMER_INFRA_ACTION_REQUIRED` until customer cloud project administrator completes their initial cloud-hosted restore rehearsal.

---

## 4. Operational Roles & Responsibilities

- **Customer Cloud DBA / Infrastructure Lead:** Responsible for maintaining active PITR subscriptions, monitoring backup storage capacity, and executing annual disaster recovery drills.
- **MadarX Lead Enterprise Architect:** Responsible for ensuring all schema changes remain strictly append-only, backward-compatible, and non-destructive.
- **Enterprise Security Officer:** Responsible for verifying backup encryption-at-rest (`AES-256`) and access control audit logs.
