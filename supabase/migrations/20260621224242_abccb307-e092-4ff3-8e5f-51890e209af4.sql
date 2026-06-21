CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  website_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select their projects" ON public.projects
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Owners can insert their projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their projects" ON public.projects
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their projects" ON public.projects
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE INDEX projects_owner_created_idx ON public.projects(owner_id, created_at DESC);