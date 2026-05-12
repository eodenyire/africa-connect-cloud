import { useEffect, useMemo, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Terminal, ShieldCheck, ShieldAlert, Loader2, Copy, Trash2, Wand2,
  Server, Database,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  loadRelayConfig, clearRelayConfig, suggestRelayUrl, validateAndPersistRoute,
  ROUTE_PATHS, type RelayConfig, type RelayRoute,
} from "@/lib/terminalRelay";

const ROUTE_META: { route: RelayRoute; label: string; description: string; icon: typeof Server }[] = [
  { route: "health", label: "Health", description: "Base liveness probe", icon: ShieldCheck },
  { route: "ssh", label: "SSH", description: "Required to Connect to compute instances", icon: Server },
  { route: "db", label: "DB", description: "Required to Connect to managed databases", icon: Database },
];

const TerminalRelayPage = () => {
  const { organization, profile } = useWorkspace();
  const [cfg, setCfg] = useState<RelayConfig | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<RelayRoute | "all" | null>(null);

  useEffect(() => {
    const c = loadRelayConfig();
    setCfg(c);
    setUrl(c?.url ?? "");
  }, []);

  const slug = ((organization as unknown as { slug?: string } | null)?.slug) ?? profile?.org_name ?? "workspace";
  const suggestion = useMemo(() => suggestRelayUrl(slug), [slug]);

  const sshReady = !!cfg?.routes.ssh.validatedAt;
  const dbReady = !!cfg?.routes.db.validatedAt;
  const anyReady = sshReady || dbReady || !!cfg?.routes.health.validatedAt;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const generate = () => setUrl(suggestion);

  const runRoute = async (route: RelayRoute) => {
    if (!url.trim()) { toast.error("Introduce primero la URL del relay"); return; }
    setBusy(route);
    const r = await validateAndPersistRoute(url.trim(), route);
    setCfg(loadRelayConfig());
    setBusy(null);
    if (r.ok) toast.success(`${ROUTE_PATHS[route]} OK · ${r.latencyMs}ms`);
    else toast.error(`${ROUTE_PATHS[route]} falló: ${(r as { ok: false; error: string }).error}`);
  };

  const runAll = async () => {
    if (!url.trim()) { toast.error("Introduce primero la URL del relay"); return; }
    setBusy("all");
    for (const m of ROUTE_META) {
      await validateAndPersistRoute(url.trim(), m.route);
    }
    setCfg(loadRelayConfig());
    setBusy(null);
    toast.success("Pruebas de relay completadas");
  };

  const reset = () => {
    clearRelayConfig();
    setCfg(null);
    setUrl("");
    toast.success("Configuración del relay borrada");
  };

  return (
    <ConsoleLayout title="Terminal Relay">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Terminal className="h-6 w-6 text-primary" /> Terminal relay
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Las sesiones Connect se transmiten a través de un relay WebSocket que tú controlas.
            Cada ruta (<code className="font-mono">/ssh</code> y <code className="font-mono">/db</code>)
            se prueba por separado: el botón Connect solo se habilita para los recursos cuya ruta
            haya validado correctamente.
          </p>
        </div>

        {/* Status */}
        <Card className="p-5 flex items-center gap-4">
          {anyReady ? (
            <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
          ) : (
            <ShieldAlert className="h-8 w-8 text-destructive shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading font-semibold text-foreground">
                {anyReady ? "Relay configurado" : "Relay no configurado"}
              </span>
              <Badge variant={sshReady ? "default" : "secondary"} className="text-[10px]">
                SSH {sshReady ? "✓" : "—"}
              </Badge>
              <Badge variant={dbReady ? "default" : "secondary"} className="text-[10px]">
                DB {dbReady ? "✓" : "—"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate font-mono mt-1">
              {cfg?.url ?? "Sin endpoint guardado"}
            </p>
          </div>
          {cfg?.url && (
            <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
              <Trash2 className="h-4 w-4" /> Limpiar
            </Button>
          )}
        </Card>

        {/* Setup wizard */}
        <Tabs defaultValue="configure">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="configure">1. Configurar y probar</TabsTrigger>
            <TabsTrigger value="install">2. Instalar relay</TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="mt-4">
            <Card className="p-5 space-y-5">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Endpoint del relay
                </label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="wss://relay.example.com/ws"
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" onClick={generate} className="gap-2 shrink-0">
                    <Wand2 className="h-4 w-4" /> Generar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Sugerido: <code className="font-mono">{suggestion}</code>
                </p>
              </div>

              {/* Per-route tests */}
              <div className="space-y-2">
                {ROUTE_META.map((m) => {
                  const status = cfg?.routes[m.route];
                  const ok = !!status?.validatedAt;
                  const Icon = m.icon;
                  const isBusy = busy === m.route || busy === "all";
                  return (
                    <div
                      key={m.route}
                      className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2"
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${ok ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{m.label}</span>
                          <code className="text-[11px] font-mono text-muted-foreground">{ROUTE_PATHS[m.route]}</code>
                          {ok && status?.latencyMs != null && (
                            <Badge variant="secondary" className="text-[10px]">{status.latencyMs}ms</Badge>
                          )}
                          {ok ? (
                            <Badge className="text-[10px]">OK</Badge>
                          ) : status?.error ? (
                            <Badge variant="destructive" className="text-[10px]">Fallo</Badge>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {status?.error ?? m.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={ok ? "outline" : "default"}
                        disabled={!!busy}
                        onClick={() => runRoute(m.route)}
                        className="gap-2 shrink-0"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        {ok ? "Re-probar" : "Probar"}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button onClick={runAll} disabled={!!busy} className="gap-2">
                  {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Probar todas las rutas
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Connect SSH se habilita con <code className="font-mono">/ssh</code>; Connect DB con
                  <code className="font-mono"> /db</code>.
                </p>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="install" className="mt-4">
            <Card className="p-5 space-y-4">
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground mb-2">
                  Option A · ttyd on a single VM
                </h3>
                <CodeBlock onCopy={copy} text={`# install ttyd\nsudo apt-get install -y ttyd\n# expose bash on :7681 over ws\nttyd -p 7681 -W bash`} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Front it with Caddy/Nginx for TLS, then point this page at
                  <code className="font-mono"> wss://your-host/ws</code>.
                </p>
              </div>

              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground mb-2">
                  Option B · Africa Cloud relay container
                </h3>
                <CodeBlock onCopy={copy} text={`docker run -d --name ac-relay \\\n  -p 8443:8443 \\\n  -e AC_WORKSPACE=${slug} \\\n  -e AC_TLS_CERT=/certs/fullchain.pem \\\n  -e AC_TLS_KEY=/certs/privkey.pem \\\n  -v /etc/letsencrypt:/certs:ro \\\n  ghcr.io/africacloud/relay:latest`} />
              </div>

              <div className="rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Rutas requeridas:</strong> el relay debe aceptar
                upgrades WebSocket en <code className="font-mono">/health</code>,{" "}
                <code className="font-mono">/ssh</code> y <code className="font-mono">/db</code>.
                Cada una se prueba por separado y desbloquea el botón Connect correspondiente.
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ConsoleLayout>
  );
};

const CodeBlock = ({ text, onCopy }: { text: string; onCopy: (t: string, l: string) => void }) => (
  <div className="relative rounded-md border border-border bg-[#0A0F1A] text-xs font-mono p-3 pr-10 text-muted-foreground whitespace-pre-wrap break-all">
    {text}
    <Button
      size="icon"
      variant="ghost"
      className="absolute top-1 right-1 h-7 w-7"
      onClick={() => onCopy(text, "Snippet")}
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  </div>
);

export default TerminalRelayPage;
