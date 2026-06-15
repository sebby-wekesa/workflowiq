import { FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Brand from "@/components/Brand";
import { useAuth } from "@/components/providers/auth";

type Mode = "sign-in" | "new-workshop";
type Notice = { type: "success" | "error"; text: string } | null;

export default function SignIn() {
  const { signInWithEmail, signInWithGoogle, signUpNewWorkshop } = useAuth();
  const googleAuthEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === "true";
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [notice, setNotice] = useState<Notice>(() => {
    const error = searchParams.get("error");
    return error ? { type: "error", text: error } : null;
  });
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setNotice(null);

    try {
      const result = mode === "sign-in"
        ? await signInWithEmail(email)
        : await signUpNewWorkshop(email, fullName, workshopName);

      setNotice(result.error
        ? { type: "error", text: result.error }
        : {
            type: "success",
            text: "Check your inbox for a secure sign-in link. It may take a minute to arrive.",
          });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Could not start sign-in.",
      });
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setNotice(null);
    try {
      const result = await signInWithGoogle();
      if (result.error) setNotice({ type: "error", text: result.error });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Could not start Google sign-in.",
      });
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <Brand />
        <div>
          <p className="eyebrow">Clear work. Better decisions.</p>
          <h1>Your workshop&apos;s day, organized.</h1>
          <p>Track every job from intake to collection and keep stock accountable.</p>
        </div>
        <div className="auth-proof">
          <span>Jobs</span><span>Inventory</span><span>Customers</span><span>Team</span>
        </div>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-heading">
            <span className="status-dot">Secure workspace</span>
            <h2>{mode === "sign-in" ? "Welcome back" : "Create your workshop"}</h2>
            <p>
              {mode === "sign-in"
                ? "Enter your email and we will send you a sign-in link."
                : "Create a new, isolated workspace for your team."}
            </p>
          </div>

          {mode === "new-workshop" && (
            <>
              <label>
                Your name
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Alex Morgan"
                />
              </label>
              <label>
                Workshop name
                <input
                  required
                  value={workshopName}
                  onChange={(event) => setWorkshopName(event.target.value)}
                  placeholder="Precision Works"
                />
              </label>
            </>
          )}

          <label>
            Work email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
          </label>

          <button className="button button-primary" disabled={loading}>
            {loading ? "Sending..." : "Continue with email"}
          </button>
          {googleAuthEnabled && (
            <button
              className="button button-secondary"
              type="button"
              onClick={googleSignIn}
            >
              Continue with Google
            </button>
          )}

          {notice && <p className={`form-message form-message-${notice.type}`}>{notice.text}</p>}

          <p className="auth-switch">
            {mode === "sign-in" ? "Starting a new workshop?" : "Already have a workspace?"}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "sign-in" ? "new-workshop" : "sign-in");
                setNotice(null);
              }}
            >
              {mode === "sign-in" ? "Create one" : "Sign in"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
