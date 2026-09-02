import test from "node:test";
import assert from "node:assert/strict";
import { getReminderState, getTaskReminders } from "../src/lib/reminders.ts";
import { reminderIsDue, reminderTime } from "../src/lib/notifications/reminderTiming.ts";

const base = { id: "task-1", title: "Test task", completed: false, priority: "medium", createdAt: "", updatedAt: "" };
const now = new Date(2026, 8, 2, 12, 0);
const task = (dueDate, dueTime, completed = false) => ({ ...base, dueDate, dueTime, completed });

test("classifies active in-app reminder windows", () => {
  assert.equal(getReminderState(task("2026-09-02", "11:00"), now), "overdue");
  assert.equal(getReminderState(task("2026-09-02", "12:45"), now), "due-soon");
  assert.equal(getReminderState(task("2026-09-02", "18:00"), now), "today");
  assert.equal(getReminderState(task("2026-09-03"), now), "tomorrow");
});

test("excludes completed, distant, undated, and dismissed reminders", () => {
  assert.equal(getReminderState(task("2026-09-02", "12:30", true), now), null);
  assert.equal(getReminderState(task("2026-09-06"), now), null);
  assert.equal(getReminderState({ ...base }, now), null);
  const reminder = getTaskReminders([task("2026-09-02", "12:30")], new Set(), now)[0];
  assert.equal(getTaskReminders([reminder.task], new Set([reminder.dismissalKey]), now).length, 0);
});

test("calculates timezone-safe push reminder instants", () => {
  const dueAt = "2026-09-02T22:00:00.000Z";
  assert.equal(reminderTime(dueAt, 60).toISOString(), "2026-09-02T21:00:00.000Z");
  assert.equal(reminderIsDue(dueAt, 60, new Date("2026-09-02T21:00:00.000Z")), true);
  assert.equal(reminderIsDue(dueAt, 15, new Date("2026-09-02T21:00:00.000Z")), false);
});
