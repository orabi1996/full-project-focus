# Candidate → employee: atomic conversion

Implemented in migration `20260922010000_atomic_candidate_conversion.sql`.

The recruitment screen calls one RPC. The database locks the candidate, resolves
the company from the persisted job opening's department, checks employee creation
authority, then creates a draft, records the candidate/employee link and changes
the candidate stage in one transaction. Employee numbering and creation audit
also roll back on failure. The existing financial permission gate remains active.

Retries return the linked employee ID. A protected ledger has one row per candidate
and a unique employee ID; ordinary authenticated table writes cannot forge links.
Direct transitions to `hired` require a link. Converted candidates cannot be moved
back or assigned to another opening. Employee/candidate deletion is restricted while
the link exists; use employee lifecycle actions instead.

Names are explicitly confirmed. No English names, identity details, subsidiary,
start date or salary are inferred from placeholder data or another candidate's offer.
Nonfinancial users create a draft with zero salary, matching the existing employee
creation contract; the screen explains that financial completion is still required.

## Release requirements

- Apply the migration to the target Supabase database before using the new UI.
  This repository update does not itself prove the live migration was applied.
- Candidates must have an opening with a department whose company is known.
  Records without that tenant association are rejected, never assigned to the
  operator's company by default.
- Conversion requires employee creation authority. Recruitment visibility alone
  does not grant that authority; salary input additionally requires financial authority.
- Previously hired candidates without a link require manual reconciliation.
  Existing orphan drafts from earlier partial failures also need review before
  retrying those legacy candidates. No speculative historical backfill is performed.
- The transaction prevents duplicates for the same candidate record, not duplicate
  applications representing the same person. Applicant identity deduplication is a
  separate business rule.

## Verification

`npm run test:unit` includes embedded PostgreSQL (PGlite) tests loading the actual
employee creation and conversion migrations against isolated prerequisite fixtures.
They exercise rollback after an injected final-stage failure, protected ledger
access, tenant and financial rejection, draft truthfulness and idempotent retries.
Frontend tests check validation and demo conversion without partial publication.
The embedded database tests do not substitute for a full Supabase migration replay
or multi-connection concurrency test in staging.
