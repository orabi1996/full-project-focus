-- Restore the atomic payroll snapshot API for the current production tables.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS exit_date date;
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS calculation_basis text;
ALTER TABLE public.payroll_details
  ADD COLUMN IF NOT EXISTS gosi_employer numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS gosi_employee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deductions numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absence_deductions numeric NOT NULL DEFAULT 0;

-- Historical runs can be assigned only when all their employees share one company.
UPDATE public.payroll_runs r SET company_id = x.company_id
FROM (SELECT d.payroll_run_id, min(e.company_id::text)::uuid company_id
  FROM public.payroll_details d JOIN public.employees e ON e.id=d.employee_id
  GROUP BY d.payroll_run_id HAVING count(DISTINCT e.company_id)=1 AND count(*)=count(e.company_id)) x
WHERE r.id=x.payroll_run_id AND r.company_id IS NULL;

CREATE TABLE IF NOT EXISTS public.payroll_loan_allocations (
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  amount numeric(12,2) NOT NULL CHECK(amount>0),
  recovered_at timestamptz,
  PRIMARY KEY(payroll_run_id,loan_id)
);
ALTER TABLE public.payroll_loan_allocations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private_sec.can_manage_payroll_company(p_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND public.can_access_core_company(p_company)
 AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid()
   AND role::text=ANY(ARRAY['super_admin','org_admin','hr_manager','payroll_officer','finance_officer']))
$$;
REVOKE ALL ON FUNCTION private_sec.can_manage_payroll_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private_sec.can_manage_payroll_company(uuid) TO authenticated;

-- Definer API below verifies both role and company before touching payroll data.
CREATE OR REPLACE FUNCTION public.save_payroll_run_atomic(p_run jsonb,p_details jsonb,p_allocations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_company uuid := (p_run->>'company_id')::uuid;
 v_group uuid := (p_run->>'payroll_group_id')::uuid;
 v_year int := (p_run->>'period_year')::int;
 v_month int := (p_run->>'period_month')::int;
 v_end date := (p_run->>'period_end')::date;
 v_existing public.payroll_runs%ROWTYPE;
 v_id uuid;
 v_detail jsonb;
 v_loan jsonb;
 v_replace boolean := coalesce((p_run->>'replace_all')::boolean,false);
BEGIN
 IF NOT coalesce(private_sec.can_manage_payroll_company(v_company),false) THEN
   RAISE EXCEPTION 'غير مصرح بإدارة رواتب هذه المنشأة' USING ERRCODE='42501';
 END IF;
 IF v_year IS NULL OR v_year NOT BETWEEN 2000 AND 2100 OR v_month IS NULL OR v_month NOT BETWEEN 1 AND 12
 OR v_end IS NULL OR v_end<make_date(v_year,v_month,1)
 OR v_end >= (make_date(v_year,v_month,1)+interval '1 month')::date
 OR coalesce(p_run->>'calculation_basis','') NOT IN ('fixed_30_days','calendar_days')
 OR jsonb_typeof(p_details) IS DISTINCT FROM 'array' OR jsonb_array_length(p_details)=0
 OR jsonb_typeof(p_allocations) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'مدخلات المسير غير صالحة';
 END IF;
 IF v_group IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_groups WHERE id=v_group) THEN
   RAISE EXCEPTION 'مجموعة الرواتب غير موجودة';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll:'||v_company||':'||v_year||':'||v_month,0));
 IF (SELECT count(*) FROM payroll_runs WHERE company_id=v_company AND period_year=v_year AND period_month=v_month
     AND payroll_group_id IS NOT DISTINCT FROM v_group)>1 THEN
   RAISE EXCEPTION 'توجد مسيرات مكررة؛ يجب مراجعتها قبل الاحتساب';
 END IF;
 SELECT * INTO v_existing FROM payroll_runs WHERE company_id=v_company AND period_year=v_year AND period_month=v_month
   AND payroll_group_id IS NOT DISTINCT FROM v_group FOR UPDATE;
 IF FOUND THEN
   IF v_existing.status<>'draft' THEN RAISE EXCEPTION 'المسير مقفل أو معتمد ولا يمكن إعادة احتسابه'; END IF;
   IF EXISTS(SELECT 1 FROM payroll_payments WHERE payroll_run_id=v_existing.id AND status<>'pending') THEN
     RAISE EXCEPTION 'تم تجهيز أو إرسال دفعات للمسير؛ راجع الدفعات أولًا';
   END IF;
   IF EXISTS(SELECT 1 FROM payroll_loan_allocations WHERE payroll_run_id=v_existing.id AND recovered_at IS NOT NULL) THEN
     RAISE EXCEPTION 'توجد أقساط مستردة بالفعل';
   END IF;
   IF NOT v_replace AND (v_existing.period_end IS DISTINCT FROM v_end OR
        v_existing.calculation_basis IS DISTINCT FROM p_run->>'calculation_basis') THEN
     RAISE EXCEPTION 'يجب إعادة احتساب المسير كاملًا عند تغيير الفترة أو سياسة الحساب';
   END IF;
   v_id:=v_existing.id;
   DELETE FROM payroll_payments WHERE payroll_run_id=v_id;
   DELETE FROM payroll_loan_allocations WHERE payroll_run_id=v_id AND (v_replace OR employee_id IN
     (SELECT (value->>'employee_id')::uuid FROM jsonb_array_elements(p_details)));
   DELETE FROM payroll_details WHERE payroll_run_id=v_id AND (v_replace OR employee_id IN
     (SELECT (value->>'employee_id')::uuid FROM jsonb_array_elements(p_details)));
 ELSE
   v_id := (p_run->>'id')::uuid;
   INSERT INTO payroll_runs(id,company_id,payroll_group_id,period_year,period_month,status)
     VALUES(v_id,v_company,v_group,v_year,v_month,'draft');
 END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_details)) <>
    (SELECT count(DISTINCT value->>'employee_id') FROM jsonb_array_elements(p_details)) THEN
   RAISE EXCEPTION 'الموظف مكرر في مدخلات المسير';
 END IF;
 FOR v_detail IN SELECT value FROM jsonb_array_elements(p_details) LOOP
   IF NOT EXISTS(SELECT 1 FROM employees WHERE id=(v_detail->>'employee_id')::uuid AND company_id=v_company
      AND (v_group IS NULL OR payroll_group_id=v_group)) THEN
     RAISE EXCEPTION 'الموظف خارج نطاق المنشأة أو المجموعة' USING ERRCODE='42501';
   END IF;
   IF EXISTS(SELECT 1 FROM payroll_details d JOIN payroll_runs r ON r.id=d.payroll_run_id
      WHERE r.period_year=v_year AND r.period_month=v_month AND r.id<>v_id
      AND d.employee_id=(v_detail->>'employee_id')::uuid) THEN
     RAISE EXCEPTION 'الموظف موجود في مسير آخر لنفس الشهر';
   END IF;
   IF EXISTS(SELECT 1 FROM jsonb_each_text(v_detail) WHERE key IN
     ('basic_salary','housing_allowance','transport_allowance','other_allowances','overtime_amount','overtime_hours',
      'gross_salary','net_salary','total_deductions','gosi_employee_deduction','gosi_employer','loan_deduction',
      'absence_late_deduction','unpaid_leave_deduction','other_deductions','bonus_amount','working_days','absent_days')
     AND (value IS NULL OR value::numeric<0 OR value IN ('NaN','Infinity','-Infinity'))) THEN
     RAISE EXCEPTION 'قيم راتب غير صالحة';
   END IF;
   IF (v_detail->>'net_salary')::numeric IS NULL OR (v_detail->>'gross_salary')::numeric IS NULL OR
      (v_detail->>'total_deductions')::numeric IS NULL OR
      round((v_detail->>'gross_salary')::numeric-(v_detail->>'total_deductions')::numeric,2)
      IS DISTINCT FROM (v_detail->>'net_salary')::numeric THEN
     RAISE EXCEPTION 'صافي الراتب غير مطابق للإجماليات';
   END IF;
   INSERT INTO payroll_details(payroll_run_id,employee_id,basic_salary,housing_allowance,transport_allowance,
     other_allowances,overtime_hours,overtime_amount,bonus_amount,unpaid_leave_deduction,absence_late_deduction,
     loan_deduction,gosi_employee_deduction,gosi_employer,other_deductions,gross_salary,total_deductions,
     net_salary,working_days,absent_days,notes,gosi_employee,loan_deductions,absence_deductions)
   SELECT v_id,d.employee_id,d.basic_salary,d.housing_allowance,d.transport_allowance,d.other_allowances,
     d.overtime_hours,d.overtime_amount,d.bonus_amount,d.unpaid_leave_deduction,d.absence_late_deduction,
     d.loan_deduction,d.gosi_employee_deduction,d.gosi_employer,d.other_deductions,d.gross_salary,
     d.total_deductions,d.net_salary,d.working_days,d.absent_days,d.notes,d.gosi_employee_deduction,d.loan_deduction,d.absence_late_deduction
   FROM jsonb_populate_record(NULL::public.payroll_details,v_detail) d;
 END LOOP;
 PERFORM id FROM loans WHERE id IN (SELECT (value->>'loan_id')::uuid FROM jsonb_array_elements(p_allocations)) ORDER BY id FOR UPDATE;
 FOR v_loan IN SELECT value FROM jsonb_array_elements(p_allocations) LOOP
   IF NOT EXISTS(SELECT 1 FROM loans l JOIN payroll_details d ON d.employee_id=l.employee_id
     WHERE l.id=(v_loan->>'loan_id')::uuid AND l.employee_id=(v_loan->>'employee_id')::uuid
     AND d.payroll_run_id=v_id AND l.status='active' AND (v_loan->>'amount')::numeric>0
     AND (v_loan->>'amount')::numeric=round(least(l.monthly_installment,l.remaining_balance),2)) THEN
     RAISE EXCEPTION 'تغيرت بيانات السلفة؛ أعد احتساب المسير';
   END IF;
   INSERT INTO payroll_loan_allocations(payroll_run_id,loan_id,employee_id,amount)
     VALUES(v_id,(v_loan->>'loan_id')::uuid,(v_loan->>'employee_id')::uuid,(v_loan->>'amount')::numeric);
 END LOOP;
 IF EXISTS(SELECT 1 FROM payroll_details d WHERE payroll_run_id=v_id AND d.loan_deduction IS DISTINCT FROM
    coalesce((SELECT sum(a.amount) FROM payroll_loan_allocations a WHERE a.payroll_run_id=v_id AND a.employee_id=d.employee_id),0)) THEN
   RAISE EXCEPTION 'إجمالي أقساط السلف غير مطابق للتفاصيل';
 END IF;
 UPDATE payroll_runs SET period_end=v_end,calculation_basis=p_run->>'calculation_basis',
   total_employees=(SELECT count(*) FROM payroll_details WHERE payroll_run_id=v_id),
   total_basic_salary=(SELECT sum(basic_salary) FROM payroll_details WHERE payroll_run_id=v_id),
   total_allowances=(SELECT sum(housing_allowance+transport_allowance+other_allowances) FROM payroll_details WHERE payroll_run_id=v_id),
   total_overtime_amount=(SELECT sum(overtime_amount) FROM payroll_details WHERE payroll_run_id=v_id),
   total_deductions=(SELECT sum(total_deductions) FROM payroll_details WHERE payroll_run_id=v_id),
   total_net_salary=(SELECT sum(net_salary) FROM payroll_details WHERE payroll_run_id=v_id),
   total_employer_gosi=(SELECT sum(gosi_employer) FROM payroll_details WHERE payroll_run_id=v_id)
 WHERE id=v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_payroll_run_atomic(jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_payroll_run_atomic(jsonb,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_payroll_run_status_atomic(p_run_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_run public.payroll_runs%ROWTYPE;
BEGIN
 SELECT * INTO v_run FROM payroll_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(private_sec.can_manage_payroll_company(v_run.company_id),false) THEN
   RAISE EXCEPTION 'غير مصرح بإدارة هذا المسير' USING ERRCODE='42501';
 END IF;
 IF p_status=v_run.status THEN RETURN; END IF;
 IF p_status IS NULL OR p_status NOT IN ('approved','locked') OR v_run.status NOT IN ('draft','approved') THEN
   RAISE EXCEPTION 'انتقال غير مسموح لحالة المسير';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM payroll_details WHERE payroll_run_id=p_run_id) THEN
   RAISE EXCEPTION 'المسير لا يحتوي على تفاصيل';
 END IF;
 UPDATE payroll_runs SET status=p_status,locked_at=CASE WHEN p_status='locked' THEN now() ELSE locked_at END WHERE id=p_run_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_payroll_run_status_atomic(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_payroll_run_status_atomic(uuid,text) TO authenticated;

-- These add staff read access through the same protected company predicate.
CREATE POLICY payroll_snapshot_staff_read ON public.payroll_runs FOR SELECT TO authenticated
 USING(private_sec.can_manage_payroll_company(company_id));
CREATE POLICY payroll_detail_staff_read ON public.payroll_details FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.payroll_runs r WHERE r.id=payroll_run_id AND private_sec.can_manage_payroll_company(r.company_id)));
CREATE POLICY payroll_allocation_staff_read ON public.payroll_loan_allocations FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.payroll_runs r WHERE r.id=payroll_run_id AND private_sec.can_manage_payroll_company(r.company_id)));
GRANT SELECT ON public.payroll_loan_allocations TO authenticated;
CREATE POLICY payroll_employee_staff_read ON public.employees FOR SELECT TO authenticated
 USING(private_sec.can_manage_payroll_company(company_id));
CREATE POLICY payroll_salary_staff_read ON public.salary_profiles FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_id AND private_sec.can_manage_payroll_company(e.company_id)));
CREATE POLICY payroll_attendance_staff_read ON public.attendance_records FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_id AND private_sec.can_manage_payroll_company(e.company_id)));
CREATE POLICY payroll_loan_staff_read ON public.loans FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_id AND private_sec.can_manage_payroll_company(e.company_id)));

CREATE OR REPLACE FUNCTION private_sec.guard_locked_payroll_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN
   PERFORM id FROM public.payroll_runs WHERE id=OLD.payroll_run_id FOR SHARE;
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN
   PERFORM id FROM public.payroll_runs WHERE id=NEW.payroll_run_id FOR SHARE;
 END IF;
 IF TG_OP IN ('UPDATE','DELETE') AND EXISTS(SELECT 1 FROM public.payroll_runs WHERE id=OLD.payroll_run_id AND status<>'draft') THEN
   RAISE EXCEPTION 'لا يمكن تعديل تفاصيل مسير مقفل أو معتمد';
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') AND EXISTS(SELECT 1 FROM public.payroll_runs WHERE id=NEW.payroll_run_id AND status<>'draft') THEN
   RAISE EXCEPTION 'لا يمكن إضافة تفاصيل لمسير مقفل أو معتمد';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private_sec.guard_locked_payroll_details() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_locked_payroll_details BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_details
 FOR EACH ROW EXECUTE FUNCTION private_sec.guard_locked_payroll_details();
