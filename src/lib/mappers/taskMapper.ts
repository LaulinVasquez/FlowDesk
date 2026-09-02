import { Priority, Task, TaskStage } from "@/lib/types";

export interface TaskRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  due_at: string | null;
  reminder_minutes: 15 | 60 | 1440 | null;
  assigned_user_id: string | null;
  stage: TaskStage;
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
    dueTime: row.due_time ?? undefined,
    dueAt: row.due_at ?? undefined,
    reminderMinutes: row.reminder_minutes ?? undefined,
    assignedUserId: row.assigned_user_id ?? undefined,
    stage: row.stage,
    tags: row.tags ?? [],
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
