# MadarX Enterprise Workforce Platform — Post-Go-Live 30-Day Operational Plan
**Document Reference:** `POST_GO_LIVE_30_DAY_PLAN.md`  
**Release Version:** `v1.0.0-enterprise`  
**Target Window:** Days 0 to 30 of Production Operations  

---

## 1. Operational Phases & Monitoring Cadence

```mermaid
flowchart LR
    D0["Day 0: Go-Live Cutover"] --> H24["First 24 Hours: Hypercare"]
    H24 --> D7["First 7 Days: Stabilization"]
    D7 --> D30["Days 8–30: Full Operational Run"]
```

---

## 2. Phase-by-Phase Execution Plan

### 2.1 Day 0 — Cutover & Production Deployment
- **Pre-Cutover Checklist:**
  - Verify append-only migration chain (`supabase db push`).
  - Verify environment variables in production server (zero secrets in frontend).
  - Execute idempotent tenant bootstrap: `bootstrap_enterprise_tenant`.
  - Confirm System Owner, Tenant Admin, and HR Admin role assignments.
- **Go-Live Validation:**
  - Execute read-only smoke probe across all 18 core domains.
  - Verify storage bucket access controls and private document security.
  - Verify health endpoint returns healthy status.

### 2.2 First 24 Hours — Immediate Hypercare
- **Active Monitoring Focus:**
  - **Login & Authentication:** Monitor failed login rates and MFA lockouts; triage user onboarding difficulties.
  - **Error Spikes:** Monitor Sentry / application logs for uncaught exceptions or edge worker timeouts.
  - **Database Connection Pool:** Track PgBouncer active connections and query transaction latencies.
  - **Critical User Inquiries:** Dedicated technical war room active for HR administrators and managers.

### 2.3 First 7 Days — Operational Stabilization
- **Key Checkpoints:**
  - **Attendance Ingestion:** Verify daily biometric clock-ins, shift roster assignment, and attendance exception generation.
  - **Workflow Progression:** Audit approval queues across leave requests, expense claims, and onboarding tasks to ensure no stuck instances.
  - **In-App Notifications:** Verify timely delivery of workflow alerts and task assignments.
  - **Dead-Letter Queue (DLQ):** Inspect `public.outbox_events` and background jobs for retry exhaustion or dead letters.

### 2.4 Days 8 to 30 — Monthly Payroll Cycle & Full Operational Run
- **Key Milestones:**
  - **Mid-Month Payroll Dry Run (Day 15):** Execute pre-payroll validation probe; verify absence deductions, approved overtime, and loan installments.
  - **Final Payroll Execution (Day 25–28):** Run official monthly payroll; verify gross-to-net calculations, statutory deductions (GOSI, NOSI, ETA, GRSIA, SPF, SIO), and End-of-Service accruals.
  - **WPS File Generation:** Export and validate Wage Protection System electronic files (Mudad, SIF, bank transfer registers).
  - **Finalized Run Closure:** Lock monthly payroll run and confirm immutable snapshot creation in `payroll_run_country_snapshots`.
  - **30-Day Technical Review:** Review system latency, database growth rates, and close hypercare phase.

---

## 3. Metric Alert Thresholds & Escalation Matrix

| Monitoring Dimension | Primary Metric | Warning Threshold | Critical Alert (Sev-1) | Action Required |
|---|---|:---:|:---:|---|
| **Authentication** | Failed Login Rate | $> 5\%$ of attempts | $> 15\%$ of attempts | Check IdP / Supabase Auth status; investigate IP brute force. |
| **API & RPC Health** | HTTP `5xx` / RPC Errors | $> 0.5\%$ | $> 2.0\%$ | Inspect server error logs; verify connection pool limits. |
| **Database Performance** | P95 Query Latency | $> 250\text{ ms}$ | $> 1,000\text{ ms}$ | Analyze slow queries in `pg_stat_statements`; optimize query plan. |
| **Attendance Processing** | Unmatched Clock-Ins | $> 2\%$ | $> 5\%$ | Review biometric device sync agent logs; verify employee badge mappings. |
| **Workflow Engine** | Stalled Tasks ($> 72\text{h}$) | $> 10$ tasks | $> 50$ tasks | Trigger workflow manager escalation; notify approval leads. |
| **Payroll Processing** | Calculation Variance | $> 0$ discrepancies | Any failure | Halt run; inspect calculation inputs; re-verify against attendance/leave. |
| **Security & Privacy** | RLS Denied Probes | $> 0$ cross-tenant | Any incident | Immediate security isolation; review JWT token claims and audit log. |
| **Integration Connectors**| Unhandled Connector Errors| $> 0$ unhandled | Any crash | Ensure connector operates in fail-closed mode (`WAITING_FOR_CREDENTIALS`). |

---

## 4. Operational Sign-Off & Review Cadence
- **Daily Standup:** Days 1–7 (Deployment Lead, HR Operations, Infrastructure Lead).
- **Weekly Review:** Days 14, 21, 28 (Enterprise Architect, Security Lead, Payroll Director).
- **Transition to Business-as-Usual (BAU):** Day 30 post-go-live.
