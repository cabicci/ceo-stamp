
CREATE TABLE public.connected_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  login_url text NOT NULL,
  session_data_encrypted text,
  status text NOT NULL DEFAULT 'disconnected',
  last_connected_at timestamptz,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connected_sites TO authenticated;
GRANT ALL ON public.connected_sites TO service_role;

ALTER TABLE public.connected_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_select" ON public.connected_sites FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()) OR public.is_admin());

CREATE POLICY "cs_insert" ON public.connected_sites FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "cs_update" ON public.connected_sites FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE POLICY "cs_delete" ON public.connected_sites FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE INDEX connected_sites_project_id_idx ON public.connected_sites(project_id);
