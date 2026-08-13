import { redirect } from "next/navigation";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-brand"><span>✓</span>FlowDesk</div>
        <p className="landing-eyebrow">WELCOME BACK</p>
        <h1>Sign in to your workspace.</h1>
        <p>Continue with your Google account to access FlowDesk.</p>
        <GoogleSignInButton />
        <Link href="/">Back to home</Link>
      </div>
    </main>
  );
}
