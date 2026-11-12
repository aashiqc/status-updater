import { Check, Copy, RotateCcw } from "lucide-react";
import type { TimeFormat } from "~/lib/duration";
import type { OutputLine, StatusType } from "~/lib/status";
import { Button, Kbd, Segmented, Switch, cx } from "./ui";
import { TYPE_TEXT } from "./Sidebar";

export function OutputPanel({
  type,
  lines,
  missing,
  copied,
  onCopy,
  isMac,
  timeFormat,
  onTimeFormat,
  includeTime,
  onIncludeTime,
  clock,
  clockEdited,
  onClockChange,
  onClockReset,
  className,
}: {
  className?: string;
  type: StatusType;
  lines: OutputLine[];
  missing: string[];
  copied: boolean;
  onCopy: () => void;
  isMac: boolean;
  timeFormat: TimeFormat;
  onTimeFormat: (f: TimeFormat) => void;
  includeTime: boolean;
  onIncludeTime: (v: boolean) => void;
  clock: string;
  clockEdited: boolean;
  onClockChange: (v: string) => void;
  onClockReset: () => void;
}) {
  return (
    <section aria-labelledby="preview-title" data-panel="preview" className={cx("ui-panel flex min-h-0 flex-col p-3.5", className)}>
      <div className="ui-titlebar -mx-3.5 -mt-3.5 mb-3 flex shrink-0 items-center gap-2 px-3.5 py-2">
        <span className="ui-window-dots gap-1" aria-hidden>
          <span className="ui-dot size-2.5 text-stop" />
          <span className="ui-dot size-2.5 text-pause" />
          <span className="ui-dot size-2.5 text-start" />
        </span>
        <h2 id="preview-title" className="ui-heading text-xs text-muted">
          preview.txt
        </h2>
        <span className="ui-deco ml-auto text-xs" aria-hidden />
      </div>

      <div
        aria-label="Message preview"
        className="ui-code min-h-44 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-3.5 py-3 text-[12px] leading-[1.75]"
      >
        {lines.map((l, i) =>
          l.label === null ? (
            <div key={i} className={cx("font-semibold", TYPE_TEXT[type])}>
              {l.value}
            </div>
          ) : (
            <div key={i}>
              <span className="text-subtle">{l.label}:</span>{" "}
              {l.value ? <span>{l.value}</span> : l.missing ? <span className="italic text-warn/80">{l.placeholder}</span> : null}
            </div>
          ),
        )}
      </div>

      <p className={cx("mt-2 min-h-4 shrink-0 text-[11.5px]", missing.length ? "text-warn" : "text-subtle")} aria-live="polite">
        {missing.length ? `Empty: ${missing.join(", ")}` : "Ready to paste in the task thread"}
      </p>

      <Button variant="primary" size="lg" onClick={onCopy} className={cx("mt-2 w-full shrink-0", copied && "ui-copied")}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : `Copy ${type}`}
        {!copied && <Kbd className="ml-1">{isMac ? "⌘" : "Ctrl"} ↵</Kbd>}
      </Button>

      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <div className="flex items-center gap-2">
          <Switch id="include-time" checked={includeTime} onChange={onIncludeTime} label="Add time to first line" />
          <label htmlFor="include-time">Time</label>
          {includeTime && (
            <span className="ui-input flex items-center">
              <input
                value={clock}
                onChange={(e) => onClockChange(e.target.value)}
                aria-label="Time in first line"
                className="h-6 w-[4.25rem] bg-transparent px-1.5 text-center text-xs tabular-nums text-fg focus:outline-none"
              />
              {clockEdited && (
                <button type="button" onClick={onClockReset} title="Use current time" aria-label="Use current time" className="grid size-6 place-items-center text-subtle hover:text-fg">
                  <RotateCcw className="size-3" />
                </button>
              )}
            </span>
          )}
        </div>
        <Segmented
          label="Hours format"
          value={timeFormat}
          onChange={onTimeFormat}
          options={[
            { value: "decimal", label: "~2.5h" },
            { value: "hm", label: "2h 30min" },
          ]}
        />
      </div>
    </section>
  );
}
