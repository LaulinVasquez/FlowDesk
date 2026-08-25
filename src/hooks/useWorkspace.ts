"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { mapProjectRow } from "@/lib/mappers/projectMapper";
import { mapTaskRow } from "@/lib/mappers/taskMapper";
import { Project, Task } from "@/lib/types";
import { getProjects } from "@/services/projectService";
import { getTasks } from "@/services/taskService";

export function useWorkspace() {
  const [tasks, setTasksState] = useState<Task[]>([]);
  const [projects, setProjectsState] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tasksChangedLocally = useRef(false);
  const projectsChangedLocally = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setError(false);

      try {
        const [projectRows, taskRows] = await Promise.all([getProjects(), getTasks()]);
        if (!active) return;
        setProjectsState(projectRows.map(mapProjectRow));
        setTasksState(taskRows.map(mapTaskRow));
      } catch (loadError) {
        console.error("Unable to load the authenticated workspace.", loadError);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWorkspace();
    return () => { active = false; };
  }, [attempt]);

  // Mutations remain local for this milestone. Draft keys intentionally do not
  // replace legacy flowdesk.tasks/projects or participate in initial loading.
  const setTasks: Dispatch<SetStateAction<Task[]>> = useCallback((value) => {
    tasksChangedLocally.current = true;
    setTasksState(value);
  }, []);

  const setProjects: Dispatch<SetStateAction<Project[]>> = useCallback((value) => {
    projectsChangedLocally.current = true;
    setProjectsState(value);
  }, []);

  useEffect(() => {
    if (!tasksChangedLocally.current) return;
    try { localStorage.setItem("flowdesk.workspaceDraft.tasks", JSON.stringify(tasks)); }
    catch (storageError) { console.warn("Unable to save the local task draft.", storageError); }
  }, [tasks]);

  useEffect(() => {
    if (!projectsChangedLocally.current) return;
    try { localStorage.setItem("flowdesk.workspaceDraft.projects", JSON.stringify(projects)); }
    catch (storageError) { console.warn("Unable to save the local project draft.", storageError); }
  }, [projects]);

  return {
    tasks,
    setTasks,
    projects,
    setProjects,
    loading,
    error,
    retry: () => setAttempt(value => value + 1),
  };
}
