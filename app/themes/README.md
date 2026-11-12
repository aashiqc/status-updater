# Theme contract

A theme is one CSS file in `app/themes/<id>.css` plus an entry in `registry.ts` (label, Google Fonts
URL, swatches). The `<html>` element carries two attributes, set before first paint:

- `data-style="<id>"`: the active theme (`lava` is the default).
- `data-mode="light" | "dark"`: already resolved, so "System" never needs a media query.

## File rules

1. Wrap the **whole file** in `@layer components { ... }`. (Base tokens live in `@layer base`; Tailwind layout
   utilities live in `@layer utilities` and must keep winning, so themes can't break layout.)
2. Scope **every** selector to the theme:
   - tokens: `:root[data-style="<id>"] { ... }` and `:root[data-style="<id>"][data-mode="dark"] { ... }`
   - hooks: `[data-style="<id>"] .ui-panel { ... }`, dark tweaks: `[data-style="<id>"][data-mode="dark"] .ui-panel { ... }`
   - backdrop: `[data-style="<id>"] body::before { ... }` / `body::after`
3. Plain CSS only: no `@apply`, no Tailwind classes, no `@import`. Fonts come from the registry URL.
4. Must look good and stay readable in **both** light and dark mode (text contrast ≥ 4.5:1 for body
   text; `--subtle` is used for small secondary text, so keep it ≥ 4.5:1 on `--surface`).
5. Don't change layout: no `width`, `height`, `padding`, `margin`, `display` (except where noted), `position` or `gap` on hooks.
   You may change borders, radius (via tokens), backgrounds, shadows, fonts, colours, letter-spacing,
   text-transform, filters and pseudo-element decoration. Keep borders ≤ 3px. The app is a fixed full-screen
   shell on desktop, so decoration must never add scroll.
6. Respect `prefers-reduced-motion` (the global rule already cuts animation time; keep motion subtle).

## Tokens (define all colour tokens for light **and** dark)

| Token | Use |
| --- | --- |
| `--canvas` | page background colour |
| `--surface`, `--surface-2`, `--surface-3` | panel, inset/inputs, selected/hover fills |
| `--surface-solid` | opaque surface for the theme menu and dialogs (may be translucent + blur if legible) |
| `--code` | preview message background |
| `--line`, `--line-strong` | borders |
| `--fg`, `--muted`, `--subtle` | text: primary, secondary, tertiary |
| `--primary`, `--primary-hover`, `--primary-fg` | main Copy button |
| `--accent`, `--accent-text` | focus ring and highlights / accent-coloured text |
| `--start`, `--pause`, `--stop` | START / PAUSE / STOP colours (also used as text, keep contrast) |
| `--warn`, `--danger` | missing-field warnings, delete |
| `--r-panel`, `--r-control`, `--r-input` | radii: panels, buttons/chips/tabs, inputs/code |
| `--font-body`, `--font-heading`, `--font-code` | font stacks (families must be in the registry URL) |

Optional hooks-by-token (base reads these): `--panel-bg`, `--panel-shadow`, `--panel-blur` (a full
`backdrop-filter` value), `--popover-shadow` (theme menu / dialog shadow), `--titlebar-bg`, `--footer-bg`, `--input-bg`, `--input-shadow`, `--selected-bg`,
`--selected-fg`, `--selected-border`, `--selected-shadow`, `--tab-font`, `--deco-glyph` (a CSS string,
e.g. `"✦"`), `--deco-display` (`inline-block` to show decorative glyphs, `none` to hide), `--backdrop`
(a full `background` value for the page), `--backdrop-overlay` (second layer, e.g. a grid),
`--window-dots-display` (`flex` or `none`, the three dots on the preview title bar).

## Hook classes (what the markup exposes)

| Class | Element |
| --- | --- |
| `ui-panel` | the three main panels, dialogs, menus |
| `ui-popover` | added to dialogs/menus (uses `--surface-solid`) |
| `[data-panel="sidebar" \| "form" \| "preview"]` | attribute on the three main panels, to style one panel differently |
| `ui-titlebar` | top bar of each panel (type tabs, sidebar tabs, preview title, dialog title) |
| `ui-panel-footer` | bottom bar of the form panel and dialog |
| `ui-window-dots` | three `ui-dot`s on the preview title bar |
| `ui-wordmark` | the "Status Updater" logo text in the header |
| `ui-tagline` | small secondary header text |
| `ui-heading` | small display headings ("preview.txt", day groups in history, dialog title, type labels) |
| `ui-label` | form field labels |
| `ui-deco` | decorative glyph (`::before { content: var(--deco-glyph) }`), hidden unless `--deco-display` |
| `ui-input` | text inputs and textareas (states: `:hover`, `:focus`, `[aria-invalid="true"]`) |
| `ui-btn` + `ui-btn-primary` / `ui-btn-secondary` / `ui-btn-ghost` | buttons. `ui-copied` = success flash (base handles it, don't override) |
| `ui-chip` | preset / status choice pills |
| `ui-seg` + `ui-seg-item` | small segmented controls (Dev/QA, hours format, light/dark) |
| `ui-tab` | START/PAUSE/STOP tabs and sidebar Open/History tabs |
| `ui-selected` | the selected chip / seg item / tab / theme-menu item |
| `ui-switch` (`[aria-checked="true"]`) + `ui-switch-knob` | the time toggle |
| `ui-dot` | status dots; colour comes from `color` (`currentColor`) |
| `ui-code` | the message preview and history message blocks |
| `ui-counter` | "sent today 003" counter in the footer |
| `ui-toast` | bottom toast |
| `ui-ambient` | animated background layer behind everything (off unless `--ambient-display: block`). Unlike other hooks you may set position/size/inset/transform on it and its `::before`/`::after`. Animate only `transform`/`opacity` where possible (or `background-position` on one small layer), keep it slow and subtle; the global reduced-motion rule freezes it. |
| `ui-kbd` | keyboard hints |

Look at `lava.css` (minimal) and `y2k.css` (heavily decorated) for working examples.
