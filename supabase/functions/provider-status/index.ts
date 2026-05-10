// supabase/functions/provider-status — reports which provider credentials
// are configured in backend secrets (without exposing values).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDERS = [
  { id: "hetzner",      env: "HETZNER_API_TOKEN",     label: "Hetzner Cloud" },
  { id: "digitalocean", env: "DIGITALOCEAN_TOKEN",    label: "DigitalOcean" },
  { id: "aws",          env: "AWS_ACCESS_KEY_ID",     label: "AWS" },
  { id: "cloudflare",   env: "CLOUDFLARE_API_TOKEN",  label: "Cloudflare" },
];

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const status = PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    env: p.env,
    configured: Boolean(Deno.env.get(p.env)),
  }));
  return new Response(JSON.stringify({ providers: status }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
