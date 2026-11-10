# Implementation tracking

This checklist tracks verified implementation work, not a production-readiness certification.

| Area | Completed work | Remaining acceptance criteria |
| --- | --- | --- |
| Build and CI | Reproducible npm install; typecheck, unit/contracts, coverage, browser checks and build workflow | Keep checks passing for each release |
| Employee directory | Loading/error states, retry, compatibility RPCs, scoped field projection | Role-based profile, import, document and export integration tests |
| Dashboard | Nested response contracts, scoped summary and recorded attendance trend | Authoritative attendance denominator; tenant-linked payroll totals; verified integration health |
| Role administration | Restrictive direct-write guards on user role assignment, role definitions and permission mappings | Audit every SECURITY DEFINER function and service-role entry point |
| Core tenant boundaries | Company-scope guards on employees, companies, departments, subsidiaries and work locations; protected self-service fields | Test full onboarding/transfer workflows with distinct tenants |
| Operational tables | Restrictive delegation/overtime/file metadata guards | Storage-object ownership, signed URL authorization and domain-specific approval flows |
| Performance tenant boundaries | Guards on direct and parent-linked performance tables | Within-company role visibility, anonymous reviews and cross-linked entity consistency |
| Other data domains | Pending | Map ownership for tables without company_id; scope documents, workforce planning and financial domains |
| Payroll and attendance | Pending | Validate detail-to-run linkage, company ownership, schedules, approval and idempotent posting |
| Scheduled work | Checked operational database errors; conditional queue claim; unknown-job rejection and accurate failure reports; removed direct-balance fallback from manual accrual | Atomic leave accrual and dead-letter transitions; safe retry and abandoned-job recovery; live worker integration tests |
| Deployment and recovery | Pending | Verify runtime target, database migration parity, restore drill and rollback procedure |
| Release acceptance | Pending | Real authenticated multi-role/multi-tenant end-to-end tests, regression checks and operational sign-off |

Do not infer that a green demo UI test validates live database integration. A restrictive policy intersects existing permissive policies; it does not replace a complete row/column/storage authorization review.

## Accrual database compatibility

`20261110040000_serialize_leave_accrual.sql` adds missing leave ownership/tracking columns and ledger/run tables, restricts direct writes, and serializes the accrual RPC on the company row. It uses existing core tenant authorization helpers. PGlite tests start with a legacy schema and cover replay, rollback after injected ledger/run errors, authorization and period validation. TypeScript and targeted lint pass. Multi-session PostgreSQL contention has not been tested.

The compatibility migration was applied and its function availability and direct-write restrictions verified. No accrual operation was executed. Scheduled accrual now routes each company through the transactional RPC and reports its resolved period and explicit replay flag. Deployment must include the updated RPC response before publishing the caller. Automatic queue retry remains disabled pending worker recovery and concurrency acceptance. Explicit leave policies and company timezone configuration remain prerequisites for operating accrual; no policy data was invented or seeded.
