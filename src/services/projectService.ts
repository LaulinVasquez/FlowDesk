import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/lib/mappers/projectMapper";

export interface ProjectChanges {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

async function authenticatedClient() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be logged in to manage projects.");
  return { supabase, user };
}

const projectFields = "id, owner_id, name, color, icon, created_at";

export async function getProjects() {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.from("projects").select(projectFields).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as ProjectRow[];
}

export async function createProject(name: string, color?: string, icon?: string) {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Project name is required.");
  const { supabase, user } = await authenticatedClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ owner_id: user.id, name: trimmedName, color: color || null, icon: icon || null })
    .select(projectFields)
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectRow;
}

export async function updateProject(id: string, changes: ProjectChanges) {
  if (!id) throw new Error("Project ID is required.");
  const updates: ProjectChanges = { ...changes };
  if (updates.name !== undefined) {
    updates.name = updates.name.trim();
    if (!updates.name) throw new Error("Project name is required.");
  }
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.from("projects").update(updates).eq("id", id).select(projectFields).single();
  if (error) throw new Error(error.message);
  return data as ProjectRow;
}

export async function deleteProject(id: string) {
  if (!id) throw new Error("Project ID is required.");
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
