import { useEffect, useLayoutEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type RefObject, type TextareaHTMLAttributes } from "react";

/*
 * Visual style comes from the active theme via ui-* hook classes (see app/themes/README.md).
 * Tailwind classes here are for layout and sizing only, so a theme can restyle without fighting them.
 */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Close a popover on a pointer press outside `ref` or on Escape, while `open`. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref]);
}

export function Field({
  label,
  htmlFor,
  labelId,
  optional,
  aside,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  labelId?: string;
  optional?: boolean;
  aside?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label id={labelId} htmlFor={htmlFor} className="ui-label text-xs">
          {label}
          {optional && <span className="ml-1 font-normal text-subtle">· optional</span>}
        </label>
        {aside}
      </div>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-subtle">{hint}</div>}
    </div>
  );
}

export const inputClass = "ui-input px-3 text-sm";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  // Default to full width and h-9 unless the caller sets its own width/height.
  const c = className ?? "";
  return (
    <input
      type="text"
      autoComplete="off"
      {...props}
      className={cx(inputClass, !/(^|\s)w-/.test(c) && "w-full", !/(^|\s)h-/.test(c) && "h-9", c)}
    />
  );
}

/**
 * Textarea that grows with its content (capped, then scrolls).
 * With `fill`, it instead stretches to the free space of a flex-column parent (desktop app shell).
 */
export function TextArea({
  className,
  value,
  rows = 2,
  fill,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { fill?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || fill) return;
    el.style.height = "auto";
    // Add the real border width (themes use 1–3px borders) so the content never needs an inner scrollbar.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value, fill]);
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      {...props}
      className={cx(
        inputClass,
        "w-full resize-none",
        !/(^|\s)py-/.test(className ?? "") && "py-2",
        !/(^|\s)leading-/.test(className ?? "") && "leading-relaxed",
        fill ? "min-h-20 flex-1" : "max-h-72",
        className,
      )}
    />
  );
}

export function Chip({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cx("ui-chip inline-flex h-7 items-center gap-1 px-3 text-xs font-semibold", active && "ui-selected", className)}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("ui-seg inline-flex p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx("ui-seg-item inline-flex h-6 items-center gap-1.5 px-2.5 text-xs font-semibold", active && "ui-selected")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="ui-switch relative inline-flex h-5 w-9 shrink-0 items-center"
    >
      <span className={cx("ui-switch-knob inline-block size-3.5 transition-transform", checked ? "translate-x-[17px]" : "translate-x-0.5")} />
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cx("ui-kbd inline-flex h-[18px] min-w-[18px] items-center justify-center px-1 text-[10.5px] font-medium", className)}>
      {children}
    </kbd>
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "ui-btn inline-flex items-center justify-center gap-1.5 font-bold disabled:cursor-not-allowed disabled:opacity-50",
        `ui-btn-${variant}`,
        size === "sm" && "h-7 px-2.5 text-xs",
        size === "md" && "h-8 px-3.5 text-[13px]",
        size === "lg" && "h-11 px-5 text-[15px]",
        className,
      )}
    >
      {children}
    </button>
  );
}
