// src/components/providers/auth

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
    // Password-based sign in fallback
    signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
    // Self-serve sign up that creates a brand-new workshop (org)
  signUpNewWorkshop: (
    email: string,
    fullName: string,
    workshopName: string,
    password?: string,
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
  // Load persisted session from sessionStorage (for "remember me" behavior)
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('supabase:auth:session');
        if (stored) {
          const parsed = JSON.parse(stored) as Session;
          // Only restore if the session hasn't expired yet
          if (!parsed.expires_at || new Date() < new Date(parsed.expires_at)) {
            return parsed;
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
    return null;
  });

  const [appUser, setAppUser] = useState<AppUser | null>(() => {
    if (session?.user?.id) {
      // Load app_user row that might already exist in the DB
      (async () => {
        try {
          const storedAppUser = await fetchAppUser(session.user.id);
          setAppUser(storedAppUser ?? null);
        } catch {
          // Ignore errors on initial load
        }
      })();
    }
    return null;
  });

  const [organization, setOrganization] = useState<Organization | null>(() => {
    if (session?.user?.id) {
      (async () => {
        try {
          const storedOrg = await fetchAppUser(session.user.id);
          setOrganization(storedOrg?.org_id ? { id: storedOrg!.org_id } : null);
        } catch {
          // Ignore errors on initial load
        }
      })();
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Auto-refresh Supabase session when the underlying Auth session changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s?.user?.id) {
        try {
          const storedAppUser = await fetchAppUser(s.user.id);
          setAppUser(storedAppUser);
          setOrganization(storedAppUser?.org_id ? { id: storedAppUser.org_id } : null);
        } catch {
          // Ignore errors on auth state change
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Persist session to sessionStorage whenever it changes
  useEffect(() => {
    if (session && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('supabase:auth:session', JSON.stringify({
          ...session,
          // Adjust the expiration timestamp to be relative to now
          expires_at: session.expires_at ? new Date(session.expires_at).getTime() : null,
        }));
      } catch {
        // Ignore write errors (e.g., quota exceeded)
      }
    }
  }, [session]);

  const loadAppUser = async (authId: string | undefined) => {
    if (!authId) { setAppUser(null); setOrganization(null); return; }
    let row = await fetchAppUser(authId);
    for (let i = 0; i < 4 && !row; i++) {
      await new Promise((r) => setTimeout(r, 400));
      row = await fetchAppUser(authId);
    }
    setAppUser(row);
    if (row?.org_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', row.org_id)
        .maybeSingle();
      setOrganization((org as Organization) ?? null);
    } else {
      setOrganization(null);
    }
  };

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
    signUpNewWorkshop: async (email, fullName, workshopName, password) => {
      if (password?.trim()) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: { full_name: fullName, workshop_name: workshopName },
          },
        });
        return { error: error?.message ?? null };
      }

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
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
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