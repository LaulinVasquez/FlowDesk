import { createClient } from "@/lib/supabase/client";
import type { Connection, ConnectionProfile } from "@/lib/types";

type ProfileRow = { id: string; full_name: string; email: string; avatar_url: string | null };
type ConnectionRow = { id: string; requester_id: string; addressee_id: string; status: Connection["status"]; created_at: string; requester: ProfileRow; addressee: ProfileRow };
const mapProfile = (profile: ProfileRow): ConnectionProfile => ({ id: profile.id, fullName: profile.full_name, email: profile.email, avatarUrl: profile.avatar_url || undefined });
const mapConnection = (row: ConnectionRow): Connection => ({ id: row.id, requesterId: row.requester_id, addresseeId: row.addressee_id, status: row.status, requester: mapProfile(row.requester), addressee: mapProfile(row.addressee), createdAt: row.created_at });

async function authenticatedClient() { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error("You must be signed in."); return { supabase, user }; }

export async function getConnections() {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.from("user_connections").select("id, requester_id, addressee_id, status, created_at, requester:profiles!requester_id(id, full_name, email, avatar_url), addressee:profiles!addressee_id(id, full_name, email, avatar_url)").neq("status", "rejected").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as ConnectionRow[]).map(mapConnection);
}

export async function requestConnection(email: string) {
  const { supabase, user } = await authenticatedClient();
  const { data: matches, error: searchError } = await supabase.rpc("find_profile_by_email", { search_email: email.trim() });
  if (searchError) throw new Error(searchError.message);
  const profile = (matches as ProfileRow[] | null)?.[0];
  if (!profile) throw new Error("No FlowDesk user was found with that email.");
  const { error } = await supabase.from("user_connections").insert({ requester_id: user.id, addressee_id: profile.id });
  if (error) throw new Error(error.code === "23505" ? "A connection already exists with this user." : error.message);
}

export async function respondToConnection(id: string, response: "accepted" | "rejected") { const { supabase } = await authenticatedClient(); const { error } = await supabase.rpc("respond_to_connection", { connection_id: id, response }); if (error) throw new Error(error.message); }
export async function removeConnection(id: string) { const { supabase } = await authenticatedClient(); const { error } = await supabase.from("user_connections").delete().eq("id", id); if (error) throw new Error(error.message); }
