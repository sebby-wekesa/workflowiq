import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { WrenchIcon, MailCheckIcon, Loader2Icon, ArrowLeftIcon } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup";
type FieldErrors = Partial<Record<"fullName" | "workshopName" | "email", string>>;

const emailSchema = z.string().email("Enter a valid email address");
const signUpSchema = z.object({
  fullName: z.string().min(1, "Your name is required"),
  workshopName: z.string().min(1, "Workshop name is required"),
  email: emailSchema,
});

export default function AuthPage() {
  const { isAuthenticated, isLoading, signInWithEmail, signUpNewWorkshop } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  const clearError = (field: keyof FieldErrors) =>
    setErrors((p) => ({ ...p, [field]: undefined }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (mode === "signin") {
      const parsed = emailSchema.safeParse(email.trim());
      if (!parsed.success) {
        setErrors({ email: parsed.error.issues[0].message });
        return;
      }
      setErrors({});
      setSubmitting(true);
      const { error } = await signInWithEmail(parsed.data);
      setSubmitting(false);
      if (error) {
        // Supabase returns this when the email has no account yet
        if (/signups not allowed|user not found|not found/i.test(error)) {
          setErrors({ email: "No account for this email. Create a workshop instead." });
        } else {
          toast.error(error);
        }
        return;
      }
      setSentTo(parsed.data);
      return;
    }

    // sign up — create a new workshop
    const parsed = signUpSchema.safeParse({
      fullName: fullName.trim(),
      workshopName: workshopName.trim(),
      email: email.trim(),
    });
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const f = issue.path[0] as keyof FieldErrors;
        if (!fe[f]) fe[f] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await signUpNewWorkshop(
      parsed.data.email,
      parsed.data.fullName,
      parsed.data.workshopName,
    );
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSentTo(parsed.data.email);
  };

  // ---- Confirmation state: magic link sent ----
  if (sentTo) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <MailCheckIcon className="size-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to{" "}
              <span className="font-medium text-foreground">{sentTo}</span>. Open it on
              this device to continue.
            </p>
          </div>
          <Button
            variant="ghost"
            className="gap-1.5"
            onClick={() => {
              setSentTo(null);
              setSubmitting(false);
            }}
          >
            <ArrowLeftIcon className="size-4" />
            Use a different email
          </Button>
        </div>
      </AuthShell>
    );
  }

  const isSignup = mode === "signup";

  return (
    <AuthShell>
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-bold tracking-tight">
          {isSignup ? "Create your workshop" : "Sign in"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignup
            ? "Set up a new workspace for your team."
            : "Welcome back. We'll email you a secure sign-in link."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Your name</Label>
              <Input
                id="full-name"
                placeholder="Inderjeet Singh"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) clearError("fullName");
                }}
                className={errors.fullName ? "border-destructive" : ""}
              />
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="workshop-name">Workshop name</Label>
              <Input
                id="workshop-name"
                placeholder="Nanak Mechanical Engineers"
                value={workshopName}
                onChange={(e) => {
                  setWorkshopName(e.target.value);
                  if (errors.workshopName) clearError("workshopName");
                }}
                className={errors.workshopName ? "border-destructive" : ""}
              />
              {errors.workshopName && (
                <p className="text-xs text-destructive">{errors.workshopName}</p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) clearError("email");
            }}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <Button type="submit" className="w-full gap-1.5" disabled={submitting}>
          {submitting && <Loader2Icon className="size-4 animate-spin" />}
          {isSignup ? "Create workshop" : "Email me a link"}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setMode("signin");
                setErrors({});
              }}
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            New here?{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setMode("signup");
                setErrors({});
              }}
            >
              Create a workshop
            </button>
          </>
        )}
      </div>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <WrenchIcon className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Hercules</span>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">{children}</div>
        <p className="text-center text-xs text-muted-foreground">
          Workshop job tracking for fleet &amp; brake reliners.
        </p>
      </div>
    </div>
  );
}
