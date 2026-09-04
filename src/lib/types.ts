export type Priority = "low" | "medium" | "high";
export type TaskStage = "assigned" | "working" | "reviewed" | "approved";
export interface Task {
  id: string; ownerId?: string; title: string; description?: string; completed: boolean;
  priority: Priority; dueDate?: string; dueTime?: string; dueAt?: string; reminderMinutes?: 15 | 60 | 1440; projectId?: string; assignedUserId?: string; stage?: TaskStage; reviewNote?: string; tags?: string[];
  createdAt: string; updatedAt: string; completedAt?: string;
}
export interface Project { id: string; ownerId?: string; name: string; color: string; icon?: string; createdAt: string; }
export interface ConnectionProfile { id: string; fullName: string; email: string; avatarUrl?: string; }
export interface Connection { id: string; requesterId: string; addresseeId: string; status: "pending" | "accepted" | "rejected"; requester: ConnectionProfile; addressee: ConnectionProfile; createdAt: string; }
export type View = "all" | "today" | "upcoming" | "completed" | "board" | "projects" | "people" | "settings";
export interface TaskSearchIntent {
  text?: string;
  status?: "all" | "pending" | "completed";
  priorities?: Priority[];
  projectIds?: string[];
  tags?: string[];
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  sortBy?: "relevance" | "newest" | "oldest" | "dueDate" | "priority";
}
