import { supabase } from "@/integrations/supabase/client";

export type ResourceType =
  | "compute" | "database" | "storage" | "edge" | "vpc" | "load_balancer" | "dns";
export type Provider = "hetzner" | "aws" | "digitalocean" | "cloudflare";

export interface ProvisionRequest {
  action: "create" | "delete" | "start" | "stop" | "reboot";
  resource_type: ResourceType;
  provider: Provider;
  resource_id?: string;
  payload?: Record<string, unknown>;
}

export interface ProvisionResult {
  ok: boolean;
  operation_id?: string;
  provider_resource_id?: string;
  ip_address?: string | null;
  endpoint_url?: string | null;
  message?: string;
  raw?: unknown;
}

export const provision = async (req: ProvisionRequest): Promise<ProvisionResult> => {
  const { data, error } = await supabase.functions.invoke("provision", { body: req });
  if (error) {
    return { ok: false, message: error.message ?? "Provision request failed" };
  }
  return data as ProvisionResult;
};

export const getProviderStatus = async () => {
  const { data, error } = await supabase.functions.invoke("provider-status", { body: {} });
  if (error) return { providers: [] as Array<{ id: Provider; label: string; env: string; configured: boolean }> };
  return data as { providers: Array<{ id: Provider; label: string; env: string; configured: boolean }> };
};
