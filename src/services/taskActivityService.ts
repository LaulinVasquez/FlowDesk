import { createClient } from "@/lib/supabase/client";
import type { TaskStage } from "@/lib/types";

export type TaskActivityEvent =
  | "task_assigned"
  | "work_started"
  | "submitted_for_review"
  | "changes_requested"
  | "approved"
  | "reassigned"
  | "unassigned";

export interface ActivityProfile {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  actorUserId: string;
  eventType: TaskActivityEvent;
  fromStage?: TaskStage;
  toStage?: TaskStage;
  fromAssigneeId?: string;
  toAssigneeId?: string;
  note?: string;
  createdAt: string;
  actor?: ActivityProfile;
  fromAssignee?: ActivityProfile;
  toAssignee?: ActivityProfile;
}

type ProfileRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

export interface TaskActivityRow {
  id: string;
  task_id: string;
  actor_user_id: string;
  event_type: TaskActivityEvent;
  from_stage: TaskStage | null;
  to_stage: TaskStage | null;
  from_assignee_id: string | null;
  to_assignee_id: string | null;
  note: string | null;
  created_at: string;
  actor: ProfileRow | null;
  from_assignee: ProfileRow | null;
  to_assignee: ProfileRow | null;
}

const activityFields = `
  id,
  task_id,
  actor_user_id,
  event_type,
  from_stage,
  to_stage,
  from_assignee_id,
  to_assignee_id,
  note,
  created_at,
  actor:profiles!task_activity_actor_user_id_fkey(id, full_name, avatar_url),
  from_assignee:profiles!task_activity_from_assignee_id_fkey(id, full_name, avatar_url),
  to_assignee:profiles!task_activity_to_assignee_id_fkey(id, full_name, avatar_url)
`;

function mapProfile(row: ProfileRow | null): ActivityProfile | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url ?? undefined,
  };
}

export function mapTaskActivityRow(row: TaskActivityRow): TaskActivity {
  return {
    id: row.id,
    taskId: row.task_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    fromStage: row.from_stage ?? undefined,
    toStage: row.to_stage ?? undefined,
    fromAssigneeId: row.from_assignee_id ?? undefined,
    toAssigneeId: row.to_assignee_id ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
    actor: mapProfile(row.actor),
    fromAssignee: mapProfile(row.from_assignee),
    toAssignee: mapProfile(row.to_assignee),
  };
}

async function authenticatedClient() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be signed in to view task activity.");
  return supabase;
}

export async function getTaskActivity(taskId: string) {
  if (!taskId) throw new Error("Task ID is required.");
  const supabase = await authenticatedClient();
  const { data, error } = await supabase
    .from("task_activity")
    .select(activityFields)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as TaskActivityRow[]).map(mapTaskActivityRow);
}

export async function getTaskActivities(taskIds: readonly string[]) {
  const uniqueTaskIds = [...new Set(taskIds.filter(Boolean))];
  if (uniqueTaskIds.length === 0) return [];
  const supabase = await authenticatedClient();
  const { data, error } = await supabase
    .from("task_activity")
    .select(activityFields)
    .in("task_id", uniqueTaskIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as TaskActivityRow[]).map(mapTaskActivityRow);
}
