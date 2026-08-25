export type Priority = "low" | "medium" | "high";
export interface Task {
  id: string; ownerId?: string; title: string; description?: string; completed: boolean;
  priority: Priority; dueDate?: string; projectId?: string; tags?: string[];
  createdAt: string; updatedAt: string; completedAt?: string;
}
export interface Project { id: string; ownerId?: string; name: string; color: string; createdAt: string; }
export type View = "all" | "today" | "upcoming" | "completed" | "projects" | "settings";
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
