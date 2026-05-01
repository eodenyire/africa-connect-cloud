import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type WorkspaceContext = {
  userId: string;
  orgId: string;
  projectId: string | null;
};

// Audit/cost/registry/operations tables don't exist in this project's schema yet.
// These helpers are intentional no-ops so the rest of the control plane keeps working.
const recordAudit = async (
  _ctx: WorkspaceContext,
  _action: string,
  _resourceType?: string,
  _resourceId?: string,
  _details: Json = {}
) => {
  /* no-op */
};

const recordCost = async (_input: {
  orgId: string;
  projectId: string | null;
  resourceId: string;
  resourceType: string;
  amountUsd: number;
  usageUnit?: string;
  usageQuantity?: number;
}) => {
  /* no-op */
};

// ---------- Compute ----------

export const createComputeInstance = async (
  ctx: WorkspaceContext,
  payload: {
    name: string;
    region: string;
    machine_type: string;
    vcpus: number;
    ram_gb: number;
    disk_gb: number;
    os_image: string;
    status: string;
    ip_address: string | null;
    price: number;
  }
) => {
  const { data, error } = await supabase
    .from("virtual_machines")
    .insert({
      user_id: ctx.userId,
      name: payload.name,
      region: payload.region,
      machine_type: payload.machine_type,
      vcpus: payload.vcpus,
      ram_gb: payload.ram_gb,
      disk_gb: payload.disk_gb,
      os_image: payload.os_image,
      status: payload.status,
      ip_address: payload.ip_address,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordAudit(ctx, "compute.create", "compute", data.id, { name: payload.name });
  await recordCost({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    resourceId: data.id,
    resourceType: "compute",
    amountUsd: payload.price,
  });
  return data;
};

export const listComputeInstances = async (userId: string) =>
  supabase.from("virtual_machines").select("*").eq("user_id", userId).order("created_at", { ascending: false });

export const updateComputeStatus = async (ctx: WorkspaceContext, vmId: string, status: string) => {
  const { error } = await supabase
    .from("virtual_machines")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", vmId);
  if (error) throw error;
  await recordAudit(ctx, "compute.update", "compute", vmId, { status });
};

export const deleteComputeInstance = async (ctx: WorkspaceContext, vmId: string) => {
  const { error } = await supabase.from("virtual_machines").delete().eq("id", vmId);
  if (error) throw error;
  await recordAudit(ctx, "compute.delete", "compute", vmId);
};

// ---------- Databases ----------

export const createDatabaseInstance = async (
  ctx: WorkspaceContext,
  payload: {
    name: string;
    engine: string;
    version: string;
    region: string;
    plan: string;
    storage_gb: number;
    status: string;
    connection_string: string;
    port: number;
    price: number;
  }
) => {
  const { data, error } = await supabase
    .from("database_instances")
    .insert({
      user_id: ctx.userId,
      name: payload.name,
      engine: payload.engine,
      version: payload.version,
      region: payload.region,
      plan: payload.plan,
      storage_gb: payload.storage_gb,
      status: payload.status,
      connection_string: payload.connection_string,
      port: payload.port,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordAudit(ctx, "database.create", "database", data.id, { name: payload.name });
  await recordCost({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    resourceId: data.id,
    resourceType: "database",
    amountUsd: payload.price,
  });
  return data;
};

export const listDatabaseInstances = async (userId: string) =>
  supabase.from("database_instances").select("*").eq("user_id", userId).order("created_at", { ascending: false });

export const updateDatabaseStatus = async (ctx: WorkspaceContext, dbId: string, status: string) => {
  const { error } = await supabase
    .from("database_instances")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", dbId);
  if (error) throw error;
  await recordAudit(ctx, "database.update", "database", dbId, { status });
};

export const deleteDatabaseInstance = async (ctx: WorkspaceContext, dbId: string) => {
  const { error } = await supabase.from("database_instances").delete().eq("id", dbId);
  if (error) throw error;
  await recordAudit(ctx, "database.delete", "database", dbId);
};

// ---------- Storage ----------

export const createStorageBucket = async (
  ctx: WorkspaceContext,
  payload: {
    name: string;
    region: string;
    visibility: string;
    storage_class: string;
    status: string;
    price: number;
  }
) => {
  const { data, error } = await supabase
    .from("storage_buckets")
    .insert({
      user_id: ctx.userId,
      name: payload.name,
      region: payload.region,
      visibility: payload.visibility,
      storage_class: payload.storage_class,
      status: payload.status,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordAudit(ctx, "storage.create", "storage", data.id, { name: payload.name });
  await recordCost({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    resourceId: data.id,
    resourceType: "storage",
    amountUsd: payload.price,
  });
  return data;
};

export const listStorageBuckets = async (userId: string) =>
  supabase.from("storage_buckets").select("*").eq("user_id", userId).order("created_at", { ascending: false });

export const deleteStorageBucket = async (ctx: WorkspaceContext, bucketId: string) => {
  const { error } = await supabase.from("storage_buckets").delete().eq("id", bucketId);
  if (error) throw error;
  await recordAudit(ctx, "storage.delete", "storage", bucketId);
};

export const listStorageObjects = async (bucketId: string) =>
  supabase.from("storage_objects").select("*").eq("bucket_id", bucketId).order("created_at", { ascending: false });

export const createStorageObject = async (payload: {
  bucketId: string;
  userId: string;
  key: string;
  sizeBytes: number;
  contentType: string;
}) =>
  supabase.from("storage_objects").insert({
    bucket_id: payload.bucketId,
    user_id: payload.userId,
    key: payload.key,
    size_bytes: payload.sizeBytes,
    content_type: payload.contentType,
  });

export const deleteStorageObject = async (objectId: string) =>
  supabase.from("storage_objects").delete().eq("id", objectId);

export const updateStorageBucketStats = async (
  bucketId: string,
  payload: { objectCount: number; sizeBytes: number }
) =>
  supabase
    .from("storage_buckets")
    .update({
      object_count: payload.objectCount,
      size_bytes: payload.sizeBytes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bucketId);

// ---------- Edge nodes ----------

export const createEdgeNode = async (
  ctx: WorkspaceContext,
  payload: {
    name: string;
    region: string;
    node_type: string;
    vcpus: number;
    ram_gb: number;
    disk_gb: number;
    status: string;
    ip_address: string | null;
    sync_status: string;
    price: number;
  }
) => {
  const { data, error } = await supabase
    .from("edge_nodes")
    .insert({
      user_id: ctx.userId,
      name: payload.name,
      region: payload.region,
      node_type: payload.node_type,
      vcpus: payload.vcpus,
      ram_gb: payload.ram_gb,
      disk_gb: payload.disk_gb,
      status: payload.status,
      ip_address: payload.ip_address,
      sync_status: payload.sync_status,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordAudit(ctx, "edge.create", "edge", data.id, { name: payload.name });
  await recordCost({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    resourceId: data.id,
    resourceType: "edge",
    amountUsd: payload.price,
  });
  return data;
};

export const listEdgeNodes = async (userId: string) =>
  supabase.from("edge_nodes").select("*").eq("user_id", userId).order("created_at", { ascending: false });

export const updateEdgeNodeStatus = async (
  ctx: WorkspaceContext,
  nodeId: string,
  status: string,
  sync_status: string
) => {
  const { error } = await supabase
    .from("edge_nodes")
    .update({ status, sync_status, updated_at: new Date().toISOString() })
    .eq("id", nodeId);
  if (error) throw error;
  await recordAudit(ctx, "edge.update", "edge", nodeId, { status, sync_status });
};

export const deleteEdgeNode = async (ctx: WorkspaceContext, nodeId: string) => {
  const { error } = await supabase.from("edge_nodes").delete().eq("id", nodeId);
  if (error) throw error;
  await recordAudit(ctx, "edge.delete", "edge", nodeId);
};

// ---------- Networking ----------

export const createVpc = async (
  ctx: WorkspaceContext,
  payload: { name: string; region: string; cidr_block: string; status: string; price: number }
) => {
  const { data, error } = await supabase
    .from("vpcs")
    .insert({
      user_id: ctx.userId,
      name: payload.name,
      region: payload.region,
      cidr_block: payload.cidr_block,
      status: payload.status,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordAudit(ctx, "network.create", "network", data.id, { name: payload.name });
  await recordCost({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    resourceId: data.id,
    resourceType: "network",
    amountUsd: payload.price,
  });
  return data;
};

export const listVpcs = async (userId: string) =>
  supabase.from("vpcs").select("*").eq("user_id", userId).order("created_at", { ascending: false });

export const deleteVpc = async (ctx: WorkspaceContext, vpcId: string) => {
  const { error } = await supabase.from("vpcs").delete().eq("id", vpcId);
  if (error) throw error;
  await recordAudit(ctx, "network.delete", "network", vpcId);
};

export const createLoadBalancer = async (
  ctx: WorkspaceContext,
  payload: {
    name: string;
    region: string;
    lb_type: string;
    protocol: string;
    port: number;
    status: string;
    dns_name: string | null;
    price: number;
  }
) => {
  const { data, error } = await supabase
    .from("load_balancers")
    .insert({
      user_id: ctx.userId,
      name: payload.name,
      region: payload.region,
      lb_type: payload.lb_type,
      protocol: payload.protocol,
      port: payload.port,
      status: payload.status,
      dns_name: payload.dns_name,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordAudit(ctx, "load-balancer.create", "load-balancer", data.id, { name: payload.name });
  await recordCost({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    resourceId: data.id,
    resourceType: "load-balancer",
    amountUsd: payload.price,
  });
  return data;
};

export const listLoadBalancers = async (userId: string) =>
  supabase.from("load_balancers").select("*").eq("user_id", userId).order("created_at", { ascending: false });

export const deleteLoadBalancer = async (ctx: WorkspaceContext, lbId: string) => {
  const { error } = await supabase.from("load_balancers").delete().eq("id", lbId);
  if (error) throw error;
  await recordAudit(ctx, "load-balancer.delete", "load-balancer", lbId);
};

export const createDnsRecord = async (
  ctx: WorkspaceContext,
  payload: { zone: string; record_type: string; name: string; value: string; ttl: number; status: string }
) => {
  const { data, error } = await supabase
    .from("dns_records")
    .insert({
      user_id: ctx.userId,
      zone: payload.zone,
      record_type: payload.record_type,
      name: payload.name,
      value: payload.value,
      ttl: payload.ttl,
      status: payload.status,
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordAudit(ctx, "dns.create", "dns", data.id, { name: payload.name });
  return data;
};

export const listDnsRecords = async (userId: string) =>
  supabase.from("dns_records").select("*").eq("user_id", userId).order("created_at", { ascending: false });

export const deleteDnsRecord = async (ctx: WorkspaceContext, recordId: string) => {
  const { error } = await supabase.from("dns_records").delete().eq("id", recordId);
  if (error) throw error;
  await recordAudit(ctx, "dns.delete", "dns", recordId);
};

// ---------- Org/IAM/IaC/Tokens (no backing tables yet — return empty stubs) ----------

const emptyResult = <T,>(): { data: T[]; error: null } => ({ data: [], error: null });

export const listOrganizationMembers = async (_orgId: string) => emptyResult<never>();
export const addOrganizationMember = async (_orgId: string, _userId: string, _role: string) =>
  ({ data: null, error: null });
export const updateOrganizationMemberRole = async (_memberId: string, _role: string) =>
  ({ data: null, error: null });
export const removeOrganizationMember = async (_memberId: string) => ({ data: null, error: null });

export const listRoles = async (_orgId: string) => emptyResult<never>();
export const createRole = async (_orgId: string, _name: string, _description: string, _permissions: Json) =>
  ({ data: null, error: null });

export const listAuditLogs = async (_orgId: string) => emptyResult<never>();
export const listCostRecords = async (_orgId: string) => emptyResult<never>();

export const listIacTemplates = async (_orgId: string) => emptyResult<never>();
export const createIacTemplate = async (
  _ctx: WorkspaceContext,
  _payload: { name: string; description: string; template: string; language: string }
) => ({ data: null, error: null });

export const listIacRuns = async (_orgId: string) => emptyResult<never>();
export const createIacRun = async (
  _ctx: WorkspaceContext,
  _payload: { templateId: string; plan: Json; policyViolations: Json }
) => ({ data: null, error: null });

export const listIacRunSteps = async (_runId: string) => emptyResult<never>();
export const createIacRunStep = async (
  _runId: string,
  _stepOrder: number,
  _action: string,
  _status: string,
  _details: Json
) => ({ data: null, error: null });

export const listApiTokens = async (_userId: string) => emptyResult<never>();
export const createApiToken = async (
  _ctx: WorkspaceContext,
  _payload: { name: string; tokenHash: string; expiresAt?: string | null }
) => ({ data: null, error: null });
export const revokeApiToken = async (_tokenId: string) => ({ data: null, error: null });

export const listSsoRequests = async (_userId: string) => emptyResult<never>();
export const createSsoRequest = async (
  _ctx: WorkspaceContext,
  _payload: { companyDomain: string; provider: string }
) => ({ data: null, error: null });
