import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function publicOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/login?error=oauth_start_failed", origin));
  return NextResponse.redirect(data.url);
}
