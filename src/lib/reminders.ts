import type { Task } from "@/lib/types";

export type ReminderState = "overdue" | "due-soon" | "today" | "tomorrow";

export interface TaskReminder {
  task: Task;
  state: ReminderState;
  dueAt: Date;
  dismissalKey: string;
  message: string;
}

const urgency: Record<ReminderState, number> = { overdue: 0, "due-soon": 1, today: 2, tomorrow: 3 };

function localDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getTaskDueAt(task: Task): Date | null {
  if (!task.dueDate) return null;
  const [year, month, day] = task.dueDate.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  const [hour, minute, second] = (task.dueTime || "23:59:59").split(":").map(Number);
  const dueAt = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt;
}

export function getReminderState(task: Task, now = new Date()): ReminderState | null {
  if (task.completed || !task.dueDate) return null;
  const dueAt = getTaskDueAt(task);
  if (!dueAt) return null;
  if (dueAt.getTime() < now.getTime()) return "overdue";
  if (task.dueTime && dueAt.getTime() - now.getTime() <= 60 * 60 * 1000) return "due-soon";
  const dayDifference = Math.round((localDay(dueAt).getTime() - localDay(now).getTime()) / 86_400_000);
  if (dayDifference === 0) return "today";
  if (dayDifference === 1) return "tomorrow";
  return null;
}

export function getReminderMessage(state: ReminderState, dueAt: Date, now = new Date()) {
  if (state === "overdue") return "Overdue";
  if (state === "due-soon") {
    const minutes = Math.max(1, Math.ceil((dueAt.getTime() - now.getTime()) / 60_000));
    return `Due in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return state === "today" ? "Due today" : "Due tomorrow";
}

export function getTaskReminders(tasks: Task[], dismissed: ReadonlySet<string> = new Set(), now = new Date()): TaskReminder[] {
  return tasks.flatMap(task => {
    const state = getReminderState(task, now);
    const dueAt = getTaskDueAt(task);
    if (!state || !dueAt) return [];
    const dismissalKey = `${task.id}:${task.dueDate}:${task.dueTime || "date-only"}:${state}`;
    if (dismissed.has(dismissalKey)) return [];
    return [{ task, state, dueAt, dismissalKey, message: getReminderMessage(state, dueAt, now) }];
  }).sort((a, b) => urgency[a.state] - urgency[b.state] || a.dueAt.getTime() - b.dueAt.getTime());
}
