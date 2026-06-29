
-- Fix campaign-media storage policies: use object path (name), not project name
DROP POLICY IF EXISTS campaign_media_owner_insert ON storage.objects;
DROP POLICY IF EXISTS campaign_media_owner_select ON storage.objects;
DROP POLICY IF EXISTS campaign_media_owner_update ON storage.objects;
DROP POLICY IF EXISTS campaign_media_owner_delete ON storage.objects;

CREATE POLICY campaign_media_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-media'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY campaign_media_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-media'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY campaign_media_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'campaign-media'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'campaign-media'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY campaign_media_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-media'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND p.owner_id = auth.uid()
    )
  );

-- Admins: full access on campaign-media
CREATE POLICY campaign_media_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'campaign-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'campaign-media' AND public.is_admin());
