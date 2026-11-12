const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Copy a status so it pastes into Slack as a code block.
 * text/html (<pre>) makes Slack's rich composer create a code block; text/plain carries the ``` fences.
 * Falls back to writeText, then execCommand (works on plain-http deployments where the Clipboard API is missing).
 */
export async function copyStatus(message: string, body: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([message], { type: "text/plain" }),
          "text/html": new Blob([`<pre>${escapeHtml(body)}</pre>`], { type: "text/html" }),
        }),
      ]);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = message;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function readClipboardText(): Promise<string | null> {
  try {
    return (await navigator.clipboard?.readText?.()) ?? null;
  } catch {
    return null;
  }
}
