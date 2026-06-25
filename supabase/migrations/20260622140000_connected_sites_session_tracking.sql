-- Track in-flight Browserbase sessions so orphan cleanup can protect active connects.
ALTER TABLE public.connected_sites
  ADD COLUMN IF NOT EXISTS browserbase_session_id text,
  ADD COLUMN IF NOT EXISTS connect_started_at timestamptz;

CREATE INDEX IF NOT EXISTS connected_sites_connecting_idx
  ON public.connected_sites (status, connect_started_at)
  WHERE status = 'connecting';
