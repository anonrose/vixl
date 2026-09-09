---
title: Appearance
---

# Appearance and shareable themes

Vixl ships with a built-in appearance (the Vixl Default theme) and a Light / Dark / System color mode. On top of that baseline, Vixl supports **named, shareable appearance themes**: versioned JSON files that customize semantic UI colors, typography, the app canvas background, and editor/code colors.

This page documents the shareable theme file format, its constraints and non-goals, and how themes interact with existing settings.

## Color modes

The existing color mode setting is unchanged:

| Mode | Behavior |
| --- | --- |
| `light` | Forces the light variant of the active theme |
| `dark` | Forces the dark variant of the active theme |
| `system` (default) | Follows the OS setting; light and dark variants of the active theme both matter |

Color mode and themes are independent: switching Light/Dark/System changes which **variant** of the active theme is shown, it does not change which theme is active.

## The `.vixl-theme.json` format

Themes are shared as a single self-contained JSON file with the `.vixl-theme.json` extension. The file is a versioned `vixl-theme` payload describing exactly one theme. Files are strictly validated on import: unknown fields, malformed values, and unsafe content are rejected rather than partially applied.

A theme carries:

- `id` — a stable, lowercase slug identifier. The built-in id `vixl-default` is reserved and can never be imported or stored.
- `name` — a user-facing display name (length-limited, no control characters or angle brackets).
- `version` — the theme format version the file was written for. Files with unsupported versions are rejected.
- `variants` — required `light` and `dark` variants, so System mode stays meaningful.

### Variants

Each variant carries:

- **Semantic UI colors** — a complete token map corresponding to the shadcn/Tailwind semantic variables used by the app: core tokens (background/foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring), the sidebar group (`sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`), and the chart palette (`chart1` … `chart5`). Incomplete token maps are rejected.
- **Canvas background** — either `solid` (a single color) or a structured gradient: an angle in degrees (0–360) plus 2–5 color stops with positions in 0–100, sorted by ascending position. Gradients also carry a solid fallback color so the canvas degrades safely.
- **Typography** — primary UI and monospace font family names with explicit fallback stacks (bounded count), plus bounded UI and editor font sizes. Font families are treated as data, not CSS: quotes, braces, semicolons, `url(`, `var(`, and similar escape hatches are rejected, and font sources are never fetched.
- **Editor palette** — the code colors consumed by Monaco and Shiki (background, foreground, comments, keywords, strings, numbers, and so on) including readable hover/suggest widget foreground/background/border values.

### Value rules

- **Colors** are hex only — CSS color functions, named colors, and URLs are rejected.
- **Font sizes** are bounded numeric values (half-point granularity for UI text; integer bounds for editor text).
- **Names and identifiers** are length-limited; font family strings are limited to letters, digits, spaces, and a small punctuation set.
- **Files** are size-capped (rejected before parsing if oversized), and the saved theme library is count-capped.

Imports never accept raw CSS, URLs, HTML, scripts, image data, or remote font sources. Imported values are data-only.

### Canonical exports

Exports are serialized in a stable, canonical shape: schema-versioned envelope, fixed key order, no runtime-only preview state, stable pretty printing with a trailing newline. Export → import round trips produce byte-identical files. Colors are normalized to a canonical casing so equivalent inputs serialize identically.

A structurally abbreviated example (the authoritative key layout is whatever the app's exporter produces — start from an exported theme when hand-editing):

```json
{
  "kind": "vixl-theme",
  "version": 1,
  "theme": {
    "id": "sunset",
    "name": "Sunset",
    "version": 1,
    "variants": {
      "light": {
        "colors": { "background": "#ffffff", "foreground": "#18181b", "...": "complete token map" },
        "background": { "kind": "gradient", "fallback": "#ffffff", "angle": 180, "stops": [ { "color": "#fafafa", "position": 0 }, { "color": "#e4e4e7", "position": 100 } ] },
        "editor": { "...": "Monaco/Shiki palette incl. hover/suggest widget colors" }
      },
      "dark": {
        "colors": { "background": "#18181b", "foreground": "#fafafa", "...": "complete token map" },
        "background": { "kind": "solid", "color": "#18181b" },
        "editor": { "...": "Monaco/Shiki palette incl. hover/suggest widget colors" }
      }
    }
  }
}
```

## Constraints and non-goals

To keep theme files safe, portable, and predictable, the format intentionally excludes:

- local or remote images and any binary assets;
- remote fonts or font downloads (only bundled/system stacks);
- arbitrary CSS, style strings, or links;
- a gallery or public marketplace — sharing is file-based only;
- per-project themes — themes are a personal, platform-wide preference.

## Workflows

### Export

1. Open **Settings → Appearance** and select a saved theme.
2. Export validates the theme, strips runtime-only state, and writes a canonical, versioned JSON payload through a save dialog with a sanitized suggested filename (the theme name slugified, e.g. `sunset.vixl-theme.json`).
3. Canceling the save dialog is a no-op, never an error.

### Import

1. **Settings → Appearance → Import** opens a file dialog filtered to JSON theme files.
2. The file is size-checked before parsing, parsed as JSON, and strictly validated against the versioned schema.
3. A summary preview is shown; if the theme's id collides with an existing theme, a collision-safe normalized id is assigned while the display name is preserved.
4. On confirmation the theme is added to your personal library and can be activated immediately.
5. Filesystem and validation failures are surfaced as errors without partially changing the active theme or library.

### Managing themes

The Appearance section provides create-from-current/default, rename, duplicate, delete, and reset actions, with confirmation for destructive actions. Deleting the active theme falls back to the built-in Vixl Default theme. Experimental edits use explicit Apply/Save and Cancel semantics so settings are not written on every input.

## Compatibility and storage

- **Backward compatible settings key** — `appearance.theme` continues to store the color mode (`light` / `dark` / `system`). Existing settings files migrate without changes.
- **Personal-only settings** — the theme library (`appearance.themeLibrary`) and active custom theme id (`appearance.activeThemeId`) are personal platform preferences. They are stripped from project-level overrides, so a project's `.vixl/settings.json` cannot embed or replace your theme library. Project files may still set `appearance.theme` (the color mode).
- **Safe fallbacks** — a missing or malformed active theme id resolves to the built-in Vixl Default theme rather than erroring, and invalid custom-theme state (dangling ids, malformed library entries) is cleaned up on load.
- **Default appearance preserved** — with no custom theme selected you get exactly the built-in palettes, Inter Variable / JetBrains Mono fonts, and existing sizing.
- The theme file carries its own independent format `version`; it does not bump the general settings version.
