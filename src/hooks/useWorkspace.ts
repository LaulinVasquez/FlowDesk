"use client";

import { useCallback, useEffect, useState } from "react";
import { mapProjectRow } from "@/lib/mappers/projectMapper";
import { mapTaskRow } from "@/lib/mappers/taskMapper";
import { Project, Task } from "@/lib/types";
import {
  createProject as createProjectRow,
  deleteProject as deleteProjectRow,
  getProjects,
  ProjectChanges,
  updateProject as updateProjectRow,
} from "@/services/projectService";
import {
  clearCompletedTasks,
  createTask as createTaskRow,
  deleteTask as deleteTaskRow,
  getTasks,
  setTaskCompleted as setTaskCompletedRow,
  TaskInput,
  updateTask as updateTaskRow,
} from "@/services/taskService";

export function useWorkspace() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      setLoading(true);
      setError(false);
      try {
        const [projectRows, taskRows] = await Promise.all([getProjects(), getTasks()]);
        if (!active) return;
        setProjects(projectRows.map(mapProjectRow));
        setTasks(taskRows.map(mapTaskRow));
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

  const createProject = useCallback(async (name: string) => {
    const project = mapProjectRow(await createProjectRow(name));
    setProjects(current => [...current, project]);
    return project;
  }, []);

  const updateProject = useCallback(async (id: string, changes: ProjectChanges) => {
    const project = mapProjectRow(await updateProjectRow(id, changes));
    setProjects(current => current.map(item => item.id === id ? project : item));
    return project;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await deleteProjectRow(id);
    setProjects(current => current.filter(project => project.id !== id));
    setTasks(current => current.map(task => task.projectId === id ? { ...task, projectId: undefined } : task));
  }, []);

  const createTask = useCallback(async (input: TaskInput) => {
    const task = mapTaskRow(await createTaskRow(input));
    setTasks(current => [task, ...current]);
    return task;
  }, []);

  const updateTask = useCallback(async (id: string, input: TaskInput) => {
    const task = mapTaskRow(await updateTaskRow(id, input));
    setTasks(current => current.map(item => item.id === id ? task : item));
    return task;
  }, []);

  const setTaskCompleted = useCallback(async (id: string, completed: boolean) => {
    const task = mapTaskRow(await setTaskCompletedRow(id, completed));
    setTasks(current => current.map(item => item.id === id ? task : item));
    return task;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await deleteTaskRow(id);
    setTasks(current => current.filter(task => task.id !== id));
  }, []);

  const clearCompleted = useCallback(async () => {
    await clearCompletedTasks();
    setTasks(current => current.filter(task => !task.completed));
  }, []);

  const resetWorkspace = useCallback(async () => {
    await Promise.all(tasks.map(task => deleteTaskRow(task.id)));
    await Promise.all(projects.map(project => deleteProjectRow(project.id)));
    setTasks([]);
    setProjects([]);
  }, [projects, tasks]);

  return {
    tasks, projects, loading, error,
    createProject, updateProject, deleteProject,
    createTask, updateTask, setTaskCompleted, deleteTask, clearCompleted, resetWorkspace,
    retry: () => setAttempt(value => value + 1),
  };
}
