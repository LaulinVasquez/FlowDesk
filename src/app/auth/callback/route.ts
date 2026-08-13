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

  console.log("OAuth exchange succeeded");
  console.log("User:", data.user?.email);
  console.log("Session exists:", Boolean(data.session));

  return NextResponse.redirect(
    new URL("/supabase-test", requestUrl.origin),
  );
}