import { createClient } from "@/lib/supabase/client";

export interface ParticipantProfile {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

type ProfileRow = { id: string; full_name: string; avatar_url: string | null };

export async function getParticipantProfiles(userIds: readonly string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("You must be signed in to view task participants.");
  const { data, error } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map(profile => ({
    id: profile.id,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url ?? undefined,
  })) satisfies ParticipantProfile[];
}
