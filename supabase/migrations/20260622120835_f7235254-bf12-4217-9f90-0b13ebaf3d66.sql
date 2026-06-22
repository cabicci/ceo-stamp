ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS campaign_plan jsonb;