"use client";

import { createClient } from "@/lib/supabase/client"; 

export default function LoginPage(){
    async function signInWithGoogle() {
        const supabase = createClient();

        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                 redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    }

    return (
        <main className="flex min-h-screen items-center justify-center">
            <button
                onClick={signInWithGoogle}
                className="btn primary login-button"
            >
                Continue with Google
            </button>
        </main>
    )
}
