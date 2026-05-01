import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WorkspaceProfile = {
  org_name: string | null;
  plan: string | null;
  region: string | null;
  onboarded: boolean | null;
};

type Organization = {
  id: string;
  name: string;
  region: string | null;
  plan: string | null;
};

type Project = {
  id: string;
  name: string;
  environment: string;
};

export const useWorkspace = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setOrganization(null);
      setProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("org_name, plan, region, onboarded")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      setLoading(false);
      return;
    }

    setProfile(profileData);

    // Synthesize a workspace from the user/profile so the rest of the app
    // (which expects org/project context) keeps working without a separate
    // organizations table.
    setOrganization({
      id: user.id,
      name: profileData.org_name ?? "Default Organization",
      region: profileData.region ?? "nairobi",
      plan: profileData.plan ?? "starter",
    });

    setProject({
      id: user.id,
      name: "default",
      environment: "production",
    });

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchWorkspace();
  }, [authLoading, fetchWorkspace]);

  return {
    profile,
    organization,
    project,
    loading: authLoading || loading,
    refresh: fetchWorkspace,
  };
};
