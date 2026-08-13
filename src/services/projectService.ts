"use server";

import { createClient } from "@/lib/supabase/server";

export async function createProject(name: string) {
    const supabase = await createClient()

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error("You must be logged in to create a project.");
    }

    const { data, error } = await supabase
        .from("projects")
        .insert({
            owner_id: user.id,
            name,
        })
        .select()
        .single()

    if (error) {
        throw new Error(error.message);
    }

    return data;
}


export async function getProjects() {
    const supabase = await createClient();

    const {data, error} = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false});
    if ( error ) {
        throw new Error(error.message);
    }

    return data;
}