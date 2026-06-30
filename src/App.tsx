import { Navigate, Route, Routes } from "react-router-dom";
import { isSupabaseConfigured } from "@/lib/supabase";
import AppLayout from "@/components/app-layout";
import AuthCallback from "@/pages/auth/Callback";
import AuthPage from "@/pages/auth/AuthPage";
import Dashboard from "@/pages/Dashboard";
import ChartsPage from "@/pages/ChartsPage";
import Index from "@/pages/Index";
import SettingsPage from "@/pages/settings/page";
import Setup from "@/pages/Setup";
import AccountingPage from "@/pages/AccountingPage";

export default function App() {
  if (!isSupabaseConfigured) return <Setup />;

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/sign-in" element={<AuthPage />} />
      <Route path="/" element={<Index />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route path="/jobs" element={<Dashboard />} />
        <Route path="/customers" element={<Dashboard />} />
        <Route path="/stock" element={<Dashboard />} />
        <Route path="/deliveries" element={<Dashboard />} />
        <Route path="/staff" element={<Dashboard />} />
        <Route path="/reports" element={<Dashboard />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/accounting/*" element={<AccountingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
