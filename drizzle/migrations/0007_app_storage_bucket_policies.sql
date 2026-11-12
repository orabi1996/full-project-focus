DROP POLICY IF EXISTS "app_buckets_read" ON storage.objects;
CREATE POLICY "app_buckets_read" ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id IN ('employee-avatars','employee-documents','company-documents','leave-attachments')
   AND (private_sec.current_user_is_hr() OR owner = auth.uid() OR bucket_id = 'employee-avatars'));
DROP POLICY IF EXISTS "app_buckets_insert" ON storage.objects;
CREATE POLICY "app_buckets_insert" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id IN ('employee-avatars','employee-documents','leave-attachments')
   OR (bucket_id = 'company-documents' AND private_sec.current_user_is_hr()));
DROP POLICY IF EXISTS "app_buckets_update" ON storage.objects;
CREATE POLICY "app_buckets_update" ON storage.objects FOR UPDATE TO authenticated
 USING (bucket_id IN ('employee-avatars','employee-documents','company-documents','leave-attachments') AND (private_sec.current_user_is_hr() OR owner = auth.uid()))
 WITH CHECK (bucket_id IN ('employee-avatars','employee-documents','company-documents','leave-attachments') AND (private_sec.current_user_is_hr() OR owner = auth.uid()));
DROP POLICY IF EXISTS "app_buckets_delete" ON storage.objects;
CREATE POLICY "app_buckets_delete" ON storage.objects FOR DELETE TO authenticated
 USING (bucket_id IN ('employee-avatars','employee-documents','company-documents','leave-attachments') AND (private_sec.current_user_is_hr() OR owner = auth.uid()));