import { createClient } from "@/lib/supabase/client";
import type { TaskRow } from "@/lib/mappers/taskMapper";


export type TaskPriority = "low" | "medium" | "high";

interface CreateTaskInput {
    title: string;
    description?: string;
    priority?: TaskPriority,
    projectId: string | null;
    dueDate?: string | null;
    tags?: string[];
}

export async function createTask(input: CreateTaskInput) {
    const supabase =  createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error("You must be logged in to create a task.")
    }

    const title = input.title.trim();

    if (!title) {
        throw new Error("Task title is required.");
    }

    const {data, error} = await supabase
        .from("tasks")
        .insert({
            owner_id: user.id,
            project_id: input.projectId ?? null,
            title,
            description: input.description?.trim() || null,
            priority: input.priority ?? "medium",
            due_date: input.dueDate ?? null,
            tags: input.tags ?? [],
        })
        .select()
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return data
}

export async function getTasks() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("tasks")
        .select("id, owner_id, project_id, title, description, completed, priority, due_date, tags, completed_at, created_at, updated_at")
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return data as TaskRow[];
}

