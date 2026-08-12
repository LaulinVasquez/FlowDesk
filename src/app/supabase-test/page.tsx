import { createClient } from "@/lib/supabase/client";

export default async function SupabaseTestPage() {
    const supabase = await createClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    const isMissingSession = error?.message === "Auth session missing!";

    return (
        <main style={{ padding: "2rem"}}>
            <h1>Supabase Connection Test</h1>
            {error && !isMissingSession ? (
                <>
                    <p>The Supabase request returned an error:</p>
                    <pre>{error.message}</pre>
                </>
            ) : (
                <>
                    <p>Supabase responded succesfully.</p>
                    <p>
                        Current user: {""}
                        {user ? user.email ?? user.id : "No authenticated user yet"}
                    </p>
                </>
            )}
        </main>
    )
}