# PlotWeave

<p align="center">
  <img src="icon/plotweave.png" alt="PlotWeave" width="180" />
</p>

<p align="center">
  <strong>A story bible that knows what time it is.</strong>
</p>

<p align="center">
  Track where every character is, what they carry, who they know, and what's true about your world — at any point in your story.
</p>

---

## The problem

In a long story, continuity is a memory tax. Where was she when the letter arrived? Who still has the dagger in Chapter 19? Were these two enemies yet? Most tools make you answer those questions by re-reading your own manuscript.

PlotWeave answers them for you. Everything is recorded against a **chapter cursor** — a single control that sets "when" you're looking. Move the cursor and the whole workspace snaps to that moment: characters jump to where they stood, inventories change hands, relationships shift, the map redraws. Your world becomes something you can scrub through, not just re-read.

It's a companion to your manuscript, not a replacement — built to sit alongside Word, Scrivener, or a stack of notebooks.

---

## Screenshots

### Map Explorer
![Map with character pins and chapter timeline](screenshots/maps_1.png)
*Upload any image as a map. Characters appear as pins at their chapter-specific locations, with the chapter timeline running along the bottom.*

![Sub-map with movement trails and character panel](screenshots/maps_2.png)
*Drill into nested maps (world → region → city). Movement paths are drawn between waypoints; selecting a character opens a snapshot of their inventory, location, status, and relationships.*

### Characters
![Character roster](screenshots/characters.png)
*A roster of the full cast, each showing their location and status for the active chapter.*

![Character detail view](screenshots/character_details.png)
*Per-character tabs: Overview, Current State (this chapter's snapshot), History (every chapter), Relationships, and linked Lore.*

### Timeline
![Timeline with chapters and events](screenshots/chapters.png)
*Chapters in sequence, each with attached events. Set any chapter active to focus every other view on that point in time.*

### Relationship Graph
![Relationship graph](screenshots/relationships.png)
*A network of character relationships. Edge colour signals sentiment; relationships can be chapter-scoped so they appear only once they exist in the story.*

---

## What you can do

- **Scrub through your story.** One chapter cursor drives every view. Characters, inventories, locations, relationships, and lore are all recorded per chapter and read back relative to "now."
- **Map your world.** Upload any image as a map, place locations, nest sub-maps (world → region → city), and watch characters move along the trails you draw.
- **Track the cast.** Per-chapter snapshots of each character's location, inventory, status, and alive/dead state — with full history and portrait art.
- **Model relationships.** A visual graph with sentiment and strength, scoped to the chapters where each relationship is true.
- **Keep a knowledge base.** A wiki-style Lore section for magic systems, history, and factions, with "revealed at" pinning so you can see only what the reader knows so far.
- **Catch your own mistakes.** A Continuity Checker scans the world for dead-then-alive characters, items in two places at once, and relationships that exist before they began.
- **Replay it.** Press Play and the story animates chapter by chapter — characters travel their trails while each chapter's notes surface as on-screen prose.
- **Find anything.** `Ctrl/⌘ + K` opens a full-text command palette across every entity in your world.
- **Own your data.** Everything lives locally in your browser via IndexedDB — no account, no server, works offline. Export any world to a single portable `.pwk` file.

### Themed to match your story
PlotWeave ships nine visual profiles — Dark Slate, Fantasy, Sci-Fi, Cyberpunk, Horror, Western, Action, Noir, and Romance — that retheme the whole workspace, fonts and all. It's not decoration for its own sake: when the tool *looks* like the world you're writing, it's easier to stay inside it.

---

## Tech stack

| Concern | Library |
|---|---|
| Desktop shell | Electron 41 + electron-forge |
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Database | Dexie.js (IndexedDB) |
| UI state | Zustand (persisted) |
| Routing | React Router v7 |
| Maps | Leaflet + react-leaflet (`CRS.Simple`) |
| Relationship graph | ReactFlow v11 |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Testing | Vitest + Playwright |

---

## Download

Grab the latest installer for your platform from the [Releases page](https://github.com/SirFoxworthTheThird/PlotWeave/releases):

| Platform | File |
|----------|------|
| Windows  | `PlotWeave-*-Setup.exe` — run the installer |
| macOS    | `PlotWeave-*.zip` — unzip and drag to Applications. On first launch, right-click → Open if macOS warns about the developer. |
| Linux    | `plotweave_*.deb` — install with `sudo dpkg -i plotweave_*.deb` |

---

## Quick start

1. **Create a world** from the home screen.
2. **Upload a map** and click to drop location markers.
3. **Add characters**, then drag them onto the map to place them.
4. **Create chapters** in the Timeline, and pick one from the bottom bar to set the time cursor.
5. **Track state per chapter** — move characters, hand off items, record relationships — and scrub the cursor to watch it all change.
6. **Export** your world to a `.pwk` file anytime for a full backup.

---

## Documentation

For a full, screenshot-by-screenshot walkthrough of every part of the app — the
time cursor, timeline, characters, maps, Cast Balance, Plot Threads, relationships,
lore, factions, knowledge, the Writer's Brief, the Continuity Checker, and more —
see the **[User Guide](docs/GUIDE.md)**.

---

## Development

```bash
npm install            # install dependencies
npm run electron:dev   # run the desktop app (Vite + Electron)
npm run dev            # browser-only dev server (localhost:5173)

npm run test           # run the test suite
npm run build          # type-check + production build
npm run electron:make  # package installers for the current platform
```

`@` is aliased to `src/`. Data is stored locally in IndexedDB; nothing leaves your machine.

---

## Project layout

```
src/
  features/   # self-contained feature folders (maps, characters, timeline, lore, …)
  db/         # Dexie schema + migrations and the useLiveQuery hooks that read it
  store/      # Zustand store (active world/chapter/map, playback, UI state)
  lib/        # .pwk export/import, HTML export, shared utilities
  components/ # app shell, top bar, timeline bar, shared UI primitives
  types/      # entity interfaces
```

---

## License

Released under the [MIT License](LICENSE).

---

<sub>Built conversationally with [Claude Code](https://claude.com/claude-code).</sub>
