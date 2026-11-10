# Implementation tracking

This checklist tracks verified implementation work, not a production-readiness certification.

| Area | Completed work | Remaining acceptance criteria |
| --- | --- | --- |
| Build and CI | Reproducible npm install; typecheck, unit/contracts, coverage, browser checks and build workflow | Keep checks passing for each release |
| Employee directory | Loading/error states, retry, compatibility RPCs, scoped field projection | Role-based profile, import, document and export integration tests |
| Dashboard | Nested response contracts, scoped summary and recorded attendance trend | Authoritative attendance denominator; tenant-linked payroll totals; verified integration health |
| Role administration | Restrictive direct-write guards | Audit every SECURITY DEFINER function and service-role entry point |
| Core tenant boundaries | Company-scope guards on employees, companies, departments, subsidiaries and work locations; protected self-service fields | Test full onboarding/transfer workflows with distinct tenants |
| Operational tables | Restrictive delegation/overtime/file metadata guards | Storage-object ownership, signed URL authorization and domain-specific approval flows |
| Performance tenant boundaries | Guards on direct and parent-linked performance tables | Within-company role visibility, anonymous reviews and cross-linked entity consistency |
| Other data domains | Pending | Map ownership for tables without company_id; scope documents, workforce planning and financial domains |
| Payroll and attendance | Pending | Validate detail-to-run linkage, company ownership, schedules, approval and idempotent posting |
| Scheduled work | Checked operational database errors; conditional queue claim; unknown-job rejection and accurate failure reports | Atomic leave accrual and dead-letter transitions; safe retry and abandoned-job recovery; live worker integration tests |
| Deployment and recovery | Pending | Verify runtime target, database migration parity, restore drill and rollback procedure |
| Release acceptance | Pending | Real authenticated multi-role/multi-tenant end-to-end tests, regression checks and operational sign-off |

Do not infer that a green demo UI test validates live database integration. A restrictive policy intersects existing permissive policies; it does not replace a complete row/column/storage authorization review.
