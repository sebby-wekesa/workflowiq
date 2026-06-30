import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboardIcon,
  WrenchIcon,
  TruckIcon,
  UsersIcon,
  PackageIcon,
  UserCogIcon,
  BarChart3Icon,
  LandmarkIcon,
  SettingsIcon,
  LogOutIcon,
  DiscIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Jobs", href: "/jobs", icon: WrenchIcon },
  { label: "Deliveries", href: "/deliveries", icon: TruckIcon },
  { label: "Customers", href: "/customers", icon: UsersIcon },
  { label: "Stock", href: "/stock", icon: PackageIcon },
  { label: "Staff", href: "/staff", icon: UserCogIcon },
  { label: "Charts", href: "/charts", icon: BarChart3Icon },
  { label: "Reports", href: "/reports", icon: BarChart3Icon },
  { label: "Accounting", href: "/accounting", icon: LandmarkIcon },
];

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AppSidebar() {
  const location = useLocation();
  const { appUser, organization, signOut } = useAuth();
  const isActive = (href: string) =>
    location.pathname === href || (href !== "/dashboard" && location.pathname.startsWith(`${href}/`));

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <DiscIcon className="size-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold tracking-tight text-sidebar-foreground truncate">
              {organization?.name ?? "Hercules"}
            </span>
            <span className="text-[10px] font-medium tracking-widest uppercase text-sidebar-foreground/50">
              Workshop
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {appUser?.role === "admin" && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/settings"}
                      tooltip="Workshop settings"
                    >
                      <Link to="/settings">
                        <SettingsIcon />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        {!appUser ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full bg-sidebar-accent" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24 bg-sidebar-accent" />
              <Skeleton className="h-3 w-16 bg-sidebar-accent" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-9 border border-sidebar-border">
                {appUser.avatar && <AvatarImage src={appUser.avatar} />}
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                  {getInitials(appUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {appUser.name || "User"}
                </p>
                <Badge className="text-[10px] px-1.5 py-0 capitalize bg-sidebar-primary/20 text-sidebar-primary border-sidebar-primary/30 border">
                  {appUser.role}
                </Badge>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="sign-out"
            >
              <LogOutIcon className="size-4" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
