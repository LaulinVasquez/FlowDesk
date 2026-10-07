import { Project } from "@/lib/types";

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  created_at: string;
}

const fallbackColors = ["#3ecf8e", "#60a5fa", "#a78bfa", "#f59e0b"];

function colorForId(id: string) {
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return fallbackColors[hash % fallbackColors.length];
}

export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    color: row.color || colorForId(row.id),
    icon: row.icon ?? undefined,
    createdAt: row.created_at,
  };
}
