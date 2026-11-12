import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Monitor, Moon, Palette, Sun } from "lucide-react";
import { usePersistentState } from "~/lib/storage";
import { track } from "~/lib/analytics";
import { DEFAULT_THEME, MODE_KEY, STYLE_KEY, THEMES, isThemeId, type ModePref, type ThemeId } from "~/themes/registry";
import { Button, Segmented, cx, useDismiss } from "./ui";

const isMode = (v: unknown): v is ModePref => v === "system" || v === "light" || v === "dark";

/** Theme picker (style + light/dark). Applies <html data-style/data-mode> and swaps the theme's font sheet. */
export function ThemeMenu() {
  const [style, setStyle, styleReady] = usePersistentState<ThemeId>(STYLE_KEY, DEFAULT_THEME, isThemeId);
  const [mode, setMode, modeReady] = usePersistentState<ModePref>(MODE_KEY, "system", isMode);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef(style);
  styleRef.current = style;

  const announce = (text: string) => {
    window.clearTimeout(flashTimer.current);
    setFlash(text);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1400);
  };

  // Shortcuts: "/" next theme and "?" (⇧/) previous, when not typing in a field; ⌥T / ⇧⌥T do the same
  // from anywhere; ⌥M light/dark. (e.code for ⌥ combos, so the Mac ⌥ character map doesn't matter.)
  useEffect(() => {
    const cycle = (step: number) => {
      const i = THEMES.findIndex((t) => t.id === styleRef.current);
      const next = THEMES[(i + step + THEMES.length) % THEMES.length];
      setStyle(next.id);
      announce(`Theme: ${next.label}`);
      track("theme_changed", { theme: next.id, source: "shortcut" });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || document.querySelector("dialog[open]")) return;
      const typing = !!(e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]");
      if (!e.altKey && !typing && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        cycle(e.key === "?" ? -1 : 1);
        return;
      }
      if (!e.altKey) return;
      if (e.code === "KeyT") {
        e.preventDefault();
        cycle(e.shiftKey ? -1 : 1);
      } else if (e.code === "KeyM" && !e.shiftKey) {
        e.preventDefault();
        const next: ModePref = document.documentElement.getAttribute("data-mode") === "dark" ? "light" : "dark";
        setMode(next);
        announce(next === "dark" ? "Dark mode" : "Light mode");
        track("mode_changed", { mode: next, source: "shortcut" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setStyle, setMode]);

  // Apply the style and its fonts (the boot script already did this before paint for the saved value).
  useEffect(() => {
    if (!styleReady) return;
    const meta = THEMES.find((t) => t.id === style) ?? THEMES[0];
    document.documentElement.setAttribute("data-style", meta.id);
    let link = document.getElementById("theme-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "theme-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== meta.fonts) link.setAttribute("href", meta.fonts);
  }, [style, styleReady]);

  // Resolve light/dark, following the OS live when "System" is chosen.
  useEffect(() => {
    if (!modeReady) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.setAttribute("data-mode", mode === "system" ? (mq.matches ? "dark" : "light") : mode);
    apply();
    if (mode !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode, modeReady]);

  useDismiss(rootRef, open, () => setOpen(false));

  const current = THEMES.find((t) => t.id === style) ?? THEMES[0];

  return (
    <div ref={rootRef} className="relative">
      <Button
        aria-haspopup="true"
        aria-expanded={open}
        title="Theme: / next, ⇧/ previous, ⌥M light/dark"
        onClick={() => setOpen((o) => !o)}
      >
        <Palette className="size-3.5" />
        {current.label}
        <ChevronDown className={cx("size-3.5 transition-transform", open && "rotate-180")} />
      </Button>

      <span aria-live="polite" className="sr-only">
        {flash}
      </span>
      {flash && !open && (
        <div className="ui-toast pointer-events-none absolute right-0 top-full z-40 mt-2 animate-[toast-in_160ms_ease-out] whitespace-nowrap px-3 py-1.5 text-xs font-semibold">
          {flash}
        </div>
      )}

      {open && (
        <div className="ui-panel ui-popover absolute right-0 top-full z-40 mt-2 w-72 p-1.5">
          <div role="radiogroup" aria-label="Theme" className="space-y-0.5">
            {THEMES.map((t) => {
              const active = t.id === style;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setStyle(t.id);
                    track("theme_changed", { theme: t.id });
                  }}
                  className={cx(
                    "ui-tab flex w-full items-center gap-3 px-2.5 py-2 text-left",
                    active && "ui-selected",
                  )}
                >
                  <span className="flex shrink-0 -space-x-1" aria-hidden>
                    {t.swatches.map((c, i) => (
                      <span key={i} className="size-4 rounded-full border border-black/15" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-fg">{t.label}</span>
                    <span className="block truncate text-[11.5px] text-subtle">{t.description}</span>
                  </span>
                  {active && <Check className="size-4 shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-line px-2 pb-1 pt-2.5">
            <span className="text-xs font-semibold text-muted">Mode</span>
            <Segmented
              label="Light or dark"
              value={mode}
              onChange={(m) => {
                setMode(m);
                track("mode_changed", { mode: m });
              }}
              options={[
                { value: "light", label: <Sun className="size-3.5" aria-label="Light" />, title: "Light" },
                { value: "system", label: <Monitor className="size-3.5" aria-label="System" />, title: "Match system" },
                { value: "dark", label: <Moon className="size-3.5" aria-label="Dark" />, title: "Dark" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
