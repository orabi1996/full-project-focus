import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const run = {
  id: id(10),
  payroll_group_id: null,
  period_year: 2026,
  period_month: 9,
  total_employer_gosi: 0,
};
const detail = {
  employee_id: id(2),
  basic_salary: 2000,
  housing_allowance: 0,
  transport_allowance: 0,
  other_allowances: 0,
  overtime_hours: 0,
  overtime_amount: 0,
  bonus_amount: 0,
  unpaid_leave_deduction: 0,
  absence_late_deduction: 0,
  loan_deduction: 350,
  gosi_employee_deduction: 0,
  other_deductions: 0,
  gross_salary: 2000,
  total_deductions: 350,
  net_salary: 1650,
  working_days: 30,
  absent_days: 0,
};
const allocations = [
  { loan_id: id(3), employee_id: id(2), amount: 300 },
  { loan_id: id(4), employee_id: id(2), amount: 50 },
];
let db: PGlite;
const save = (details = [detail], planned = allocations, header = run) =>
  db.query("select save_payroll_run_atomic($1,$2,$3) as id", [
    JSON.stringify(header),
    JSON.stringify(details),
    JSON.stringify(planned),
  ]);
const lock = () => db.query("select set_payroll_run_status_atomic($1,'locked')", [run.id]);
const prepare = () => db.query("select prepare_payroll_payments_atomic($1)", [run.id]);
const confirm = (reference = "BANK-001") =>
  db.query<{ result: { alreadyConfirmed: boolean } }>(
    "select confirm_payroll_payment_atomic($1,$2,$3) as result",
    [run.id, id(5), reference],
  );
const balances = () =>
  db.query(
    "select remaining_balance::float as balance,paid_installments,status from loans order by id",
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(new URL("./fixtures/payroll-db.sql", import.meta.url), "utf8"));
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260908120000_atomic_payroll_confirmation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "RESET ROLE; TRUNCATE payroll_runs,loans,employees,company_bank_accounts CASCADE; SET test.app_role='finance_officer';",
  );
  await db.query("insert into employees values ($1,'SA0380000000608010167519','Bank')", [id(2)]);
  await db.query(
    "insert into loans(id,employee_id,monthly_installment,remaining_balance) values ($1,$3,300,900),($2,$3,200,50)",
    [id(3), id(4), id(2)],
  );
  await db.query("insert into company_bank_accounts(id,current_balance) values ($1,10000)", [
    id(5),
  ]);
  await db.exec("SET ROLE authenticated");
});

describe("real PostgreSQL payroll transactions", () => {
  it("records each loan's own capped installment exactly once on duplicate confirmation", async () => {
    await save();
    await lock();
    await prepare();
    await confirm();
    const repeated = await confirm();
    expect(repeated.rows[0].result.alreadyConfirmed).toBe(true);
    expect((await balances()).rows).toEqual([
      { balance: 600, paid_installments: 1, status: "active" },
      { balance: 0, paid_installments: 1, status: "closed" },
    ]);
    expect(
      (await db.query("select current_balance::float as balance from company_bank_accounts")).rows,
    ).toEqual([{ balance: 8350 }]);
    expect((await db.query("select reference,sent_at from payroll_payments")).rows).toEqual([
      { reference: "BANK-001", sent_at: null },
    ]);
    await expect(confirm("OTHER")).rejects.toThrow("سبق تأكيد");
  });
  it("rolls back all changes if a later loan changed after calculation", async () => {
    await save();
    await lock();
    await prepare();
    await db.query("update loans set remaining_balance=10 where id=$1", [id(4)]);
    await expect(confirm()).rejects.toThrow("تغير رصيد");
    expect((await balances()).rows[0]).toEqual({
      balance: 900,
      paid_installments: 0,
      status: "active",
    });
    expect(
      (await db.query("select current_balance::float as balance from company_bank_accounts"))
        .rows[0],
    ).toEqual({ balance: 10000 });
    expect((await db.query("select status from payroll_runs")).rows[0]).toEqual({
      status: "locked",
    });
    expect((await db.query("select status from payroll_payments")).rows[0]).toEqual({
      status: "pending",
    });
  });
  it("preserves the previous draft if recalculation fails", async () => {
    await save();
    await expect(save([{ ...detail, employee_id: id(99) }])).rejects.toThrow();
    expect((await db.query("select net_salary::float as net from payroll_details")).rows).toEqual([
      { net: 1650 },
    ]);
    expect(
      (await db.query("select count(*)::int as count from payroll_loan_allocations")).rows[0],
    ).toEqual({ count: 2 });
  });
  it("rejects missing snapshots, unprepared payments and insufficient balances", async () => {
    await expect(save([detail], [])).rejects.toThrow("أقساط");
    await save();
    await lock();
    await expect(confirm()).rejects.toThrow("اكتمال");
    await prepare();
    await db.exec("update company_bank_accounts set current_balance=10");
    await expect(confirm()).rejects.toThrow("الرصيد");
  });
  it("requires locking and prevents preparing or recalculating paid runs", async () => {
    await save();
    await expect(prepare()).rejects.toThrow("اعتمد");
    await lock();
    await prepare();
    await confirm();
    await expect(prepare()).rejects.toThrow("اعتمد");
    await expect(save()).rejects.toThrow("مقفل");
    await expect(
      db.query("select set_payroll_run_status_atomic($1,'draft')", [run.id]),
    ).rejects.toThrow();
  });
  it("isolates runs by group and rejects overlapping employees for the same month", async () => {
    await save();
    await expect(
      save([detail], allocations, { ...run, id: id(11), payroll_group_id: id(12) as never }),
    ).rejects.toThrow("مسيّر آخر");
    expect((await db.query("select count(*)::int as count from payroll_runs")).rows[0]).toEqual({
      count: 1,
    });
  });
  it("rejects employees at the RPC boundary and restricts confirmation to finance", async () => {
    await db.exec("SET test.app_role='employee'");
    await expect(save()).rejects.toThrow("غير مصرح");
    await expect(confirm()).rejects.toThrow("للمسؤول المالي");
    await db.exec("SET test.app_role='payroll_officer'");
    await save();
    await lock();
    await prepare();
    await expect(confirm()).rejects.toThrow("للمسؤول المالي");
  });
  it("rejects a reused bank reference without recovering installments or debiting again", async () => {
    await save();
    await lock();
    await prepare();
    await confirm();
    await db.query("insert into employees values ($1,'SA0380000000608010167519','Bank')", [id(6)]);
    await save([{ ...detail, employee_id: id(6), loan_deduction: 0 }], [], {
      ...run,
      id: id(11),
      period_month: 10,
    });
    await db.query("select set_payroll_run_status_atomic($1,'locked')", [id(11)]);
    await db.query("select prepare_payroll_payments_atomic($1)", [id(11)]);
    await expect(
      db.query("select confirm_payroll_payment_atomic($1,$2,'BANK-001')", [id(11), id(5)]),
    ).rejects.toThrow();
    expect(
      (await db.query("select current_balance::float as balance from company_bank_accounts")).rows,
    ).toEqual([{ balance: 8350 }]);
  });
});
