import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionTask, filterCollaborativeTasks } from "../src/lib/workflow.ts";

const baseTask = {
  id: "task-1",
  ownerId: "owner",
  assignedUserId: "assignee",
  title: "Collaborative task",
  completed: false,
  priority: "medium",
  stage: "assigned",
  projectId: "project-1",
  createdAt: "2026-09-04T12:00:00.000Z",
  updatedAt: "2026-09-04T12:00:00.000Z",
};

test("allows only the responsible actor to perform each workflow transition", () => {
  assert.equal(canTransitionTask(baseTask, "working", "assignee"), true);
  assert.equal(canTransitionTask(baseTask, "working", "owner"), false);
  const working = { ...baseTask, stage: "working" };
  assert.equal(canTransitionTask(working, "reviewed", "assignee"), true);
  assert.equal(canTransitionTask(working, "reviewed", "owner"), false);
  const reviewed = { ...baseTask, stage: "reviewed" };
  assert.equal(canTransitionTask(reviewed, "approved", "owner"), true);
  assert.equal(canTransitionTask(reviewed, "approved", "assignee"), false);
  assert.equal(canTransitionTask(reviewed, "working", "owner"), true);
  assert.equal(canTransitionTask(reviewed, "working", "assignee"), false);
});

test("filters board work by relationship, person, and project", () => {
  const tasks = [
    baseTask,
    { ...baseTask, id: "task-2", ownerId: "other", assignedUserId: "owner", projectId: "project-2" },
    { ...baseTask, id: "task-3", ownerId: "stranger", assignedUserId: "other" },
    { ...baseTask, id: "task-4", assignedUserId: undefined },
  ];
  assert.deepEqual(filterCollaborativeTasks(tasks, "owner", "all").map(task => task.id), ["task-1", "task-2"]);
  assert.deepEqual(filterCollaborativeTasks(tasks, "owner", "by-me").map(task => task.id), ["task-1"]);
  assert.deepEqual(filterCollaborativeTasks(tasks, "owner", "to-me").map(task => task.id), ["task-2"]);
  assert.deepEqual(filterCollaborativeTasks(tasks, "owner", "all", "assignee", "project-1").map(task => task.id), ["task-1"]);
});
