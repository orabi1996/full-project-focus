
-- 1) file_objects: فهرس ملفات التخزين
CREATE TABLE IF NOT EXISTS public.file_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  replaces_file_id uuid,
  content_type text,
  size_bytes bigint,
  created_by uuid,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, object_path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_objects TO authenticated;
GRANT ALL ON public.file_objects TO service_role;
ALTER TABLE public.file_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY file_objects_select ON public.file_objects FOR SELECT TO authenticated USING (true);
CREATE POLICY file_objects_insert ON public.file_objects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY file_objects_update ON public.file_objects FOR UPDATE TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY file_objects_delete ON public.file_objects FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));

-- 2) accounting_journals: عمود الحالة
ALTER TABLE public.accounting_journals ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- 3) RPCs لإدارة الملفات
CREATE OR REPLACE FUNCTION public.archive_file_object(p_file_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح بأرشفة الملفات' USING ERRCODE = '42501';
  END IF;
  UPDATE public.file_objects SET status = 'archived', archived_at = now() WHERE id = p_file_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الملف غير موجود' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_file_replacement(p_previous_file_id uuid, p_new_file_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.file_objects SET status = 'archived', archived_at = now() WHERE id = p_previous_file_id;
  UPDATE public.file_objects SET status = 'active' WHERE id = p_new_file_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_file_download_access(p_file_id uuid, p_access_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, changes_summary)
  VALUES (auth.uid(), 'file_' || COALESCE(p_access_type, 'view'), 'file_object', p_file_id::text, NULL);
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_business_document(p_document_id uuid, p_document_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح بأرشفة المستندات' USING ERRCODE = '42501';
  END IF;
  IF p_document_type = 'company' THEN
    UPDATE public.company_documents SET status = 'archived' WHERE id = p_document_id;
  ELSE
    UPDATE public.employee_documents SET status = 'archived' WHERE id = p_document_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_file_object(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_file_replacement(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_file_download_access(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_business_document(uuid, text) FROM anon;
