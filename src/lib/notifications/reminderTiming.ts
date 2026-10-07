export function reminderTime(dueAt: string, minutes: number) {
  return new Date(new Date(dueAt).getTime() - minutes * 60_000);
}

export function reminderIsDue(dueAt: string, minutes: number, now = new Date()) {
  return reminderTime(dueAt, minutes).getTime() <= now.getTime();
}
