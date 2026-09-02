"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, CheckCircle2, Clock3, X } from "lucide-react";
import { getTaskReminders, type ReminderState } from "@/lib/reminders";
import type { Project, Task } from "@/lib/types";

const stateLabels: Record<ReminderState, string> = { overdue: "Overdue", "due-soon": "Due soon", today: "Today", tomorrow: "Tomorrow" };

export function ReminderPanel({ tasks, projects, userKey, onOpenTask }: { tasks: Task[]; projects: Project[]; userKey: string; onOpenTask: (task: Task) => void }) {
  const storageKey = `flowdesk.reminderDismissals.${userKey}`;
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { try { const values: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]"); setDismissed(new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [])); } catch { setDismissed(new Set()); } }, [storageKey]);
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(interval); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") { setOpen(false); bellRef.current?.focus(); }
      else if (event instanceof MouseEvent && !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const reminders = useMemo(() => getTaskReminders(tasks, dismissed, now), [tasks, dismissed, now]);
  const dismiss = (key: string) => setDismissed(current => { const next = new Set(current).add(key); localStorage.setItem(storageKey, JSON.stringify([...next])); return next; });
  const formatDue = (dueAt: Date, hasTime: boolean) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(dueAt);
  return <div className="reminder-root" ref={rootRef}>
    <button ref={bellRef} className="icon-btn notification" aria-label={`${reminders.length} active reminders`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}><Bell/>{reminders.length > 0 && <span className="notification-count" aria-hidden="true">{reminders.length > 99 ? "99+" : reminders.length}</span>}</button>
    {open && <section className="reminder-panel" role="dialog" aria-label="Task reminders">
      <div className="reminder-head"><div><span className="eyebrow">REMINDERS</span><h2>Needs your attention</h2></div><button className="icon-btn" aria-label="Close reminders" onClick={() => { setOpen(false); bellRef.current?.focus(); }}><X/></button></div>
      {reminders.length ? <div className="reminder-list">{reminders.map(reminder => { const project = projects.find(item => item.id === reminder.task.projectId); return <article className={`reminder-item ${reminder.state}`} key={reminder.dismissalKey}>
        <button className="reminder-open" onClick={() => { setOpen(false); onOpenTask(reminder.task); }}><span className="reminder-state">{reminder.state === "overdue" ? <Clock3/> : <CalendarDays/>}{stateLabels[reminder.state]}</span><strong>{reminder.task.title}</strong><span>{reminder.message} · {formatDue(reminder.dueAt, !!reminder.task.dueTime)}</span><small>{project?.name || "No project"}{reminder.task.priority === "high" ? " · High priority" : ""}</small></button>
        <button className="reminder-dismiss" aria-label={`Dismiss reminder for ${reminder.task.title}`} onClick={() => dismiss(reminder.dismissalKey)}><X/></button>
      </article>; })}</div> : <div className="reminder-empty"><CheckCircle2/><h3>You&apos;re all caught up.</h3><p>No tasks need your attention right now.</p></div>}
    </section>}
  </div>;
}
