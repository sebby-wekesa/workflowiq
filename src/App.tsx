import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import AuthPage from "./pages/auth/AuthPage.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./components/app-layout.tsx";
import DashboardPage from "./pages/dashboard/page.tsx";
import JobsPage from "./pages/jobs/page.tsx";
import DeliveriesPage from "./pages/deliveries/page.tsx";
import CustomersPage from "./pages/customers/page.tsx";
import StockPage from "./pages/stock/page.tsx";
import StaffPage from "./pages/staff/page.tsx";
import SettingsPage from "./pages/settings/page.tsx";
import ReportsPage from "./pages/reports/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/sign-in" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Authenticated routes with sidebar layout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/deliveries" element={<DeliveriesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            {/* Workshop settings (rename + team) — supersedes the old user-management page */}
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
