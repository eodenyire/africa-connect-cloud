import { useEffect, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Op = {
  id: string;
  resource_type: string;
  resource_id: string | null;
  provider: string;
  action: string;
  status: string;
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

const STATUS = (s: string) =>
  s === "succeeded" ? <CheckCircle2 className="h-4 w-4 text-green-400" /> :
  s === "failed"    ? <XCircle      className="h-4 w-4 text-destructive" /> :
                      <Loader2      className="h-4 w-4 text-primary animate-spin" />;

const Operations = () => {
  const { user } = useAuth();
  const [ops, setOps] = useState<Op[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("resource_operations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setOps((data as Op[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`ops-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "resource_operations" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return (
    <ConsoleLayout
      title="Operations"
      actions={<Button variant="ghost" size="sm" onClick={load}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>}
    >
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Card>
          <CardHeader><CardTitle className="text-lg font-heading">Provisioning activity</CardTitle></CardHeader>
          <CardContent>
            {ops.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No operations yet. Provision a resource to see it here.</p>
            ) : (
              <div className="space-y-2">
                {ops.map((op) => (
                  <div key={op.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center gap-3">
                      {STATUS(op.status)}
                      <div>
                        <div className="font-medium text-foreground">
                          {op.action} <span className="text-muted-foreground">·</span> {op.resource_type}
                          <span className="text-muted-foreground"> on </span>
                          <span className="text-primary">{op.provider}</span>
                        </div>
                        {op.error && <div className="text-xs text-destructive mt-0.5 font-mono">{op.error}</div>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(op.started_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ConsoleLayout>
  );
};

export default Operations;
