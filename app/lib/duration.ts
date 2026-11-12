export type TimeFormat = "decimal" | "hm";

const TOKEN = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)?/g;

/**
 * Parse a free-text duration into minutes.
 * Accepts: "2" / "2.5" (hours), "90m", "2h", "2h 30m", "2h30", "1:30", "~ 1.5 h", "5hr", "30 mins".
 * Returns null when the text can't be read as a duration.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/^~\s*/, "").replace(/,/g, ".");
  if (!s) return null;

  const clock = s.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);

  const parts = [...s.matchAll(TOKEN)];
  const leftover = s.replace(TOKEN, "").replace(/\band\b|[\s+]/g, "");
  if (!parts.length || leftover) return null;

  let total = 0;
  let prev: "h" | "m" | null = null;
  for (const p of parts) {
    const n = parseFloat(p[1]);
    // A bare number right after hours is minutes ("2h30"); otherwise it's hours.
    const unit: "h" | "m" = p[2] ? (p[2][0] as "h" | "m") : prev === "h" ? "m" : "h";
    total += unit === "h" ? n * 60 : n;
    prev = unit;
  }
  return Math.round(total);
}

/** Format minutes the way the team writes it in Slack: "~2.5h" or "~2h 30min". */
export function formatDuration(minutes: number, format: TimeFormat, prefix = "~"): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (format === "hm") {
    if (h > 0 && m > 0) return `${prefix}${h}h ${m}min`;
    if (h > 0) return `${prefix}${h}h`;
    return `${prefix}${m}min`;
  }
  const rounded = Math.round((minutes / 60) * 10) / 10;
  return `${prefix}${rounded}h`;
}

/** Compact value to put back into an input: "2h 30m", "45m", "3h". */
export function formatShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "3:42PM" — matches the existing header format. */
export function formatClock(date: Date): string {
  const h = date.getHours();
  return `${h % 12 || 12}:${pad(date.getMinutes())}${h >= 12 ? "PM" : "AM"}`;
}

const CLOCK_RE = /^(\d{1,2})(?:[:.](\d{2}))?\s*(?:([ap])\.?\s*m\.?)?$/i;

/** Normalise "5.20 pm", "17:20", "3:11PM" → "5:20PM". Returns null if it isn't a time. */
export function normalizeClock(input: string): string | null {
  const m = input.trim().match(CLOCK_RE);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toUpperCase();
  if ((!m[2] && !ap) || min > 59) return null;
  if (ap) return h >= 1 && h <= 12 ? `${h}:${pad(min)}${ap}M` : null;
  if (h > 23) return null;
  return `${h % 12 || 12}:${pad(min)}${h >= 12 ? "PM" : "AM"}`;
}

/** Resolve a normalised clock ("3:11PM") to a Date on the same day as `ref`. */
export function clockToDate(clock: string, ref: Date): Date | null {
  const m = clock.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!m) return null;
  const d = new Date(ref);
  d.setHours((Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0), Number(m[2]), 0, 0);
  return d;
}
