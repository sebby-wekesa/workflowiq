// src/components/providers/auth.tsx
// Replaces the old Hercules OIDC + Convex auth provider.
// Exposes the same surface your components already use via useAuth():
//   { user, appUser, isLoading, isAuthenticated, signInWithEmail, signOut }
import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type AppUser, type Organization } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;            // raw Supabase auth user
  appUser: AppUser | null;      // your app_users row (role, status, org_id)
  organization: Organization | null; // the workshop this user belongs to
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Magic-link sign in for an existing/invited account
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  // Self-serve sign up that creates a brand-new workshop (org)
  signUpNewWorkshop: (
    email: string,
    fullName: string,
    workshopName: string,
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAppUser(authId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) throw error;
  return (data as AppUser) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAppUser = async (authId: string | undefined) => {
    if (!authId) { setAppUser(null); setOrganization(null); return; }
    // The DB trigger links/creates the app_users row (and a new org for a
    // brand-new signup) on first login. Poll briefly until it commits.
    let row = await fetchAppUser(authId);
    for (let i = 0; i < 4 && !row; i++) {
      await new Promise((r) => setTimeout(r, 400));
      row = await fetchAppUser(authId);
    }
    setAppUser(row);
    if (row?.org_id) {
      const { data: org } = await supabase
        .from("organizations").select("*").eq("id", row.org_id).maybeSingle();
      setOrganization((org as Organization) ?? null);
    } else {
      setOrganization(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadAppUser(data.session?.user.id);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await loadAppUser(s?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    appUser,
    organization,
    session,
    isLoading,
    isAuthenticated: !!session,
    signInWithEmail: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Migrated and invited accounts exist in public.app_users before
          // they have an auth.users identity. The database trigger claims the
          // matching row by email when Supabase creates that identity.
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error: error?.message ?? null };
    },
    signUpNewWorkshop: async (email, fullName, workshopName) => {
      // workshop_name + full_name ride along in user metadata; the DB trigger
      // reads them to create the new organization and the admin account.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: { full_name: fullName, workshop_name: workshopName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error: error?.message ?? null };
    },
    signInWithGoogle: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setAppUser(null);
      setOrganization(null);
    },
    refreshAppUser: async () => loadAppUser(session?.user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
