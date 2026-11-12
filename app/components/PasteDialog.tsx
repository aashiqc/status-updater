import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardPaste, X } from "lucide-react";
import { parseMessage, SOURCE_LABEL } from "~/lib/status";
import { Button, inputClass, cx } from "./ui";

const EXAMPLE = `Paste a Tazko task card or a status you posted, e.g.

START - 3:11PM
Project: Urban monkey
Task: Back in Stock using appmaker BIS
Estimated Time: ~3h
Dev: Ashiq`;

export function PasteDialog({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const parsed = useMemo(() => (text.trim() ? parseMessage(text) : null), [text]);
  const found = parsed
    ? ([
        ["Project", parsed.project],
        ["Task", parsed.task],
        ["Estimate", parsed.estimate],
        ["Reference", parsed.reference],
        ["Name", parsed.name],
      ] as const).filter(([, v]) => v)
    : [];
  const usable = !!(parsed?.project || parsed?.task);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        setText("");
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="paste-title"
      className="ui-panel ui-popover m-auto w-[min(600px,calc(100vw-32px))] overflow-hidden p-0 text-fg"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (usable) onApply(text);
        }}
      >
        <div className="ui-titlebar flex items-center justify-between px-4 py-2.5">
          <h2 id="paste-title" className="ui-heading flex items-center gap-2 text-sm">
            <ClipboardPaste className="size-4 text-accent-text" /> Fill from Slack
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-full text-subtle hover:bg-surface-3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && usable) {
                e.preventDefault();
                onApply(text);
              }
            }}
            placeholder={EXAMPLE}
            aria-label="Pasted text"
            className={cx(inputClass, "h-48 w-full resize-none py-2 font-mono text-[13px] leading-relaxed")}
          />
          <div className="min-h-6 text-xs" aria-live="polite">
            {parsed && (usable ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-subtle">Found in {SOURCE_LABEL[parsed.source]}:</span>
                {found.map(([k, v]) => (
                  <span key={k} title={v} className="inline-flex max-w-56 items-center gap-1 truncate rounded-full bg-start/12 px-2.5 py-0.5 font-bold text-start">
                    <Check className="size-3 shrink-0" /> {k}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-warn">No Project or Task found yet. Paste the whole message.</span>
            ))}
          </div>
        </div>
        <div className="ui-panel-footer flex items-center justify-end gap-2 px-4 py-2.5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!usable}>
            Fill form
          </Button>
        </div>
      </form>
    </dialog>
  );
}
