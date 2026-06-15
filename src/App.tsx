import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/providers/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import AuthCallback from "@/pages/auth/Callback";
import Dashboard from "@/pages/Dashboard";
import Setup from "@/pages/Setup";
import SignIn from "@/pages/SignIn";

function LoadingScreen() {
  return (
    <main className="center-screen">
      <div className="loader" />
      <p>Loading your workshop...</p>
    </main>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/sign-in"
        element={isAuthenticated ? <Navigate to="/" replace /> : <SignIn />}
      />
      <Route
        path="*"
        element={isAuthenticated ? <Dashboard /> : <Navigate to="/sign-in" replace />}
      />
    </Routes>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <Setup />;

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
