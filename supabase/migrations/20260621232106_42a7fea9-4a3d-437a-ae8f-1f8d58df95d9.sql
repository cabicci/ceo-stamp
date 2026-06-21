
-- 1. campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  objective text NOT NULL,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaigns_project_idx ON public.campaigns(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = campaigns.project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners insert campaigns" ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = campaigns.project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners update campaigns" ON public.campaigns
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = campaigns.project_id AND p.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = campaigns.project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Owners delete campaigns" ON public.campaigns
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = campaigns.project_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Admins read all campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (public.is_admin());

-- 2. content_items
CREATE TABLE public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  platform text NOT NULL,
  content_type text,
  copy text,
  media_brief text,
  framework_applied text,
  rationale text,
  locale text NOT NULL DEFAULT 'ar',
  adapted_from_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  scheduled_date date,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_items_campaign_idx ON public.content_items(campaign_id, scheduled_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;
GRANT ALL ON public.content_items TO service_role;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select content_items" ON public.content_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = content_items.campaign_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners insert content_items" ON public.content_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = content_items.campaign_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners update content_items" ON public.content_items
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = content_items.campaign_id AND p.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = content_items.campaign_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners delete content_items" ON public.content_items
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = content_items.campaign_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Admins read all content_items" ON public.content_items
  FOR SELECT TO authenticated USING (public.is_admin());

-- 3. ad_copies
CREATE TABLE public.ad_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  platform text NOT NULL,
  variant_label text,
  headline text,
  body text,
  cta text,
  framework_applied text,
  rationale text,
  locale text NOT NULL DEFAULT 'ar',
  adapted_from_id uuid REFERENCES public.ad_copies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_copies_campaign_idx ON public.ad_copies(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_copies TO authenticated;
GRANT ALL ON public.ad_copies TO service_role;
ALTER TABLE public.ad_copies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select ad_copies" ON public.ad_copies
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = ad_copies.campaign_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners insert ad_copies" ON public.ad_copies
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = ad_copies.campaign_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners update ad_copies" ON public.ad_copies
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = ad_copies.campaign_id AND p.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = ad_copies.campaign_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Owners delete ad_copies" ON public.ad_copies
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = ad_copies.campaign_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Admins read all ad_copies" ON public.ad_copies
  FOR SELECT TO authenticated USING (public.is_admin());
