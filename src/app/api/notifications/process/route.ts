import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { configureWebPush } from "@/lib/notifications/push";
import { reminderIsDue, reminderTime } from "@/lib/notifications/reminderTiming";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const push = configureWebPush();
    const now = new Date();
    const { data: tasks, error } = await supabase.from("tasks").select("id, owner_id, title, due_at, reminder_minutes").eq("completed", false).not("due_at", "is", null).lte("due_at", new Date(now.getTime() + 86_400_000).toISOString()).gte("due_at", new Date(now.getTime() - 86_400_000).toISOString());
    if (error) throw error;
    let sent = 0;
    for (const task of tasks || []) {
      const { data: profile } = await supabase.from("profiles").select("default_reminder_minutes").eq("id", task.owner_id).single();
      const minutes = task.reminder_minutes || profile?.default_reminder_minutes || 60;
      if (!task.due_at || !reminderIsDue(task.due_at, minutes, now)) continue;
      const reminderAt = reminderTime(task.due_at, minutes).toISOString();
      const { data: subscriptions } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", task.owner_id);
      for (const subscription of subscriptions || []) {
        const { data: claim, error: claimError } = await supabase.from("notification_deliveries").insert({ user_id: task.owner_id, task_id: task.id, subscription_id: subscription.id, reminder_at: reminderAt }).select("id").single();
        if (claimError?.code === "23505") continue;
        if (claimError || !claim) throw claimError || new Error("Unable to claim notification delivery.");
        try {
          await push.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: "FlowDesk", body: `${task.title} is due ${minutes === 1440 ? "in 1 day" : minutes === 60 ? "in 1 hour" : "in 15 minutes"}.`, url: `/app?task=${task.id}`, tag: `task-${task.id}-${reminderAt}` }));
          sent++;
        } catch (pushError: unknown) {
          const statusCode = typeof pushError === "object" && pushError && "statusCode" in pushError ? Number(pushError.statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
          else await supabase.from("notification_deliveries").delete().eq("id", claim.id);
        }
      }
    }
    return NextResponse.json({ processed: tasks?.length || 0, sent });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Notification processing failed." }, { status: 500 });
  }
}
