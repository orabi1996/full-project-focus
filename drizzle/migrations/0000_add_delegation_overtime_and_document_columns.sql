
-- 1) employee_documents: أعمدة ناقصة يستخدمها التطبيق
ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS file_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS confidentiality text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'employee_visible',
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS issuing_authority text;

-- 2) company_documents: أعمدة ناقصة
ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS file_id text,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS subsidiary_id uuid;

-- 3) delegation_rules
CREATE TABLE IF NOT EXISTS public.delegation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  delegate_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'all_requests',
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delegation_rules TO authenticated;
GRANT ALL ON public.delegation_rules TO service_role;
ALTER TABLE public.delegation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY delegation_rules_select ON public.delegation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY delegation_rules_insert ON public.delegation_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY delegation_rules_update ON public.delegation_rules FOR UPDATE TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY delegation_rules_delete ON public.delegation_rules FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));

-- 4) overtime_records
CREATE TABLE IF NOT EXISTS public.overtime_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  start_time time NOT NULL DEFAULT '17:00:00',
  end_time time NOT NULL DEFAULT '20:00:00',
  hours numeric NOT NULL DEFAULT 0,
  rate_multiplier numeric NOT NULL DEFAULT 1.5,
  rate_type text NOT NULL DEFAULT 'regular_150',
  reason text NOT NULL DEFAULT '',
  hourly_rate numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_records TO authenticated;
GRANT ALL ON public.overtime_records TO service_role;
ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY overtime_records_select ON public.overtime_records FOR SELECT TO authenticated USING (true);
CREATE POLICY overtime_records_insert ON public.overtime_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY overtime_records_update ON public.overtime_records FOR UPDATE TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY overtime_records_delete ON public.overtime_records FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));

-- 5) RPCs
CREATE OR REPLACE FUNCTION public.revoke_delegation_rule(p_delegation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح: إلغاء التفويض متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE public.delegation_rules SET status = 'revoked' WHERE id = p_delegation_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'قاعدة التفويض غير موجودة أو غير نشطة' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_overtime_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح: اعتماد العمل الإضافي متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE public.overtime_records
  SET status = 'approved', decided_by = auth.uid(), decided_at = now()
  WHERE id = p_overtime_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب العمل الإضافي غير موجود أو تمت معالجته مسبقاً' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_overtime_request(p_overtime_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح: رفض العمل الإضافي متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE public.overtime_records
  SET status = 'rejected', decided_by = auth.uid(), decided_at = now()
  WHERE id = p_overtime_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب العمل الإضافي غير موجود أو تمت معالجته مسبقاً' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_attendance_correction(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح: اعتماد تصحيح البصمة متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE public.requests
  SET status = 'approved', updated_at = now()
  WHERE id = p_request_id AND type = 'attendance_fix' AND status IN ('pending', 'submitted');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تصحيح البصمة غير موجود أو تمت معالجته مسبقاً' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_attendance_correction(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح: رفض تصحيح البصمة متاح لمسؤولي الموارد البشرية فقط' USING ERRCODE = '42501';
  END IF;
  UPDATE public.requests
  SET status = 'rejected', updated_at = now()
  WHERE id = p_request_id AND type = 'attendance_fix' AND status IN ('pending', 'submitted');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب تصحيح البصمة غير موجود أو تمت معالجته مسبقاً' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_delegation_rule(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_overtime_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_overtime_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_attendance_correction(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_attendance_correction(uuid) FROM anon;
