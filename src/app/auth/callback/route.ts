import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client"; 

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error("OAuth callback error:", error);
            return NextResponse.redirect(
                new URL("/login?error=oauth_callback_failed", requestUrl.origin),
            );
        }
    }

    return NextResponse.redirect(new URL("/", requestUrl.origin));
}