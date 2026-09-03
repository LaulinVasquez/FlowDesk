"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type RefreshCallback = () => void | Promise<void>;

export interface WorkspaceRealtimeOptions {
  userId?: string | null;
  refreshTasks: RefreshCallback;
  refreshConnections: RefreshCallback;
  enabled?: boolean;
  debounceMs?: number;
  onError?: (error: Error) => void;
}

type RefreshScheduler = {
  schedule: () => void;
  dispose: () => void;
};

function createRefreshScheduler(
  callback: RefreshCallback,
  reportError: (error: unknown) => void,
  debounceMs: number,
): RefreshScheduler {
  let disposed = false;
  let running = false;
  let queued = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async () => {
    timer = undefined;
    if (disposed) return;
    if (running) {
      queued = true;
      return;
    }

    running = true;
    try {
      await callback();
    } catch (error) {
      reportError(error);
    } finally {
      running = false;
      if (queued && !disposed) {
        queued = false;
        timer = setTimeout(() => void run(), debounceMs);
      }
    }
  };

  return {
    schedule() {
      if (disposed) return;
      queued = true;
      if (running || timer !== undefined) return;
      timer = setTimeout(() => {
        queued = false;
        void run();
      }, debounceMs);
    },
    dispose() {
      disposed = true;
      queued = false;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

/**
 * Refreshes the authenticated workspace when collaborative rows change.
 *
 * Each subscription is scoped to the current user's owner/assignee or
 * requester/addressee relationship. Supabase RLS remains the security boundary;
 * these filters only reduce irrelevant Realtime traffic.
 */
export function useWorkspaceRealtime({
  userId,
  refreshTasks,
  refreshConnections,
  enabled = true,
  debounceMs = 150,
  onError,
}: WorkspaceRealtimeOptions) {
  const callbacks = useRef({ refreshTasks, refreshConnections, onError });

  useEffect(() => {
    callbacks.current = { refreshTasks, refreshConnections, onError };
  }, [refreshTasks, refreshConnections, onError]);

  useEffect(() => {
    if (!enabled || !userId) return;

    const supabase = createClient();
    const reportError = (error: unknown) => {
      callbacks.current.onError?.(
        error instanceof Error ? error : new Error("Unable to refresh realtime workspace data."),
      );
    };
    const taskRefresh = createRefreshScheduler(
      () => callbacks.current.refreshTasks(),
      reportError,
      debounceMs,
    );
    const connectionRefresh = createRefreshScheduler(
      () => callbacks.current.refreshConnections(),
      reportError,
      debounceMs,
    );

    const channel = supabase
      .channel(`flowdesk-workspace-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `owner_id=eq.${userId}` },
        taskRefresh.schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `assigned_user_id=eq.${userId}` },
        taskRefresh.schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_connections", filter: `requester_id=eq.${userId}` },
        connectionRefresh.schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_connections", filter: `addressee_id=eq.${userId}` },
        connectionRefresh.schedule,
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reportError(error ?? new Error("The realtime workspace subscription was interrupted."));
        }
      });

    return () => {
      taskRefresh.dispose();
      connectionRefresh.dispose();
      void supabase.removeChannel(channel);
    };
  }, [debounceMs, enabled, userId]);
}
