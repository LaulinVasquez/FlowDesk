"use client";

import { useState } from "react";
import { createProject } from "@/services/projectService";

export default function ProjectTestButton() {
    const [ message, setMessage] = useState("");

    async function handleCreateProject() {
        try {
            const project = await createProject("My First Project");

            setMessage(`Created: ${project.name}`)
            console.log("Created project:", project);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unknown error";

                setMessage(`Error: ${message}`);
                console.error(error);
        }
    };

    return (
    <div>
        <button type="button" onClick={handleCreateProject}>
            Test Project Creation
        </button>
        {message && <p>{message}</p>}
    </div>
)
}

