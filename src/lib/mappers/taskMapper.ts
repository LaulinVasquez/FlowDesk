import { Priority, Task } from "@/lib/types";

export interface TaskRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  tags: string[] | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    ownerId: row.owner_id,
    projectId: row.project_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    completed: row.completed,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
    tags: row.tags ?? [],
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
