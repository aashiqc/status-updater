import { Plus, Sparkles, X } from "lucide-react";
import { formatDuration, formatShort, parseDuration, type TimeFormat } from "~/lib/duration";
import { durationMinutes } from "~/lib/status";
import { Chip, Field, TextInput, cx } from "./ui";

const PRESETS = [30, 60, 120, 180, 240, 360];

export function DurationField({
  id,
  label,
  value,
  days,
  format,
  onChange,
  onDaysChange,
  suggestion,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  days: string[] | null;
  format: TimeFormat;
  onChange: (v: string) => void;
  onDaysChange: (d: string[] | null) => void;
  suggestion?: { label: string; minutes: number } | null;
  hint?: string;
}) {
  const minutes = durationMinutes(value, days);
  const invalid = !days && value.trim() !== "" && minutes === null;

  const toggleDays = () => {
    if (days) {
      onChange(minutes ? formatShort(minutes) : "");
      onDaysChange(null);
    } else {
      onDaysChange([value, ""]);
    }
  };

  return (
    <Field
      label={label}
      htmlFor={days ? `${id}-day-0` : id}
      aside={
        <button type="button" onClick={toggleDays} className="text-[11.5px] text-subtle underline-offset-2 hover:text-fg hover:underline">
          {days ? "Single entry" : "Split across days"}
        </button>
      }
    >
      {days ? (
        <div className="space-y-1.5 rounded-[var(--r-input)] border border-line bg-surface-2 p-2">
          {days.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <label htmlFor={`${id}-day-${i}`} className="w-10 shrink-0 text-xs text-subtle">
                Day {i + 1}
              </label>
              <TextInput
                id={`${id}-day-${i}`}
                value={d}
                placeholder="3h"
                aria-invalid={d.trim() !== "" && parseDuration(d) === null}
                onChange={(e) => onDaysChange(days.map((x, j) => (j === i ? e.target.value : x)))}
                className="h-8 w-40"
              />
              <button
                type="button"
                aria-label={`Remove day ${i + 1}`}
                disabled={days.length <= 1}
                onClick={() => onDaysChange(days.filter((_, j) => j !== i))}
                className="grid size-6 place-items-center rounded text-subtle hover:text-danger disabled:invisible"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={() => onDaysChange([...days, ""])}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
            >
              <Plus className="size-3.5" /> Add day
            </button>
            <span className="text-xs font-semibold tabular-nums">
              Total {minutes ? formatDuration(minutes, format, "") : "—"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative w-40">
            <TextInput
              id={id}
              value={value}
              placeholder="2h 30m"
              aria-invalid={invalid}
              aria-describedby={`${id}-hint`}
              onChange={(e) => onChange(e.target.value)}
              className="pr-14"
            />
            <span
              className={cx(
                "pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11.5px] tabular-nums",
                invalid ? "text-warn" : "text-subtle",
              )}
            >
              {invalid ? "?" : minutes ? formatDuration(minutes, format) : ""}
            </span>
          </div>
          {suggestion && suggestion.minutes > 0 && (
            <Chip
              onClick={() => onChange(formatShort(suggestion.minutes))}
              active={minutes === suggestion.minutes}
              title="Worked out from the START/PAUSE updates you copied"
              className={minutes === suggestion.minutes ? "" : "border-accent/40 text-accent-text"}
            >
              <Sparkles className="size-3" />
              {suggestion.label} {formatDuration(suggestion.minutes, format, "")}
            </Chip>
          )}
          {PRESETS.map((p) => (
            <Chip key={p} active={minutes === p} onClick={() => onChange(formatShort(p))} className="px-2">
              {formatShort(p)}
            </Chip>
          ))}
        </div>
      )}
      {(invalid || hint) && (
        <p id={`${id}-hint`} className={cx("mt-1 text-[11.5px]", invalid ? "text-warn" : "text-subtle")}>
          {invalid ? "Try 2h 30m, 2.5 or 90m" : hint}
        </p>
      )}
    </Field>
  );
}
