import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BuildingIcon, Loader2Icon } from "lucide-react";
import { useOrganization, useRenameWorkshop } from "@/lib/api.ts";
import { useAuth } from "@/components/providers/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkshopNameCard() {
  const { appUser } = useAuth();
  const { data: org, isLoading } = useOrganization();
  const rename = useRenameWorkshop();
  const isAdmin = appUser?.role === "admin";

  const [name, setName] = useState("");
  useEffect(() => {
    if (org?.name) setName(org.name);
  }, [org?.name]);

  const dirty = org && name.trim() && name.trim() !== org.name;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Workshop name can't be empty");
      return;
    }
    try {
      await rename.mutateAsync(trimmed);
      toast.success("Workshop name updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the name");
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <BuildingIcon className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Workshop</h2>
          <p className="text-xs text-muted-foreground">
            The name shown across the app and on invoices.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="workshop-name">Name</Label>
          <div className="flex gap-2">
            <Input
              id="workshop-name"
              value={name}
              disabled={!isAdmin || rename.isPending}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirty) handleSave();
              }}
            />
            <Button onClick={handleSave} disabled={!isAdmin || !dirty || rename.isPending}>
              {rename.isPending && <Loader2Icon className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              Only admins can rename the workshop.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
