"use client";

import { useRef, useState } from "react";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const signInStarted = useRef(false);

  async function signIn() {
    if (signInStarted.current) return;
    signInStarted.current = true;
    setLoading(true);
    setError("");
    try {
      window.location.assign("/auth/google");
    } catch {
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
