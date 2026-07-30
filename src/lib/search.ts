import { Project, TaskSearchIntent } from "./types";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const startOfWeek = (date: Date) => {
  const result = new Date(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
};

export function parseSearchIntent(query: string, projects: Pick<Project, "id" | "name">[]): TaskSearchIntent {
  const q = query.trim().toLowerCase();
  const now = new Date();
  const intent: TaskSearchIntent = {};
  const matchedProjects = projects.filter(project => q.includes(project.name.toLowerCase())).map(project => project.id);
  if (matchedProjects.length) intent.projectIds = matchedProjects;
  if (/\b(completed|finished|done)\b/.test(q)) intent.status = "completed";
  if (/\b(unfinished|pending|open|remaining)\b/.test(q)) intent.status = "pending";
  if (/\b(urgent|critical|high priority|important)\b/.test(q)) intent.priorities = ["high"];
  else if (/\bmedium priority\b/.test(q)) intent.priorities = ["medium"];
  else if (/\b(low priority|whenever)\b/.test(q)) intent.priorities = ["low"];
  if (/\b(overdue|ignored|late)\b/.test(q)) { intent.overdue = true; intent.status = "pending"; }
  if (/\btoday\b/.test(q)) intent.dueFrom = intent.dueTo = iso(now);
  if (/\btomorrow\b/.test(q)) {
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    intent.dueFrom = intent.dueTo = iso(tomorrow);
  }
  if (/\bthis week\b/.test(q)) {
    const end = new Date(startOfWeek(now)); end.setDate(end.getDate() + 6);
    intent.dueFrom = iso(now); intent.dueTo = iso(end);
  }
  if (/\bnext week\b/.test(q)) {
    const start = startOfWeek(now); start.setDate(start.getDate() + 7);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    intent.dueFrom = iso(start); intent.dueTo = iso(end);
  }
  if (/\b(recent|newest|just added)\b/.test(q)) intent.sortBy = "newest";
  if (/\boldest\b/.test(q)) intent.sortBy = "oldest";
  if (/\bdue (soon|date)\b/.test(q)) intent.sortBy = "dueDate";

  const stopWords = /\b(show|find|give|me|my|what|have|i|tasks?|todos?|due|next|this|week|today|tomorrow|completed|finished|done|unfinished|pending|open|remaining|urgent|critical|high|medium|low|priority|important|overdue|ignored|late|for|from|that|are|the|in|of|work)\b/g;
  const projectNames = projects.map(project => project.name.toLowerCase());
  const text = q.replace(stopWords, " ").split(/\s+/).filter(word => word.length > 1 && !projectNames.includes(word)).join(" ").trim();
  if (text) intent.text = text;
  return intent;
}

export function validateSearchIntent(value: unknown, validProjectIds: string[]): TaskSearchIntent {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>, result: TaskSearchIntent = {};
  if (typeof input.text === "string") result.text = input.text.slice(0, 160);
  if (["all","pending","completed"].includes(String(input.status))) result.status = input.status as TaskSearchIntent["status"];
  if (Array.isArray(input.priorities)) result.priorities = input.priorities.filter(v => ["low","medium","high"].includes(v)) as TaskSearchIntent["priorities"];
  if (Array.isArray(input.projectIds)) result.projectIds = input.projectIds.filter(v => typeof v === "string" && validProjectIds.includes(v));
  if (Array.isArray(input.tags)) result.tags = input.tags.filter(v => typeof v === "string").slice(0, 8) as string[];
  if (typeof input.dueFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueFrom)) result.dueFrom = input.dueFrom;
  if (typeof input.dueTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueTo)) result.dueTo = input.dueTo;
  if (typeof input.overdue === "boolean") result.overdue = input.overdue;
  if (["relevance","newest","oldest","dueDate","priority"].includes(String(input.sortBy))) result.sortBy = input.sortBy as TaskSearchIntent["sortBy"];
  return result;
}
