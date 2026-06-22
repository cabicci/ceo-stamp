ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_source text CHECK (image_source IN ('ai','upload','url'));