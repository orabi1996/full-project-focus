# MadarX — Enterprise Workforce Platform
## Release Notes — Core v1 (`v1.0.0-core`)

**Baseline Commit:** `282fe08`  
**Certification Phase:** Prompt 26 (Production Readiness, Security Hardening, UAT & Go-Live Certification)  
**Status:** Certified Release Candidate (`v1.0.0-rc.core`) — Pending Owner Credential Rotation  

---

### 1. Executive Summary

MadarX Enterprise Workforce Platform Core v1 represents the culmination of 26 rigorous development, architecture, security, and integration phases. Built for modern enterprise operations in Saudi Arabia and the GCC, MadarX integrates human capital management, statutory compliance, multi-tenant organizational structure, dynamic workflow automation, and self-service experiences into a unified, secure web and mobile platform.

This release certifies the completion and closure of the **Core Roadmap (Prompts 1–26)**.

---

### 2. Core Functional Modules Inventory (Prompts 1–25)

| Module | Core Capabilities | Security & Architectural Controls |
| :--- | :--- | :--- |
| **Authentication & Sessions** | Email/Password, Magic Link, TOTP Multi-Factor Authentication (MFA), Session Keepalive, Inactivity Timeout. | Real Supabase Auth, PKCE flow, Secure Session storage, zero client bypass. |
| **RBAC & Permissions** | Multi-role matrix (`super_admin`, `company_admin`, `hr_manager`, `payroll_specialist`, `line_manager`, `employee`), granular permission policies. | Role-guarded route trees, server-side RPC enforcement, RLS query scoping. |
| **Organization Structure** | Multi-company / Subsidiary hierarchy, Departments, Cost Centers, Job Families, Position Management. | Strong multi-tenant data isolation (`company_id` enforcement), cascading integrity. |
| **Employee Master Directory** | 360° Employee records, Saudi/Non-Saudi profiles, National ID/Iqama validation, contract & job history. | Sensitive data masking, server-side directory projection, elimination of mock fallbacks. |
| **Time & Attendance** | Real-time punch clock, Geofence GPS verification, Biometric sync readiness, Attendance exception rules. | Server-side punch verification RPCs, tamper-evident logs, time-zone standardization (`Asia/Riyadh`). |
| **Leaves & Time Off** | Balance accruals, Saudi Labor Law statutory leave types (Hajj, Umrah, Bereavement, Sick tiers), workflow requests. | Automated balance recalculations, overlap rejection, document-mandatory triggers. |
| **Shifts & Rosters** | Dynamic shift templates, rotational rosters, overnight shifts, split-shifts, schedule conflict detection. | Roster conflict validation, shift swapping with manager approval workflows. |
| **Workflows & Approvals** | Multi-level approval chains, conditional routing, auto-delegation, SLA timeouts, audit logging. | Server-side execution engine, state machine integrity, anti-tampering guards. |
| **Payroll & Compensation** | Full payroll batch engine, WPS SIF generation, Saudi GOSI calculation, loan deduction, retro adjustments. | Server-side execution, immutable locked batches, zero client-side money fabrication. |
| **Loans & Advances** | Salary advance policies, multi-installment personal loans, automated payroll deduction sync. | Loan balance tracking, approval thresholds, ledger entry generation. |
| **End of Service (EOSB)** | Saudi Labor Law Article 84/85 calculations, resignation vs termination scaling, final settlement processing. | Authoritative server-side settlement calculations, clearance workflows. |
| **Expenses & Claims** | Multi-currency claims, receipt attachment vault, expense categories, mileage, per diem rules. | Pre-flight receipt metadata registration, dual-approval chains. |
| **Performance & 360** | Appraisal cycles, KPI/OKR tracking, 360-degree feedback reviews, rating calibration. | Reviewer anonymity controls, cycle deadline enforcement, historical archives. |
| **Workforce Planning** | Headcount budgeting, vacancy forecasting, attrition tracking, salary cost modeling. | Read-only aggregation projections, executive permission restrictions. |
| **Recruitment & ATS** | Job requisitions, career portal integration, candidate pipeline stages, interview scheduling, offer generation. | One-click candidate-to-employee onboarding conversion, resume storage isolation. |
| **Enterprise Asset Tracking**| Hardware, vehicles, credentials custody tracking, assignment and return handover logs. | Handover digital sign-off, asset depreciation records, condition logging. |
| **Document Vault** | Corporate policies, employee legal documents, expiration alert engine, secure storage integration. | Metadata-first upload protocol, bucket path isolation, orphan file auto-cleanup. |
| **Reporting & Analytics** | Interactive executive dashboards, statutory labor compliance reports, CSV/Excel/PDF exports. | Server-side query projection, pagination, sensitive column masking in exports. |
| **Integration Hub** | Government connector readiness (Qiwa, GOSI, Muqeem, Mudad), Webhook gateway, API keys. | HMAC signature validation, rate limiting, connection health diagnostics. |
| **Notifications & SLA Engine**| Enterprise notification inbox, delivery retries, operational task center, SLA countdown timers, escalations. | Server-side outbox queue, dead-letter monitoring, in-app real-time subscription. |
| **Audit & Observability** | Tamper-evident hash-chained audit trail, sensitive action tracking, system background job observability. | SHA-256 hash chaining, immutable append-only logs, IP/user-agent capture. |
| **Employee Self-Service (ESS)**| Mobile-first responsive portal, punch-in, leave/expense/loan requests, payslip downloads, profile updates. | Strictly derived from authenticated session, zero client employee-ID substitution. |
| **Manager Self-Service (MSS)**| Team attendance monitoring, pending approvals queue, shift roster visibility, team performance reviews. | Direct-report server-side filtering, delegation support. |

---

### 3. Key Architectural & Security Milestones

1. **Authenticated Context Integrity:** Completely eliminated arbitrary `employees[0]` or mock fallback identities across all self-service, layout, and operational views. All employee data is derived strictly from the authenticated Supabase user ID.
2. **Database Function Security:** All Postgres functions in production migrations are hardened with `SECURITY DEFINER` and explicit `SET search_path = public` to mitigate search-path hijacking attacks.
3. **Environment Startup Gate:** Strict pre-flight validator (`validateEnvironment` / `assertProductionReadiness`) enforces HTTPS URLs, public-only publishable client keys, and disables demo mode in production.
4. **Resilient Offline & Testing Suite:** Integrated 54 test suites (938 passing tests) using PGlite in-memory PostgreSQL, providing 100% deterministic local validation of migrations, business logic, and security contracts.
5. **Universal RTL/LTR & Accessibility:** Native bidirectional Arabic (RTL) and English (LTR) typography, mobile safe-area spacing, and responsive design across desktop, tablet, and mobile browsers.

---

### 4. Core v1 Scope Boundaries & Expansion Roadmap

With the completion of Prompt 26, the **Core Platform** is frozen and certified. Future roadmap initiatives (post Core v1) are designated as **Expansion Modules**:
- **Expansion 1:** Advanced Onboarding Journeys & Automated 90-Day Probation Workflows.
- **Expansion 2:** Internal Talent Mobility & Cross-Departmental Movements.
- **Expansion 3:** Learning Management System (LMS) & Competency Skill Gap Mapping.
- **Expansion 4:** Succession Planning & High-Potential (HiPo) Talent Matrix.
- **Expansion 5:** Employee Engagement Pulse Surveys & eNPS Analytics.
- **Expansion 6:** Employee Relations, Disciplinary Hearings & Case Management.
- **Expansion 7:** Regional GCC Country Localization Packs (UAE, Qatar, Kuwait, Bahrain, Oman).
