# MADARX ENTERPRISE WORKFORCE PLATFORM — AI GOVERNANCE & SECURITY CHARTER (`v1.0.0-enterprise`)

## 1. AI Permitted Uses (Assistive Only)
MadarX Enterprise AI is strictly **assistive and non-authoritative**. Permitted capabilities:
- Searching permitted HR information and policy documents with verifiable citations.
- Explaining HR policies, statutory rules, and factual system states (leave rejections, payroll readiness blockers, attendance exceptions, salary band positioning, onboarding blockers, pending approvals).
- Summarizing permitted employee, team, attendance, leave, and payroll data within the authenticated user's scope.
- Assisting users in navigating MadarX modules and preparing governed reports.
- Preparing draft HR action proposals that require explicit human confirmation and standard workflow execution.

## 2. Prohibited Authoritative Decisions
AI is strictly prohibited from autonomously executing or deciding:
- Hiring, probation pass/fail, or termination decisions.
- Disciplinary findings, warnings, or penalties.
- Salary changes, bonus awards, loan approvals, or payroll finalization.
- Direct database mutations bypassing workflow approvals or RBAC.
- Granting roles, altering permissions, or accessing cross-tenant data.

## 3. Human Approval Requirements & Action Boundaries
- For sensitive operational actions (`leave_request`, `employee_movement`, `salary_change`, `disciplinary_action`, `payroll_action`, `termination`, `approval`), `prepareGovernedAIHrAction` in `src/lib/ai/tools/registry.ts` only prepares an unexecuted draft (`status: "PREPARED_DRAFT_REQUIRES_HUMAN_APPROVAL"`, `bypassAllowed: false`, `executedDirectly: false`).
- Any attempt to invoke a direct bypass throws `AI_DIRECT_MUTATION_FORBIDDEN`.
- Final execution must pass through standard MadarX validation, central Workflow approval, server-side RBAC, atomic RPC mutation, and immutable audit logging.

## 4. Data Access Boundaries & Context Security
All AI data retrieval passes through `authorizeGovernedAIToolAccess` (`src/lib/ai/tools/registry.ts`) and governed tools (`getMyProfile`, `getMyLeaveBalance`, `getMyAttendanceSummary`, `getTeamSummary`, `getEmployeeSummary`, `getPayrollSummary`, `searchPolicies`, `getOpenTasks`, `getReportsMetadata`):
- **Tenant Scope:** `actorCompanyId === targetCompanyId` is mandatory; cross-tenant access returns `CROSS_TENANT_DENIED`.
- **Self Scope:** `employee` role can only query `actorEmployeeId === targetEmployeeId` (`SELF_SCOPE_VIOLATION` otherwise).
- **Manager Hierarchy Scope:** `line_manager` can only query self or direct reports in `directReportEmployeeIds` (`MANAGER_HIERARCHY_VIOLATION` otherwise).
- **Role Scope:** Every tool validates `isUserAuthorizedForTool(role, toolName)` server-side.

## 5. Privacy Rules & Highly Sensitive Domains
- `minimizeEmployeePII` strips national IDs/Iqamas, IBANs, and raw salary figures before external model context construction.
- Field-level sensitivity rules strictly gate:
  - `salary` & `bank_details`: restricted to authorized payroll/finance/HR roles (or self for basic salary slip).
  - `identity_documents` & `medical_information`: restricted to authorized HR/admin roles.
  - `disciplinary_cases`: restricted to `super_admin`, `hr_manager`, `auditor`.
  - `talent_ratings` & `succession`: restricted to `super_admin`, `hr_manager`, `performance_lead`, `auditor`.
  - `survey_anonymity`: permanently blocked (`ANONYMOUS_SURVEY_PROTECTED`) for all roles so individual survey responses can never be de-anonymized.
  - `government_credentials`: permanently blocked (`GOVERNMENT_CREDENTIAL_ACCESS_FORBIDDEN`) for all roles.

## 6. Logging & Safe AI Audit
- `createGovernedAIAuditRecord` records `userId`, `companyId`, `toolName`, `entityType`, `timestamp`, and `resultStatus` (`authorized_success | blocked_unauthorized | failed_safe`) with `confidentialContentLogged: false`.
- Confidential response bodies, salaries, and PII are never written to AI telemetry logs.

## 7. Failure Behavior & Platform Availability Independence
- `executeAIWithSafeFallback` wraps AI provider calls so timeouts, quota exhaustion, or provider outages return `{ aiAvailable: false, hrmsOperational: true }` with bilingual user-safe messages.
- Core HRMS, Attendance, Leave, Workflow, and Payroll modules have zero availability dependency on the AI service.

## 8. Prompt Injection Defense
- User prompts are screened by `detectAndSanitizePrompt` (`src/lib/domains/ai/index.ts`) against SQL injection, jailbreak, and prompt-extraction patterns.
- Untrusted record content (`uploaded_document`, `employee_note`, `policy_text`, `external_content`) is sanitized by `sanitizeUntrustedContentForAI` (`src/lib/ai/tools/registry.ts`), redacting adversarial directives (`[UNTRUSTED_DIRECTIVE_REDACTED]`) and enforcing `canOverrideSystemRules: false`.
