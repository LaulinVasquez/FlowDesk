import { redirect } from "next/navigation";
import { TodoApp } from "@/components/TodoApp";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Workspace" };

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <TodoApp user={{
      name: profile?.full_name || user.user_metadata.full_name || user.user_metadata.name || "FlowDesk user",
      email: user.email || "",
      avatarUrl: profile?.avatar_url || user.user_metadata.avatar_url || user.user_metadata.picture || null,
    }} />
  );
}
