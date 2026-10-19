# MADARX ENTERPRISE WORKFORCE PLATFORM — FINAL GO-LIVE CERTIFICATE (`v1.0.0-enterprise`)

- **Product:** MadarX — Enterprise Workforce Platform
- **Repository:** `orabi1996/full-project-focus`
- **Release Tag:** `v1.0.0-enterprise`
- **P0 Blockers:** `0`
- **P1 Blockers:** `0`
- **Legacy Supabase API Key Dependency Remaining:** `NO`
- **Client Bundle Secret Exposure:** `NO`
- **Core Go-Live Ready (`MADARX_CORE_GO_LIVE_READY`):** `YES`
- **Final Verdict:** `APPROVED_FOR_CORE_PRODUCTION_GO_LIVE`

---

## 1. Go-Live Classification Tiers

| Tier | Classification | Status |
| :--- | :--- | :--- |
| **Tier A** | **SOFTWARE READY** | `YES` (`100% Certified`) |
| **Tier B** | **PRODUCTION ENVIRONMENT READY** | `YES` (`Contract Verified — VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_URL + SUPABASE_SECRET_KEY`) |
| **Tier C** | **OPTIONAL EXTERNAL INTEGRATIONS READY** | `CUSTOMER_CREDENTIAL_REQUIRED` (`SANDBOX_READY` adapters; non-blocking for Core Go-Live) |

---

## 2. Customer Infrastructure Actions (At Cloud Cutover)
1. Inject `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ENABLE_DEMO_MODE=false` (client build) and `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (trusted server secret manager).
2. Run `supabase db push` against the production Supabase project using the 70 committed append-only migrations.
3. Execute `SELECT public.bootstrap_enterprise_tenant(...)` with the customer's legal entity and initial `super_admin` user ID.
4. Enable Supabase Point-in-Time Recovery (PITR) on the production database (`CUSTOMER_INFRA_ACTION_REQUIRED`).

---

## 3. Optional Customer Integration Actions (Post-Go-Live, Per Country)
Provide establishment credentials/certificates in the server secret vault only for the specific government authorities (`GOSI`, `MUDAD`, `QIWA`, `MUQEEM`, `NOSI`, `ETA`, `GRSIA`, `MADLSA`, `SPF`, `CBO`, `SIO`, `LMRA`) the customer wishes to switch from `official_file_export` (`SIF`/`CSV`) to direct B2G API submission.
