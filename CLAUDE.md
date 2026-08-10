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
The global event selector in `TopBar` drives everything. `activeEventId` (Zustand, persisted) acts as a "time cursor" — all character/item/location state is read relative to it. Never auto-compute state across events; always use explicit snapshot records.

### Data layer (`src/db/`)
- `database.ts` — single `PlotWeaveDB` (Dexie) instance, versioned schema with migrations. Add new tables or fields as new `.version(N)` blocks with upgrade functions.
- **Never remove old `.version(N)` blocks** from `PlotWeaveDB`. Dexie requires the full migration chain to remain present so that databases at any prior version can upgrade through each step.
- `db/hooks/` — one file per entity group. Each exports `useFoo(id)` hooks (built on `useLiveQuery`) and standalone async CRUD functions (`createFoo`, `updateFoo`, `deleteFoo`). Hooks are the only way components read data.
- Images are stored as Blobs in a separate `blobs` table (`BlobStore`) — never inline in entity records.

### Operation journal (`src/lib/operations.ts`, `src/db/hooks/useOperations.ts`)
Journalled mutations write the record **and** an `Operation` describing the change in one Dexie
transaction, so the journal can never disagree with the store. This is the local-first foundation
(issue #115) — it is what makes the store replayable rather than only current, and it underpins undo
and durable backup. It is entirely local: no network work is required for a mutation to be committed.

- Wrap a mutation in `withJournal([tables], { … })` rather than writing the table directly. Pass the
  entity's existing cascade logic as `apply` so it stays where it lives.
- Journalled records carry an optional `version`, incremented per write. **Read it as `?? 1`** —
  records predating v52, and older `.pwk` imports, have none.
- Deletes also write a `Tombstone`, so a deletion is recorded rather than inferred from absence.
- `OperationEntity` lists the 19 entity groups on the seam: character, characterGoal, item,
  location, timeline, chapter, event, relationship, lorePage, faction, plotThread, motif,
  knowledgeFact, plus the per-event snapshots (characterSnapshot, itemPlacement, locationSnapshot,
  itemSnapshot, relationshipSnapshot, mapRegionSnapshot). Snapshots are only written by a direct
  user edit — chapter-to-chapter inheritance is resolved at read time, so there is no bulk
  snapshot write.
- **A partial journal is worse than none.** If a path writes a journalled table directly — bulk AI
  generation, chapter AI import, world import — it must call `markJournalDiscontinuity(worldId)`,
  which resets the journal rather than leaving one that claims to be complete and isn't. Bulk
  operations that are ordinary user edits (`bulkDeleteEvents`, `bulkAddTag`, `moveEventOnBoard`)
  instead route through the journalled singles.
- **Operations** are device-local history and stay out of `.pwk`/`.pwb`. **Tombstones do travel**:
  they are world state, and without them a merge on the other device treats a deleted record as
  merely absent and resurrects it. `markJournalDiscontinuity` therefore clears operations only.
- Merge (`applyWorldImport('merge')`) unions records by id, so deletions are applied afterwards from
  the tombstone set (`src/lib/mergeTombstones.ts`). A record edited *after* its deletion is kept —
  keeping is recoverable, discarding later work is not — and its stale tombstone is dropped.

### State (`src/store/index.ts`)
Single Zustand store (`useAppStore`) with slices for: active world/event/map, map drill-down history stack, playback, and UI panel open/close state. Only `activeWorldId`, `activeEventId`, `sidebarOpen`, `navPinned`, `barScope`, and `theme` are persisted (localStorage key: `plotweave-ui`).

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

Playwright e2e tests live in `e2e/*.spec.ts` (run with `npm run test:e2e`) and drive the real app in Chromium, resetting IndexedDB per test via `e2e/helpers/reset.ts`. They run against a **production build** (`vite build` + `vite preview`), four files at a time; use `npm run test:e2e:dev` to run against the dev server instead, which is slower but keeps hot reload while you are writing a spec. The dev server was costing roughly two-thirds of the suite's runtime, because each of the ~83 database resets is a full document load and Vite re-transformed the app for every one.

**Testing rule:** every new behaviour needs a test. Prefer a Vitest unit test (pure logic in `src/lib/**`) or an integration test (real CRUD hooks against `fake-indexeddb`, as in `src/db/hooks/__tests__/`). When behaviour genuinely can't be exercised that way — because it depends on the browser/DOM (caret handling, autocomplete dropdowns, focus/blur timing, drag, canvas/Leaflet) or on a full multi-view user flow — add a Playwright e2e test in `e2e/` instead. Do not leave such behaviour untested with a note that it "needs a manual check"; write the e2e test.

**A test that never fails protects nothing.** Several tests in this repo were
written, passed on the first run, and turned out to assert nothing at all: a
`toHaveCount(0)` that was already 0 for an unrelated reason, an absence checked
on a screen where the control never renders anyway, a count captured before its
live query resolved and then compared against itself. Each looked like coverage
and was worth less than no test, because it also stopped anyone looking again.

Two habits, both cheap:

- **Break it on purpose.** Before trusting a test that guards a fix, remove the
  fix and watch the test go red. If it still passes, the test is wrong — fix the
  test before restoring the code. The suite runs in about nine minutes; a single
  spec runs in under one.
- **Pair an absence with a presence.** A test asserting something is *hidden*
  should assert it is *shown* under the opposite condition, in the same test.
  Vacuity cannot satisfy both halves. `e2e/readingMode.spec.ts` does this for
  the settings sections and the reveal-all confirm.

**Do not describe behaviour that is not there yet.** A comment or doc block
saying a function is bounded, gated, or retried is a claim, and reviewers read
it as one. Journal pruning carried a paragraph about a hard ceiling before the
ceiling existed; the test caught it, but the comment would have outlived a
weaker test. Write the claim after the code earns it.

**Verify at the commit you are shipping.** Long runs get overtaken: a suite
started before the last three commits reports on none of them. Re-run at the
tip before saying it passes, and read what the tools already wrote — Playwright
saves a page snapshot to `test-results/…/error-context.md` that usually
identifies the failure faster than reasoning about the error message does.

**Scope a locator to what it is about.** A page-wide `getByText('First Scene')`
or `getByRole('button', { name: /The gate opens/ })` is a bug waiting for a
second match, and the app's own chrome supplies them: the time-cursor pill
carries the active scene's title, the chapter bar carries every scene's title,
and a per-row menu is named after its row. Four specs broke this way in one
sitting — `calendar`, `corkboard`, `structure`, `imageLightbox` — and every one
of them was ambiguous *before* the change that exposed it, passing only because
nothing else happened to match yet. A failure that appears under one ordering
and not another is this, not a flake. Reach through `page.getByRole('main')`,
through the dialog, through the row — or pass `exact: true` where the name
really is the whole name.

### Documentation
The illustrated user guide lives at `docs/GUIDE.md`, with screenshots in `docs/images/` (numbered, e.g. `24-manuscript.png`). `README.md` links to it.

**Documentation rule:** every user-facing feature added or changed must update `docs/GUIDE.md` in the same PR. If it's a new feature, add (or extend) the relevant section and its table-of-contents entry; if it changes existing behaviour, update the affected section so the guide never describes something that no longer matches the app. When the change alters what a screen looks like or introduces a new screen/dialog, refresh or add a screenshot (drive the dev server with Playwright, capture to `docs/images/NN-name.png` at `deviceScaleFactor: 2`, and reference it from the section) — match the guide's existing voice and screenshot style. Purely internal changes (refactors, tests, tooling, non-visual bug fixes with no behaviour change) don't need a guide edit.

### Electron
The app is also packaged as an Electron desktop app. Entry point: `electron/main.cjs`. Use `npm run electron:dev` during development or `npm run electron:make` to build distributables via electron-forge.
