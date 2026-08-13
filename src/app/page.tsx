import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error_code?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/app");
  const { error_code: errorCode } = await searchParams;

  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-brand"><span>✓</span>FlowDesk</div>
        <p className="landing-eyebrow">FOCUS WORKSPACE</p>
        <h1>Organize your tasks.<br />Focus on what matters.</h1>
        <p>A calm, focused workspace for moving meaningful work forward.</p>
        {errorCode === "bad_oauth_state" && (
          <p className="oauth-notice" role="alert">
            That sign-in attempt expired. Start a fresh Google sign-in below and complete it in the same tab.
          </p>
        )}
        <GoogleSignInButton />
      </div>
    </main>
  );
}
