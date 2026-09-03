"use client";

import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Folder,
  GripVertical,
  Inbox,
  Loader2,
  Pencil,
  RotateCcw,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getReminderState, getTaskDueAt, type ReminderState } from "@/lib/reminders";
import type { Connection, ConnectionProfile, Project, Task, TaskStage } from "@/lib/types";

export type WorkBoardView = "all" | "by-me" | "to-me";

export interface WorkBoardActivity {
  id: string;
  taskId: string;
  actorUserId: string;
  eventType: string;
  fromStage?: TaskStage | null;
  toStage?: TaskStage | null;
  reviewNote?: string | null;
  createdAt: string;
  actor?: ConnectionProfile;
}

export interface WorkBoardProps {
  tasks: Task[];
  projects: Project[];
  connections: Connection[];
  userId: string;
  onOpenTask: (task: Task) => void;
  onStageTransition: (task: Task, stage: TaskStage, reviewNote?: string) => Promise<unknown>;
  onAssignmentChange: (task: Task, assignedUserId: string | null) => Promise<unknown>;
  activities?: WorkBoardActivity[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

type TaskPatch = { stage?: TaskStage; assignedUserId?: string | null };
type DueTone = ReminderState | "upcoming" | "none";

const stages: Array<{ id: TaskStage; label: string; empty: string }> = [
  { id: "assigned", label: "Assigned", empty: "No work is waiting to be started." },
  { id: "working", label: "Working", empty: "No work is currently in progress." },
  { id: "reviewed", label: "Reviewed", empty: "No work is waiting for review." },
  { id: "approved", label: "Approved", empty: "Approved work will remain visible here." },
];

const viewLabels: Record<WorkBoardView, string> = {
  all: "All collaborative work",
  "by-me": "Assigned by me",
  "to-me": "Assigned to me",
};

const eventLabels: Record<string, string> = {
  task_assigned: "assigned this task",
  work_started: "started work",
  submitted_for_review: "submitted for review",
  changes_requested: "requested changes",
  approved: "approved this task",
  reassigned: "reassigned this task",
  unassigned: "unassigned this task",
};

function initials(profile?: ConnectionProfile) {
  const source = profile?.fullName?.trim() || profile?.email?.trim() || "?";
  return source.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
}

function avatarStyle(profile?: ConnectionProfile) {
  return profile?.avatarUrl
    ? { backgroundImage: `url(${JSON.stringify(profile.avatarUrl)})` }
    : undefined;
}

function displayName(profile: ConnectionProfile | undefined, id: string | undefined, userId: string) {
  if (id === userId) return "You";
  return profile?.fullName || profile?.email || "FlowDesk user";
}

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function formatDue(task: Task) {
  const dueAt = getTaskDueAt(task);
  if (!dueAt) return "No due date";
  return formatDate(dueAt.toISOString(), Boolean(task.dueTime));
}

function dueTone(task: Task, now: Date): DueTone {
  const reminder = getReminderState(task, now);
  if (reminder) return reminder;
  const dueAt = getTaskDueAt(task);
  return dueAt && !task.completed && dueAt.getTime() >= now.getTime() ? "upcoming" : "none";
}

function dueLabel(task: Task, now: Date) {
  const tone = dueTone(task, now);
  if (tone === "overdue") return `Overdue · ${formatDue(task)}`;
  if (tone === "due-soon") return `Due soon · ${formatDue(task)}`;
  if (tone === "today") return `Due today · ${formatDue(task)}`;
  if (tone === "tomorrow") return `Due tomorrow · ${formatDue(task)}`;
  return formatDue(task);
}

function canTransition(task: Task, target: TaskStage, userId: string) {
  const current = task.stage || "assigned";
  if (target === "working" && current === "assigned") return task.assignedUserId === userId;
  if (target === "reviewed" && current === "working") return task.assignedUserId === userId;
  if (target === "approved" && current === "reviewed") return task.ownerId === userId;
  if (target === "working" && current === "reviewed") return task.ownerId === userId;
  return false;
}

function transitionAction(task: Task, userId: string) {
  const stage = task.stage || "assigned";
  if (stage === "assigned" && task.assignedUserId === userId) {
    return { label: "Start work", stage: "working" as const };
  }
  if (stage === "working" && task.assignedUserId === userId) {
    return { label: "Submit for review", stage: "reviewed" as const };
  }
  return null;
}

export function WorkBoard({
  tasks,
  projects,
  connections,
  userId,
  onOpenTask,
  onStageTransition,
  onAssignmentChange,
  activities = [],
  loading = false,
  error = null,
  onRetry,
}: WorkBoardProps) {
  const [view, setView] = useState<WorkBoardView>("all");
  const [personId, setPersonId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [showApproved, setShowApproved] = useState(true);
  const [mobileStage, setMobileStage] = useState<TaskStage>("assigned");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [patches, setPatches] = useState<Record<string, TaskPatch>>({});
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [reviewTaskId, setReviewTaskId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [now, setNow] = useState(() => new Date());
  const closeRef = useRef<HTMLButtonElement>(null);
  const reviewRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setPatches(current => {
      let changed = false;
      const next = { ...current };
      Object.entries(current).forEach(([id, patch]) => {
        const task = tasks.find(item => item.id === id);
        if (!task) {
          delete next[id];
          changed = true;
          return;
        }
        const stageMatches = patch.stage === undefined || (task.stage || "assigned") === patch.stage;
        const assigneeMatches = patch.assignedUserId === undefined || (task.assignedUserId || null) === patch.assignedUserId;
        if (stageMatches && assigneeMatches) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [tasks]);

  useEffect(() => {
    if (!selectedId) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setReviewTaskId(null);
        setReviewNote("");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [selectedId]);

  useEffect(() => {
    if (reviewTaskId) reviewRef.current?.focus();
  }, [reviewTaskId]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const profiles = useMemo(() => {
    const byId = new Map<string, ConnectionProfile>();
    connections.forEach(connection => {
      byId.set(connection.requester.id, connection.requester);
      byId.set(connection.addressee.id, connection.addressee);
    });
    return byId;
  }, [connections]);

  const people = useMemo(() => {
    const byId = new Map<string, ConnectionProfile>();
    connections.filter(connection => connection.status === "accepted").forEach(connection => {
      const profile = connection.requesterId === userId ? connection.addressee : connection.requester;
      if (profile.id !== userId) byId.set(profile.id, profile);
    });
    return [...byId.values()].sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
  }, [connections, userId]);

  const displayTasks = useMemo(() => tasks.map(task => {
    const patch = patches[task.id];
    if (!patch) return task;
    return {
      ...task,
      ...(patch.stage !== undefined ? { stage: patch.stage } : {}),
      ...(patch.assignedUserId !== undefined
        ? { assignedUserId: patch.assignedUserId || undefined }
        : {}),
    };
  }), [patches, tasks]);

  const collaborativeTasks = useMemo(() => displayTasks.filter(task => {
    if (!task.assignedUserId) return false;
    if (task.ownerId !== userId && task.assignedUserId !== userId) return false;
    if (view === "by-me" && task.ownerId !== userId) return false;
    if (view === "to-me" && task.assignedUserId !== userId) return false;
    if (personId !== "all" && task.ownerId !== personId && task.assignedUserId !== personId) return false;
    if (projectId !== "all" && task.projectId !== projectId) return false;
    return true;
  }), [displayTasks, personId, projectId, userId, view]);

  const grouped = useMemo(() => Object.fromEntries(stages.map(stage => [
    stage.id,
    collaborativeTasks
      .filter(task => (task.stage || "assigned") === stage.id)
      .sort((a, b) => {
        const aDue = getTaskDueAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = getTaskDueAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue || b.updatedAt.localeCompare(a.updatedAt);
      }),
  ])) as Record<TaskStage, Task[]>, [collaborativeTasks]);

  const selectedTask = selectedId ? displayTasks.find(task => task.id === selectedId) : undefined;
  const selectedActivities = selectedId
    ? activities.filter(activity => activity.taskId === selectedId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const setTaskPending = (taskId: string, value: boolean) => setPending(current => {
    const next = new Set(current);
    if (value) next.add(taskId);
    else next.delete(taskId);
    return next;
  });

  const runTransition = async (task: Task, target: TaskStage, note?: string) => {
    if (pending.has(task.id) || !canTransition(task, target, userId)) return;
    const previousPatch = patches[task.id];
    setFeedback(null);
    setTaskPending(task.id, true);
    setPatches(current => ({ ...current, [task.id]: { ...current[task.id], stage: target } }));
    try {
      const result = await onStageTransition(task, target, note);
      if (result === false) throw new Error("The workflow change was not accepted.");
      setFeedback({ tone: "success", message: `“${task.title}” moved to ${target}.` });
      setReviewTaskId(null);
      setReviewNote("");
    } catch (transitionError) {
      setPatches(current => {
        const next = { ...current };
        if (previousPatch) next[task.id] = previousPatch;
        else delete next[task.id];
        return next;
      });
      setFeedback({
        tone: "error",
        message: transitionError instanceof Error ? transitionError.message : "The task could not be moved. It was returned to its previous stage.",
      });
    } finally {
      setTaskPending(task.id, false);
    }
  };

  const requestChanges = (task: Task) => {
    setSelectedId(task.id);
    setReviewTaskId(task.id);
    setReviewNote("");
  };

  const submitChangesRequest = async (task: Task) => {
    const note = reviewNote.trim();
    if (!note) {
      setFeedback({ tone: "error", message: "Add a short note explaining what needs to change." });
      reviewRef.current?.focus();
      return;
    }
    await runTransition(task, "working", note);
  };

  const runAssignmentChange = async (task: Task, nextAssignee: string | null) => {
    if (pending.has(task.id) || task.ownerId !== userId || (task.assignedUserId || null) === nextAssignee) return;
    const previousPatch = patches[task.id];
    setFeedback(null);
    setTaskPending(task.id, true);
    setPatches(current => ({
      ...current,
      [task.id]: { ...current[task.id], assignedUserId: nextAssignee, stage: "assigned" },
    }));
    try {
      const result = await onAssignmentChange(task, nextAssignee);
      if (result === false) throw new Error("The assignment change was not accepted.");
      setFeedback({
        tone: "success",
        message: nextAssignee ? `“${task.title}” was reassigned.` : `“${task.title}” is now unassigned.`,
      });
      if (!nextAssignee) setSelectedId(null);
    } catch (assignmentError) {
      setPatches(current => {
        const next = { ...current };
        if (previousPatch) next[task.id] = previousPatch;
        else delete next[task.id];
        return next;
      });
      setFeedback({
        tone: "error",
        message: assignmentError instanceof Error ? assignmentError.message : "The assignment could not be changed.",
      });
    } finally {
      setTaskPending(task.id, false);
    }
  };

  const onDrop = (target: TaskStage) => {
    const task = draggedId ? displayTasks.find(item => item.id === draggedId) : undefined;
    setDraggedId(null);
    if (!task || !canTransition(task, target, userId)) return;
    if ((task.stage || "assigned") === "reviewed" && target === "working") {
      requestChanges(task);
      return;
    }
    void runTransition(task, target);
  };

  const summary = view === "by-me"
    ? [
        ["Assigned", grouped.assigned.length],
        ["Working", grouped.working.length],
        ["Needs review", grouped.reviewed.filter(task => task.ownerId === userId).length],
        ["Approved", grouped.approved.length],
        ["Overdue", collaborativeTasks.filter(task => dueTone(task, now) === "overdue").length],
      ]
    : [
        ["Assigned to me", collaborativeTasks.filter(task => task.assignedUserId === userId).length],
        ["In progress", collaborativeTasks.filter(task => task.assignedUserId === userId && task.stage === "working").length],
        ["Waiting review", collaborativeTasks.filter(task => task.assignedUserId === userId && task.stage === "reviewed").length],
        ["Overdue", collaborativeTasks.filter(task => dueTone(task, now) === "overdue").length],
      ];

  if (loading) {
    return <section className="work-board work-board-state" aria-busy="true"><Loader2 className="spin"/><div><h2>Loading collaborative work</h2><p>Bringing the latest assignments into view.</p></div><BoardStyles/></section>;
  }

  if (error) {
    return <section className="work-board work-board-state" role="alert"><AlertCircle/><div><h2>Couldn’t load the Work Board</h2><p>{error}</p>{onRetry && <button className="wb-button wb-secondary" onClick={onRetry}><RotateCcw/>Try again</button>}</div><BoardStyles/></section>;
  }

  return <section className="work-board" aria-label="Collaborative work board">
    <div className="wb-topline">
      <div>
        <span className="wb-eyebrow">COLLABORATION</span>
        <h2>Work Board</h2>
        <p>Follow every assignment from handoff through approval.</p>
      </div>
      <label className="wb-approved-toggle">
        <input
          type="checkbox"
          checked={showApproved}
          onChange={event => {
            setShowApproved(event.target.checked);
            if (!event.target.checked && mobileStage === "approved") setMobileStage("assigned");
          }}
        />
        <span aria-hidden="true"><i/></span>
        Show approved
      </label>
    </div>

    <div className="wb-filters" aria-label="Board filters">
      <div className="wb-view-tabs" role="group" aria-label="Assignment view">
        {(Object.keys(viewLabels) as WorkBoardView[]).map(option => <button
          type="button"
          key={option}
          className={view === option ? "active" : ""}
          aria-pressed={view === option}
          onClick={() => setView(option)}
        >{viewLabels[option]}</button>)}
      </div>
      <label><span>Person</span><select value={personId} onChange={event => setPersonId(event.target.value)}><option value="all">All people</option>{people.map(person => <option key={person.id} value={person.id}>{person.fullName || person.email}</option>)}</select></label>
      <label><span>Project</span><select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="all">All projects</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    </div>

    <div className="wb-summary" aria-label={view === "by-me" ? "Assigned by me summary" : "My work summary"}>
      <div className="wb-summary-title"><span>{view === "by-me" ? "Assigned by Me" : "My Work"}</span><small>{collaborativeTasks.length} visible {collaborativeTasks.length === 1 ? "task" : "tasks"}</small></div>
      {summary.map(([label, value]) => <div className={`wb-summary-stat ${label === "Overdue" && Number(value) > 0 ? "danger" : ""}`} key={label}><strong>{value}</strong><span>{label}</span></div>)}
    </div>

    <div className="wb-mobile-stages" role="tablist" aria-label="Workflow stage">
      {stages.filter(stage => showApproved || stage.id !== "approved").map(stage => <button
        key={stage.id}
        type="button"
        role="tab"
        aria-selected={mobileStage === stage.id}
        className={mobileStage === stage.id ? "active" : ""}
        onClick={() => setMobileStage(stage.id)}
      ><span>{stage.label}</span><b>{grouped[stage.id].length}</b></button>)}
    </div>

    {collaborativeTasks.length === 0 && <div className="wb-empty-board">
      <Inbox/>
      <div><h3>{view === "to-me" ? "Nothing assigned to you right now." : "No collaborative tasks here."}</h3><p>{personId !== "all" || projectId !== "all" ? "Try another person or project filter." : "Connect with someone in People and assign your first task."}</p></div>
    </div>}

    <div className="wb-columns" data-mobile-stage={mobileStage}>
      {stages.filter(stage => showApproved || stage.id !== "approved").map(stage => {
        const reviewCount = stage.id === "reviewed" ? grouped.reviewed.filter(task => task.ownerId === userId).length : 0;
        const draggedTask = draggedId ? displayTasks.find(task => task.id === draggedId) : undefined;
        const canDrop = Boolean(draggedTask && canTransition(draggedTask, stage.id, userId));
        return <section
          className={`wb-column stage-${stage.id} ${canDrop ? "can-drop" : ""}`}
          data-stage={stage.id}
          key={stage.id}
          onDragOver={event => { if (canDrop) event.preventDefault(); }}
          onDrop={event => { event.preventDefault(); onDrop(stage.id); }}
          aria-labelledby={`board-${stage.id}`}
        >
          <header>
            <div><i/><h3 id={`board-${stage.id}`}>{stage.label}</h3><b>{grouped[stage.id].length}</b></div>
            {reviewCount > 0 && <span className="wb-review-count"><AlertCircle/>Needs review {reviewCount}</span>}
          </header>
          <div className="wb-card-list">
            {grouped[stage.id].map(task => {
              const assignee = task.assignedUserId ? profiles.get(task.assignedUserId) : undefined;
              const owner = task.ownerId ? profiles.get(task.ownerId) : undefined;
              const project = projects.find(item => item.id === task.projectId);
              const tone = dueTone(task, now);
              const action = transitionAction(task, userId);
              const isPending = pending.has(task.id);
              const draggable = !isPending && stages.some(target => canTransition(task, target.id, userId));
              return <article
                className={`wb-card due-${tone} ${draggedId === task.id ? "dragging" : ""} ${isPending ? "pending" : ""}`}
                key={task.id}
                draggable={draggable}
                onDragStart={event => {
                  setDraggedId(task.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", task.id);
                }}
                onDragEnd={() => setDraggedId(null)}
              >
                <button className="wb-card-open" type="button" onClick={() => setSelectedId(task.id)} aria-label={`Open ${task.title} details`}>
                  <div className="wb-card-meta"><span className={`wb-priority priority-${task.priority}`}><i/>{task.priority}</span>{draggable && <GripVertical aria-hidden="true"/>}</div>
                  <h4>{task.title}</h4>
                  <div className="wb-project"><Folder/>{project ? <><i style={{ background: project.color }}/>{project.name}</> : "No project"}</div>
                  <div className="wb-person-row"><span className="wb-mini-avatar" style={avatarStyle(assignee)}>{!assignee?.avatarUrl && initials(assignee)}</span><span><small>Assignee</small><strong>{displayName(assignee, task.assignedUserId, userId)}</strong></span></div>
                  {view === "to-me" && <div className="wb-owner-line"><UserRound/>Assigned by {displayName(owner, task.ownerId, userId)}</div>}
                  <div className={`wb-due due-${tone}`}><CalendarDays/><span>{dueLabel(task, now)}</span></div>
                  <div className="wb-stage-line"><span className={`wb-stage stage-${task.stage || "assigned"}`}>{task.stage || "assigned"}</span><ChevronRight/></div>
                </button>
                {(action || (task.stage === "reviewed" && task.ownerId === userId)) && <div className="wb-card-actions">
                  {action && <button type="button" disabled={isPending} onClick={() => void runTransition(task, action.stage)}>{isPending ? <Loader2 className="spin"/> : <ArrowRight/>}{action.label}</button>}
                  {task.stage === "reviewed" && task.ownerId === userId && <>
                    <button type="button" className="request" disabled={isPending} onClick={() => requestChanges(task)}>Request changes</button>
                    <button type="button" className="approve" disabled={isPending} onClick={() => void runTransition(task, "approved")}>{isPending ? <Loader2 className="spin"/> : <Check/>}Approve</button>
                  </>}
                </div>}
              </article>;
            })}
            {grouped[stage.id].length === 0 && <div className="wb-column-empty"><CheckCircle2/><p>{stage.id === "reviewed" && view === "by-me" ? "You’re all caught up. No work is waiting for your review." : stage.empty}</p>{canDrop && <strong>Drop task here</strong>}</div>}
          </div>
        </section>;
      })}
    </div>

    {feedback && <div className={`wb-feedback ${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.tone === "error" ? <AlertCircle/> : <CheckCircle2/>}<span>{feedback.message}</span><button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message"><X/></button></div>}

    {selectedTask && <div className="wb-overlay" onMouseDown={event => { if (event.target === event.currentTarget) { setSelectedId(null); setReviewTaskId(null); setReviewNote(""); } }}>
      <section className="wb-detail" role="dialog" aria-modal="true" aria-labelledby="wb-detail-title">
        <div className="wb-detail-head">
          <div><span className="wb-eyebrow">TASK DETAILS</span><h2 id="wb-detail-title">{selectedTask.title}</h2></div>
          <button ref={closeRef} type="button" className="wb-icon-button" aria-label="Close task details" onClick={() => { setSelectedId(null); setReviewTaskId(null); setReviewNote(""); }}><X/></button>
        </div>
        {selectedTask.description && <p className="wb-description">{selectedTask.description}</p>}
        <div className="wb-detail-grid">
          <DetailValue label="Project" value={projects.find(project => project.id === selectedTask.projectId)?.name || "No project"}/>
          <DetailPerson label="Owner" profile={selectedTask.ownerId ? profiles.get(selectedTask.ownerId) : undefined} id={selectedTask.ownerId} userId={userId}/>
          <DetailPerson label="Assigned to" profile={selectedTask.assignedUserId ? profiles.get(selectedTask.assignedUserId) : undefined} id={selectedTask.assignedUserId} userId={userId}/>
          <DetailValue label="Priority" value={`${selectedTask.priority[0].toUpperCase()}${selectedTask.priority.slice(1)}`}/>
          <DetailValue label="Due" value={formatDue(selectedTask)}/>
          <DetailValue label="Status" value={`${(selectedTask.stage || "assigned")[0].toUpperCase()}${(selectedTask.stage || "assigned").slice(1)}`}/>
          <DetailValue label="Created" value={formatDate(selectedTask.createdAt, true)}/>
        </div>

        {selectedTask.ownerId === userId && <label className="wb-reassign"><span>Assignee</span><select value={selectedTask.assignedUserId || ""} disabled={pending.has(selectedTask.id)} onChange={event => void runAssignmentChange(selectedTask, event.target.value || null)}><option value="">Unassigned</option>{people.map(person => <option value={person.id} key={person.id}>{person.fullName || person.email}</option>)}</select><small>Reassignment returns the workflow to Assigned.</small></label>}

        {((selectedTask as Task & { reviewNote?: string }).reviewNote || selectedActivities.find(item => item.eventType === "changes_requested" && item.reviewNote)?.reviewNote) && <div className="wb-review-note"><strong><Pencil/>Review note</strong><p>{(selectedTask as Task & { reviewNote?: string }).reviewNote || selectedActivities.find(item => item.eventType === "changes_requested" && item.reviewNote)?.reviewNote}</p></div>}

        {reviewTaskId === selectedTask.id && <div className="wb-review-form"><label htmlFor="wb-review-note">What needs to change?</label><textarea ref={reviewRef} id="wb-review-note" value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={3} placeholder="Please update the mobile layout before resubmitting."/><div><button type="button" className="wb-button wb-secondary" disabled={pending.has(selectedTask.id)} onClick={() => { setReviewTaskId(null); setReviewNote(""); }}>Cancel</button><button type="button" className="wb-button wb-primary" disabled={pending.has(selectedTask.id)} onClick={() => void submitChangesRequest(selectedTask)}>{pending.has(selectedTask.id) ? <Loader2 className="spin"/> : <RotateCcw/>}Request changes</button></div></div>}

        {reviewTaskId !== selectedTask.id && <div className="wb-detail-actions">
          <button type="button" className="wb-button wb-secondary" onClick={() => { onOpenTask(selectedTask); setSelectedId(null); }}><Pencil/>Edit task</button>
          {transitionAction(selectedTask, userId) && <button type="button" className="wb-button wb-primary" disabled={pending.has(selectedTask.id)} onClick={() => { const action = transitionAction(selectedTask, userId); if (action) void runTransition(selectedTask, action.stage); }}><ArrowRight/>{transitionAction(selectedTask, userId)?.label}</button>}
          {selectedTask.stage === "reviewed" && selectedTask.ownerId === userId && <><button type="button" className="wb-button wb-secondary" disabled={pending.has(selectedTask.id)} onClick={() => requestChanges(selectedTask)}><RotateCcw/>Request changes</button><button type="button" className="wb-button wb-primary" disabled={pending.has(selectedTask.id)} onClick={() => void runTransition(selectedTask, "approved")}><Check/>Approve</button></>}
        </div>}

        <div className="wb-activity">
          <h3><Clock3/>Activity</h3>
          {selectedActivities.length > 0 ? <ol>{selectedActivities.map(activity => {
            const actor = activity.actor || profiles.get(activity.actorUserId);
            return <li key={activity.id}><span className="wb-mini-avatar" style={avatarStyle(actor)}>{!actor?.avatarUrl && initials(actor)}</span><div><p><strong>{displayName(actor, activity.actorUserId, userId)}</strong> {eventLabels[activity.eventType] || activity.eventType.replaceAll("_", " ")}</p>{activity.reviewNote && <blockquote>{activity.reviewNote}</blockquote>}<time dateTime={activity.createdAt}>{formatDate(activity.createdAt, true)}</time></div></li>;
          })}</ol> : <div className="wb-activity-empty"><Clock3/><span>Workflow activity will appear here as the task moves.</span></div>}
        </div>
      </section>
    </div>}
    <BoardStyles/>
  </section>;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="wb-detail-value"><span>{label}</span><strong>{value}</strong></div>;
}

function DetailPerson({ label, profile, id, userId }: { label: string; profile?: ConnectionProfile; id?: string; userId: string }) {
  return <div className="wb-detail-value"><span>{label}</span><div className="wb-detail-person"><span className="wb-mini-avatar" style={avatarStyle(profile)}>{!profile?.avatarUrl && initials(profile)}</span><strong>{id ? displayName(profile, id, userId) : "Unassigned"}</strong></div></div>;
}

function BoardStyles() {
  return <style jsx global>{`
    .work-board{--wb-purple:#a78bfa;--wb-purple-soft:rgba(167,139,250,.1);min-width:0;color:var(--text)}
    .wb-topline{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}.wb-eyebrow{display:block;font:9px "DM Mono",monospace;letter-spacing:.13em;color:var(--green);margin-bottom:6px}.wb-topline h2{font-size:20px;margin:0}.wb-topline p{font-size:10px;color:var(--muted);margin:6px 0 0}.wb-approved-toggle{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--muted);cursor:pointer}.wb-approved-toggle input{position:absolute;opacity:0;pointer-events:none}.wb-approved-toggle>span{width:35px;height:20px;border-radius:99px;background:var(--surface3);border:1px solid var(--border2);padding:2px;transition:.18s}.wb-approved-toggle i{display:block;width:14px;height:14px;border-radius:50%;background:var(--muted2);transition:.18s}.wb-approved-toggle input:checked+span{background:var(--green);border-color:var(--green)}.wb-approved-toggle input:checked+span i{transform:translateX(15px);background:#063923}.wb-approved-toggle input:focus-visible+span{box-shadow:0 0 0 2px var(--green-soft),0 0 0 3px var(--green)}
    .wb-filters{display:grid;grid-template-columns:minmax(420px,1fr) 180px 180px;gap:9px;align-items:end;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:10px}.wb-view-tabs{display:flex;padding:3px;border:1px solid var(--border);border-radius:6px;background:var(--surface2)}.wb-view-tabs button{flex:1;min-height:34px;padding:5px 9px;border:0;border-radius:4px;background:transparent;color:var(--muted);font-size:10px}.wb-view-tabs button:hover{color:var(--text)}.wb-view-tabs button.active{background:var(--surface3);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.12)}.wb-filters>label{display:flex;flex-direction:column;gap:5px}.wb-filters>label>span{font:8px "DM Mono",monospace;letter-spacing:.09em;text-transform:uppercase;color:var(--muted2)}.wb-filters select{width:100%}
    .wb-summary{display:flex;align-items:stretch;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:14px;overflow:hidden}.wb-summary-title{min-width:165px;display:flex;flex-direction:column;justify-content:center;padding:13px 16px;border-right:1px solid var(--border)}.wb-summary-title span{font-size:11px;font-weight:700}.wb-summary-title small{font-size:8px;color:var(--muted);margin-top:3px}.wb-summary-stat{flex:1;min-width:92px;padding:11px 14px;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:3px}.wb-summary-stat:last-child{border:0}.wb-summary-stat strong{font-size:17px}.wb-summary-stat span{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.wb-summary-stat.danger strong,.wb-summary-stat.danger span{color:var(--red)}
    .wb-columns{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));align-items:start;gap:10px;overflow-x:auto;padding-bottom:8px}.wb-column{min-width:0;border:1px solid var(--border);border-radius:8px;background:var(--surface2);transition:border-color .15s,background .15s}.wb-column.can-drop{border-color:rgba(62,207,142,.52);background:var(--green-soft)}.wb-column>header{min-height:49px;padding:10px 11px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--surface);border-radius:8px 8px 0 0}.wb-column>header>div{display:flex;align-items:center;gap:7px;min-width:0}.wb-column>header i{width:7px;height:7px;border-radius:50%;background:var(--blue)}.wb-column.stage-working>header i{background:var(--amber)}.wb-column.stage-reviewed>header i{background:var(--wb-purple)}.wb-column.stage-approved>header i{background:var(--green)}.wb-column>header h3{font-size:10px;margin:0}.wb-column>header b{font-size:9px;padding:2px 6px;border-radius:99px;background:var(--surface3);color:var(--muted)}.wb-review-count{display:flex;align-items:center;gap:3px;font-size:7px;text-transform:uppercase;color:var(--wb-purple);white-space:nowrap}.wb-review-count svg{width:10px}.wb-card-list{padding:8px;display:flex;flex-direction:column;gap:8px;min-height:170px}
    .wb-card{position:relative;border:1px solid var(--border);border-radius:7px;background:var(--surface);box-shadow:0 2px 6px rgba(0,0,0,.07);transition:transform .15s,border-color .15s,opacity .15s}.wb-card:hover{border-color:var(--border2);transform:translateY(-1px)}.wb-card.dragging{opacity:.42;transform:rotate(1deg)}.wb-card.pending{opacity:.72}.wb-card.due-overdue{border-left:3px solid var(--red)}.wb-card.due-due-soon{border-left:3px solid var(--amber)}.wb-card-open{display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:12px}.wb-card-open:focus-visible{outline:2px solid var(--green);outline-offset:-2px;border-radius:6px}.wb-card-meta{display:flex;align-items:center;justify-content:space-between}.wb-card-meta>svg{width:14px;color:var(--muted2);cursor:grab}.wb-priority{display:inline-flex;align-items:center;gap:5px;font:8px "DM Mono",monospace;text-transform:uppercase;letter-spacing:.05em}.wb-priority i{width:5px;height:5px;border-radius:50%}.wb-priority.priority-high{color:var(--red)}.wb-priority.priority-high i{background:var(--red)}.wb-priority.priority-medium{color:var(--amber)}.wb-priority.priority-medium i{background:var(--amber)}.wb-priority.priority-low{color:var(--blue)}.wb-priority.priority-low i{background:var(--blue)}.wb-card h4{font-size:12px;line-height:1.45;margin:12px 0 11px;overflow-wrap:anywhere}.wb-project{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--muted);margin-bottom:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wb-project svg{width:12px;flex:0 0 auto}.wb-project i{width:5px;height:5px;border-radius:2px;flex:0 0 auto}.wb-person-row{display:flex;align-items:center;gap:7px;padding:8px 0;border-top:1px solid var(--border)}.wb-mini-avatar{width:25px;height:25px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background-color:var(--green-soft);background-position:center;background-size:cover;border:1px solid var(--border2);color:var(--green);font-size:8px;font-weight:700}.wb-person-row>span:last-child{display:flex;flex-direction:column;gap:1px;min-width:0}.wb-person-row small{font-size:7px;color:var(--muted2);text-transform:uppercase}.wb-person-row strong{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wb-owner-line{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:8px;margin:1px 0 8px}.wb-owner-line svg{width:11px}.wb-due{display:flex;align-items:center;gap:5px;font-size:8px;color:var(--muted);padding-top:8px;border-top:1px solid var(--border)}.wb-due svg{width:12px}.wb-due.due-overdue{color:var(--red);font-weight:700;text-transform:uppercase}.wb-due.due-due-soon{color:var(--amber);font-weight:700}.wb-due.due-today{color:var(--blue)}.wb-stage-line{display:flex;align-items:center;justify-content:space-between;margin-top:10px}.wb-stage-line>svg{width:13px;color:var(--muted2)}.wb-stage{display:inline-flex;padding:3px 6px;border-radius:4px;background:rgba(116,169,237,.09);color:var(--blue);font:8px "DM Mono",monospace;letter-spacing:.05em;text-transform:uppercase}.wb-stage.stage-working{color:var(--amber);background:rgba(243,185,95,.09)}.wb-stage.stage-reviewed{color:var(--wb-purple);background:var(--wb-purple-soft)}.wb-stage.stage-approved{color:var(--green);background:var(--green-soft)}.wb-card-actions{display:flex;gap:5px;flex-wrap:wrap;padding:8px;border-top:1px solid var(--border)}.wb-card-actions button{min-height:29px;display:inline-flex;align-items:center;justify-content:center;gap:4px;flex:1;border:1px solid rgba(62,207,142,.23);border-radius:4px;background:var(--green-soft);color:var(--green);font-size:8px;white-space:nowrap}.wb-card-actions button.request{color:var(--muted);background:transparent;border-color:var(--border2)}.wb-card-actions button.approve{color:var(--green)}.wb-card-actions svg{width:11px}.wb-card-actions button:disabled{opacity:.55}.wb-column-empty{min-height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15px;text-align:center;color:var(--muted2)}.wb-column-empty svg{width:20px;opacity:.6}.wb-column-empty p{font-size:9px;line-height:1.55;margin:8px 0}.wb-column-empty strong{font-size:8px;color:var(--green)}
    .wb-empty-board{display:flex;align-items:center;gap:12px;padding:15px;margin-bottom:10px;border:1px dashed var(--border2);border-radius:8px;background:var(--surface)}.wb-empty-board>svg{width:25px;color:var(--green)}.wb-empty-board h3{font-size:11px;margin:0 0 4px}.wb-empty-board p{font-size:9px;color:var(--muted);margin:0}.wb-mobile-stages{display:none}
    .wb-overlay{position:fixed;inset:0;z-index:110;background:rgba(4,7,5,.72);backdrop-filter:blur(6px);display:flex;justify-content:flex-end;padding:12px;animation:fade .15s ease}.wb-detail{width:min(510px,100%);height:100%;overflow:auto;border:1px solid var(--border2);border-radius:10px;background:var(--surface);box-shadow:var(--shadow);padding:24px;animation:wb-slide-in .2s ease}.wb-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding-bottom:18px;border-bottom:1px solid var(--border)}.wb-detail-head h2{font-size:19px;line-height:1.35;margin:0}.wb-icon-button{width:34px;height:34px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--muted);display:grid;place-items:center;flex:0 0 auto}.wb-icon-button svg{width:15px}.wb-description{font-size:11px;line-height:1.7;color:var(--muted);padding:16px 0;margin:0;border-bottom:1px solid var(--border);white-space:pre-wrap}.wb-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:7px 0 18px}.wb-detail-value{min-height:66px;padding:12px 7px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:6px}.wb-detail-value>span{font:8px "DM Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:var(--muted2)}.wb-detail-value>strong{font-size:10px}.wb-detail-person{display:flex;align-items:center;gap:7px}.wb-detail-person strong{font-size:10px}.wb-reassign{display:flex;flex-direction:column;gap:6px;padding:13px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:9px;color:var(--muted)}.wb-reassign>span{font-weight:700;color:var(--text)}.wb-reassign select{width:100%}.wb-reassign small{font-size:8px}.wb-review-note{margin-top:14px;padding:13px;border:1px solid rgba(167,139,250,.22);border-radius:7px;background:var(--wb-purple-soft)}.wb-review-note strong{display:flex;align-items:center;gap:6px;color:var(--wb-purple);font-size:10px}.wb-review-note svg{width:13px}.wb-review-note p{font-size:10px;line-height:1.55;margin:7px 0 0}.wb-review-form{margin-top:14px;padding:14px;border:1px solid rgba(167,139,250,.26);border-radius:7px;background:var(--wb-purple-soft)}.wb-review-form>label{display:block;font-size:10px;font-weight:700;margin-bottom:7px}.wb-review-form textarea{width:100%;padding:10px;color:var(--text);font-size:11px;resize:vertical}.wb-review-form>div{display:flex;justify-content:flex-end;gap:7px;margin-top:9px}.wb-detail-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-top:16px}.wb-button{min-height:35px;padding:0 11px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:9px}.wb-button svg{width:13px}.wb-primary{border:1px solid var(--green);background:var(--green);color:#063923;font-weight:700}.wb-secondary{border:1px solid var(--border2);background:var(--surface2);color:var(--text)}.wb-button:disabled{opacity:.55}.wb-activity{margin-top:23px;padding-top:18px;border-top:1px solid var(--border)}.wb-activity h3{display:flex;align-items:center;gap:7px;font-size:11px;margin:0 0 14px}.wb-activity h3 svg{width:14px;color:var(--green)}.wb-activity ol{list-style:none;padding:0;margin:0}.wb-activity li{display:flex;gap:9px;position:relative;padding-bottom:15px}.wb-activity li:not(:last-child):before{content:"";position:absolute;left:12px;top:27px;bottom:2px;width:1px;background:var(--border)}.wb-activity li>div{min-width:0}.wb-activity p{font-size:9px;margin:2px 0 3px}.wb-activity time{font-size:8px;color:var(--muted2)}.wb-activity blockquote{font-size:9px;color:var(--muted);margin:5px 0;padding:7px 9px;border-left:2px solid var(--wb-purple);background:var(--surface2)}.wb-activity-empty{min-height:72px;border:1px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--muted2);font-size:9px}.wb-activity-empty svg{width:15px}
    .wb-feedback{position:fixed;right:20px;bottom:20px;z-index:140;max-width:min(390px,calc(100vw - 30px));display:flex;align-items:center;gap:8px;padding:11px 13px;border:1px solid var(--border2);border-radius:7px;background:var(--surface);box-shadow:var(--shadow);font-size:9px}.wb-feedback.success>svg{color:var(--green)}.wb-feedback.error{border-color:rgba(248,113,113,.35)}.wb-feedback.error>svg{color:var(--red)}.wb-feedback>svg{width:15px;flex:0 0 auto}.wb-feedback>button{margin-left:auto;border:0;background:transparent;color:var(--muted);padding:2px}.wb-feedback>button svg{width:13px}.work-board-state{min-height:300px;border:1px solid var(--border);border-radius:8px;background:var(--surface);display:flex;align-items:center;justify-content:center;gap:13px}.work-board-state>svg{width:25px;color:var(--green)}.work-board-state h2{font-size:13px;margin:0 0 5px}.work-board-state p{font-size:10px;color:var(--muted);margin:0 0 10px}
    @keyframes wb-slide-in{from{opacity:0;transform:translateX(15px)}to{opacity:1;transform:none}}
    @media(max-width:1100px){.wb-filters{grid-template-columns:1fr 145px 145px}.wb-summary{overflow-x:auto}.wb-summary-title{position:sticky;left:0;z-index:1;background:var(--surface)}}
    @media(max-width:760px){.wb-topline{align-items:flex-start}.wb-filters{grid-template-columns:1fr 1fr}.wb-view-tabs{grid-column:1/-1;overflow-x:auto}.wb-view-tabs button{min-width:max-content}.wb-summary{display:grid;grid-template-columns:repeat(2,1fr);overflow:visible}.wb-summary-title{grid-column:1/-1;position:static;border-right:0;border-bottom:1px solid var(--border)}.wb-summary-stat{border-bottom:1px solid var(--border)}.wb-summary-stat:nth-child(odd){border-right:0}.wb-mobile-stages{display:flex;gap:5px;overflow-x:auto;margin-bottom:9px;padding-bottom:2px}.wb-mobile-stages button{min-width:max-content;height:37px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--muted);padding:0 10px;display:flex;align-items:center;gap:7px;font-size:9px}.wb-mobile-stages button b{font-size:8px;background:var(--surface3);border-radius:99px;padding:2px 5px}.wb-mobile-stages button.active{border-color:rgba(62,207,142,.35);background:var(--green-soft);color:var(--green)}.wb-columns{display:block;overflow:visible}.wb-column{display:none}.wb-columns[data-mobile-stage="assigned"] .wb-column[data-stage="assigned"],.wb-columns[data-mobile-stage="working"] .wb-column[data-stage="working"],.wb-columns[data-mobile-stage="reviewed"] .wb-column[data-stage="reviewed"],.wb-columns[data-mobile-stage="approved"] .wb-column[data-stage="approved"]{display:block}.wb-card-list{min-height:230px}.wb-card{max-width:none}.wb-card-open{padding:14px}.wb-card-actions button{min-height:38px;font-size:9px}.wb-overlay{padding:0;align-items:flex-end}.wb-detail{width:100%;height:min(92vh,760px);border-radius:12px 12px 0 0;padding:20px}.wb-detail-grid{grid-template-columns:1fr}.wb-detail-value{min-height:58px}.wb-detail-actions{display:grid;grid-template-columns:1fr}.wb-detail-actions .wb-button{width:100%;min-height:42px}.wb-review-form>div{display:grid;grid-template-columns:1fr}.wb-review-form .wb-button{width:100%;min-height:42px}.wb-feedback{left:15px;right:15px;bottom:15px;max-width:none}}
    @media(max-width:430px){.wb-topline{display:block}.wb-approved-toggle{margin-top:12px}.wb-filters{grid-template-columns:1fr}.wb-view-tabs{grid-column:auto}.wb-filters select{height:42px}.wb-summary-stat{padding:10px}.wb-detail{padding:17px}.wb-detail-head h2{font-size:17px}}
    @media(prefers-reduced-motion:reduce){.wb-card,.wb-detail,.wb-overlay,.wb-approved-toggle *{animation:none!important;transition:none!important}}
  `}</style>;
}
