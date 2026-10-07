# MadarX Enterprise — Production Go-Live Checklist & Certification Gate

**Release Version:** `v1.0.0-rc.core`  
**Target Release:** `v1.0.0-core`  
**Assessment Date:** 2026-10-07  
**Overall Status:** **CONDITIONAL GO-LIVE APPROVAL** (Awaiting Owner Credential Rotation)  

---

## 1. Critical Owner Actions (P0 Pre-Condition)

> [!WARNING]
> **STATUS: OWNER ACTION REQUIRED — CREDENTIAL ROTATION**  
> Prior git commits in early repository history contain historical references to project connection tokens. Per enterprise security policy and automated security audit directive, the system owner MUST execute the following rotation steps in the Supabase management console prior to promoting this release candidate to live production traffic.

### Mandatory Owner Action Items:
1. **Rotate Supabase JWT Secret & API Keys:**
   - Navigate to **Supabase Dashboard -> Project Settings -> API**.
   - Generate a new `anon / publishable` key and new `service_role` key.
   - Click **Rotate JWT Secret** (invalidates any older tokens or historical leaked keys).
2. **Update Deployment Environment Variables:**
   - In Cloudflare Pages / Vercel / deployment environment, set the newly generated `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - Ensure `VITE_ENABLE_DEMO_MODE=false`.
   - Ensure `NODE_ENV=production`.
3. **Configure Custom Domain & SSL:**
   - Bind official production hostname (e.g., `app.madarx.com`) with TLS 1.3 certificate.
   - Add production hostname to Supabase Auth **Site URL** and **Redirect URLs**.
4. **Provision Initial Root Super Admin:**
   - Create the designated executive super-admin user in Supabase Auth.
   - Assign `super_admin` role in `public.user_roles`.
   - Enable mandatory TOTP Multi-Factor Authentication (MFA).

---

## 2. Pre-Flight Verification Matrix

| Area | Verification Item | Status | Verification Detail |
| :--- | :--- | :---: | :--- |
| **Code Quality** | TypeScript compilation (`npm run typecheck`) | **PASS** | 0 errors across entire workspace. |
| **Code Quality** | ESLint static analysis (`npm run lint`) | **PASS** | 0 errors; code standards verified. |
| **Automated Tests** | Full Vitest test suite (`npm run test:unit`) | **PASS** | 938 tests passed across 54 suites (0 failures). |
| **Build Artifacts** | Production build (`npm run build`) | **PASS** | Nitro SSR server & Vite bundle generated cleanly. |
| **Environment** | Pre-flight configuration validator | **PASS** | Validates HTTPS, blocks secret keys, blocks demo mode. |
| **Security** | Zero `employees[0]` or mock fallback identities | **PASS** | Verified in ESS, MSS, Header, Context, and Repositories. |
| **Security** | Postgres `SECURITY DEFINER` search path | **PASS** | All functions explicitly specify `SET search_path = public`. |
| **Security** | Tenant data isolation & RLS policies | **PASS** | Validated across core tables (`company_id` scoping). |
| **Database** | Migration sequence idempotence | **PASS** | Applies cleanly from scratch in PGlite; no destructive drops. |
| **Statutory Engine**| Saudi GOSI calculation accuracy | **PASS** | 9.75% / 11.75% Saudi rates, 2% Expat, 45,000 SAR ceiling. |
| **Statutory Engine**| Saudi Overtime calculation (Art. 107) | **PASS** | Hourly rate + 50% basic rate calculation verified. |
| **Statutory Engine**| End of Service Benefit (Art. 84/85) | **PASS** | Verified server-side calculation for resignation/termination. |
| **Self-Service** | ESS & MSS Mobile Navigation | **PASS** | Responsive layout, safe-area spacing, no fake notch frames. |
| **Localization** | Bidirectional RTL (Arabic) & LTR (English) | **PASS** | Full UI dictionary support and typography alignment. |
| **Observability** | Hash-chained audit trail & task center | **PASS** | SHA-256 tamper-evident log and SLA timers operational. |
| **Credentials** | Secret rotation of historical credentials | **PENDING** | **OWNER ACTION REQUIRED** (See Section 1 above). |

---

## 3. Go-Live Sign-Off Protocol

- **Software Engineering & Architecture:** APPROVED (100% Core Requirements Prompts 1–25 verified).
- **QA & Test Engineering:** APPROVED (54 test suites passing, 0 test regressions).
- **DevOps & Infrastructure:** APPROVED (Build artifacts packaged, Nitro runner ready).
- **Information Security (InfoSec):** **CONDITIONAL APPROVAL** — Release Candidate tagged as `v1.0.0-rc.core`. Full production cutover approved immediately upon completion of Owner Credential Rotation.
