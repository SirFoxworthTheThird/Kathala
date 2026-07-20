# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Vite dev server (localhost:5173)
npm run electron:dev     # Run as Electron desktop app (Vite + Electron together)
npm run build            # TypeScript check + Vite build
npm run lint             # ESLint
npm run test             # Run all tests once (Vitest)
npm run test:watch       # Vitest in watch mode
npm run test:coverage    # Coverage report (v8)
```

Run a single test file:
```bash
npx vitest run src/db/hooks/__tests__/timeline.test.ts
```

`@` is aliased to `src/` in both Vite and TypeScript configs.

## Architecture

**PlotWeave** (package name: `plotweave`) is a local-first story-tracking app. All data lives in IndexedDB via Dexie — no backend.

### The time-cursor pattern
The global chapter selector in `TopBar` drives everything. `activeChapterId` (Zustand, persisted) acts as a "time cursor" — all character/item/location state is read relative to it. Never auto-compute state across chapters; always use explicit snapshot records.

### Data layer (`src/db/`)
- `database.ts` — single `PlotWeaveDB` (Dexie) instance, versioned schema with migrations. Add new tables or fields as new `.version(N)` blocks with upgrade functions.
- **Never remove old `.version(N)` blocks** from `PlotWeaveDB`. Dexie requires the full migration chain to remain present so that databases at any prior version can upgrade through each step.
- `db/hooks/` — one file per entity group. Each exports `useFoo(id)` hooks (built on `useLiveQuery`) and standalone async CRUD functions (`createFoo`, `updateFoo`, `deleteFoo`). Hooks are the only way components read data.
- Images are stored as Blobs in a separate `blobs` table (`BlobStore`) — never inline in entity records.

### State (`src/store/index.ts`)
Single Zustand store (`useAppStore`) with slices for: active world/chapter/map, map drill-down history stack, playback, and UI panel open/close state. Only `activeWorldId`, `activeChapterId`, `sidebarOpen`, and `theme` are persisted (localStorage key: `plotweave-ui`).

### Snapshot model
Per-chapter state is stored as explicit snapshot records — not computed:
- `CharacterSnapshot` — location, inventory, alive status, travel mode per (character × chapter)
- `ItemPlacement` — where an item is per (item × chapter)  
- `LocationSnapshot` — status/notes per (location × chapter)
- `ItemSnapshot` — condition/notes per (item × chapter)
- `RelationshipSnapshot` — relationship state per (relationship × chapter)

When a new chapter is created, it inherits all snapshots from the immediately preceding chapter in the same timeline.

### Map system (`src/features/maps/`)
Uses Leaflet with `CRS.Simple` (pixel coordinates) for custom/fantasy image maps. Sub-maps are supported via `LinkedMapLayerId` on location markers; the map drill-down history is tracked as `mapLayerHistory: string[]` in Zustand. `LeafletMapCanvas.tsx` is the main map renderer. Map layers have optional `scalePixelsPerUnit` / `scaleUnit` for distance calculations.

### Features directory (`src/features/`)
Each feature folder is self-contained. Notable features:
- `characters/tabs/` — `CurrentStateTab`, `HistoryTab`, `RelationshipsTab`, `OverviewTab`
- `timeline/` — `TimelineView`, `ChapterDetailView`, `ChapterRow`
- `relationships/` — `RelationshipGraphView` (ReactFlow)
- `search/` — `SearchPalette`
- `diff/` — `ChapterDiffModal` (compare chapters)
- `continuity/` — `ContinuityChecker`
- `arc/` — `CharacterArcView`
- `brief/` — `WritersBriefPanel`

### Testing
Tests use Vitest + jsdom + `@testing-library/jest-dom`. Dexie is tested against `fake-indexeddb`. Tests live in `src/db/hooks/__tests__/` and `src/lib/__tests__/`. Coverage is scoped to `src/lib/**`, `src/store/**`, and `src/db/hooks/**`.

Playwright e2e tests live in `e2e/*.spec.ts` (run with `npm run test:e2e`) and drive the real app in Chromium against a live dev server, resetting IndexedDB per test via `e2e/helpers/reset.ts`.

**Testing rule:** every new behaviour needs a test. Prefer a Vitest unit test (pure logic in `src/lib/**`) or an integration test (real CRUD hooks against `fake-indexeddb`, as in `src/db/hooks/__tests__/`). When behaviour genuinely can't be exercised that way — because it depends on the browser/DOM (caret handling, autocomplete dropdowns, focus/blur timing, drag, canvas/Leaflet) or on a full multi-view user flow — add a Playwright e2e test in `e2e/` instead. Do not leave such behaviour untested with a note that it "needs a manual check"; write the e2e test.

### Documentation
The illustrated user guide lives at `docs/GUIDE.md`, with screenshots in `docs/images/` (numbered, e.g. `24-manuscript.png`). `README.md` links to it.

**Documentation rule:** every user-facing feature added or changed must update `docs/GUIDE.md` in the same PR. If it's a new feature, add (or extend) the relevant section and its table-of-contents entry; if it changes existing behaviour, update the affected section so the guide never describes something that no longer matches the app. When the change alters what a screen looks like or introduces a new screen/dialog, refresh or add a screenshot (drive the dev server with Playwright, capture to `docs/images/NN-name.png` at `deviceScaleFactor: 2`, and reference it from the section) — match the guide's existing voice and screenshot style. Purely internal changes (refactors, tests, tooling, non-visual bug fixes with no behaviour change) don't need a guide edit.

### Electron
The app is also packaged as an Electron desktop app. Entry point: `electron/main.cjs`. Use `npm run electron:dev` during development or `npm run electron:make` to build distributables via electron-forge.
