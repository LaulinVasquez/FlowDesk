import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    console.error("OAuth callback: no code found");

    return NextResponse.redirect(
      new URL("/login?error=no_code", requestUrl.origin),
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth exchange failed:", error);

    return NextResponse.redirect(
      new URL("/login?error=oauth_callback_failed", requestUrl.origin),
    );
  }

  const user = data.user;
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_user", requestUrl.origin));
  }

  const metadata = user.user_metadata;
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: metadata.full_name || metadata.name || user.email?.split("@")[0] || "FlowDesk user",
    avatar_url: metadata.avatar_url || metadata.picture || null,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    console.error("Could not create authenticated user profile:", profileError.message);
    return NextResponse.redirect(new URL("/login?error=profile_setup_failed", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/app", requestUrl.origin));
}
