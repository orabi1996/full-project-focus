-- Match the dashboard response contract without bypassing existing RLS.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_start_date date, p_end_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := auth.uid();
  company uuid;
  is_super boolean;
  is_hr boolean;
  start_day date := coalesce(p_start_date, (now() AT TIME ZONE 'Asia/Riyadh')::date - 6);
  end_day date := coalesce(p_end_date, (now() AT TIME ZONE 'Asia/Riyadh')::date);
  headcount jsonb;
  docs jsonb;
  pending jsonb;
  roster jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF start_day > end_day THEN RAISE EXCEPTION 'Invalid date range'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role::text='super_admin'),
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role::text IN ('super_admin','org_admin','hr_manager'))
    INTO is_super, is_hr;
  SELECT CASE WHEN count(DISTINCT company_id)=1 THEN min(company_id::text)::uuid END INTO company
    FROM public.employees WHERE user_id=uid;

  SELECT jsonb_build_object('available',true,
    'activeCount',count(*) FILTER(WHERE e.status::text IN ('active','probation','on_leave')),
    'newHires',count(*) FILTER(WHERE e.hire_date BETWEEN start_day AND end_day),
    'prevNewHires',count(*) FILTER(WHERE e.hire_date BETWEEN start_day-(end_day-start_day+1) AND start_day-1),
    'saudiCount',count(*) FILTER(WHERE e.status::text IN ('active','probation','on_leave') AND lower(btrim(e.nationality)) IN ('سعودي','سعودية','saudi','saudi arabia')),
    'nonSaudiCount',count(*) FILTER(WHERE e.status::text IN ('active','probation','on_leave') AND nullif(btrim(e.nationality),'') IS NOT NULL AND lower(btrim(e.nationality)) NOT IN ('سعودي','سعودية','saudi','saudi arabia')),
    'unknownNationalityCount',count(*) FILTER(WHERE e.status::text IN ('active','probation','on_leave') AND nullif(btrim(e.nationality),'') IS NULL),
    'turnoverRate',NULL,'reasonTurnoverUnavailable','لا تتوفر بيانات موثوقة لتاريخ انتهاء الخدمة') INTO headcount
  FROM public.employees e WHERE is_super OR (is_hr AND e.company_id=company) OR (NOT is_hr AND e.user_id=uid);

  SELECT jsonb_build_object('available',is_hr,
    'expired',count(*) FILTER(WHERE d.expiry_date<end_day),
    'within7d',count(*) FILTER(WHERE d.expiry_date BETWEEN end_day AND end_day+7),
    'within30d',count(*) FILTER(WHERE d.expiry_date BETWEEN end_day AND end_day+30),
    'within60d',count(*) FILTER(WHERE d.expiry_date BETWEEN end_day AND end_day+60)) INTO docs
  FROM public.employee_documents d JOIN public.employees e ON e.id=d.employee_id
  WHERE is_hr AND (is_super OR e.company_id=company);

  SELECT jsonb_build_object('available',true,'count',count(*),'items',coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'referenceNo',r.reference,'type',r.type,'requesterId',r.employee_id,
    'requesterName',e.full_name,'submittedAt',r.created_at,'reason',r.reason) ORDER BY r.created_at),'[]'::jsonb)) INTO pending
  FROM public.requests r JOIN public.employees e ON e.id=r.employee_id
  WHERE r.status::text IN ('pending','submitted','pending_approval')
    AND (is_super OR (is_hr AND e.company_id=company) OR (NOT is_hr AND e.user_id=uid));

  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'employeeId',r.employee_id,
    'firstNameAr',e.first_name_ar,'lastNameAr',e.last_name_ar,'jobTitleAr',e.job_title,
    'leaveType',r.type,'startDate',r.start_date,'endDate',r.end_date)),'[]'::jsonb) INTO roster
  FROM public.requests r JOIN public.employees e ON e.id=r.employee_id
  WHERE r.type::text='leave' AND r.status::text='approved' AND end_day BETWEEN r.start_date AND r.end_date
    AND (is_super OR (is_hr AND e.company_id=company) OR (NOT is_hr AND e.user_id=uid));

  IF is_hr AND NOT is_super AND company IS NULL THEN
    headcount := jsonb_build_object('available',false,'reasonUnavailable','لا يوجد نطاق منشأة وحيد مرتبط بالحساب');
    docs := jsonb_build_object('available',false,'expired',0,'within7d',0,'within30d',0,'within60d',0);
  END IF;
  RETURN jsonb_build_object('scope',CASE WHEN is_hr THEN 'organization' ELSE 'self' END,
    'timezone','Asia/Riyadh','anchorDate',end_day,'startDate',start_day,'endDate',end_day,
    'headcount',headcount,
    'attendance',jsonb_build_object('available',false,'reasonUnavailable','يلزم التحقق من جداول الدوام قبل حساب نسب الحضور'),
    'pendingApprovals',pending,
    'payroll',jsonb_build_object('available',false,'reasonUnavailable','يلزم التحقق من نطاق المنشأة وربط مسير الرواتب'),
    'documents',docs,'recruitment',jsonb_build_object('available',false,'reasonUnavailable','لم يتم التحقق من بيانات التوظيف'),
    'leaveRoster',roster);
END;
$$;
REVOKE ALL ON FUNCTION public.get_dashboard_summary(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_attendance_trend(p_anchor_date date, p_days integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := auth.uid();
  company uuid;
  is_super boolean;
  is_hr boolean;
  anchor_day date := coalesce(p_anchor_date,(now() AT TIME ZONE 'Asia/Riyadh')::date);
  days integer := greatest(1,least(coalesce(p_days,7),90));
  points jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role::text='super_admin'),
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role::text IN ('super_admin','org_admin','hr_manager')) INTO is_super,is_hr;
  SELECT CASE WHEN count(DISTINCT company_id)=1 THEN min(company_id::text)::uuid END INTO company FROM public.employees WHERE user_id=uid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('date',x.work_date,'dayLabelAr',x.work_date::text,
    'present',x.present,'late',x.late,'absent',x.absent) ORDER BY x.work_date),'[]'::jsonb) INTO points
  FROM (SELECT a.work_date,
    count(DISTINCT a.employee_id) FILTER(WHERE a.status::text IN ('present','late')) AS present,
    count(DISTINCT a.employee_id) FILTER(WHERE a.status::text='late') AS late,
    count(DISTINCT a.employee_id) FILTER(WHERE a.status::text='absent') AS absent
    FROM public.attendance_records a JOIN public.employees e ON e.id=a.employee_id
    WHERE a.work_date BETWEEN anchor_day-days+1 AND anchor_day
      AND (is_super OR (is_hr AND e.company_id=company) OR (NOT is_hr AND e.user_id=uid))
    GROUP BY a.work_date) x;
  RETURN jsonb_build_object('available',jsonb_array_length(points)>0,'timezone','Asia/Riyadh',
    'anchorDate',anchor_day,'days',days,'trend',points,'reasonUnavailable',CASE WHEN jsonb_array_length(points)=0 THEN 'لا توجد سجلات حضور ضمن الفترة المحددة' END);
END;
$$;
REVOKE ALL ON FUNCTION public.get_dashboard_attendance_trend(date,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_attendance_trend(date,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_integration_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('available',false,'reasonUnavailable','لم يتم التحقق من حالة التكاملات','platforms','[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_dashboard_integration_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_integration_health() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
