CREATE POLICY "employees read own documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'hrms-documents'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.current_user_is_hr())
);

CREATE POLICY "employees upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hrms-documents'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.current_user_is_hr())
);

CREATE POLICY "hr updates documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hrms-documents' AND public.current_user_is_hr())
WITH CHECK (bucket_id = 'hrms-documents' AND public.current_user_is_hr());

CREATE POLICY "hr deletes documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hrms-documents' AND public.current_user_is_hr());