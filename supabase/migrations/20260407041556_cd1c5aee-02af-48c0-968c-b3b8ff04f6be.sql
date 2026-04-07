
CREATE TABLE public.storage_buckets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'nairobi',
  visibility TEXT NOT NULL DEFAULT 'private',
  storage_class TEXT NOT NULL DEFAULT 'standard',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  object_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.storage_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own buckets" ON public.storage_buckets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own buckets" ON public.storage_buckets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own buckets" ON public.storage_buckets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own buckets" ON public.storage_buckets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.storage_objects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id UUID NOT NULL REFERENCES public.storage_buckets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.storage_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own objects" ON public.storage_objects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own objects" ON public.storage_objects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own objects" ON public.storage_objects FOR DELETE TO authenticated USING (auth.uid() = user_id);
