import { useMemo, useState } from "react";
import { Copy, Pencil, Search, Trash2, X } from "lucide-react";
import { formatClock, formatDuration, type TimeFormat } from "~/lib/duration";
import type { StatusType } from "~/lib/status";
import { trackedMinutes, type HistoryEntry, type TrackedTask } from "~/lib/tasks";
import { cx } from "./ui";

export const TYPE_TEXT: Record<StatusType, string> = {
  START: "text-start",
  PAUSE: "text-pause",
  STOP: "text-stop",
};
/** Status dot per type (themes style ui-dot; colour comes from `color`). */
export const TYPE_DOT: Record<StatusType, string> = {
  START: "ui-dot text-start",
  PAUSE: "ui-dot text-pause",
  STOP: "ui-dot text-stop",
};

const DAY = 24 * 60 * 60 * 1000;
function dayLabel(at: number, now: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (at >= start.getTime()) return "Today";
  if (at >= start.getTime() - DAY) return "Yesterday";
  return new Date(at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function Sidebar({
  tasks,
  history,
  now,
  format,
  onPickTask,
  onRemoveTask,
  onCopyEntry,
  onEditEntry,
  onDeleteEntry,
  onClearHistory,
}: {
  tasks: TrackedTask[];
  history: HistoryEntry[];
  now: number;
  format: TimeFormat;
  onPickTask: (t: TrackedTask, type: StatusType) => void;
  onRemoveTask: (id: string) => void;
  onCopyEntry: (e: HistoryEntry) => void;
  onEditEntry: (e: HistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearHistory: () => void;
}) {
  const open = tasks.filter((t) => t.state !== "done");
  const [tab, setTab] = useState<"tasks" | "history" | null>(null);
  const active = tab ?? (open.length ? "tasks" : "history");

  return (
    <aside aria-label="Open tasks and history" data-panel="sidebar" className="ui-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div role="tablist" aria-label="Sidebar" className="ui-titlebar flex shrink-0 gap-1 px-2 py-1.5">
        {(
          [
            ["tasks", "Open", open.length],
            ["history", "History", history.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={active === key}
            onClick={() => setTab(key)}
            className={cx(
              "ui-tab inline-flex h-7 items-center gap-1.5 px-3 text-[13px] font-bold",
              active === key && "ui-selected",
            )}
          >
            {label}
            {count > 0 && <span className="text-[11px] tabular-nums opacity-70">{count}</span>}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {active === "tasks" ? (
          <TaskList tasks={open} now={now} format={format} onPick={onPickTask} onRemove={onRemoveTask} />
        ) : (
          <HistoryList
            history={history}
            now={now}
            onCopy={onCopyEntry}
            onEdit={onEditEntry}
            onDelete={onDeleteEntry}
            onClear={onClearHistory}
          />
        )}
      </div>
    </aside>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="px-5 py-8 text-center text-xs leading-relaxed text-subtle">{children}</p>;
}

function TaskList({
  tasks,
  now,
  format,
  onPick,
  onRemove,
}: {
  tasks: TrackedTask[];
  now: number;
  format: TimeFormat;
  onPick: (t: TrackedTask, type: StatusType) => void;
  onRemove: (id: string) => void;
}) {
  if (!tasks.length) return <Empty>Tasks you START show up here, ready to PAUSE or STOP in one click.</Empty>;

  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const mins = trackedMinutes(t, now);
        const when =
          t.state === "paused"
            ? "Paused"
            : t.startedAt
              ? `${dayLabel(t.startedAt, now) === "Today" ? "" : dayLabel(t.startedAt, now) + " "}${formatClock(new Date(t.startedAt))}`
              : "Started";
        return (
          <li key={t.id} className="group px-3.5 py-2.5">
            <div className="flex items-start gap-2">
              <span
                aria-hidden
                className={cx("ui-dot mt-[5px] size-2.5 shrink-0", t.state === "active" ? "text-start" : "text-pause")}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium" title={t.task}>
                  {t.task}
                </p>
                <p className="truncate text-[11.5px] text-subtle">
                  {[t.project, when, mins > 0 && formatDuration(mins, format), t.estimate && `est ${t.estimate}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-1.5 flex gap-3 text-xs font-bold">
                  {t.state === "active" ? (
                    <button type="button" onClick={() => onPick(t, "PAUSE")} className="text-pause hover:underline">
                      Pause
                    </button>
                  ) : (
                    <button type="button" onClick={() => onPick(t, "START")} className="text-start hover:underline">
                      Resume
                    </button>
                  )}
                  <button type="button" onClick={() => onPick(t, "STOP")} className="text-stop hover:underline">
                    Stop
                  </button>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Forget ${t.task}`}
                title="Remove"
                onClick={() => onRemove(t.id)}
                className="grid size-5 shrink-0 place-items-center rounded text-subtle opacity-0 hover:text-fg focus:opacity-100 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HistoryList({
  history,
  now,
  onCopy,
  onEdit,
  onDelete,
  onClear,
}: {
  history: HistoryEntry[];
  now: number;
  onCopy: (e: HistoryEntry) => void;
  onEdit: (e: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? history.filter((h) => `${h.type} ${h.body}`.toLowerCase().includes(q)) : history;
    const out: { label: string; items: HistoryEntry[] }[] = [];
    for (const h of list) {
      const label = dayLabel(h.at, now);
      const g = out[out.length - 1];
      if (g?.label === label) g.items.push(h);
      else out.push({ label, items: [h] });
    }
    return out;
  }, [history, query, now]);

  if (!history.length) return <Empty>Every update you copy is saved here, so you can copy it again or edit and repost.</Empty>;

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-line bg-surface-2 px-2 py-1.5 backdrop-blur-md">
        <Search className="ml-1 size-3.5 shrink-0 text-subtle" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search history"
          className="h-7 min-w-0 flex-1 bg-transparent px-1.5 text-[13px] placeholder:text-subtle focus:outline-none"
        />
        <button
          type="button"
          onClick={onClear}
          title="Clear history"
          aria-label="Clear history"
          className="grid size-6 place-items-center rounded text-subtle hover:text-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {groups.length === 0 && <Empty>No matches.</Empty>}

      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="ui-heading flex items-center gap-1.5 px-3.5 pb-1 pt-3 text-[10px] text-subtle">
            <span className="ui-deco text-[9px]" aria-hidden />
            {g.label}
          </h3>
          <ul>
            {g.items.map((h) => {
              const isOpen = expanded === h.id;
              return (
                <li key={h.id} className={cx("group mx-1.5 rounded-[var(--r-input)]", isOpen ? "bg-surface-3/70" : "hover:bg-surface-3/50")}>
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : h.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span className={cx("ui-heading text-[9.5px]", TYPE_TEXT[h.type])}>{h.type}</span>
                        <span className="truncate text-[13px]" title={h.task}>
                          {h.task || "Untitled"}
                        </span>
                      </span>
                      <span className="block truncate text-[11.5px] text-subtle">
                        {h.project} · {formatClock(new Date(h.at))}
                      </span>
                    </button>
                    <div className="flex shrink-0 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                      <IconAction label="Copy again" icon={Copy} onClick={() => onCopy(h)} />
                      <IconAction label="Edit in form" icon={Pencil} onClick={() => onEdit(h)} />
                      <IconAction label="Delete" icon={Trash2} onClick={() => onDelete(h.id)} danger />
                    </div>
                  </div>
                  {isOpen && (
                    <pre className="ui-code mx-2 mb-2 max-h-56 overflow-auto whitespace-pre-wrap break-words p-2 text-[10.5px] leading-[1.6]">
                      {h.body}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  danger,
}: {
  label: string;
  icon: typeof Copy;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(
        "grid size-6 place-items-center rounded-full text-subtle transition-colors hover:bg-surface-3",
        danger ? "hover:text-danger" : "hover:text-fg",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
