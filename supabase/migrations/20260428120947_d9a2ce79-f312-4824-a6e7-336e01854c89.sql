CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.football_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_hint TEXT,
  is_valid BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verification_message TEXT,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.football_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own football API keys"
ON public.football_api_keys FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own football API keys"
ON public.football_api_keys FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own football API keys"
ON public.football_api_keys FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own football API keys"
ON public.football_api_keys FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.football_api_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  data_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  source_url TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (provider, data_type, external_id)
);

ALTER TABLE public.football_api_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verified football cache is readable"
ON public.football_api_cache FOR SELECT TO authenticated
USING (expires_at > now());

CREATE TABLE public.stadium_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT,
  city TEXT,
  teams TEXT[] NOT NULL DEFAULT '{}',
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stadium_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verified stadium cache is readable"
ON public.stadium_cache FOR SELECT TO authenticated
USING (expires_at > now());

CREATE INDEX idx_football_api_cache_lookup ON public.football_api_cache (provider, data_type, external_id, expires_at);
CREATE INDEX idx_stadium_cache_lookup ON public.stadium_cache (external_id, expires_at);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_football_api_keys_updated_at
BEFORE UPDATE ON public.football_api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stadium_cache_updated_at
BEFORE UPDATE ON public.stadium_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();