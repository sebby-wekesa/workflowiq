// src/pages/auth/Callback
// Handles the redirect after a magic-link or OAuth sign-in. Supabase parses the
// session from the URL automatically (detectSessionInUrl: true); we just wait
// for it and bounce to the dashboard.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/providers/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const error = params.get("error_description") || hashParams.get("error_description");

    if (error) {
      navigate(`/sign-in?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (!isLoading) {
      navigate(isAuthenticated ? "/dashboard" : "/sign-in", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <main className="center-screen">
      <div className="loader" />
      <p>Signing you in...</p>
    </main>
  );
}
