import { useEffect, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, KeyRound, ExternalLink } from "lucide-react";
import { getProviderStatus } from "@/lib/provision";

type Row = { id: string; label: string; env: string; configured: boolean };

const HELP: Record<string, { url: string; hint: string }> = {
  HETZNER_API_TOKEN:    { url: "https://console.hetzner.cloud/",                       hint: "Hetzner → Project → Security → API Tokens" },
  DIGITALOCEAN_TOKEN:   { url: "https://cloud.digitalocean.com/account/api/tokens",    hint: "DO → API → Generate New Token (read+write)" },
  AWS_ACCESS_KEY_ID:    { url: "https://console.aws.amazon.com/iam/home#/security_credentials", hint: "Also add AWS_SECRET_ACCESS_KEY and AWS_REGION" },
  CLOUDFLARE_API_TOKEN: { url: "https://dash.cloudflare.com/profile/api-tokens",        hint: "Token with Zone:DNS:Edit on the target zones" },
};

const Providers = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await getProviderStatus();
    setRows(r.providers);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <ConsoleLayout title="Providers">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Cloud provider credentials
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              The Africa Cloud orchestrator dispatches resources to whichever upstream provider you configure.
              Add API keys as backend secrets — the orchestrator will pick them up immediately.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : rows.map((p) => {
              const help = HELP[p.env];
              return (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    {p.configured
                      ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                      : <XCircle className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <div className="font-medium text-foreground">{p.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.env}</div>
                      {help && <div className="text-xs text-muted-foreground mt-1">{help.hint}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${p.configured ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {p.configured ? "Configured" : "Not configured"}
                    </span>
                    {help && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={help.url} target="_blank" rel="noreferrer" className="gap-1">
                          <ExternalLink className="h-3.5 w-3.5" /> Get key
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-base font-heading">How real provisioning works</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Click <strong>Launch Instance</strong> in Compute and pick a provider.</p>
            <p>2. The orchestrator edge function calls the provider API (Hetzner / DigitalOcean / AWS) directly.</p>
            <p>3. The returned external resource ID and IP are saved on your row, and the operation is logged in the activity feed.</p>
            <p>4. <strong>Connect</strong> opens an xterm.js terminal connected to your VM via the configured WebSocket relay (e.g. ttyd).</p>
          </CardContent>
        </Card>
      </div>
    </ConsoleLayout>
  );
};

export default Providers;
