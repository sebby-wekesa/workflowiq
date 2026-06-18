import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { WrenchIcon, MailCheckIcon, Loader2Icon, ArrowLeftIcon } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Brand from "@/components/Brand";

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
      <main className="auth-page">
        <section className="auth-intro">
          <div className="flex items-center justify-center gap-2">
            <Brand compact={true} />
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
        </section>
      </main>
    );
  }

  const isSignup = mode === "signup";

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="flex items-center justify-center gap-2">
          <Brand compact={true} />
        </div>
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">
            Clear work. Better decisions.
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Your workshop's day, organized.
          </h1>
          <p className="text-sm text-muted-foreground">
            Track every job from intake to collection and keep stock accountable.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm text-white/80">
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">Jobs</div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">Inventory</div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">Customers</div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">Team</div>
            <div className="col-span-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2">
              Secure workspace
            </div>
          </div>
        </div>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          <div className="auth-heading">
            <h2 className="text-xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Enter your email and we will send you a sign-in link.
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
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
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
              {isSignup ? "Create workshop" : "Continue with email"}
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
                Starting a new workshop?{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setMode("signup");
                    setErrors({});
                  }}
                >
                  Create one
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}