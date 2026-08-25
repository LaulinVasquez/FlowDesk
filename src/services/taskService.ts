import { createClient } from "@/lib/supabase/client";


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

