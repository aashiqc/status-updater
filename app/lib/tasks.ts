import type { Role, StatusType } from "./status";

/** A task you've posted START for, remembered on this device until you STOP it. */
export interface TrackedTask {
  id: string;
  project: string;
  task: string;
  reference: string;
  estimate: string;
  state: "active" | "paused" | "done";
  /** When the current working session began (from a copied or pasted START). */
  startedAt: number | null;
  /** Minutes from earlier sessions (closed by PAUSE). */
  loggedMin: number;
  updatedAt: number;
}

/** One update you copied, kept so you can copy it again or reuse its fields. */
export interface HistoryEntry {
  id: string;
  type: StatusType;
  role: Role;
  project: string;
  task: string;
  body: string;
  at: number;
}

const MAX_SESSION_MS = 12 * 60 * 60 * 1000;
const DONE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_TASKS = 30;
export const MAX_HISTORY = 100;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const taskKey = (project: string, task: string) => `${norm(project)}::${norm(task)}`;

export function findTask(tasks: TrackedTask[], project: string, task: string) {
  if (!task.trim()) return undefined;
  const key = taskKey(project, task);
  return tasks.find((t) => t.id === key);
}

/** Minutes in the current session, ignoring sessions that look abandoned (> 12h). */
export function sessionMinutes(t: TrackedTask, now: number): number {
  if (t.state !== "active" || !t.startedAt) return 0;
  const ms = now - t.startedAt;
  return ms > 0 && ms <= MAX_SESSION_MS ? Math.round(ms / 60000) : 0;
}

export const trackedMinutes = (t: TrackedTask, now: number) => t.loggedMin + sessionMinutes(t, now);

export interface UpdateInput {
  type: StatusType;
  project: string;
  task: string;
  reference: string;
  estimate: string;
  at: number;
  /** Override the session start (pasted START with a time). `null` = unknown. */
  startedAt?: number | null;
}

export function recordUpdate(tasks: TrackedTask[], u: UpdateInput): TrackedTask[] {
  if (!u.task.trim()) return tasks;
  const id = taskKey(u.project, u.task);
  const existing = tasks.find((t) => t.id === id);
  const base: TrackedTask = existing ?? {
    id,
    project: u.project.trim(),
    task: u.task.trim(),
    reference: "",
    estimate: "",
    state: "active",
    startedAt: null,
    loggedMin: 0,
    updatedAt: u.at,
  };
  const next: TrackedTask = {
    ...base,
    project: u.project.trim() || base.project,
    task: u.task.trim(),
    reference: u.reference.trim() || base.reference,
    estimate: u.estimate.trim() || base.estimate,
    updatedAt: u.at,
  };

  if (u.type === "START") {
    const restarting = base.state === "done";
    const sessionLive = base.state === "active" && base.startedAt && u.at - base.startedAt <= MAX_SESSION_MS;
    if (restarting) next.loggedMin = 0;
    if (!existing || restarting || !sessionLive) {
      next.startedAt = u.startedAt === undefined ? u.at : u.startedAt;
    }
    next.state = "active";
  } else {
    next.loggedMin = base.loggedMin + sessionMinutes(base, u.at);
    next.startedAt = null;
    next.state = u.type === "PAUSE" ? "paused" : "done";
  }

  return [next, ...tasks.filter((t) => t.id !== id)]
    .filter((t) => t.state !== "done" || u.at - t.updatedAt < DONE_TTL_MS)
    .slice(0, MAX_TASKS);
}

export function addHistory(history: HistoryEntry[], entry: Omit<HistoryEntry, "id">): HistoryEntry[] {
  // Copying the same message twice in a row shouldn't add a duplicate.
  const [last] = history;
  if (last && last.body === entry.body && entry.at - last.at < 10 * 60 * 1000) {
    return [{ ...last, at: entry.at }, ...history.slice(1)];
  }
  return [{ ...entry, id: `${entry.at}-${Math.random().toString(36).slice(2, 7)}` }, ...history].slice(
    0,
    MAX_HISTORY,
  );
}

/** Unique project names, most recent first — for autocomplete. */
export function recentProjects(tasks: TrackedTask[], history: HistoryEntry[]): string[] {
  const seen = new Map<string, string>();
  const items = [
    ...tasks.map((t) => ({ p: t.project, at: t.updatedAt })),
    ...history.map((h) => ({ p: h.project, at: h.at })),
  ].sort((a, b) => b.at - a.at);
  for (const { p } of items) {
    const k = norm(p);
    if (k && !seen.has(k)) seen.set(k, p.trim());
  }
  return [...seen.values()].slice(0, 20);
}
