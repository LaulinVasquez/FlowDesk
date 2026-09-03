"use client";

import { useCallback, useEffect, useState } from "react";
import { mapProjectRow } from "@/lib/mappers/projectMapper";
import { mapTaskRow } from "@/lib/mappers/taskMapper";
import { Connection, Project, Task, TaskStage } from "@/lib/types";
import { getConnections, removeConnection as removeConnectionRow, requestConnection as requestConnectionRow, respondToConnection } from "@/services/connectionService";
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
  updateTaskStage as updateTaskStageRow,
} from "@/services/taskService";

export function useWorkspace() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const refreshTasks = useCallback(async () => {
    const taskRows = await getTasks();
    setTasks(taskRows.map(mapTaskRow));
  }, []);

  const refreshConnections = useCallback(async () => setConnections(await getConnections()), []);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      setLoading(true);
      setError(false);
      try {
        const [projectRows, taskRows, connectionRows] = await Promise.all([getProjects(), getTasks(), getConnections()]);
        if (!active) return;
        setProjects(projectRows.map(mapProjectRow));
        setTasks(taskRows.map(mapTaskRow));
        setConnections(connectionRows);
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

  const updateTaskStage = useCallback(async (id: string, stage: TaskStage) => {
    const task = mapTaskRow(await updateTaskStageRow(id, stage));
    setTasks(current => current.map(item => item.id === id ? task : item));
    return task;
  }, []);

  const requestConnection = useCallback(async (email: string) => { await requestConnectionRow(email); await refreshConnections(); }, [refreshConnections]);
  const answerConnection = useCallback(async (id: string, response: "accepted" | "rejected") => { await respondToConnection(id, response); await refreshConnections(); }, [refreshConnections]);
  const removeConnection = useCallback(async (id: string) => { await removeConnectionRow(id); setConnections(current => current.filter(item => item.id !== id)); }, []);

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
    tasks, projects, connections, loading, error,
    createProject, updateProject, deleteProject,
    createTask, updateTask, updateTaskStage, setTaskCompleted, deleteTask, clearCompleted, resetWorkspace,
    requestConnection, answerConnection, removeConnection, refreshTasks, refreshConnections,
    retry: () => setAttempt(value => value + 1),
  };
}
