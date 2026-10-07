"use client";

import { useCallback, useEffect, useState } from "react";
import { mapProjectRow } from "@/lib/mappers/projectMapper";
import { mapTaskRow } from "@/lib/mappers/taskMapper";
import { Connection, Project, Task, TaskStage } from "@/lib/types";
import { useWorkspaceRealtime } from "@/hooks/useWorkspaceRealtime";
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
  reassignTask as reassignTaskRow,
  requestTaskChanges as requestTaskChangesRow,
  setTaskCompleted as setTaskCompletedRow,
  TaskInput,
  updateTask as updateTaskRow,
  updateTaskStage as updateTaskStageRow,
} from "@/services/taskService";

export function useWorkspace(userId?: string) {
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

  const requestTaskChanges = useCallback(async (id: string, note: string) => {
    const task = mapTaskRow(await requestTaskChangesRow(id, note));
    setTasks(current => current.map(item => item.id === id ? task : item));
    return task;
  }, []);

  const reassignTask = useCallback(async (id: string, assignedUserId: string | null) => {
    const task = mapTaskRow(await reassignTaskRow(id, assignedUserId));
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
    await refreshTasks();
  }, [refreshTasks]);

  const resetWorkspace = useCallback(async () => {
    await Promise.all(tasks.filter(task => task.ownerId === userId).map(task => deleteTaskRow(task.id)));
    await Promise.all(projects.map(project => deleteProjectRow(project.id)));
    setTasks(current => current.filter(task => task.ownerId !== userId));
    setProjects([]);
  }, [projects, tasks, userId]);

  useWorkspaceRealtime({
    userId,
    refreshTasks,
    refreshConnections,
    onError: realtimeError => console.error("Unable to synchronize collaborative workspace changes.", realtimeError),
  });

  return {
    tasks, projects, connections, loading, error,
    createProject, updateProject, deleteProject,
    createTask, updateTask, updateTaskStage, requestTaskChanges, reassignTask, setTaskCompleted, deleteTask, clearCompleted, resetWorkspace,
    requestConnection, answerConnection, removeConnection, refreshTasks, refreshConnections,
    retry: () => setAttempt(value => value + 1),
  };
}
