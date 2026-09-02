import { createClient } from "@/lib/supabase/client";
import type { TaskRow } from "@/lib/mappers/taskMapper";

export type TaskPriority = "low" | "medium" | "high";
export interface TaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  projectId: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  dueAt?: string | null;
  reminderMinutes?: 15 | 60 | 1440 | null;
  tags?: string[];
}

async function authenticatedClient() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be logged in to manage tasks.");
  return { supabase, user };
}

const taskFields = "id, owner_id, project_id, title, description, completed, priority, due_date, due_time, due_at, reminder_minutes, tags, completed_at, created_at, updated_at";

function taskValues(input: TaskInput) {
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required.");
  return { project_id: input.projectId || null, title, description: input.description?.trim() || null, priority: input.priority ?? "medium", due_date: input.dueDate || null, due_time: input.dueDate ? input.dueTime || null : null, due_at: input.dueAt || null, reminder_minutes: input.reminderMinutes || null, tags: input.tags ?? [] };
}

export async function getTasks() {
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.from("tasks").select(taskFields).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as TaskRow[];
}

export async function createTask(input: TaskInput) {
  const { supabase, user } = await authenticatedClient();
  const { data, error } = await supabase.from("tasks").insert({ owner_id: user.id, ...taskValues(input) }).select(taskFields).single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function updateTask(id: string, input: TaskInput) {
  if (!id) throw new Error("Task ID is required.");
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.from("tasks").update(taskValues(input)).eq("id", id).select(taskFields).single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function setTaskCompleted(id: string, completed: boolean) {
  if (!id) throw new Error("Task ID is required.");
  const { supabase } = await authenticatedClient();
  const { data, error } = await supabase.from("tasks").update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq("id", id).select(taskFields).single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function deleteTask(id: string) {
  if (!id) throw new Error("Task ID is required.");
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function clearCompletedTasks() {
  const { supabase } = await authenticatedClient();
  const { error } = await supabase.from("tasks").delete().eq("completed", true);
  if (error) throw new Error(error.message);
}
