-- Provider tracking on existing resource tables
ALTER TABLE public.virtual_machines
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'hetzner',
  ADD COLUMN IF NOT EXISTS provider_resource_id text,
  ADD COLUMN IF NOT EXISTS ssh_key_id uuid;

ALTER TABLE public.database_instances
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'aws',
  ADD COLUMN IF NOT EXISTS provider_resource_id text;

ALTER TABLE public.storage_buckets
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'aws',
  ADD COLUMN IF NOT EXISTS provider_resource_id text,
  ADD COLUMN IF NOT EXISTS endpoint_url text;

ALTER TABLE public.edge_nodes
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'digitalocean',
  ADD COLUMN IF NOT EXISTS provider_resource_id text;

ALTER TABLE public.vpcs
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'hetzner',
  ADD COLUMN IF NOT EXISTS provider_resource_id text;

ALTER TABLE public.load_balancers
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'hetzner',
  ADD COLUMN IF NOT EXISTS provider_resource_id text;

ALTER TABLE public.dns_records
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'cloudflare',
  ADD COLUMN IF NOT EXISTS provider_resource_id text;

-- Resource operations: every async provisioning action
CREATE TABLE IF NOT EXISTS public.resource_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  provider text NOT NULL,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own operations" ON public.resource_operations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own operations" ON public.resource_operations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own operations" ON public.resource_operations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ops_user_created ON public.resource_operations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_resource ON public.resource_operations(resource_id);

-- SSH keys
CREATE TABLE IF NOT EXISTS public.ssh_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  public_key text NOT NULL,
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ssh_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ssh keys" ON public.ssh_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ssh keys" ON public.ssh_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own ssh keys" ON public.ssh_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Provider credentials (display-only metadata; real secrets live in backend secrets)
CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  display_name text NOT NULL,
  default_region text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, display_name)
);

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own provider creds" ON public.provider_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own provider creds" ON public.provider_credentials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own provider creds" ON public.provider_credentials
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own provider creds" ON public.provider_credentials
  FOR DELETE TO authenticated USING (auth.uid() = user_id);