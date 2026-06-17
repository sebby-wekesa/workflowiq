import { Outlet, Navigate } from "react-router-dom";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscIcon, ShieldXIcon } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { Button } from "@/components/ui/button";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary animate-pulse">
          <DiscIcon className="size-6 text-primary-foreground" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { isLoading, isAuthenticated, appUser, signOut } = useAuth();

  // Auth still resolving
  if (isLoading) return <LoadingScreen />;

  // Not signed in -> send to the auth screen
  if (!isAuthenticated) return <Navigate to="/sign-in" replace />;

  // Signed in but the app_users row hasn't loaded yet
  if (!appUser) return <LoadingScreen />;

  // Account deactivated by an admin (pending users haven't signed in yet)
  if (!appUser.is_active && appUser.status !== "pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldXIcon className="size-8 text-destructive" />
        </div>
        <div className="text-center max-w-sm space-y-2">
          <h1 className="text-xl font-bold">Account deactivated</h1>
          <p className="text-muted-foreground text-sm">
            Your account has been deactivated by an administrator. Contact your
            workshop admin to regain access.
          </p>
        </div>
        <Button variant="secondary" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
