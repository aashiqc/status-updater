# Status Updater

Writes the START / PAUSE / STOP updates we post in Tazko task threads in Slack, formatted as a code block.

## How to use it

1. Copy the Tazko task card (or your earlier START message) in Slack.
2. Press `⌘V` anywhere on the page outside a text field, or click **Paste from Slack**. Project, task and reference fill in.
3. Pick START, PAUSE or STOP, fill the rest, and press `⌘↵` (or **Copy**). Paste it in the thread.

Pasting a START message switches you to STOP. The time taken is suggested from the START/PAUSE updates you copied here.

## What it remembers (this browser only, in localStorage)

- Your name, role (Dev/QA), theme and output settings
- The form you were filling, so a reload doesn't lose it
- **Open tasks**: anything you've STARTed and not STOPped, with one-click Pause / Stop
- **History**: the last 100 updates you copied. You can search them, copy again, or edit and repost

Nothing is sent to a server.

## Shortcuts

| Keys | Action |
| --- | --- |
| `⌘/Ctrl ↵` | Copy the update |
| `⌥/Alt 1–3` | Switch to START / PAUSE / STOP |
| `⌘/Ctrl V` | Fill the form from a Slack message (works inside fields too) |
| `⌥/Alt N` | Clear the form |
| `/` · `⇧ /` | Next · previous theme (outside text fields) |
| `⌥/Alt M` | Light / dark |

## Themes

Pick a theme from the palette button in the header: **Lava** (default, the brand palette), **Glass**,
**Vaporwave**, **Memphis**, **Pixel** and **Y2K**. Each has a light and a dark mode (Light / System / Dark).
The choice is saved on this device and applied before first paint, and each theme's fonts load only when it's active.

Themes are plain CSS files in `app/themes/`. They style a shared set of `ui-*` hook classes and colour tokens,
so adding one is one CSS file plus an entry in `app/themes/registry.ts`. The rules are in `app/themes/README.md`.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build && npm start
```

Analytics: set `VITE_PUBLIC_POSTHOG_KEY` (and optionally `VITE_PUBLIC_POSTHOG_HOST`) at build time. PostHog loads lazily after the page is idle. Without a key it isn't bundled at all.

Docker: `docker build -t status-updater . && docker run -p 3000:3000 status-updater`

## Code map

- `app/routes/home.tsx`: page state and actions
- `app/lib/status.ts`: output format and the Slack/Tazko paste parser
- `app/lib/duration.ts`: time parsing and formatting ("2h 30m", "2.5", "90m" → minutes → "~2.5h")
- `app/lib/tasks.ts`: open tasks, history, time tracking from updates
- `app/lib/storage.ts`: hydration-safe localStorage state
- `app/components/`: form controls, sidebar, preview, paste dialog, theme toggle
