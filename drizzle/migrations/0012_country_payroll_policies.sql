-- Company-owned, effective-dated payroll policies. Rates are approved configuration,
-- not inferred from citizenship or copied from a global country template.
CREATE TABLE public.payroll_country_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES public.companies(id),
 country_code text NOT NULL CHECK(country_code IN ('SA','EG','AE','QA','OM','BH','KW')),
 status text NOT NULL CHECK(status IN ('draft','active')),
 effective_from date NOT NULL,
 effective_to date,
 policy jsonb NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 approved_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
CREATE INDEX payroll_country_policy_lookup ON public.payroll_country_policies(company_id,country_code,effective_from) WHERE status='active';
ALTER TABLE public.payroll_country_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_country_policy_read ON public.payroll_country_policies FOR SELECT TO authenticated
 USING(private_sec.can_manage_payroll_company(company_id));
REVOKE ALL ON public.payroll_country_policies FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.payroll_country_policies TO authenticated;

CREATE FUNCTION private_sec.resolve_payroll_country(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT '{"السعودية": "SA", "سعودي": "SA", "سعودية": "SA", "SAUDI ARABIA": "SA", "SAUDI": "SA", "SAU": "SA", "KSA": "SA", "مصر": "EG", "مصري": "EG", "مصرية": "EG", "EGYPT": "EG", "EGYPTIAN": "EG", "EGY": "EG", "الإمارات": "AE", "اماراتي": "AE", "إماراتي": "AE", "UAE": "AE", "EMIRATI": "AE", "إماراتية": "AE", "اماراتية": "AE", "ARE": "AE", "قطر": "QA", "قطري": "QA", "QATAR": "QA", "QATARI": "QA", "قطرية": "QA", "QAT": "QA", "عمان": "OM", "عُمان": "OM", "عماني": "OM", "OMAN": "OM", "OMANI": "OM", "عمانية": "OM", "OMN": "OM", "البحرين": "BH", "بحريني": "BH", "BAHRAIN": "BH", "BAHRAINI": "BH", "بحرينية": "BH", "BHR": "BH", "الكويت": "KW", "كويتي": "KW", "KUWAIT": "KW", "KUWAITI": "KW", "كويتية": "KW", "KWT": "KW", "EG": "EG", "جمهورية مصر العربية": "EG", "ARAB REPUBLIC OF EGYPT": "EG", "SA": "SA", "المملكة العربية السعودية": "SA", "KINGDOM OF SAUDI ARABIA": "SA", "QA": "QA", "دولة قطر": "QA", "STATE OF QATAR": "QA", "OM": "OM", "سلطنة عمان": "OM", "SULTANATE OF OMAN": "OM", "BH": "BH", "مملكة البحرين": "BH", "KINGDOM OF BAHRAIN": "BH", "AE": "AE", "الإمارات العربية المتحدة": "AE", "UNITED ARAB EMIRATES": "AE", "KW": "KW", "دولة الكويت": "KW", "STATE OF KUWAIT": "KW"}'::jsonb ->> upper(trim(value))
$$;
REVOKE ALL ON FUNCTION private_sec.resolve_payroll_country(text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.save_country_payroll_policy(p_company uuid,p_country text,p_policy jsonb,p_activate boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_country text;
 v_from date;
 v_to date;
 v_scheme jsonb;
 v_component jsonb;
 v_bracket jsonb;
 v_previous numeric:=0;
 v_codes text[]:=ARRAY[]::text[];
 v_id uuid;
BEGIN
 IF NOT coalesce(private_sec.can_manage_payroll_company(p_company),false) THEN
   RAISE EXCEPTION 'غير مصرح بإدارة سياسة هذه المنشأة' USING ERRCODE='42501';
 END IF;
 SELECT private_sec.resolve_payroll_country(country) INTO v_country FROM companies WHERE id=p_company;
 IF v_country IS NULL OR v_country IS DISTINCT FROM p_country OR p_activate IS NULL THEN RAISE EXCEPTION 'دولة السياسة لا تطابق المنشأة'; END IF;
 IF jsonb_typeof(p_policy) IS DISTINCT FROM 'object' OR octet_length(p_policy::text)>65536
 OR nullif(trim(p_policy->>'name'),'') IS NULL OR coalesce(p_policy->>'sourceUrl','') NOT LIKE 'https://%'
 OR jsonb_typeof(p_policy->'monthlyHours') IS DISTINCT FROM 'number'
 OR (p_policy->>'monthlyHours')::numeric NOT BETWEEN 1 AND 744
 OR jsonb_typeof(p_policy->'overtimeWageMultiplier') IS DISTINCT FROM 'number'
 OR (p_policy->>'overtimeWageMultiplier')::numeric NOT BETWEEN 0 AND 10
 OR jsonb_typeof(p_policy->'overtimeBasicPremium') IS DISTINCT FROM 'number'
 OR (p_policy->>'overtimeBasicPremium')::numeric NOT BETWEEN 0 AND 10
 OR jsonb_typeof(p_policy->'schemes') IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_policy->'schemes') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'تعريف السياسة غير صالح'; END IF;
 v_from:=(p_policy->>'effectiveFrom')::date; v_to:=(p_policy->>'effectiveTo')::date;
 IF coalesce(p_policy->>'effectiveFrom','') !~ '^\d{4}-\d{2}-\d{2}$' OR v_from IS NULL OR v_to<v_from THEN RAISE EXCEPTION 'فترة سريان السياسة غير صالحة'; END IF;
 FOR v_scheme IN SELECT value FROM jsonb_array_elements(p_policy->'schemes') LOOP
   IF coalesce(v_scheme->>'code','') !~ '^[a-zA-Z0-9_-]{1,50}$' OR (v_scheme->>'code')=ANY(v_codes)
   OR nullif(trim(v_scheme->>'name'),'') IS NULL
   OR coalesce(v_scheme->>'citizenship','') NOT IN ('national','non_national','explicit')
   OR jsonb_typeof(v_scheme->'contributions') IS DISTINCT FROM 'array'
   OR jsonb_array_length(v_scheme->'contributions') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'نظام اشتراك غير صالح أو مكرر'; END IF;
   v_codes:=array_append(v_codes,v_scheme->>'code');
   FOR v_component IN SELECT value FROM jsonb_array_elements(v_scheme->'contributions') LOOP
     IF (v_component ? 'taxDeductible' AND jsonb_typeof(v_component->'taxDeductible') IS DISTINCT FROM 'boolean') OR nullif(trim(v_component->>'name'),'') IS NULL OR coalesce(v_component->>'basis','') NOT IN ('basic','basic_housing','gross','registered')
     OR jsonb_typeof(v_component->'employeeRate') IS DISTINCT FROM 'number'
     OR (v_component->>'employeeRate')::numeric NOT BETWEEN 0 AND 1
     OR jsonb_typeof(v_component->'employerRate') IS DISTINCT FROM 'number'
     OR (v_component->>'employerRate')::numeric NOT BETWEEN 0 AND 1
     OR jsonb_typeof(v_component->'minimum') IS DISTINCT FROM 'number'
     OR (v_component->>'minimum')::numeric<0
     OR ((v_component->>'offset') IS NOT NULL AND (jsonb_typeof(v_component->'offset') IS DISTINCT FROM 'number' OR (v_component->>'offset')::numeric<0))
     OR ((v_component->>'maximum') IS NOT NULL AND
       (jsonb_typeof(v_component->'maximum') IS DISTINCT FROM 'number' OR (v_component->>'maximum')::numeric<(v_component->>'minimum')::numeric))
     THEN RAISE EXCEPTION 'مكون اشتراك غير صالح'; END IF;
   END LOOP;
 END LOOP;
 IF jsonb_typeof(p_policy#>'{tax,enabled}') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(p_policy#>'{tax,annualExemption}') IS DISTINCT FROM 'number'
 OR (p_policy#>>'{tax,annualExemption}')::numeric<0 THEN RAISE EXCEPTION 'بيانات الضريبة غير صالحة'; END IF;
 IF p_country='EG' AND NOT (p_policy#>>'{tax,enabled}')::boolean THEN RAISE EXCEPTION 'تهيئة ضريبة الدخل مطلوبة للسياسة المصرية'; END IF;
 IF (p_policy#>>'{tax,enabled}')::boolean THEN
   IF jsonb_typeof(p_policy#>'{tax,brackets}') IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_policy#>'{tax,brackets}') NOT BETWEEN 1 AND 30
   OR (p_policy#>'{tax,brackets}'->-1->>'upper') IS NOT NULL THEN RAISE EXCEPTION 'شرائح الضريبة غير صالحة'; END IF;
   FOR v_bracket IN SELECT value FROM jsonb_array_elements(p_policy#>'{tax,brackets}') LOOP
     IF jsonb_typeof(v_bracket->'rate') IS DISTINCT FROM 'number' OR (v_bracket->>'rate')::numeric NOT BETWEEN 0 AND 1
     OR ((v_bracket->>'upper') IS NOT NULL AND (jsonb_typeof(v_bracket->'upper') IS DISTINCT FROM 'number' OR (v_bracket->>'upper')::numeric<=v_previous))
     OR ((v_bracket->>'availableUpToAnnual') IS NOT NULL AND (jsonb_typeof(v_bracket->'availableUpToAnnual') IS DISTINCT FROM 'number' OR (v_bracket->>'availableUpToAnnual')::numeric<0))
     OR (v_previous=-1) THEN RAISE EXCEPTION 'حدود شرائح الضريبة غير صالحة'; END IF;
     v_previous:=coalesce((v_bracket->>'upper')::numeric,-1);
   END LOOP;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-policy:'||p_company||':'||p_country,0));
 IF p_activate THEN
   IF EXISTS(SELECT 1 FROM payroll_country_policies WHERE company_id=p_company AND country_code=p_country AND status='active'
      AND effective_from>=v_from AND (v_to IS NULL OR effective_from<=v_to)) THEN RAISE EXCEPTION 'توجد سياسة معتمدة تتداخل مع الفترة الجديدة'; END IF;
   UPDATE payroll_country_policies SET effective_to=v_from-1,
     policy=jsonb_set(policy,'{effectiveTo}',to_jsonb((v_from-1)::text))
   WHERE company_id=p_company AND country_code=p_country AND status='active' AND effective_from<v_from
     AND (effective_to IS NULL OR effective_to>=v_from);
 END IF;

 INSERT INTO payroll_country_policies(company_id,country_code,status,effective_from,effective_to,policy,created_by,approved_by)
 VALUES(p_company,p_country,CASE WHEN p_activate THEN 'active' ELSE 'draft' END,v_from,v_to,p_policy,auth.uid(),CASE WHEN p_activate THEN auth.uid() END)
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_country_payroll_policy(uuid,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_country_payroll_policy(uuid,text,jsonb,boolean) TO authenticated;

ALTER TABLE public.payroll_runs
 ADD COLUMN country_code text,
 ADD COLUMN currency text,
 ADD COLUMN country_policy_id uuid REFERENCES public.payroll_country_policies(id),
 ADD COLUMN country_policy_snapshot jsonb;
ALTER TABLE public.payroll_details ADD COLUMN income_tax numeric(18,3) NOT NULL DEFAULT 0;

-- Retain the original scale for non-money fields such as overtime hours.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'
  AND table_name IN ('employees','salary_profiles','payroll_details','payroll_runs','payroll_loan_allocations','loans','loan_installments','payroll_payments','company_bank_accounts')
  AND data_type='numeric' AND numeric_scale=2 AND column_name NOT IN ('overtime_hours','interest_rate','rate')
 LOOP EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE numeric(18,3)',r.table_name,r.column_name); END LOOP;
END $$;

-- Keep the transactional persistence implementation private behind the country check.
ALTER FUNCTION public.save_payroll_run_atomic(jsonb,jsonb,jsonb) RENAME TO save_payroll_run_core_v1;
ALTER FUNCTION public.save_payroll_run_core_v1(jsonb,jsonb,jsonb) SET SCHEMA private_sec;
REVOKE ALL ON FUNCTION private_sec.save_payroll_run_core_v1(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private_sec.save_payroll_run_core_v1(p_run jsonb,p_details jsonb,p_allocations jsonb)
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
 v_precision int := CASE WHEN p_run->>'currency' IN ('OMR','BHD','KWD') THEN 3 ELSE 2 END;
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
      round((v_detail->>'gross_salary')::numeric-(v_detail->>'total_deductions')::numeric,v_precision)
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
     AND (v_loan->>'amount')::numeric=round(least(l.monthly_installment,l.remaining_balance),v_precision)) THEN
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
REVOKE ALL ON FUNCTION private_sec.save_payroll_run_core_v1(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.save_payroll_run_atomic(p_run jsonb,p_details jsonb,p_allocations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_country text; v_currency text; v_expected_currency text;
 v_company uuid:=(p_run->>'company_id')::uuid;
 v_policy payroll_country_policies%ROWTYPE;
 v_policy_id uuid:=(p_run->>'country_policy_id')::uuid;
 v_id uuid;
 v_existing payroll_runs%ROWTYPE;
 v_start date:=make_date((p_run->>'period_year')::int,(p_run->>'period_month')::int,1);
 v_end date:=(p_run->>'period_end')::date;
BEGIN
 IF NOT coalesce(private_sec.can_manage_payroll_company(v_company),false) THEN RAISE EXCEPTION 'غير مصرح بإدارة رواتب المنشأة' USING ERRCODE='42501'; END IF;
 SELECT private_sec.resolve_payroll_country(country),currency INTO v_country,v_currency FROM companies WHERE id=v_company;
 v_expected_currency:=CASE v_country WHEN 'SA' THEN 'SAR' WHEN 'EG' THEN 'EGP' WHEN 'AE' THEN 'AED' WHEN 'QA' THEN 'QAR' WHEN 'OM' THEN 'OMR' WHEN 'BH' THEN 'BHD' WHEN 'KW' THEN 'KWD' END;
 IF v_country IS NULL OR v_currency IS DISTINCT FROM v_expected_currency OR
    coalesce(p_run->>'country_code',v_country) IS DISTINCT FROM v_country OR coalesce(p_run->>'currency',v_currency) IS DISTINCT FROM v_currency THEN
   RAISE EXCEPTION 'دولة المسير أو عملته لا تطابق المنشأة';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll-policy:'||v_company||':'||v_country,0));
 IF v_policy_id IS NOT NULL THEN
   SELECT * INTO v_policy FROM payroll_country_policies WHERE id=v_policy_id AND company_id=v_company AND country_code=v_country AND status='active'
     AND effective_from<=v_start AND (effective_to IS NULL OR effective_to>=v_end);
   IF NOT FOUND OR v_policy.policy IS DISTINCT FROM p_run->'country_policy_snapshot' THEN RAISE EXCEPTION 'تغيرت سياسة الدولة؛ أعد مراجعة المسير'; END IF;
 ELSIF v_country<>'SA' OR EXISTS(SELECT 1 FROM payroll_country_policies WHERE company_id=v_company AND country_code=v_country AND status='active' AND effective_from<=v_end) THEN
   RAISE EXCEPTION 'سياسة الدولة المعتمدة مطلوبة لهذا المسير';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll:'||v_company||':'||(p_run->>'period_year')||':'||(p_run->>'period_month'),0));
 SELECT * INTO v_existing FROM payroll_runs WHERE company_id=v_company AND period_year=(p_run->>'period_year')::int AND period_month=(p_run->>'period_month')::int
  AND payroll_group_id IS NOT DISTINCT FROM (p_run->>'payroll_group_id')::uuid FOR UPDATE;
 IF FOUND AND NOT coalesce((p_run->>'replace_all')::boolean,false) AND
    ((v_existing.country_code IS NOT NULL AND v_existing.country_code IS DISTINCT FROM v_country) OR
     (v_existing.currency IS NOT NULL AND v_existing.currency IS DISTINCT FROM v_currency) OR
     v_existing.country_policy_id IS DISTINCT FROM v_policy_id) THEN
   RAISE EXCEPTION 'يلزم إعادة احتساب المسير كاملًا عند تغيير سياسة الدولة أو العملة';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_details) j WHERE j->>'income_tax' IS NOT NULL AND
  (jsonb_typeof(j->'income_tax') IS DISTINCT FROM 'number' OR (j->>'income_tax')::numeric<0 OR
   (j->>'income_tax')::numeric>coalesce((j->>'other_deductions')::numeric,0))) THEN RAISE EXCEPTION 'ضريبة الدخل غير مطابقة للاستقطاعات'; END IF;
 v_id:=private_sec.save_payroll_run_core_v1(p_run||jsonb_build_object('currency',v_currency),p_details,p_allocations);
 UPDATE payroll_runs SET country_code=v_country,currency=v_currency,country_policy_id=v_policy_id,country_policy_snapshot=v_policy.policy WHERE id=v_id;
 UPDATE payroll_details d SET income_tax=coalesce((j.value->>'income_tax')::numeric,0)
 FROM jsonb_array_elements(p_details) j WHERE d.payroll_run_id=v_id AND d.employee_id=(j.value->>'employee_id')::uuid;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_payroll_run_atomic(jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_payroll_run_atomic(jsonb,jsonb,jsonb) TO authenticated;

CREATE FUNCTION private_sec.guard_payroll_country_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.status<>'draft' AND (OLD.country_code IS DISTINCT FROM NEW.country_code OR OLD.currency IS DISTINCT FROM NEW.currency
  OR OLD.country_policy_id IS DISTINCT FROM NEW.country_policy_id OR OLD.country_policy_snapshot IS DISTINCT FROM NEW.country_policy_snapshot) THEN
   RAISE EXCEPTION 'لا يمكن تغيير دولة أو سياسة مسير مقفل أو معتمد';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private_sec.guard_payroll_country_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_payroll_country_snapshot BEFORE UPDATE OF country_code,currency,country_policy_id,country_policy_snapshot
 ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION private_sec.guard_payroll_country_snapshot();
