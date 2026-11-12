import { formatDuration, normalizeClock, parseDuration, type TimeFormat } from "./duration";

export type StatusType = "START" | "PAUSE" | "STOP";
export type Role = "dev" | "qa";

export const STATUS_TYPES: StatusType[] = ["START", "PAUSE", "STOP"];
export const CUSTOM = "Other";

export const PAUSE_OPTIONS = ["In Progress", "Blocked", "On Hold"];
export const STOP_OPTIONS: Record<Role, string[]> = {
  dev: ["Done", "Moved to QA", "Dropped", "Re-scoped"],
  qa: ["Done", "Passed", "Issues found"],
};
export const defaultStopStatus = (role: Role) => (role === "qa" ? "Done" : "Moved to QA");

export interface Draft {
  project: string;
  task: string;
  // START
  estimate: string;
  estimateDays: string[] | null;
  reference: string;
  // PAUSE
  pauseStatus: string;
  pauseCustom: string;
  reason: string;
  progress: string;
  // STOP
  stopStatus: string;
  stopCustom: string;
  timeTaken: string;
  takenDays: string[] | null;
  notes: string;
}

export const EMPTY_DRAFT: Draft = {
  project: "",
  task: "",
  estimate: "",
  estimateDays: null,
  reference: "",
  pauseStatus: "In Progress",
  pauseCustom: "",
  reason: "",
  progress: "",
  stopStatus: "Moved to QA",
  stopCustom: "",
  timeTaken: "",
  takenDays: null,
  notes: "",
};

/** Total minutes for a duration field, summing per-day entries when split. */
export function durationMinutes(value: string, days: string[] | null): number | null {
  if (!days) return parseDuration(value);
  let total = 0;
  let any = false;
  for (const d of days) {
    const m = parseDuration(d);
    if (m != null) {
      total += m;
      any = true;
    }
  }
  return any ? total : null;
}

export interface OutputLine {
  label: string | null;
  value: string;
  placeholder?: string;
  missing?: boolean;
}

export interface BuildOptions {
  type: StatusType;
  role: Role;
  name: string;
  draft: Draft;
  timeFormat: TimeFormat;
  headerTime: string | null;
}

const line = (label: string, value: string, placeholder: string, required = true): OutputLine => {
  const v = value.trim();
  return { label, value: v, placeholder, missing: required && !v };
};

export function buildLines({ type, role, name, draft: d, timeFormat, headerTime }: BuildOptions): OutputLine[] {
  const lines: OutputLine[] = [{ label: null, value: headerTime ? `${type} - ${headerTime}` : type }];
  lines.push(line("Project", d.project, "brand name"));
  lines.push(line("Task", d.task, "short description"));

  if (type === "START") {
    const min = durationMinutes(d.estimate, d.estimateDays);
    lines.push(line("Estimated Time", min ? formatDuration(min, timeFormat) : "", "e.g. ~2h"));
    lines.push({ label: "Reference", value: d.reference.trim() || "nil" });
  } else if (type === "PAUSE") {
    const status = d.pauseStatus === CUSTOM ? d.pauseCustom : d.pauseStatus;
    lines.push(line("Status", status, "status"));
    lines.push(line("Reason", d.reason, "short reason"));
    lines.push(line("Progress", d.progress, "what is done so far"));
  } else {
    const status = d.stopStatus === CUSTOM ? d.stopCustom : d.stopStatus;
    const min = durationMinutes(d.timeTaken, d.takenDays);
    lines.push(line("Status", status, "status"));
    lines.push(line("Time Taken", min ? formatDuration(min, timeFormat) : "", "approx time spent"));
    lines.push(line("Notes", d.notes, "build number, PRs", false));
  }

  lines.push(line(role === "qa" ? "QA" : "Dev", name, "your name"));
  return lines;
}

/** Message body. Empty fields stay blank ("Notes:") rather than leaking placeholder text into Slack. */
export function linesToText(lines: OutputLine[]): string {
  return lines
    .map((l) => (l.label === null ? l.value : l.value ? `${l.label}: ${l.value}` : `${l.label}:`))
    .join("\n");
}

export const toSlackMessage = (body: string) => "```\n" + body + "\n```";

// ---------------------------------------------------------------------------
// Parsing pasted Slack text: status messages, Tazko task cards, or loose fields
// ---------------------------------------------------------------------------

export interface ParsedMessage {
  source: "status" | "tazko" | "fields" | "none";
  type?: StatusType;
  time?: string;
  project?: string;
  task?: string;
  name?: string;
  role?: Role;
  estimate?: string;
  reference?: string;
  status?: string;
  timeTaken?: string;
  reason?: string;
  progress?: string;
  notes?: string;
}

type Key =
  | "project" | "task" | "title" | "dev" | "qa" | "assignee" | "estimate" | "reference"
  | "status" | "timeTaken" | "reason" | "progress" | "notes" | "ignore";

const KEYS: Record<string, Key> = {
  project: "project",
  "project name": "project",
  brand: "project",
  task: "task",
  title: "title",
  dev: "dev",
  developer: "dev",
  qa: "qa",
  "assigned to": "assignee",
  "assigned by": "ignore",
  priority: "ignore",
  "marked by": "ignore",
  "estimated time": "estimate",
  estimate: "estimate",
  est: "estimate",
  "est time": "estimate",
  eta: "estimate",
  reference: "reference",
  references: "reference",
  ref: "reference",
  status: "status",
  "time taken": "timeTaken",
  "time spent": "timeTaken",
  reason: "reason",
  progress: "progress",
  notes: "notes",
  note: "notes",
};
const MULTILINE = new Set<Key>(["notes", "progress", "reason"]);
const URL_RE = /https?:\/\/[^\s<>|]+/;
const EMPTY_VALUES = new Set(["", "nil", "-", "na", "n/a", "none"]);

function cleanValue(raw: string, preferUrl: boolean): string {
  let v = raw
    .replace(/<(https?:\/\/[^|>\s]+)\|([^>]*)>/g, (_m, url: string, label: string) =>
      preferUrl || !label.trim() ? url : label,
    )
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(/<@[A-Z0-9]+\|([^>]+)>/g, "$1")
    .trim();
  if (/^_.*_$/.test(v) || /^\*.*\*$/.test(v)) v = v.slice(1, -1).trim();
  return v;
}

export function parseMessage(input: string): ParsedMessage {
  const out: ParsedMessage = { source: "none" };
  const acc: Partial<Record<Key, string>> = {};
  const urls: string[] = [];
  let current: Key | null = null;
  let tazko = false;
  let sawField = false;

  const rows = input.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/```/g, "\n").split("\n");

  for (const raw of rows) {
    const text = raw
      .replace(/^\s*(?:>\s?)+/, "") // Slack quotes
      .replace(/^\*([^*\n]{1,30}?):\*/, "$1:") // *Title:* → Title:
      .trim();

    if (!text) {
      if (current && acc[current]) acc[current] += "\n";
      continue;
    }

    if (!sawField && !out.type) {
      const head = text.match(/^(START|PAUSE|STOP)\b[\s:\-–—]*(.*)$/i);
      if (head) {
        const time = head[2] ? normalizeClock(head[2]) : null;
        if (!head[2] || time) {
          out.type = head[1].toUpperCase() as StatusType;
          if (time) out.time = time;
          continue;
        }
      }
    }

    if (/^(?::\w+:\s*)?(new\s+)?task\s+(assigned|completed)\b/i.test(text)) {
      tazko = true;
      continue;
    }

    const kv = text.match(/^([A-Za-z][A-Za-z ]{0,20}?)\s*:(?!\/\/)\s*(.*)$/);
    const key = kv ? KEYS[kv[1].trim().toLowerCase()] : undefined;
    if (kv && key) {
      sawField = true;
      if (key === "title" || key === "assignee") tazko = true;
      current = MULTILINE.has(key) ? key : null;
      if (key !== "ignore") acc[key] = kv[2];
      continue;
    }

    if (current) {
      acc[current] = acc[current] ? `${acc[current]}\n${text}` : text;
      continue;
    }

    const url = text.match(URL_RE);
    if (url) urls.push(url[0].replace(/[.,;:!?)_]+$/, ""));
  }

  const get = (k: Key, preferUrl = false) => {
    const v = acc[k];
    if (v == null) return undefined;
    const c = cleanValue(v, preferUrl);
    return EMPTY_VALUES.has(c.toLowerCase()) ? undefined : c;
  };

  out.project = get("project");
  out.task = get("task") ?? get("title");
  out.estimate = get("estimate");
  out.reference = get("reference", true) ?? (tazko ? urls[0] : undefined);
  out.status = get("status");
  out.timeTaken = get("timeTaken");
  out.reason = get("reason");
  out.progress = get("progress");
  out.notes = get("notes", true);

  const dev = get("dev");
  const qa = get("qa");
  const assignee = get("assignee")?.replace(/^@/, "");
  if (dev) [out.name, out.role] = [dev, "dev"];
  else if (qa) [out.name, out.role] = [qa, "qa"];
  else if (assignee) out.name = assignee;

  out.source = out.type ? "status" : tazko ? "tazko" : out.project || out.task ? "fields" : "none";
  return out;
}

/**
 * Should a paste inside a form field fill the whole form instead of landing in that field?
 * Yes for a multi-line Tazko card or START/PAUSE/STOP message. In single-line inputs, also for any
 * multi-line text carrying both Project and Task. Notes/Progress keep ordinary multi-line pastes
 * (build info, lists) unless it's clearly a whole status message.
 */
export function shouldFillFromPaste(text: string, field: "input" | "textarea"): boolean {
  if (!text.includes("\n")) return false;
  const p = parseMessage(text);
  if (p.source === "status" || p.source === "tazko") return !!(p.project || p.task);
  return field === "input" && !!p.project && !!p.task;
}

export const SOURCE_LABEL: Record<ParsedMessage["source"], string> = {
  status: "status update",
  tazko: "Tazko task card",
  fields: "text",
  none: "text",
};
