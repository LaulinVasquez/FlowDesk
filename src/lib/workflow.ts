import type { Task, TaskStage } from "@/lib/types";

export type CollaborationView = "all" | "by-me" | "to-me";

export function canTransitionTask(task: Task, target: TaskStage, userId: string) {
  const current = task.stage || "assigned";
  if (current === "assigned" && target === "working") return task.assignedUserId === userId;
  if (current === "working" && target === "reviewed") return task.assignedUserId === userId;
  if (current === "reviewed" && target === "approved") return task.ownerId === userId;
  if (current === "reviewed" && target === "working") return task.ownerId === userId;
  return false;
}

export function getTaskTransitionAction(task: Task, userId: string) {
  const stage = task.stage || "assigned";
  if (stage === "assigned" && task.assignedUserId === userId) {
    return { label: "Start work", stage: "working" as const };
  }
  if (stage === "working" && task.assignedUserId === userId) {
    return { label: "Submit for review", stage: "reviewed" as const };
  }
  return null;
}

export function filterCollaborativeTasks(
  tasks: readonly Task[],
  userId: string,
  view: CollaborationView,
  personId = "all",
  projectId = "all",
) {
  return tasks.filter(task => {
    if (!task.assignedUserId) return false;
    if (task.ownerId !== userId && task.assignedUserId !== userId) return false;
    if (view === "by-me" && task.ownerId !== userId) return false;
    if (view === "to-me" && task.assignedUserId !== userId) return false;
    if (personId !== "all" && task.ownerId !== personId && task.assignedUserId !== personId) return false;
    if (projectId !== "all" && task.projectId !== projectId) return false;
    return true;
  });
}
