import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260901153000_complete_organization_structure.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();
const businessSchema = readFileSync(
  new URL("../../supabase/migrations/20260831115000_business_schema.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("organization database migration", () => {
  it.each(["cost_centers", "job_positions"])("creates and secures %s", (table) => {
    expect(migration).toContain(`create table if not exists public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
    expect(migration).toContain(`public.current_user_is_hr()`);
  });

  it("connects the organization hierarchy and employee positions with foreign keys", () => {
    expect(businessSchema).toContain("parent_id uuid references public.departments");
    expect(migration).toContain("cost_center_id uuid references public.cost_centers");
    expect(migration).toContain("job_position_id uuid references public.job_positions");
  });

  it("prevents cyclic department trees", () => {
    expect(migration).toContain("function public.prevent_department_cycle()");
    expect(migration).toContain("departments_prevent_cycle");
  });

  it("denies anonymous table access", () => {
    expect(migration).toContain(
      "revoke all on public.cost_centers, public.job_positions from anon",
    );
  });
});
