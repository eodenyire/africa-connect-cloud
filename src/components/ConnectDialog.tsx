import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Terminal, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type ConnectTarget = {
  kind: "compute" | "database";
  name: string;
  region: string;
  // compute
  ip?: string | null;
  os?: string;
  // database
  engine?: string;
  port?: number | null;
  connectionString?: string | null;
};

type Line = { text: string; tone?: "muted" | "ok" | "warn" | "err" | "prompt" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const buildSshCommand = (t: ConnectTarget) => `ssh root@${t.ip ?? "host"}`;

const buildDbCommand = (t: ConnectTarget) => {
  const host = `${t.name}.${t.region}.ac-db.africa`;
  if (t.engine === "redis") return `redis-cli -h ${host} -p ${t.port ?? 6379} -a ********`;
  if (t.engine === "mongodb") return `mongosh "mongodb://acuser:********@${host}:${t.port ?? 27017}/${t.name}"`;
  return `psql "postgresql://acuser:********@${host}:${t.port ?? 5432}/${t.name}?sslmode=require"`;
};

const computeBootSequence = (t: ConnectTarget): Line[] => [
  { text: `$ ${buildSshCommand(t)}`, tone: "prompt" },
  { text: `Resolving ${t.ip ?? "host"} via Africa Cloud edge router (${t.region})...`, tone: "muted" },
  { text: `Negotiating SSH-2.0 handshake... ed25519 fingerprint verified ✓`, tone: "ok" },
  { text: `Authenticated using publickey (acctl-managed)`, tone: "ok" },
  { text: ``, },
  { text: `Welcome to ${t.os ?? "Ubuntu 22.04 LTS"} (GNU/Linux 6.5.0-ac-cloud x86_64)`, tone: "muted" },
  { text: ` * Africa Cloud control plane: connected`, tone: "muted" },
  { text: ` * Region: ${t.region}   Zone: ${t.region}-a`, tone: "muted" },
  { text: ` * Last login: just now from 102.68.14.22`, tone: "muted" },
  { text: ``, },
  { text: `root@${t.name}:~# uname -a`, tone: "prompt" },
  { text: `Linux ${t.name} 6.5.0-ac-cloud #1 SMP x86_64 GNU/Linux`, tone: "muted" },
  { text: `root@${t.name}:~# systemctl is-system-running`, tone: "prompt" },
  { text: `running`, tone: "ok" },
  { text: `root@${t.name}:~# _`, tone: "prompt" },
];

const dbBootSequence = (t: ConnectTarget): Line[] => {
  const host = `${t.name}.${t.region}.ac-db.africa`;
  if (t.engine === "redis") {
    return [
      { text: `$ ${buildDbCommand(t)}`, tone: "prompt" },
      { text: `Connecting to ${host}:${t.port ?? 6379}...`, tone: "muted" },
      { text: `TLS handshake complete ✓`, tone: "ok" },
      { text: `${host}:${t.port ?? 6379}> PING`, tone: "prompt" },
      { text: `PONG`, tone: "ok" },
      { text: `${host}:${t.port ?? 6379}> INFO server`, tone: "prompt" },
      { text: `redis_version:7.2.4`, tone: "muted" },
      { text: `os:Linux 6.5.0-ac-cloud x86_64`, tone: "muted" },
      { text: `${host}:${t.port ?? 6379}> _`, tone: "prompt" },
    ];
  }
  if (t.engine === "mongodb") {
    return [
      { text: `$ ${buildDbCommand(t)}`, tone: "prompt" },
      { text: `Connecting to mongodb://${host}:${t.port ?? 27017}/${t.name}`, tone: "muted" },
      { text: `Using MongoDB: 7.0.4   Mongosh: 2.1.1`, tone: "muted" },
      { text: `Authenticated as acuser ✓`, tone: "ok" },
      { text: `${t.name}> db.runCommand({ ping: 1 })`, tone: "prompt" },
      { text: `{ ok: 1 }`, tone: "ok" },
      { text: `${t.name}> _`, tone: "prompt" },
    ];
  }
  return [
    { text: `$ ${buildDbCommand(t)}`, tone: "prompt" },
    { text: `Connecting to ${host}:${t.port ?? 5432} (sslmode=require)...`, tone: "muted" },
    { text: `SSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384) ✓`, tone: "ok" },
    { text: `psql (16.1, server 16.1)`, tone: "muted" },
    { text: `${t.name}=> SELECT version();`, tone: "prompt" },
    { text: `PostgreSQL 16.1 on x86_64-africa-cloud, compiled by gcc`, tone: "muted" },
    { text: `${t.name}=> SELECT now();`, tone: "prompt" },
    { text: `${new Date().toISOString()}`, tone: "muted" },
    { text: `${t.name}=> _`, tone: "prompt" },
  ];
};

export const ConnectDialog = ({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: ConnectTarget | null;
}) => {
  const [lines, setLines] = useState<Line[]>([]);
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !target) return;
    let cancelled = false;
    setLines([]);
    setConnected(false);
    setLatency(null);

    const seq = target.kind === "compute" ? computeBootSequence(target) : dbBootSequence(target);

    (async () => {
      for (let i = 0; i < seq.length; i++) {
        if (cancelled) return;
        await sleep(180 + Math.random() * 220);
        setLines((prev) => [...prev, seq[i]]);
        if (scrollerRef.current) {
          scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
        }
      }
      if (cancelled) return;
      setConnected(true);
      setLatency(Math.floor(12 + Math.random() * 28));
    })();

    return () => {
      cancelled = true;
    };
  }, [open, target]);

  if (!target) return null;

  const command = target.kind === "compute" ? buildSshCommand(target) : buildDbCommand(target);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const toneClass = (tone?: Line["tone"]) =>
    tone === "ok"
      ? "text-green-400"
      : tone === "warn"
      ? "text-yellow-400"
      : tone === "err"
      ? "text-destructive"
      : tone === "prompt"
      ? "text-primary"
      : "text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Terminal className="h-5 w-5 text-primary" />
            Connect to {target.name}
          </DialogTitle>
          <DialogDescription>
            {target.kind === "compute"
              ? "Live SSH session via the Africa Cloud control plane."
              : `Secure ${target.engine ?? "database"} session via the Africa Cloud control plane.`}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="terminal" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="details">Connection details</TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="mt-4">
            <div className="rounded-lg border border-border bg-[hsl(var(--background))] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/40">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                  <span className="ml-3 text-xs text-muted-foreground font-mono">
                    {target.kind === "compute" ? `ssh • ${target.name}` : `${target.engine ?? "db"} • ${target.name}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {connected ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Connected{latency !== null ? ` · ${latency}ms` : ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-primary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Establishing session…
                    </span>
                  )}
                </div>
              </div>
              <div
                ref={scrollerRef}
                className="h-80 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
              >
                {lines.map((l, i) => (
                  <div key={i} className={toneClass(l.tone)}>
                    {l.text || "\u00A0"}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <code className="text-xs text-muted-foreground font-mono truncate mr-2">{command}</code>
              <Button size="sm" variant="outline" onClick={() => copy(command, "Command")} className="gap-2 shrink-0">
                <Copy className="h-3.5 w-3.5" /> Copy command
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="details" className="mt-4 space-y-3">
            <DetailRow label="Region" value={target.region} />
            {target.kind === "compute" ? (
              <>
                <DetailRow label="Public IP" value={target.ip ?? "—"} onCopy={() => target.ip && copy(target.ip, "IP")} />
                <DetailRow label="OS image" value={target.os ?? "—"} />
                <DetailRow label="SSH user" value="root" />
                <DetailRow label="SSH command" value={buildSshCommand(target)} onCopy={() => copy(buildSshCommand(target), "SSH command")} />
                <DetailRow label="acctl" value={`acctl compute ssh ${target.name}`} onCopy={() => copy(`acctl compute ssh ${target.name}`, "CLI command")} />
              </>
            ) : (
              <>
                <DetailRow label="Engine" value={`${target.engine ?? "—"}`} />
                <DetailRow label="Host" value={`${target.name}.${target.region}.ac-db.africa`} onCopy={() => copy(`${target.name}.${target.region}.ac-db.africa`, "Host")} />
                <DetailRow label="Port" value={String(target.port ?? "—")} />
                <DetailRow
                  label="Connection string"
                  value={target.connectionString ?? buildDbCommand(target)}
                  onCopy={() => copy(target.connectionString ?? buildDbCommand(target), "Connection string")}
                />
                <DetailRow label="acctl" value={`acctl db connect ${target.name}`} onCopy={() => copy(`acctl db connect ${target.name}`, "CLI command")} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const DetailRow = ({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-mono text-foreground truncate">{value}</div>
    </div>
    {onCopy && (
      <Button size="icon" variant="ghost" onClick={onCopy} className="shrink-0">
        <Copy className="h-4 w-4" />
      </Button>
    )}
  </div>
);
