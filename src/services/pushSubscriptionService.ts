import { createClient } from "@/lib/supabase/client";

export async function savePushSubscription(subscription: PushSubscription) {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("You must be signed in to enable notifications.");
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("The browser returned an invalid push subscription.");
  const { error } = await supabase.from("push_subscriptions").upsert({ user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: "endpoint" });
  if (error) throw new Error(error.message);
}

export async function removePushSubscription(endpoint: string) {
  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

export async function getDefaultReminder() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { data, error } = await supabase.from("profiles").select("default_reminder_minutes").eq("id", user.id).single();
  if (error) throw new Error(error.message);
  return (data.default_reminder_minutes || 60) as 15 | 60 | 1440;
}

export async function setDefaultReminder(minutes: 15 | 60 | 1440) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { error } = await supabase.from("profiles").update({ default_reminder_minutes: minutes }).eq("id", user.id);
  if (error) throw new Error(error.message);
}
