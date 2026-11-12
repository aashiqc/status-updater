import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/home";
import { CircleAlert, CircleCheck, ClipboardPaste, Eraser, Info, Keyboard, Link as LinkIcon, X } from "lucide-react";
import { DurationField } from "~/components/DurationField";
import { OutputPanel } from "~/components/OutputPanel";
import { PasteDialog } from "~/components/PasteDialog";
import { Sidebar, TYPE_DOT } from "~/components/Sidebar";
import { ThemeMenu } from "~/components/ThemeMenu";
import { Button, Chip, Field, Kbd, Segmented, TextArea, TextInput, cx, useDismiss } from "~/components/ui";
import { setPersonProperties, track } from "~/lib/analytics";
import { copyStatus, readClipboardText } from "~/lib/clipboard";
import { clockToDate, formatClock, formatDuration, formatShort, type TimeFormat } from "~/lib/duration";
import { usePersistentState } from "~/lib/storage";
import {
  CUSTOM,
  EMPTY_DRAFT,
  PAUSE_OPTIONS,
  SOURCE_LABEL,
  STATUS_TYPES,
  STOP_OPTIONS,
  buildLines,
  defaultStopStatus,
  durationMinutes,
  linesToText,
  parseMessage,
  shouldFillFromPaste,
  toSlackMessage,
  type Draft,
  type Role,
  type StatusType,
} from "~/lib/status";
import {
  addHistory,
  findTask,
  recentProjects,
  recordUpdate,
  trackedMinutes,
  type HistoryEntry,
  type TrackedTask,
} from "~/lib/tasks";

export function meta({}: Route.MetaArgs) {
  const description = "Write START, PAUSE and STOP updates for Tazko task threads in seconds.";
  return [
    { title: "Status Updater" },
    { name: "description", content: description },
    { property: "og:title", content: "Status Updater" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "/og-image.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: "/og-image.png" },
  ];
}

const TYPE_HINT: Record<StatusType, string> = {
  START: "Starting a task",
  PAUSE: "Stepping away for now",
  STOP: "Done or handed over",
};

const CHANGELOG = [
  {
    version: "v2.2",
    date: "Nov 12, 2026",
    changes: [
      "Themes: Lava (default), Glass, Vaporwave, Memphis, Pixel and Y2K, each with light and dark",
      "/ next theme, ⇧/ previous, ⌥M light/dark",
      "Subtle animated backgrounds per theme (frozen if your system asks for reduced motion)",
      "Paste a Slack message even while typing in a field; Clear moved to the top (⌥N)",
      "New icon and favicons",
      "Compact layout that fits the screen",
    ],
  },
  {
    version: "v2.0",
    date: "Nov 12, 2026",
    changes: [
      "New layout with light and dark mode",
      "Remembers your name, role, settings and the form, even after a reload",
      "Open tasks: copy a START, then PAUSE or STOP it later in one click",
      "History: every copied update is saved. Search it, copy it again, or edit and repost",
      "Paste a Tazko card or START message anywhere (⌘V) to fill the form",
      "One time box: type 2h 30m, 2.5 or 90m, pick a preset, or split across days",
      "Time taken is suggested from your START/PAUSE updates",
      "Empty fields copy as blank instead of <placeholder> text",
    ],
  },
  { version: "v1.4", date: "Feb 11, 2026", changes: ["Time Calculator for multi-day totals"] },
  { version: "v1.3", date: "Jan 21, 2026", changes: ["~2.5h / 2h 30min time format toggle"] },
];

interface Profile {
  name: string;
  role: Role;
}
interface Prefs {
  timeFormat: TimeFormat;
  includeTime: boolean;
}
type ToastTone = "success" | "warn" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; run: () => void };
}

const eqi = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const freshDraft = (role: Role): Draft => ({ ...EMPTY_DRAFT, stopStatus: defaultStopStatus(role) });

function pickOption(options: string[], value: string | undefined): [string, string] {
  if (!value) return [options[0], ""];
  const hit = options.find((o) => eqi(o, value));
  return hit ? [hit, ""] : [CUSTOM, value];
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function focusField(id: string) {
  window.setTimeout(() => document.getElementById(id)?.focus(), 50);
}

export default function Home() {
  const [type, setType] = usePersistentState<StatusType>("type", "START", (v) =>
    STATUS_TYPES.includes(v as StatusType),
  );
  const [draft, setDraft] = usePersistentState<Draft>("draft", EMPTY_DRAFT);
  const [profile, setProfile] = usePersistentState<Profile>("profile", { name: "", role: "dev" });
  const [prefs, setPrefs] = usePersistentState<Prefs>("prefs", { timeFormat: "decimal", includeTime: false });
  const [tasks, setTasks] = usePersistentState<TrackedTask[]>("tasks", []);
  const [history, setHistory] = usePersistentState<HistoryEntry[]>("history", []);

  const now = useNow(30_000);
  const [clockOverride, setClockOverride] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [isMac, setIsMac] = useState(true);
  const mod = isMac ? "⌘" : "Ctrl";
  const alt = isMac ? "⌥" : "Alt";

  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);

  const showToast = useCallback((message: string, tone: ToastTone = "info", action?: Toast["action"]) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 6000 : 3500);
  }, []);

  const update = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value })),
    [setDraft],
  );

  // ---- derived -------------------------------------------------------------
  const nowMs = now ? now.getTime() : 0;
  const clock = clockOverride ?? (now ? formatClock(now) : "");
  const headerTime = prefs.includeTime && clock.trim() ? clock.trim() : null;

  const lines = useMemo(
    () =>
      buildLines({ type, role: profile.role, name: profile.name, draft, timeFormat: prefs.timeFormat, headerTime }),
    [type, profile.role, profile.name, draft, prefs.timeFormat, headerTime],
  );
  const body = useMemo(() => linesToText(lines), [lines]);
  const missing = lines.filter((l) => l.missing).map((l) => l.label as string);

  const matched = findTask(tasks, draft.project, draft.task);
  const trackedMin = matched && nowMs ? trackedMinutes(matched, nowMs) : 0;
  const estimateMin = durationMinutes(draft.estimate, draft.estimateDays);
  const projects = useMemo(() => recentProjects(tasks, history), [tasks, history]);

  // Latest values for global listeners and async handlers.
  const state = { type, draft, profile, prefs, body, missing, estimateMin };
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---- actions -------------------------------------------------------------
  const changeType = useCallback(
    (next: StatusType) => {
      const s = stateRef.current;
      if (next === s.type) return;
      track("status_type_changed", { from_type: s.type, to_type: next });
      setType(next);
      setClockOverride(null);
    },
    [setType],
  );

  const changeRole = (role: Role) => {
    if (role === profile.role) return;
    track("role_switched", { from_role: profile.role, to_role: role });
    setProfile((p) => ({ ...p, role }));
    setDraft((d) =>
      STOP_OPTIONS[role].includes(d.stopStatus) || d.stopStatus === CUSTOM ? d : { ...d, stopStatus: defaultStopStatus(role) },
    );
  };

  const applyParsed = useCallback(
    (text: string, source: "button" | "shortcut" | "dialog" | "field"): boolean => {
      const p = parseMessage(text);
      const s = stateRef.current;
      if (!p.project && !p.task) {
        if (source !== "button") showToast("Couldn't find a Project or Task in that text.", "warn");
        return false;
      }

      const prev = { draft: s.draft, type: s.type };
      const sameTask =
        (!p.project || eqi(p.project, s.draft.project)) && (!p.task || eqi(p.task, s.draft.task));
      const base = sameTask ? s.draft : freshDraft(s.profile.role);
      setDraft({
        ...base,
        project: p.project ?? base.project,
        task: p.task ?? base.task,
        reference: p.reference ?? base.reference,
        ...(p.estimate ? { estimate: p.estimate, estimateDays: null } : {}),
      });
      if (p.name && !s.profile.name.trim()) setProfile({ name: p.name, role: p.role ?? s.profile.role });

      // A Tazko card means you're about to START; a pasted START means you're about to STOP.
      let nextType = s.type;
      if (p.source === "tazko") nextType = "START";
      else if (p.type === "START" && s.type === "START") nextType = "STOP";
      if (nextType !== s.type) setType(nextType);
      setClockOverride(null);

      if (p.type === "START" && p.task) {
        const at = Date.now();
        const started = p.time ? clockToDate(p.time, new Date(at)) : null;
        setTasks((ts) =>
          recordUpdate(ts, {
            type: "START",
            project: p.project ?? "",
            task: p.task!,
            reference: p.reference ?? "",
            estimate: p.estimate ?? "",
            at,
            startedAt: started && started.getTime() <= at ? started.getTime() : null,
          }),
        );
      }

      const filled = [p.project && "project", p.task && "task", p.estimate && "estimate", p.reference && "reference"]
        .filter(Boolean)
        .join(", ");
      showToast(
        `Filled ${filled} from ${SOURCE_LABEL[p.source]}${nextType !== s.type ? `. Switched to ${nextType}.` : "."}`,
        "success",
        {
          label: "Undo",
          run: () => {
            setDraft(prev.draft);
            setType(prev.type);
          },
        },
      );
      track("status_pasted", {
        source,
        kind: p.source,
        detected_type: p.type,
        detected_user_type: p.role,
        has_project: !!p.project,
        has_task: !!p.task,
        has_estimate: !!p.estimate,
        has_time: !!p.time,
        switched_to: nextType !== s.type ? nextType : undefined,
      });
      if (nextType === "STOP") focusField("time-taken");
      return true;
    },
    [setDraft, setProfile, setType, setTasks, showToast],
  );

  const copy = useCallback(async () => {
    const s = stateRef.current;
    const ok = await copyStatus(toSlackMessage(s.body), s.body);
    if (!ok) {
      showToast("Couldn't reach the clipboard. Select the preview text and copy it.", "warn");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);

    const at = Date.now();
    setHistory((h) =>
      addHistory(h, {
        type: s.type,
        role: s.profile.role,
        project: s.draft.project.trim(),
        task: s.draft.task.trim(),
        body: s.body,
        at,
      }),
    );
    setTasks((ts) =>
      recordUpdate(ts, {
        type: s.type,
        project: s.draft.project,
        task: s.draft.task,
        reference: s.draft.reference,
        estimate: s.estimateMin ? formatShort(s.estimateMin) : "",
        at,
      }),
    );

    showToast(
      s.missing.length
        ? `Copied, but ${s.missing.join(", ")} ${s.missing.length > 1 ? "are" : "is"} empty.`
        : `${s.type} update copied. Paste it in the task thread.`,
      s.missing.length ? "warn" : "success",
    );
    track("status_copied", {
      status_type: s.type,
      project: s.draft.project,
      task: s.draft.task,
      dev_name: s.profile.name,
      role: s.profile.role,
      time_format: s.prefs.timeFormat,
      show_time: s.prefs.includeTime,
      missing_count: s.missing.length,
      timestamp: new Date(at).toISOString(),
    });
    if (s.profile.name) {
      setPersonProperties({
        name: s.profile.name,
        role: s.profile.role,
        last_project: s.draft.project || undefined,
      });
    }
  }, [setHistory, setTasks, showToast]);

  const pasteFromClipboard = async () => {
    const text = await readClipboardText();
    if (text?.trim() && applyParsed(text, "button")) return;
    setPasteOpen(true);
  };

  const clearForm = () => {
    const prev = draft;
    setDraft(freshDraft(profile.role));
    setClockOverride(null);
    track("form_reset", { status_type: type, had_project: !!draft.project, had_task: !!draft.task });
    showToast("Form cleared.", "info", { label: "Undo", run: () => setDraft(prev) });
    focusField("project");
  };

  const pickTask = (t: TrackedTask, next: StatusType) => {
    const prev = { draft, type };
    const same = eqi(draft.project, t.project) && eqi(draft.task, t.task);
    if (!same) {
      setDraft({
        ...freshDraft(profile.role),
        project: t.project,
        task: t.task,
        reference: t.reference,
        estimate: t.estimate,
      });
    }
    setType(next);
    setClockOverride(null);
    track("task_picked", { to_type: next, task_state: t.state });
    if (!same) {
      showToast(`Loaded “${t.task}” for ${next}.`, "info", {
        label: "Undo",
        run: () => {
          setDraft(prev.draft);
          setType(prev.type);
        },
      });
    }
    focusField(next === "STOP" ? "time-taken" : next === "PAUSE" ? "reason" : "estimate");
  };

  const removeTask = (id: string) => {
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    track("task_removed");
    showToast("Removed from open tasks.", "info", { label: "Undo", run: () => setTasks(prev) });
  };

  const copyEntry = async (h: HistoryEntry) => {
    const ok = await copyStatus(toSlackMessage(h.body), h.body);
    showToast(ok ? `${h.type} update copied again.` : "Couldn't reach the clipboard.", ok ? "success" : "warn");
    track("history_copied", { status_type: h.type });
  };

  const editEntry = (h: HistoryEntry) => {
    const p = parseMessage(h.body);
    const prev = { draft, type };
    const [pauseStatus, pauseCustom] = pickOption(PAUSE_OPTIONS, p.status);
    const [stopStatus, stopCustom] = p.status
      ? pickOption(STOP_OPTIONS[h.role], p.status)
      : [defaultStopStatus(h.role), ""];
    setDraft({
      ...freshDraft(h.role),
      project: p.project ?? "",
      task: p.task ?? "",
      estimate: p.estimate ?? "",
      reference: p.reference ?? "",
      ...(h.type === "PAUSE" ? { pauseStatus, pauseCustom, reason: p.reason ?? "", progress: p.progress ?? "" } : {}),
      ...(h.type === "STOP" ? { stopStatus, stopCustom, timeTaken: p.timeTaken ?? "", notes: p.notes ?? "" } : {}),
    });
    setType(h.type);
    setClockOverride(null);
    track("history_edited", { status_type: h.type });
    showToast(`Loaded ${h.type} update into the form.`, "info", {
      label: "Undo",
      run: () => {
        setDraft(prev.draft);
        setType(prev.type);
      },
    });
  };

  const deleteEntry = (id: string) => {
    const prev = history;
    setHistory((h) => h.filter((e) => e.id !== id));
    showToast("Deleted from history.", "info", { label: "Undo", run: () => setHistory(prev) });
  };

  const clearHistory = () => {
    const prev = history;
    setHistory([]);
    track("history_cleared", { count: prev.length });
    showToast(`Cleared ${prev.length} updates from history.`, "info", { label: "Undo", run: () => setHistory(prev) });
  };

  // ---- global shortcuts ----------------------------------------------------
  const copyRef = useRef(copy);
  copyRef.current = copy;
  const applyRef = useRef(applyParsed);
  applyRef.current = applyParsed;
  const changeTypeRef = useRef(changeType);
  changeTypeRef.current = changeType;
  const clearRef = useRef(clearForm);
  clearRef.current = clearForm;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void copyRef.current();
      } else if (e.altKey && !e.metaKey && !e.ctrlKey && /^Digit[123]$/.test(e.code)) {
        e.preventDefault();
        changeTypeRef.current(STATUS_TYPES[Number(e.code.slice(5)) - 1]);
      } else if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.code === "KeyN") {
        e.preventDefault();
        clearRef.current();
      }
    };
    // ⌘V of a Slack message fills the form from anywhere, even while typing in a field
    // (capture phase, so it runs before the field receives the text). Ordinary pastes are left alone.
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("dialog")) return; // the paste dialog handles its own text
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim()) return;
      const field = target?.closest?.("input, textarea, select, [contenteditable]");
      if (field) {
        if (!shouldFillFromPaste(text, field.tagName === "TEXTAREA" ? "textarea" : "input")) return;
        e.preventDefault();
        applyRef.current(text, "field");
        return;
      }
      e.preventDefault();
      applyRef.current(text, "shortcut");
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("paste", onPaste, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("paste", onPaste, true);
    };
  }, []);

  // ---- render --------------------------------------------------------------
  const isEmpty = !draft.project.trim() && !draft.task.trim();
  const startOfToday = now ? new Date(now).setHours(0, 0, 0, 0) : 0;
  const sentToday = startOfToday ? history.filter((h) => h.at >= startOfToday).length : 0;
  const estimateForStop = estimateMin ?? (matched?.estimate ? durationMinutes(matched.estimate, null) : null);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="ui-ambient" aria-hidden />
      <header className="mb-4 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="flex items-center gap-2 leading-none">
          <span className="ui-deco text-[15px]" aria-hidden />
          <span className="ui-wordmark text-[20px]">Status Updater</span>
        </h1>
        <span className="ui-tagline hidden text-xs md:inline">for Tazko task threads</span>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={pasteFromClipboard} title={`Fill from a Tazko card or a status message (${mod} V)`}>
            <ClipboardPaste className="size-3.5" />
            <span className="hidden sm:inline">Paste from Slack</span>
            <span className="sm:hidden">Paste</span>
          </Button>
          <ThemeMenu />
        </div>
      </header>

      {/* Desktop: three columns in a 3 : 6 : 4 ratio. Panels take their content height (the row matches the
          taller of form/preview), are capped to the screen and scroll inside, so the page never scrolls. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,3fr)_minmax(0,6fr)_minmax(300px,4fr)]">
        <div className="relative order-3 flex max-h-[480px] min-h-0 flex-col lg:order-none lg:max-h-none lg:min-h-[320px] lg:[&>aside]:absolute lg:[&>aside]:inset-0">
          <Sidebar
            tasks={tasks}
            history={history}
            now={nowMs}
            format={prefs.timeFormat}
            onPickTask={pickTask}
            onRemoveTask={removeTask}
            onCopyEntry={copyEntry}
            onEditEntry={editEntry}
            onDeleteEntry={deleteEntry}
            onClearHistory={clearHistory}
          />
        </div>

        <main className="flex min-w-0 flex-col lg:max-h-[calc(100dvh-11.5rem)]">
          <section aria-label="Update details" data-panel="form" className="ui-panel flex min-h-0 flex-1 flex-col">
            <div className="ui-titlebar flex shrink-0 items-center justify-between gap-3 px-2.5 py-1.5">
              <div role="radiogroup" aria-label="Update type" className="flex gap-1">
                {STATUS_TYPES.map((t, i) => {
                  const active = t === type;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={`${TYPE_HINT[t]} (${alt}${i + 1})`}
                      onClick={() => changeType(t)}
                      className={cx(
                        "ui-tab inline-flex h-8 items-center gap-2 px-3.5 text-[12.5px] font-bold",
                        active && "ui-selected",
                      )}
                    >
                      <span aria-hidden className={cx("size-2.5", TYPE_DOT[t], !active && "opacity-45")} />
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={clearForm} title="Clear the form to start a new update (⌥N / Alt+N)">
                  <Eraser className="size-3.5" /> Clear
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <Field label="Project" htmlFor="project">
                    <TextInput
                      id="project"
                      list="project-options"
                      value={draft.project}
                      placeholder="Urban monkey"
                      onChange={(e) => update("project", e.target.value)}
                    />
                    <datalist id="project-options">
                      {projects.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Task" htmlFor="task">
                    <TextInput
                      id="task"
                      value={draft.task}
                      placeholder={profile.role === "qa" ? "Golden flow QA" : "PDP – size guide popup"}
                      onChange={(e) => update("task", e.target.value)}
                    />
                  </Field>
                </div>
                {isEmpty && (
                  <p className="mt-1.5 text-[11.5px] text-subtle">
                    Tip: copy a Tazko card or a START message in Slack, then press <Kbd>{mod} V</Kbd> anywhere on this page, even inside a field.
                  </p>
                )}
              </div>

              {type === "START" && (
                <>
                  <DurationField
                    id="estimate"
                    label="Estimated time"
                    value={draft.estimate}
                    days={draft.estimateDays}
                    format={prefs.timeFormat}
                    onChange={(v) => update("estimate", v)}
                    onDaysChange={(d) => update("estimateDays", d)}
                  />
                  <Field label="Reference" htmlFor="reference" optional aside={<span className="text-[11.5px] text-subtle">posts “nil” if empty</span>}>
                    <div className="relative">
                      <LinkIcon className="pointer-events-none absolute left-2.5 top-[11px] size-3.5 text-subtle" />
                      <TextArea
                        id="reference"
                        rows={1}
                        value={draft.reference}
                        placeholder="Figma, GitHub issue or sheet link (one per line)"
                        onChange={(e) => update("reference", e.target.value)}
                        className="min-h-9 py-[7px] pl-8 leading-5 [overflow-wrap:anywhere]"
                      />
                    </div>
                  </Field>
                </>
              )}

              {type === "PAUSE" && (
                <>
                  <div className="grid items-start gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
                    <Field label="Status" labelId="pause-status-label">
                      <StatusChoice
                        labelledBy="pause-status-label"
                        options={PAUSE_OPTIONS}
                        value={draft.pauseStatus}
                        custom={draft.pauseCustom}
                        onChange={(v) => update("pauseStatus", v)}
                        onCustom={(v) => update("pauseCustom", v)}
                      />
                    </Field>
                    <Field label="Reason" htmlFor="reason">
                      <TextInput
                        id="reason"
                        value={draft.reason}
                        placeholder="End of day, waiting on brand…"
                        onChange={(e) => update("reason", e.target.value)}
                        className="h-8"
                      />
                    </Field>
                  </div>
                  <Field label="Progress so far" htmlFor="progress">
                    <TextArea
                      id="progress"
                      rows={3}
                      value={draft.progress}
                      placeholder="Popup UI done, API wiring pending…"
                      onChange={(e) => update("progress", e.target.value)}
                    />
                  </Field>
                </>
              )}

              {type === "STOP" && (
                <>
                  <Field label="Status" labelId="stop-status-label">
                    <StatusChoice
                      labelledBy="stop-status-label"
                      options={STOP_OPTIONS[profile.role]}
                      value={draft.stopStatus}
                      custom={draft.stopCustom}
                      onChange={(v) => update("stopStatus", v)}
                      onCustom={(v) => update("stopCustom", v)}
                    />
                  </Field>
                  <DurationField
                    id="time-taken"
                    label="Time taken"
                    value={draft.timeTaken}
                    days={draft.takenDays}
                    format={prefs.timeFormat}
                    onChange={(v) => update("timeTaken", v)}
                    onDaysChange={(d) => update("takenDays", d)}
                    suggestion={trackedMin > 0 ? { label: "Tracked", minutes: trackedMin } : null}
                    hint={estimateForStop ? `Estimate was ${formatDuration(estimateForStop, prefs.timeFormat)}` : undefined}
                  />
                  <Field label="Notes" htmlFor="notes" optional>
                    <TextArea
                      id="notes"
                      rows={4}
                      value={draft.notes}
                      placeholder={
                        profile.role === "qa"
                          ? "QA report link, passed / failed summary, blockers…"
                          : "Build number, PR links, what changed…"
                      }
                      onChange={(e) => update("notes", e.target.value)}
                    />
                  </Field>
                </>
              )}
            </div>

            <div className="ui-panel-footer flex shrink-0 flex-wrap items-center gap-2.5 px-4 py-2.5">
              <label htmlFor="name" className="ui-label text-xs">
                Posting as
              </label>
              <TextInput
                id="name"
                value={profile.name}
                placeholder="Your name"
                aria-invalid={!profile.name.trim() && !isEmpty}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="h-8 w-40"
              />
              <Segmented
                label="Role"
                value={profile.role}
                onChange={changeRole}
                options={[
                  { value: "dev", label: "Dev" },
                  { value: "qa", label: "QA" },
                ]}
              />
            </div>
          </section>
        </main>

        <div className="flex min-w-0 flex-col lg:max-h-[calc(100dvh-11.5rem)]">
          <OutputPanel
            className="lg:flex-1"
            type={type}
            lines={lines}
            missing={missing}
            copied={copied}
            onCopy={copy}
            isMac={isMac}
            timeFormat={prefs.timeFormat}
            onTimeFormat={(f) => setPrefs((p) => ({ ...p, timeFormat: f }))}
            includeTime={prefs.includeTime}
            onIncludeTime={(v) => setPrefs((p) => ({ ...p, includeTime: v }))}
            clock={clock}
            clockEdited={clockOverride !== null}
            onClockChange={setClockOverride}
            onClockReset={() => setClockOverride(null)}
          />
        </div>
      </div>

      <section aria-labelledby="shortcuts-title" className="ui-panel mt-4 hidden items-center gap-x-6 gap-y-2 px-4 py-2.5 lg:flex lg:flex-wrap">
        <h2 id="shortcuts-title" className="ui-heading flex items-center gap-1.5 text-xs text-muted">
          <Keyboard className="size-3.5" aria-hidden /> Shortcuts
        </h2>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          {(
            [
              [`${mod} ↵`, "Copy update"],
              [`${alt} 1–3`, "START / PAUSE / STOP"],
              [`${mod} V`, "Fill from Slack"],
              [`${alt} N`, "Clear form"],
              ["/", "Next theme"],
              ["⇧ /", "Previous theme"],
              [`${alt} M`, "Light / dark"],
            ] as const
          ).map(([keys, label]) => (
            <li key={label} className="inline-flex items-center gap-2">
              <Kbd className="text-fg">{keys}</Kbd>
              {label}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 text-[11.5px] text-subtle">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            sent today <span className="ui-counter tabular-nums">{String(sentToday).padStart(3, "0")}</span>
          </span>
          <span>History stays on this device</span>
        </div>
        <WhatsNew />
      </footer>

      <PasteDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onApply={(text) => {
          if (applyParsed(text, "dialog")) setPasteOpen(false);
        }}
      />

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="ui-toast pointer-events-auto flex max-w-xl animate-[toast-in_160ms_ease-out] items-center gap-2.5 py-2 pl-4 pr-1.5 text-[13px] font-semibold"
          >
            {toast.tone === "success" ? (
              <CircleCheck className="size-4 shrink-0" />
            ) : toast.tone === "warn" ? (
              <CircleAlert className="size-4 shrink-0" />
            ) : (
              <Info className="size-4 shrink-0 opacity-60" />
            )}
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.run();
                  setToast(null);
                }}
                className="rounded px-2 py-1 font-semibold underline underline-offset-2"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToast(null)}
              className="grid size-6 place-items-center rounded-full opacity-70 hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChoice({
  labelledBy,
  options,
  value,
  custom,
  onChange,
  onCustom,
}: {
  labelledBy: string;
  options: string[];
  value: string;
  custom: string;
  onChange: (v: string) => void;
  onCustom: (v: string) => void;
}) {
  return (
    <div>
      <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1">
        {[...options, CUSTOM].map((o) => (
          <Chip key={o} role="radio" aria-checked={value === o} active={value === o} onClick={() => onChange(o)}>
            {o === CUSTOM ? "Other…" : o}
          </Chip>
        ))}
      </div>
      {value === CUSTOM && (
        <TextInput
          autoFocus
          aria-label="Custom status"
          value={custom}
          placeholder="Type the status"
          onChange={(e) => onCustom(e.target.value)}
          className="mt-1.5 h-8 w-full max-w-xs"
        />
      )}
    </div>
  );
}

/** "What's new" popover in the footer: toggles on click, closes on outside click or Escape. */
function WhatsNew() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="select-none hover:text-fg"
      >
        What's new · {CHANGELOG[0].version}
      </button>
      {open && (
        <div role="dialog" aria-label="What's new" className="ui-panel ui-popover absolute bottom-full right-0 z-20 mb-2 max-h-[min(26rem,calc(100dvh-12rem))] w-80 space-y-2.5 overflow-y-auto p-3.5">
          {CHANGELOG.map((c) => (
            <div key={c.version}>
              <p className="text-xs font-semibold text-fg">
                {c.version} <span className="font-normal text-subtle">· {c.date}</span>
              </p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-muted">
                {c.changes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
