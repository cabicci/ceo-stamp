
-- Helper: project ownership check
CREATE OR REPLACE FUNCTION public.owns_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = auth.uid())
$$;

-- 1) post_metrics
CREATE TABLE public.post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  reach bigint, impressions bigint, likes bigint, comments bigint, shares bigint, clicks bigint, saves bigint,
  spend numeric, conversions bigint,
  captured_at timestamptz NOT NULL DEFAULT now(),
  period_start date, period_end date,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_metrics TO authenticated;
GRANT ALL ON public.post_metrics TO service_role;
ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages post_metrics" ON public.post_metrics FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.content_items ci JOIN public.campaigns c ON c.id=ci.campaign_id WHERE ci.id = content_item_id AND public.owns_project(c.project_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.content_items ci JOIN public.campaigns c ON c.id=ci.campaign_id WHERE ci.id = content_item_id AND public.owns_project(c.project_id)));
CREATE POLICY "admin reads post_metrics" ON public.post_metrics FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX idx_post_metrics_content_item ON public.post_metrics(content_item_id);

-- 2) social_connections
CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  platform text NOT NULL,
  connection_type text NOT NULL DEFAULT 'manual',
  access_token_encrypted text,
  refresh_token_encrypted text,
  account_ref text,
  account_name text,
  scopes jsonb,
  status text NOT NULL DEFAULT 'disconnected',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages social_connections" ON public.social_connections FOR ALL TO authenticated
USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE POLICY "admin reads social_connections" ON public.social_connections FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX idx_social_connections_project ON public.social_connections(project_id);

-- 3) publishing additions on content_items
ALTER TABLE public.content_items
  ADD COLUMN published_at timestamptz,
  ADD COLUMN external_post_id text,
  ADD COLUMN publish_error text;

CREATE TABLE public.publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_jobs TO authenticated;
GRANT ALL ON public.publish_jobs TO service_role;
ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages publish_jobs" ON public.publish_jobs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.content_items ci JOIN public.campaigns c ON c.id=ci.campaign_id WHERE ci.id = content_item_id AND public.owns_project(c.project_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.content_items ci JOIN public.campaigns c ON c.id=ci.campaign_id WHERE ci.id = content_item_id AND public.owns_project(c.project_id)));
CREATE POLICY "admin reads publish_jobs" ON public.publish_jobs FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX idx_publish_jobs_content_item ON public.publish_jobs(content_item_id);
CREATE INDEX idx_publish_jobs_status_scheduled ON public.publish_jobs(status, scheduled_for);

-- 4) Campaign reuse / templates
ALTER TABLE public.campaigns
  ADD COLUMN cloned_from_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- 5) Subscriptions + usage counters
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  provider text,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages subscription" ON public.subscriptions FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "admin reads subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month text NOT NULL,
  campaigns_generated int NOT NULL DEFAULT 0,
  images_generated int NOT NULL DEFAULT 0,
  ai_tokens_used bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages usage_counters" ON public.usage_counters FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "admin reads usage_counters" ON public.usage_counters FOR SELECT TO authenticated USING (public.is_admin());

-- 6) AI generation log
CREATE TABLE public.ai_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens int,
  output_tokens int,
  cost_estimate numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_generation_log TO authenticated;
GRANT ALL ON public.ai_generation_log TO service_role;
ALTER TABLE public.ai_generation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own ai log" ON public.ai_generation_log FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "admin reads ai log" ON public.ai_generation_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX idx_ai_log_owner_created ON public.ai_generation_log(owner_id, created_at DESC);
