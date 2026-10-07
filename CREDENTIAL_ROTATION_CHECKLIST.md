# MadarX Enterprise — Owner Credential Rotation Checklist & Security Runbook

**Document Version:** 1.0.0-core  
**Target Release:** `v1.0.0-core` (Current: `v1.0.0-rc.core`)  
**Security Classification:** Highly Confidential / Owner-Action Only  
**Compliance Mandate:** ISO 27001 A.9.4.3 / Saudi NCA Essential Cybersecurity Controls (ECC-1:2018)  

---

## 1. Executive Summary & Policy Statement

Prior git commits in early repository history (notably during prototype testing in Prompts 13.4/13.5) contained test credentials and references to backend service tokens. While all live application code in the current HEAD has been scrubbed and verified 100% clean, historical git commits must be treated as untrusted.

In accordance with enterprise secret management standards, **MadarX Core v1 cannot receive final production release tag `v1.0.0-core` until the system owner completes and confirms rotation and revocation of all affected credentials**.

Until all `CRITICAL_ROTATE_NOW` entries are completed, the release remains tagged as **`v1.0.0-rc.core`**.

---

## 2. Master Credential Inventory & Classification

| # | Provider / Service | Credential Type | Environment Variable | Classification | Rotation Required |
| :- | :--- | :--- | :--- | :---: | :---: |
| 1 | **Supabase Auth** | JWT Signing Secret | *Internal to Supabase* | `CRITICAL_ROTATE_NOW` | **YES** |
| 2 | **Supabase Cloud** | Server Secret / Admin Key | `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) | `CRITICAL_ROTATE_NOW` | **YES** |
| 3 | **PostgreSQL (Supabase)** | Database Superuser Password | `DATABASE_URL` / `POSTGRES_PASSWORD` | `CRITICAL_ROTATE_NOW` | **YES** |
| 4 | **Supabase Auth** | Test User Account Passwords | `SUPABASE_TEST_*_PASSWORD` | `CRITICAL_ROTATE_NOW` | **YES** |
| 5 | **Supabase API** | Modern Publishable Browser Key | `VITE_SUPABASE_PUBLISHABLE_KEY` | `ROTATE_RECOMMENDED` | **YES** (Rotated with JWT) |
| 6 | **Webhook Gateway** | Ingress HMAC Signature Secret | `WEBHOOK_SIGNING_SECRET` | `ROTATE_RECOMMENDED` | **YES** (If pre-configured) |
| 7 | **Supabase API Gateway**| Supabase Project Endpoint URL | `VITE_SUPABASE_URL` | `PUBLIC_NON_SECRET` | **NO** |
| 8 | **Local Demo Store** | In-Memory Dummy Test Passwords | *N/A (Client Memory Only)* | `NOT_APPLICABLE` | **NO** |

---

## 3. Step-by-Step Owner Rotation Instructions

### Item 1: Supabase JWT Secret Rotation (Invalidates All Prior Tokens)
- **Provider:** Supabase Cloud
- **Credential Type:** JWT Signing Secret (HMAC-SHA256)
- **Environment Variable:** *Internal to Supabase Auth Engine*
- **Where Owner Rotates It:**
  1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select the MadarX project.
  2. Navigate to **Project Settings** (gear icon) -> **API**.
  3. Scroll down to **JWT Settings**.
  4. Click **Generate a new JWT secret** (or click **Rotate JWT secret**).
  5. Select **Revoke existing tokens** upon rotation.
- **Where MadarX Receives New Value:**
  - Rotating the JWT secret automatically regenerates both the modern `publishable` key and the `secret` key in the Supabase console.
- **Revocation of Old Credential:** **YES** (Automatic upon rotation; all existing JWTs become immediately invalid).
- **Verification Method:** Attempting to query the API using old JWT tokens returns `HTTP 401 Unauthorized`.

---

### Item 2: Supabase Server Secret Key (Modern: sb_secret_*)
- **Provider:** Supabase Cloud
- **Credential Type:** High-Privilege Admin API Secret (Bypasses RLS)
- **Environment Variable:** `SUPABASE_SECRET_KEY` (legacy fallback: `SUPABASE_SERVICE_ROLE_KEY`)
- **Where Owner Rotates It:**
  1. In Supabase Dashboard -> **Project Settings** -> **API**.
  2. Copy the newly generated `secret` key (`sb_secret_*` format) produced by the JWT rotation.
- **Where MadarX Receives New Value:**
  - Store exclusively in the production secure server environment (e.g., Cloudflare Secrets, server environment settings, or backend worker vaults) under `SUPABASE_SECRET_KEY`.
  - **CRITICAL:** NEVER place this variable into frontend `.env` files or client build configurations.
- **Revocation of Old Credential:** **YES** (Old secret / service-role key is revoked when JWT secret is rotated).
- **Verification Method:** Run server maintenance script with new key; old key fails authentication.

---

### Item 3: PostgreSQL Database Superuser Password
- **Provider:** Supabase PostgreSQL Database
- **Credential Type:** Database Master Password
- **Environment Variable:** `DATABASE_URL` / `POSTGRES_PASSWORD`
- **Where Owner Rotates It:**
  1. In Supabase Dashboard -> **Project Settings** -> **Database**.
  2. Scroll to **Database password**.
  3. Click **Reset database password**.
  4. Generate a strong, high-entropy password (minimum 24 characters).
- **Where MadarX Receives New Value:**
  - Update direct connection strings in database migration tools, Supabase CLI (`supabase link`), and CI/CD database runners.
- **Revocation of Old Credential:** **YES** (Old password is immediately superseded by Postgres engine).
- **Verification Method:** Connect via `psql` or `supabase db ping` with new password; old password connection rejected.

---

### Item 4: Test Authentication User Accounts & Session Revocation
- **Provider:** Supabase Auth (Users Table)
- **Credential Type:** User Passwords & Active Auth Sessions
- **Affected Accounts:** Test identities used in earlier test executions (`hr_a`, `hr_b`, `employee_a`, `manager_a`).
- **Where Owner Rotates It:**
  1. In Supabase Dashboard -> **Authentication** -> **Users**.
  2. Locate any test accounts that were created during development.
  3. Action Option A: Delete test users if not needed in production.
  4. Action Option B: For any user retained for production, click **...** -> **Send password reset** or manually update password.
  5. Click **Revoke all active sessions** for each user to terminate open refresh tokens.
- **Session Revocation Required:** **YES**.
- **Verification Method:** Login requires the updated credentials; old sessions are logged out.

---

### Item 5: Supabase Publishable / Anon Browser Key
- **Provider:** Supabase API Gateway
- **Credential Type:** Public Client API Key (Restricted by Row Level Security)
- **Environment Variable:** `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Where Owner Rotates It:**
  1. In Supabase Dashboard -> **Project Settings** -> **API**.
  2. Copy the newly generated `anon` / `publishable` public key (starts with `sb_publishable_` or standard anon JWT).
- **Where MadarX Receives New Value:**
  - In Cloudflare Pages / Vercel / Production Web Hosting Dashboard:
    - Update environment variable: `VITE_SUPABASE_PUBLISHABLE_KEY=<new-key>`.
    - Trigger production deployment / rebuild.
- **Revocation of Old Credential:** **YES** (Handled automatically when JWT secret is rotated).
- **Verification Method:** Open application homepage in browser; verify public queries load correctly under RLS without 401 errors.

---

### Item 6: Webhook Ingress HMAC Signing Secret (If Configured)
- **Provider:** MadarX Integration Gateway
- **Credential Type:** HMAC SHA-256 Shared Secret
- **Environment Variable:** `WEBHOOK_SIGNING_SECRET`
- **Where Owner Rotates It:**
  1. Generate new 32-byte cryptographic random secret.
  2. Update in production server environment settings.
  3. Provide secret to authorized external webhook senders (e.g., Qiwa, ERP).
- **Revocation of Old Credential:** **YES**.
- **Verification Method:** Test webhook with new signature returns `200 OK`; unsigned or old signature returns `401 Unauthorized`.

---

## 4. Post-Rotation Safe Verification Command

MadarX includes an automated post-rotation verification script that validates all gateways without printing secrets:

```bash
# Execute post-rotation verification
npm run verify:rotation
```

This verification procedure:
1. Validates presence and formatting of required production variables.
2. Performs SSL/TLS handshake with Supabase Auth API endpoint.
3. Tests database REST gateway responsiveness under Row Level Security.
4. Tests Supabase Storage bucket gateway.
5. Runs the production-readiness regression test suite.

---

## 5. Production Release Tag Policy

```
+--------------------------------------------------------------------+
|                      CURRENT RELEASE STATE                         |
|                       v1.0.0-rc.core                               |
|                (Release Candidate - Certified Code)                |
+--------------------------------------------------------------------+
                                  |
                                  | Owner completes rotation of:
                                  |  - Supabase JWT Secret
                                  |  - Database Password
                                  |  - Test User Passwords
                                  |  - All Active Sessions Revoked
                                  v
+--------------------------------------------------------------------+
|                    FINAL PRODUCTION RELEASE TAG                    |
|                        v1.0.0-core                                 |
|            (Approved for live production enterprise traffic)        |
+--------------------------------------------------------------------+
```

> [!CAUTION]
> **DO NOT CREATE `v1.0.0-core` TAG** until the system owner confirms completion of all items in Section 3 of this document. Until confirmation, the official release tag remains `v1.0.0-rc.core`.
