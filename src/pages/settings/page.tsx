import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { SettingsIcon, UsersIcon } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useAllUsers } from "@/lib/api.ts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import WorkshopNameCard from "./_components/workshop-name-card";
import InviteMemberDialog from "./_components/invite-member-dialog";
import MemberCard from "./_components/member-card";

export default function SettingsPage() {
  const { appUser, isLoading: authLoading } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const { data: members, isLoading } = useAllUsers();

  const groups = useMemo(() => {
    const active = members?.filter((m) => m.is_active && m.status !== "pending") ?? [];
    const pending = members?.filter((m) => m.status === "pending") ?? [];
    const inactive = members?.filter((m) => !m.is_active && m.status !== "pending") ?? [];
    return { active, pending, inactive };
  }, [members]);

  // Non-admins don't manage the workshop
  if (!authLoading && appUser && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="size-6" />
          Workshop settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your workshop name and the people who can access it.
        </p>
      </div>

      <WorkshopNameCard />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <UsersIcon className="size-4" />
            Team
            {members && (
              <span className="text-xs font-normal text-muted-foreground">
                ({members.length})
              </span>
            )}
          </h2>
          <InviteMemberDialog />
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          appUser && (
            <div className="space-y-6">
              <MemberGroup
                title="Active"
                members={groups.active}
                currentUserId={appUser.id}
                emptyText="No active members yet."
              />

              {groups.pending.length > 0 && (
                <MemberGroup
                  title="Pending invites"
                  members={groups.pending}
                  currentUserId={appUser.id}
                  badge={
                    <Badge className="text-[10px] px-1.5 py-0 border-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                      {groups.pending.length}
                    </Badge>
                  }
                />
              )}

              {groups.inactive.length > 0 && (
                <MemberGroup
                  title="Deactivated"
                  members={groups.inactive}
                  currentUserId={appUser.id}
                  badge={
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {groups.inactive.length}
                    </Badge>
                  }
                />
              )}
            </div>
          )
        )}
      </section>
    </div>
  );
}

function MemberGroup({
  title,
  members,
  currentUserId,
  badge,
  emptyText,
}: {
  title: string;
  members: import("@/lib/supabase.ts").AppUser[];
  currentUserId: string;
  badge?: React.ReactNode;
  emptyText?: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
        {title}
        {badge}
      </h3>
      {members.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} currentUserId={currentUserId} />
          ))}
        </div>
      ) : (
        emptyText && <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}
