ALTER TABLE public.brand_profiles
ADD COLUMN IF NOT EXISTS available_channels jsonb NOT NULL DEFAULT '[]'::jsonb;