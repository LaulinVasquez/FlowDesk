"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const signInStarted = useRef(false);

  async function signIn() {
    if (signInStarted.current) return;
    signInStarted.current = true;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (signInError) {
      setError("Could not start Google sign-in. Please try again.");
      setLoading(false);
      signInStarted.current = false;
    }
  }

  return (
    <div className="auth-action">
      <button className="btn primary login-button" onClick={signIn} disabled={loading}>
        <span className="google-mark" aria-hidden="true">G</span>
        {loading ? "Connecting…" : "Continue with Google"}
      </button>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
