import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { configureWebPush } from "@/lib/notifications/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to test notifications." }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Select a registered browser." }, { status: 400 });
    // Never send to a client-provided endpoint or keys: load the current user's
    // registered device through RLS and validate its ownership explicitly.
    const { data: subscription, error } = await supabase.from("push_subscriptions")
      .select("id, endpoint, p256dh, auth").eq("user_id", user.id).eq("endpoint", body.endpoint).maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load your saved notification subscription." }, { status: 500 });
    if (!subscription) return NextResponse.json({ error: "This browser is not registered for your account. Enable notifications again." }, { status: 404 });
    const push = configureWebPush();
    try {
      await push.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({ title: "FlowDesk", body: "Server push delivery is working.", url: "/app", tag: "flowdesk-push-test" }), { TTL: 300 });
    } catch (pushError: unknown) {
      const status = typeof pushError === "object" && pushError && "statusCode" in pushError ? Number(pushError.statusCode) : 0;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        return NextResponse.json({ error: "This push subscription expired. Disable and enable notifications to register again." }, { status: 410 });
      }
      return NextResponse.json({ error: "The push service rejected delivery. Check the deployment's VAPID key pair and try again." }, { status: 502 });
    }
    return NextResponse.json({ sent: true });
  } catch (error) {
    // Configuration diagnostics contain variable names, never their values.
    const message = error instanceof Error && error.message.startsWith("Missing VAPID configuration:")
      ? error.message : "Notification setup failed. Check the deployment's server configuration.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
