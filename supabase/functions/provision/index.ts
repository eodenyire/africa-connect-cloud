// Africa Cloud — unified provisioning orchestrator.
// Dispatches resource actions (create/delete/start/stop/reboot) to the
// configured cloud provider adapter. Records every attempt in
// resource_operations for the real-time activity feed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- Types ----------

type ResourceType =
  | "compute"
  | "database"
  | "storage"
  | "edge"
  | "vpc"
  | "load_balancer"
  | "dns";

type Provider =
  | "hetzner"
  | "aws"
  | "digitalocean"
  | "cloudflare";

interface ActionRequest {
  action: "create" | "delete" | "start" | "stop" | "reboot";
  resource_type: ResourceType;
  provider: Provider;
  resource_id?: string;        // existing resource (for delete/start/stop/reboot)
  payload?: Record<string, unknown>;
}

interface AdapterResult {
  ok: boolean;
  provider_resource_id?: string;
  ip_address?: string | null;
  endpoint_url?: string | null;
  raw?: unknown;
  message?: string;
}

interface ProviderContext {
  apiKey: string | undefined;
  region?: string;
}

// ---------- Provider adapters ----------
// Each adapter calls the real provider REST API. If credentials are missing,
// it returns ok:false with a clear message — the row is still created locally
// so the UX works end-to-end before keys are configured.

const Hetzner = {
  baseUrl: "https://api.hetzner.cloud/v1",

  async createServer(ctx: ProviderContext, p: any): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "HETZNER_API_TOKEN not configured" };
    const body = {
      name: p.name,
      server_type: p.server_type ?? "cx22",
      image: p.image ?? "ubuntu-22.04",
      location: p.location ?? "nbg1",
      ssh_keys: p.ssh_keys ?? [],
      start_after_create: true,
    };
    const r = await fetch(`${Hetzner.baseUrl}/servers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, message: `Hetzner ${r.status}: ${JSON.stringify(data)}`, raw: data };
    return {
      ok: true,
      provider_resource_id: String(data.server.id),
      ip_address: data.server?.public_net?.ipv4?.ip ?? null,
      raw: data,
    };
  },

  async deleteServer(ctx: ProviderContext, id: string): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "HETZNER_API_TOKEN not configured" };
    const r = await fetch(`${Hetzner.baseUrl}/servers/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
    });
    if (!r.ok && r.status !== 404) {
      const data = await r.text();
      return { ok: false, message: `Hetzner ${r.status}: ${data}` };
    }
    return { ok: true };
  },

  async powerAction(ctx: ProviderContext, id: string, op: "poweron" | "poweroff" | "reboot"): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "HETZNER_API_TOKEN not configured" };
    const r = await fetch(`${Hetzner.baseUrl}/servers/${id}/actions/${op}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, message: `Hetzner ${r.status}: ${JSON.stringify(data)}`, raw: data };
    return { ok: true, raw: data };
  },

  async createNetwork(ctx: ProviderContext, p: any): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "HETZNER_API_TOKEN not configured" };
    const r = await fetch(`${Hetzner.baseUrl}/networks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.name, ip_range: p.cidr_block ?? "10.0.0.0/16" }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, message: `Hetzner ${r.status}: ${JSON.stringify(data)}`, raw: data };
    return { ok: true, provider_resource_id: String(data.network.id), raw: data };
  },
};

const DigitalOcean = {
  baseUrl: "https://api.digitalocean.com/v2",

  async createDroplet(ctx: ProviderContext, p: any): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "DIGITALOCEAN_TOKEN not configured" };
    const body = {
      name: p.name,
      region: p.region ?? "nyc3",
      size: p.size ?? "s-1vcpu-1gb",
      image: p.image ?? "ubuntu-22-04-x64",
      ssh_keys: p.ssh_keys ?? [],
    };
    const r = await fetch(`${DigitalOcean.baseUrl}/droplets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, message: `DO ${r.status}: ${JSON.stringify(data)}`, raw: data };
    return {
      ok: true,
      provider_resource_id: String(data.droplet.id),
      ip_address: data.droplet?.networks?.v4?.[0]?.ip_address ?? null,
      raw: data,
    };
  },

  async deleteDroplet(ctx: ProviderContext, id: string): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "DIGITALOCEAN_TOKEN not configured" };
    const r = await fetch(`${DigitalOcean.baseUrl}/droplets/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
    });
    if (!r.ok && r.status !== 404) {
      return { ok: false, message: `DO ${r.status}: ${await r.text()}` };
    }
    return { ok: true };
  },

  async dropletAction(ctx: ProviderContext, id: string, type: "power_on" | "power_off" | "reboot"): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "DIGITALOCEAN_TOKEN not configured" };
    const r = await fetch(`${DigitalOcean.baseUrl}/droplets/${id}/actions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, message: `DO ${r.status}: ${JSON.stringify(data)}`, raw: data };
    return { ok: true, raw: data };
  },

  async createDatabase(ctx: ProviderContext, p: any): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "DIGITALOCEAN_TOKEN not configured" };
    const r = await fetch(`${DigitalOcean.baseUrl}/databases`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: p.name,
        engine: p.engine ?? "pg",
        version: p.version,
        region: p.region ?? "nyc3",
        size: p.size ?? "db-s-1vcpu-1gb",
        num_nodes: 1,
      }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, message: `DO ${r.status}: ${JSON.stringify(data)}`, raw: data };
    return {
      ok: true,
      provider_resource_id: String(data.database.id),
      endpoint_url: data.database?.connection?.uri ?? null,
      raw: data,
    };
  },
};

// AWS adapter — uses SigV4 via dynamic import. For brevity we stub real calls
// and surface a clear "not configured" message; the structure is in place to
// drop in the AWS SDK when you wire keys.
const AWS = {
  async createInstance(ctx: ProviderContext, p: any): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "AWS_ACCESS_KEY_ID not configured (also need AWS_SECRET_ACCESS_KEY)" };
    // Real EC2 RunInstances call goes here once SDK is added.
    return { ok: false, message: "AWS adapter scaffolded — wire SDK + RunInstances next" };
  },
  async createBucket(ctx: ProviderContext, p: any): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "AWS_ACCESS_KEY_ID not configured" };
    return { ok: false, message: "AWS S3 adapter scaffolded — wire SDK + CreateBucket next" };
  },
  async createRds(ctx: ProviderContext, p: any): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "AWS_ACCESS_KEY_ID not configured" };
    return { ok: false, message: "AWS RDS adapter scaffolded" };
  },
};

const Cloudflare = {
  baseUrl: "https://api.cloudflare.com/client/v4",

  async createDnsRecord(ctx: ProviderContext, p: any): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "CLOUDFLARE_API_TOKEN not configured" };
    const zoneId = p.zone_id;
    if (!zoneId) return { ok: false, message: "Cloudflare zone_id required in payload" };
    const r = await fetch(`${Cloudflare.baseUrl}/zones/${zoneId}/dns_records`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: p.record_type,
        name: p.name,
        content: p.value,
        ttl: p.ttl ?? 300,
        proxied: p.proxied ?? false,
      }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, message: `CF ${r.status}: ${JSON.stringify(data)}`, raw: data };
    return { ok: true, provider_resource_id: data.result?.id, raw: data };
  },

  async deleteDnsRecord(ctx: ProviderContext, zoneId: string, recordId: string): Promise<AdapterResult> {
    if (!ctx.apiKey) return { ok: false, message: "CLOUDFLARE_API_TOKEN not configured" };
    const r = await fetch(`${Cloudflare.baseUrl}/zones/${zoneId}/dns_records/${recordId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
    });
    if (!r.ok && r.status !== 404) return { ok: false, message: `CF ${r.status}: ${await r.text()}` };
    return { ok: true };
  },
};

// ---------- Dispatcher ----------

function resolveCtx(provider: Provider): ProviderContext {
  switch (provider) {
    case "hetzner":      return { apiKey: Deno.env.get("HETZNER_API_TOKEN") };
    case "digitalocean": return { apiKey: Deno.env.get("DIGITALOCEAN_TOKEN") };
    case "aws":          return { apiKey: Deno.env.get("AWS_ACCESS_KEY_ID") };
    case "cloudflare":   return { apiKey: Deno.env.get("CLOUDFLARE_API_TOKEN") };
  }
}

async function dispatch(req: ActionRequest): Promise<AdapterResult> {
  const ctx = resolveCtx(req.provider);
  const p = req.payload ?? {};

  if (req.resource_type === "compute") {
    if (req.action === "create") {
      if (req.provider === "hetzner") return Hetzner.createServer(ctx, p);
      if (req.provider === "digitalocean") return DigitalOcean.createDroplet(ctx, p);
      if (req.provider === "aws") return AWS.createInstance(ctx, p);
    }
    if (req.action === "delete" && p.provider_resource_id) {
      if (req.provider === "hetzner") return Hetzner.deleteServer(ctx, p.provider_resource_id as string);
      if (req.provider === "digitalocean") return DigitalOcean.deleteDroplet(ctx, p.provider_resource_id as string);
    }
    if (["start", "stop", "reboot"].includes(req.action) && p.provider_resource_id) {
      const id = p.provider_resource_id as string;
      if (req.provider === "hetzner") {
        const op = req.action === "start" ? "poweron" : req.action === "stop" ? "poweroff" : "reboot";
        return Hetzner.powerAction(ctx, id, op as any);
      }
      if (req.provider === "digitalocean") {
        const op = req.action === "start" ? "power_on" : req.action === "stop" ? "power_off" : "reboot";
        return DigitalOcean.dropletAction(ctx, id, op as any);
      }
    }
  }

  if (req.resource_type === "database" && req.action === "create") {
    if (req.provider === "digitalocean") return DigitalOcean.createDatabase(ctx, p);
    if (req.provider === "aws") return AWS.createRds(ctx, p);
  }

  if (req.resource_type === "storage" && req.action === "create") {
    if (req.provider === "aws") return AWS.createBucket(ctx, p);
  }

  if (req.resource_type === "vpc" && req.action === "create") {
    if (req.provider === "hetzner") return Hetzner.createNetwork(ctx, p);
  }

  if (req.resource_type === "dns") {
    if (req.action === "create") return Cloudflare.createDnsRecord(ctx, p);
    if (req.action === "delete" && p.zone_id && p.provider_resource_id) {
      return Cloudflare.deleteDnsRecord(ctx, p.zone_id as string, p.provider_resource_id as string);
    }
  }

  return { ok: false, message: `Unsupported: ${req.action} ${req.resource_type} on ${req.provider}` };
}

// ---------- HTTP entrypoint ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const body = (await req.json()) as ActionRequest;
    if (!body?.action || !body?.resource_type || !body?.provider) {
      return new Response(JSON.stringify({ error: "action, resource_type, provider required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the operation up-front
    const { data: opRow } = await supabase
      .from("resource_operations")
      .insert({
        user_id: userId,
        resource_type: body.resource_type,
        resource_id: body.resource_id ?? null,
        provider: body.provider,
        action: body.action,
        status: "running",
        request: body.payload ?? {},
      })
      .select("id")
      .single();

    const result = await dispatch(body);

    await supabase
      .from("resource_operations")
      .update({
        status: result.ok ? "succeeded" : "failed",
        response: (result.raw ?? {}) as any,
        error: result.ok ? null : result.message ?? "unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", opRow?.id);

    return new Response(JSON.stringify({ operation_id: opRow?.id, ...result }), {
      status: result.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
