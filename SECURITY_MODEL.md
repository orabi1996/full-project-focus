# MADARX ENTERPRISE WORKFORCE PLATFORM
# SECURITY MODEL & COMPLIANCE SPECIFICATION

## 1. Authentication & Identity Management
- **Enterprise MFA:** TOTP-based Multi-Factor Authentication with backup recovery codes.
- **Session Tokens:** Server-side JWT validation signed via asymmetric keys with tenant metadata (`company_id`, `role`, `user_id`).
- **Account Protection:** Brute-force rate limiting, automatic temporary lockout after 5 failed attempts, password complexity enforcement.

## 2. Authorization & RBAC Architecture
- **Role Hierarchy:** Ten distinct enterprise roles (`super_admin`, `hr_manager`, `payroll_officer`, `attendance_officer`, `line_manager`, `recruiter`, `finance_officer`, `performance_lead`, `employee`, `auditor`).
- **Auditor Invariant:** The `auditor` role is strictly read-only across all system modules (`moduleManageAccess` never includes `auditor`).
- **Field-Level Security:** Highly sensitive fields (basic salary, total compensation, bank IBAN, national identification number, confidential employee relations investigation transcripts) are guarded at the projection layer and stripped from unauthorized access.

## 3. Multi-Tenant Isolation & Row-Level Security (RLS)
- Every relational table enforces active Row-Level Security in PostgreSQL.
- Isolation predicate: `company_id = auth.jwt() -> 'app_metadata' ->> 'company_id'`.
- Zero cross-tenant data leakage: Foreign key relationships and stored procedures strictly validate tenant ownership prior to mutation or query execution.

## 4. AI Security & Prompt Injection Defenses
- **Adversarial Interception:** All incoming user prompts pass through `detectAndSanitizePrompt()` to intercept SQL injection (`DROP TABLE`, `DELETE FROM`, `UNION SELECT`), jailbreaks (`ignore previous instructions`), and secret extraction attempts.
- **PII Scrubbing:** Outgoing payloads to external LLM providers pass through `minimizeEmployeePII()`, eliminating personal national IDs, bank numbers, and unrequested compensation metrics.
- **Mutation Confirmation Gates:** Autonomous AI writes are strictly prohibited. Operations such as task creation, notification broadcast, leave request creation, or workflow triggers require explicit human confirmation.
