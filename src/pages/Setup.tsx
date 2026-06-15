import Brand from "@/components/Brand";

export default function Setup() {
  return (
    <main className="setup-page">
      <section className="setup-hero">
        <Brand />
        <div className="setup-copy">
          <p className="eyebrow">Workshop operations, in one place</p>
          <h1>Know what is moving through your workshop.</h1>
          <p>
            WorkflowIQ brings job progress, customers, stock, and deliveries into
            one focused workspace.
          </p>
        </div>
        <div className="setup-preview">
          <div className="preview-top">
            <span>Today&apos;s workflow</span>
            <strong>24 active jobs</strong>
          </div>
          <div className="preview-bars">
            <span style={{ height: "42%" }} />
            <span style={{ height: "66%" }} />
            <span style={{ height: "50%" }} />
            <span style={{ height: "84%" }} />
            <span style={{ height: "72%" }} />
            <span style={{ height: "100%" }} />
            <span style={{ height: "88%" }} />
          </div>
        </div>
      </section>

      <section className="setup-panel">
        <div className="setup-card">
          <span className="status-dot">Setup required</span>
          <h2>Connect your Supabase project</h2>
          <p>
            The frontend is running. Add your project credentials to connect auth
            and workshop data.
          </p>
          <ol className="setup-steps">
            <li>
              <span>1</span>
              <div>
                <strong>Create the environment file</strong>
                <code>cp .env.example .env</code>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Add Supabase credentials</strong>
                <small>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Run the database migrations</strong>
                <small>Use the SQL files in supabase/migrations in order.</small>
              </div>
            </li>
          </ol>
          <div className="setup-note">
            <strong>After updating .env</strong>
            <span>Restart the dev server to open the sign-in screen.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
