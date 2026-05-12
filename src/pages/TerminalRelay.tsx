import { useEffect, useMemo, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Terminal, ShieldCheck, ShieldAlert, Loader2, Copy, RefreshCw, Trash2, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  loadRelayConfig, saveRelayConfig, clearRelayConfig, validateRelay, suggestRelayUrl,
  type RelayConfig,
} from "@/lib/terminalRelay";

const TerminalRelayPage = () => {
  const { organization, profile } = useWorkspace();
  const [cfg, setCfg] = useState<RelayConfig | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const c = loadRelayConfig();
    setCfg(c);
    setUrl(c?.url ?? "");
  }, []);

  const slug = ((organization as unknown as { slug?: string } | null)?.slug) ?? profile?.org_name ?? "workspace";
  const suggestion = useMemo(() => suggestRelayUrl(slug), [slug]);

  const validated = !!cfg?.validatedAt;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const generate = () => {
    setUrl(suggestion);
    setLastError(null);
  };

  const test = async (persistOnSuccess: boolean) => {
    if (!url.trim()) { toast.error("Enter a relay URL first"); return; }
    setBusy(true);
    setLastError(null);
    const result = await validateRelay(url.trim());
    setBusy(false);
    if (result.ok) {
      const next: RelayConfig = {
        url: url.trim(),
        validatedAt: new Date().toISOString(),
        latencyMs: result.latencyMs,
      };
      if (persistOnSuccess) {
        saveRelayConfig(next);
        setCfg(next);
        toast.success(`Relay validated (${result.latencyMs}ms) — Connect enabled`);
      } else {
        toast.success(`Reachable in ${result.latencyMs}ms`);
      }
    } else {
      const err = result.error;
      setLastError(err);
      toast.error(`Relay unreachable: ${err}`);
    }
  };

  const reset = () => {
    clearRelayConfig();
    setCfg(null);
    setUrl("");
    setLastError(null);
    toast.success("Relay configuration cleared");
  };

  return (
    <ConsoleLayout title="Terminal Relay">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Terminal className="h-6 w-6 text-primary" /> Terminal relay
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect sessions stream raw bytes through a WebSocket relay you control. Provision the
            relay once per workspace, validate connectivity, and live SSH / database consoles
            unlock across the console.
          </p>
        </div>

        {/* Status */}
        <Card className="p-5 flex items-center gap-4">
          {validated ? (
            <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
          ) : (
            <ShieldAlert className="h-8 w-8 text-destructive shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-foreground">
                {validated ? "Relay active" : "Relay not configured"}
              </span>
              {validated && cfg?.latencyMs != null && (
                <Badge variant="secondary" className="text-xs">{cfg.latencyMs}ms</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate font-mono">
              {cfg?.url ?? "No relay endpoint saved"}
            </p>
            {validated && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Last validated {new Date(cfg!.validatedAt!).toLocaleString()}
              </p>
            )}
          </div>
          {validated && (
            <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          )}
        </Card>

        {/* Setup wizard */}
        <Tabs defaultValue="configure">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="configure">1. Configure</TabsTrigger>
            <TabsTrigger value="install">2. Install relay</TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="mt-4">
            <Card className="p-5 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Relay endpoint
                </label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="wss://relay.example.com/ws"
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" onClick={generate} className="gap-2 shrink-0">
                    <Wand2 className="h-4 w-4" /> Generate
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Suggested: <code className="font-mono">{suggestion}</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => test(true)} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Validate &amp; save
                </Button>
                <Button variant="outline" onClick={() => test(false)} disabled={busy} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Test only
                </Button>
              </div>

              {lastError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                  <strong>Validation failed:</strong> {lastError}
                  <p className="text-muted-foreground mt-1">
                    Confirm the relay is reachable from your browser, TLS is valid, and
                    <code className="font-mono"> /health</code> accepts WebSocket upgrades.
                  </p>
                </div>
              )}
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
                <strong className="text-foreground">Health check:</strong> the relay must respond
                to a WebSocket upgrade on <code className="font-mono">/health</code>. Validation
                opens that endpoint and closes immediately.
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
