# Feature: Themes

## Overview

PlotWeave has nine visual themes that instantly transform the entire app — backgrounds, borders, fonts, glow effects, animations, and overlay textures all update together. Themes are implemented as CSS custom property sets injected by `ThemeProvider` onto the document root. The active theme is persisted in Zustand (localStorage).

---

## What Already Works

- **Nine themes** — Dark Slate, Fantasy, Sci-Fi, Cyberpunk, Horror, Western, Action, Noir, Romance
- **`ThemeProvider`** — reads `theme` from Zustand store; on mount and theme change, applies the correct CSS variable block to `:root`; used in `AppShell`
- **`ThemePicker`** — dropdown/grid in `TopBar`; shows theme name and a colour swatch; selecting a theme calls `setTheme` in the store
- **CSS custom properties** — every themed element reads from variables like `--bg-primary`, `--border-color`, `--font-body`, `--glow-color`, `--tl-bg` (timeline bar), `--tl-dot-active`, `--tl-pulse-duration`, etc.
- **Timeline bar theming** — all timeline bar colours, dot styles, glow, and pulse animation speed are theme-controlled via `--tl-*` variables
- **Map callout theming** — map popups and callout cards read `--popup-bg`, `--popup-border`, `--popup-shadow`
- **Per-theme font** — body font and heading font set per theme; loaded via `@import` in the theme CSS block or via system fonts
- **Overlay textures** — Sci-Fi (scanlines), Cyberpunk, Action (diagonal crosshatch), Horror, Noir (corner vignette) have optional pseudo-element overlays
- **Pulse animations** — timeline bar marker pulse speed, glow intensity, and animation easing all vary by theme
- **Persistence** — `theme` field in Zustand store persisted via `localStorage` key `plotweave-ui`

---

## Available Themes

| Key | Name | Palette | Font |
|---|---|---|---|
| `dark-slate` | Dark Slate | Slate-900 blues | Inter sans-serif |
| `fantasy` | Fantasy | Parchment & gold | Palatino serif |
| `sci-fi` | Sci-Fi | Frosted glass & cyan | Monospace |
| `cyberpunk` | Cyberpunk | Neon pink & yellow | Monospace bold |
| `horror` | Horror | Charcoal & blood-red | Palatino serif |
| `western` | Western | Leather & copper | Palatino serif |
| `action` | Action | Gunmetal & orange | Impact bold-italic |
| `noir` | Noir | Monochrome near-black | Playfair Display serif |
| `romance` | Romance | Dark rose & rose-gold | Georgia serif |

---

## User Stories

- As a writer, I want to create a custom theme by adjusting individual colour values so I can match my story's aesthetic exactly.
- As a writer, I want themes to affect the map tile style (e.g. sepia tint for Fantasy) so the map feels part of the world.
- As a writer, I want to import/export custom themes as JSON files so I can share them with other users.

---

## Technical Approach

### Key files
- `src/components/ThemePicker.tsx` — theme selector UI
- `src/components/ThemeProvider.tsx` — injects CSS variables on theme change
- `src/store/index.ts` — `theme: ThemeName`, `setTheme`, persisted in localStorage
- `src/types/theme.ts` — `ThemeName` union type + theme definition objects

### CSS variable injection
```typescript
// ThemeProvider effect
useEffect(() => {
  const vars = THEMES[theme]  // object of CSS variable key → value
  const root = document.documentElement
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value))
}, [theme])
```

All components reference `var(--some-var)` in inline styles or Tailwind `[var(--some-var)]` classes. No theme-specific class names — a single variable swap changes everything.

---

## Tasks

- [x] Nine themes with full CSS variable sets
- [x] `ThemeProvider` injection on theme change
- [x] `ThemePicker` in `TopBar`
- [x] Timeline bar theme variables (`--tl-*`)
- [x] Map callout theme variables
- [x] Per-theme font families
- [x] Overlay textures and vignettes (Sci-Fi, Horror, Noir, Action, Cyberpunk)
- [x] Theme persisted in Zustand / localStorage
