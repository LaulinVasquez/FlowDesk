import { createClient } from "@/lib/supabase/client";
import type { ParticipantProfile } from "@/services/profileService";

export interface TaskComment {
  id: string;
  taskId: string;
  authorUserId?: string;
  body: string;
  createdAt: string;
  author?: ParticipantProfile;
}

type CommentRow = {
  id: string;
  task_id: string;
  author_user_id: string | null;
  body: string;
  created_at: string;
  author?: { id: string; full_name: string; avatar_url: string | null } | null;
};

const commentFields = "id, task_id, author_user_id, body, created_at, author:profiles!task_comments_author_user_id_fkey(id, full_name, avatar_url)";

function mapComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    authorUserId: row.author_user_id ?? undefined,
    body: row.body,
    createdAt: row.created_at,
    author: row.author ? {
      id: row.author.id,
      fullName: row.author.full_name,
      avatarUrl: row.author.avatar_url ?? undefined,
    } : undefined,
  };
}

async function authenticatedClient() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be signed in to use task comments.");
  return supabase;
}

export async function getTaskComments(taskIds: readonly string[]) {
  const ids = [...new Set(taskIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const supabase = await authenticatedClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select(commentFields)
    .in("task_id", ids)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as CommentRow[]).map(mapComment);
}

export async function addTaskComment(taskId: string, body: string) {
  const cleanBody = body.trim();
  if (!taskId) throw new Error("Task ID is required.");
  if (!cleanBody) throw new Error("A comment is required.");
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("add_task_comment", {
    task_id: taskId,
    comment_body: cleanBody,
  });
  if (error) throw new Error(error.message);
  return mapComment(data as CommentRow);
}
