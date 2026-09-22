# Lovable database compatibility recovery

## Evidence received on 2026-09-22

The user exported catalog results from the Lovable Cloud SQL Editor. These are
observations of that database, not confirmation of a successful migration replay.
The published hrtest.fun browser bundle was separately observed to use project
`rzsybirgoxwrxsnnowvx`. Direct Supabase dashboard access was unavailable to the user.

- Core recruitment, employee and organization tables exist.
- `create_employee`, `generate_company_employee_no`,
  `current_user_can_manage_company` and `convert_candidate_to_employee` are absent.
- `employee_status` contains active, on_leave, suspended and terminated; draft is absent.
- Employee contract_type, gender and marital_status are text columns. Several
  fields expected by the repository creation function, including work_type and
  salary allowances, are absent. Do not cast existing contract values blindly;
  the exported contract default is `indefinite`.
- `profiles` and `user_roles` have no company_id. An authoritative user/company
  relationship cannot be inferred by choosing the first company.
- RLS is enabled on all ten inspected tables. No noninternal triggers were returned
  for those tables by the supplied catalog query.
- Employee UPDATE policy permits HR or the linked user, and the authenticated role
  has table-wide UPDATE privileges. The inspected policy does not constrain salary,
  company or ownership columns. The private helper definitions remain uninspected.
- HR checks in policies use `private_sec.current_user_is_hr`, not the public
  helper names searched earlier. Role mutation policies also depend on this helper.

## Staged recovery

1. Run `supabase/manual-recovery/01_prepare_employee_draft_status.sql` in the
   existing Lovable Cloud SQL Editor. This adds only the missing enum label and
   commits it separately. Existing rows, active defaults, grants and policies remain
   unchanged. It can be rerun. This does not enable conversion on its own.
2. Run `supabase/manual-recovery/02_inspect_private_authorization.sql` and export
   its result. This obtains actual authorization helper definitions and aggregate
   organization/role information without exporting personal records.
3. Use those definitions to design the compatibility and authorization update.
   Do not create a SECURITY DEFINER conversion with assumed role or company scope.
   Self-editable employee company fields are not a trusted tenant authority.
4. Validate the recovery against the exported legacy schema, then apply prerequisite
   changes and atomic conversion in the target database. Verify runtime behavior with
   authenticated roles. A successful repository CI run alone does not verify this DB.

These scripts deliberately live outside `supabase/migrations`: they are an explicit
recovery sequence for an observed legacy database, not an instruction to mark earlier
repository migrations as applied. Do not replay all historical migrations blindly,
rewrite their published history, or redirect the app to the unrelated Supabase project.

Current status: scripts prepared; execution on the live database is awaiting the
user's SQL Editor results. The complete compatibility/security update is not deployed.
