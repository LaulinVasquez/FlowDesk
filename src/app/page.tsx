import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-brand"><span>✓</span>FlowDesk</div>
        <p className="landing-eyebrow">FOCUS WORKSPACE</p>
        <h1>Organize your tasks.<br />Focus on what matters.</h1>
        <p>A calm, focused workspace for moving meaningful work forward.</p>
        <GoogleSignInButton />
      </div>
    </main>
  );
}
