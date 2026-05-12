import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Terminal, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { XTerminal } from "@/components/XTerminal";
import { getRelayUrlForRoute } from "@/lib/terminalRelay";

const buildWsUrl = (t: ConnectTarget) => {
  const route = t.kind === "compute" ? "ssh" : "db";
  const relay = getRelayUrlForRoute(route);
  if (!relay) return undefined;
  const base = relay.replace(/\/$/, "");
  if (t.kind === "compute") return `${base}/ssh?host=${encodeURIComponent(t.ip ?? "")}&user=root`;
  const dsn = t.connectionString ?? "";
  return `${base}/db?engine=${encodeURIComponent(t.engine ?? "postgres")}&dsn=${encodeURIComponent(dsn)}`;
};

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

export const ConnectDialog = ({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: ConnectTarget | null;
}) => {
  if (!target) return null;
  const wsUrl = buildWsUrl(target);
  const banner =
    target.kind === "compute"
      ? `Africa Cloud · ${target.region}\nVM: ${target.name} (${target.os ?? "linux"}) · ${target.ip ?? "no public IP"}`
      : `Africa Cloud · ${target.region}\n${target.engine ?? "db"}: ${target.name} · port ${target.port ?? "?"}`;

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
            {!wsUrl && (
              <div className="mb-3 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 text-xs">
                  <p className="text-foreground font-medium">
                    Ruta <code className="font-mono">/{target.kind === "compute" ? "ssh" : "db"}</code> del relay no validada
                  </p>
                  <p className="text-muted-foreground">
                    Connect requiere que la ruta correspondiente del relay WebSocket pase la prueba de conectividad.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/console/terminal-relay" onClick={() => onOpenChange(false)}>
                    Configurar relay
                  </Link>
                </Button>
              </div>
            )}
            <XTerminal wsUrl={wsUrl} banner={banner} />
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
