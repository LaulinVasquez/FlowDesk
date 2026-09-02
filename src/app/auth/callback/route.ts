import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function publicOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");

  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = publicOrigin(request);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    console.error("OAuth callback: no code found");

    return NextResponse.redirect(
      new URL("/login?error=no_code", origin),
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${error.code === "pkce_code_verifier_not_found" ? "pkce_expired" : "oauth_callback_failed"}`, origin),
    );
  }

  const user = data.user;
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_user", origin));
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
    return NextResponse.redirect(new URL("/login?error=profile_setup_failed", origin));
  }

  return NextResponse.redirect(new URL("/app", origin));
}
