"use client";

import { useState } from "react";
import { FolderPlus, Loader2, RefreshCw } from "lucide-react";
import { createProject, getProjects } from "@/services/projectService";

export default function ProjectTestButton() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"create" | "load" | null>(null);

  async function handleCreateProject() {
    try {
      setLoading("create");
      const project = await createProject("My First Project");

      setMessage(`Created: ${project.name}`);
      console.log("Created project:", project);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      setMessage(`Error: ${message}`);
      console.error(error);
    } finally {
      setLoading(null);
    }
  }

  async function handleLoadProjects() {
    try {
      setLoading("load");
      const projects = await getProjects();

      console.log("My projects:", projects);
      setMessage(`Found ${projects.length} project(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      setMessage(`Error: ${message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="project-test-panel">
      <div className="project-test-actions">
        <button className="btn primary" type="button" onClick={handleCreateProject} disabled={loading !== null}>
          {loading === "create" ? <Loader2 className="spin" /> : <FolderPlus />}
          {loading === "create" ? "Creating…" : "Test Project Creation"}
        </button>
        <button className="btn project-test-secondary" type="button" onClick={handleLoadProjects} disabled={loading !== null}>
          {loading === "load" ? <Loader2 className="spin" /> : <RefreshCw />}
          {loading === "load" ? "Loading…" : "Load My Projects"}
        </button>
      </div>
      {message && <p className="project-test-message" role="status">{message}</p>}
    </div>
  );
}
