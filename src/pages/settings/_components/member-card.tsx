import { toast } from "sonner";
import { MoreVerticalIcon, ShieldCheckIcon, ShieldIcon, UserIcon } from "lucide-react";
import type { AppUser } from "@/lib/supabase.ts";
import { useChangeRole, useToggleUserActive, useCancelInvite } from "@/lib/api.ts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string | null, email: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function MemberCard({
  member,
  currentUserId,
}: {
  member: AppUser;
  currentUserId: string;
}) {
  const changeRole = useChangeRole();
  const toggleActive = useToggleUserActive();
  const cancelInvite = useCancelInvite();

  const isSelf = member.id === currentUserId;
  const isAdmin = member.role === "admin";
  const pending = member.status === "pending";
  const inactive = !member.is_active && member.status !== "pending";

  const handleRole = async (role: "admin" | "manager") => {
    if (role === member.role) return;
    try {
      await changeRole.mutateAsync({ userId: member.id, role });
      toast.success(`${member.name ?? "Member"} is now ${role === "admin" ? "an admin" : "a manager"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the role");
    }
  };

  const handleToggle = async () => {
    try {
      await toggleActive.mutateAsync(member.id);
      toast.success(member.is_active ? "Member deactivated" : "Member reactivated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the member");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelInvite.mutateAsync(member.id);
      toast.success("Invite removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the invite");
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <Avatar className="size-10">
        {member.avatar && <AvatarImage src={member.avatar} alt={member.name ?? ""} />}
        <AvatarFallback>{initials(member.name, member.email)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-medium truncate">{member.name || "Invited member"}</p>
          {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
        </div>
        <p className="text-sm text-muted-foreground truncate">{member.email}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            className={
              isAdmin
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 gap-1"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 gap-1"
            }
          >
            {isAdmin ? <ShieldCheckIcon className="size-3" /> : <ShieldIcon className="size-3" />}
            {isAdmin ? "Admin" : "Manager"}
          </Badge>
          {pending && (
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-0">
              Pending
            </Badge>
          )}
          {inactive && (
            <Badge variant="destructive" className="gap-1">
              <UserIcon className="size-3" />
              Deactivated
            </Badge>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 shrink-0">
            <MoreVerticalIcon className="size-4" />
            <span className="sr-only">Member actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {pending ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleCancel}
            >
              Remove invite
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem disabled={isSelf || member.role === "manager"} onClick={() => handleRole("manager")}>
                Make manager
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isSelf || member.role === "admin"} onClick={() => handleRole("admin")}>
                Make admin
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isSelf}
                className={member.is_active ? "text-destructive focus:text-destructive" : ""}
                onClick={handleToggle}
              >
                {member.is_active ? "Deactivate" : "Reactivate"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
