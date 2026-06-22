CREATE POLICY "campaign_media_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-media' AND
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "campaign_media_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-media' AND
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "campaign_media_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'campaign-media' AND
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "campaign_media_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-media' AND
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.owner_id = auth.uid()
    )
  );