import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { UserPlusIcon } from "lucide-react";
import { useInviteUser } from "@/lib/api.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inviteSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["admin", "manager"]),
});

type FieldErrors = Partial<Record<"name" | "email" | "role", string>>;

export default function InviteMemberDialog() {
  const invite = useInviteUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "">("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const resetForm = () => {
    setName("");
    setEmail("");
    setRole("");
    setErrors({});
  };

  const handleSubmit = async () => {
    const result = inviteSchema.safeParse({ name, email, role: role || undefined });
    if (!result.success) {
      const fe: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fe[field]) fe[field] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    try {
      await invite.mutateAsync({
        name: result.data.name,
        email: result.data.email,
        role: result.data.role,
      });
      toast.success(`${result.data.name} can now sign in with ${result.data.email}.`);
      setOpen(false);
      resetForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't add the member";
      // Unique email constraint surfaces as a duplicate-key error
      if (/duplicate|unique|already/i.test(msg)) {
        setErrors({ email: "Someone with this email is already on the team." });
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlusIcon className="size-4" />
          Add member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a team member</DialogTitle>
          <DialogDescription>
            They join this workshop and sign in with a link sent to their email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">Full name</Label>
            <Input
              id="member-name"
              placeholder="Asha Were"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              }}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-email">Email address</Label>
            <Input
              id="member-email"
              type="email"
              placeholder="asha@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v as "admin" | "manager");
                if (errors.role) setErrors((p) => ({ ...p, role: undefined }));
              }}
            >
              <SelectTrigger className={errors.role ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={invite.isPending}>
            {invite.isPending ? "Adding…" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
