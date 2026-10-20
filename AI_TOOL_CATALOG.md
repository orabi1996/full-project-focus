# MadarX Enterprise AI — Governed Tool Catalog (`AI_TOOL_CATALOG.md`)

**Release:** `v1.0.0-enterprise-rc`  
**Architecture:** Strict Server-Authoritative Tool Registry (`src/lib/ai/tools/registry.ts`)  
**Direct SQL Policy:** Forbidden (`usesRawSql = false` across all tools)

---

## 1. Tool Classification & Execution Rules

Every tool registered in `GOVERNED_AI_TOOLS` is classified into one of three operational tiers:

1. **READ Tools (`isMutation: false, requiresConfirmation: false`)**
   - Read-only queries scoped strictly by `actorCompanyId` (tenant), `actorRole` (RBAC), and `actorEmployeeId` / `directReportEmployeeIds` (hierarchy scope).
2. **DRAFT Tools (`isMutation: false, requiresConfirmation: true`)**
   - Generates structured drafts (job descriptions, HR letters, performance goals, leave drafts) without committing database mutations or overwriting master records.
3. **ACTION Tools (`isMutation: true, requiresConfirmation: true`)**
   - Renders an explicit **Action Confirmation Card** (`AWAITING_HUMAN_CONFIRMATION`) requiring a human click and a unique `idempotencyKey` before invoking `execute_ai_tool_action_atomic`.

---

## 2. Canonical Tool Inventory

| Tool Name | Tier | Domain Module | Authorized Roles | Confirmation Required | Description |
|---|---|---|---|---|---|
| `get_employee_summary` | READ | `employees` | `super_admin`, `hr_manager`, `line_manager`, `employee`, `auditor` | No | Retrieves employee profile summary within self/direct-report/HR scope |
| `search_employees` | READ | `employees` | `super_admin`, `hr_manager`, `line_manager`, `auditor` | No | Permission-filtered employee directory search with pagination |
| `get_leave_balance` | READ | `leaves` | `super_admin`, `hr_manager`, `line_manager`, `employee`, `auditor` | No | Retrieves authoritative leave ledger balances |
| `get_pending_approvals` | READ | `workflow` | `super_admin`, `hr_manager`, `line_manager`, `payroll_officer`, `finance_officer`, `auditor` | No | Lists pending workflow approval items for the current actor |
| `get_payroll_summary` | READ | `payroll` | `super_admin`, `hr_manager`, `payroll_officer`, `finance_officer`, `auditor` | No | Summarizes payroll run totals and variance for authorized roles |
| `get_attendance_summary` | READ | `attendance` | `super_admin`, `hr_manager`, `attendance_officer`, `line_manager`, `employee`, `auditor` | No | Summarizes attendance compliance, late arrivals, and overtime |
| `get_learning_status` | READ | `learning` | `super_admin`, `hr_manager`, `line_manager`, `employee`, `auditor` | No | Retrieves assigned courses and completion progress |
| `get_expiring_certifications` | READ | `learning` | `super_admin`, `hr_manager`, `line_manager`, `auditor` | No | Lists employee certifications expiring within threshold days |
| `get_open_cases` | READ | `employee_relations` | `super_admin`, `hr_manager`, `auditor` | No | Summarizes open Employee Relations cases for authorized HR roles |
| `get_workforce_metrics` | READ | `reports` | `super_admin`, `hr_manager`, `finance_officer`, `auditor` | No | Retrieves governed executive workforce and localization KPIs |
| `run_governed_report` | READ | `reports` | `super_admin`, `hr_manager`, `payroll_officer`, `finance_officer`, `line_manager`, `auditor` | No | Maps natural language intent to governed `REPORT_CATALOG` definitions |
| `draft_job_description` | DRAFT | `organization` | `super_admin`, `hr_manager`, `recruiter`, `line_manager` | Yes | Generates bilingual job description and interview rubric drafts |
| `draft_hr_letter` | DRAFT | `documents` | `super_admin`, `hr_manager`, `line_manager` | Yes | Generates unapproved HR letter drafts requiring human signature |
| `draft_employee_movement` | ACTION | `movements` | `super_admin`, `hr_manager`, `line_manager` | Yes | Prepares a draft transfer/movement request awaiting human confirmation |
| `tasks.create` | ACTION | `tasks` | `super_admin`, `hr_manager`, `line_manager` | Yes | Creates a governed operational task after explicit user confirmation |
| `notifications.send_reminder` | ACTION | `notifications` | `super_admin`, `hr_manager`, `line_manager` | Yes | Dispatches an approval/compliance reminder after explicit confirmation |

---

## 3. Sensitive Domain Redaction Matrix

The tool authorization guard (`authorizeGovernedAIToolAccess`) enforces strict field-level privacy across 9 sensitive domains:

- `salary`: Restricted to `super_admin`, `hr_manager`, `payroll_officer`, `finance_officer`, `auditor`, or self.
- `bank_details`: Restricted to `super_admin`, `payroll_officer`, `finance_officer`.
- `identity_documents`: Restricted to `super_admin`, `hr_manager`, `auditor`, or self.
- `medical_information`: Restricted to `super_admin`, `hr_manager`.
- `disciplinary_cases`: Restricted to `super_admin`, `hr_manager`, `auditor`.
- `talent_ratings` & `succession`: Restricted to `super_admin`, `hr_manager`, `performance_lead`, `auditor`.
- `survey_anonymity`: **Never** exposed individually to any role (`ANONYMOUS_SURVEY_PROTECTED`).
- `government_credentials`: **Never** exposed to AI under any role (`GOVERNMENT_CREDENTIAL_ACCESS_FORBIDDEN`).
