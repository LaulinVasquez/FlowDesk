import { createClient } from "@/lib/supabase/server";

export default async function SupabaseTestPage() {
    const supabase = await createClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();



    return (
    <main style={{ padding: "2rem" }}>
      <h1>Supabase Authentication Test</h1>

      {error ? (
        <p>Error: {error.message}</p>
      ) : user ? (
        <>
          <p>✅ Authenticated successfully!</p>
          <p>Email: {user.email}</p>
          <p>User ID: {user.id}</p>
        </>
      ) : (
        <p>❌ No authenticated user.</p>
      )};
    </main>
    );
}