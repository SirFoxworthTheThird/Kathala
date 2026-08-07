# Troubleshooting

---

## Data and storage

### My world has disappeared

PlotWeave keeps everything in the browser's IndexedDB. Data is lost if you:

- Cleared your browser's site data or cache.
- Used a private/incognito window (data goes when the window closes).
- Uninstalled or reset the browser.

**Prevention:** [export](Export-and-Import) regularly, or bind the world to a [sync folder](World-Settings) so saving is automatic.

**Recovery:** import your most recent `.pwk`.

### A world is slow to load

Large worlds with many events and high-resolution map images take longer.

- Resize map images before uploading — under about 4000×4000 is comfortable.
- Prefer uploads over very large linked images if the source is slow.

### An import fails immediately

1. Confirm the file is a genuine PlotWeave export, not something renamed to `.pwk`.
2. If the export was **split**, select the `.pwk` **and** the `.pwb` together.
3. Check the browser console (`F12 → Console`) for the specific error.

### Something's missing after a merge

A merge keeps both sides' list entries and asks you about conflicting single values. **Deletions are applied** — if a record you expected is gone, it was deleted on the other device. A record edited *after* its deletion is kept.

See [Export and Import → Merging](Export-and-Import).

---

## The time cursor

### A character's state doesn't change when I move the cursor

That's usually [inheritance](Core-Concepts) working correctly: with no snapshot at the active event, the most recent earlier one carries forward.

Open the character's **History** tab to see which events actually have recorded snapshots.

### I edited state and it changed at earlier events too

You edited a snapshot that was being *inherited*, so your edit landed at the event that owns it. Record the intended state at the earlier event first, then edit the later one separately.

### A character shows as dead when they should be alive

Set the cursor to the event in question and correct the alive toggle on **Current State**. That writes a snapshot at that event; earlier events are untouched.

---

## Maps

### Characters aren't appearing

1. The cursor must be on an event where they have a location.
2. The marker must be on the layer you're looking at — not a sub-map, and not a different **floor**.

### The location panel keeps opening

It shouldn't from cursor movement. Moving the time cursor **pans** the map; the panel opens only when you pick a place from the sidebar, from search, or by clicking its pin.

### Map images won't load

- Use PNG or JPG.
- Very large files (over ~20 MB) can fail silently in some browsers — resize first.
- A **linked** image needs an internet connection and a source that's still up.

### Measure is greyed out

It unlocks once the map has a scale. Both live in the **⋯** menu.

### Export as PNG is missing part of the map

A **linked** (cross-origin) map image may not be drawable to a canvas. Uploaded maps always export.

---

## Continuity Checker

### Travel violations for everyone

The travel checks need all three of: a **map scale**, **travel modes with speeds**, and **travel days** on events. Any one missing skews the arithmetic. Set them up, then re-run.

### Warnings on a flashback

Check **Is flashback** on the event. Flashbacks are excluded from travel and staleness checks.

### A suppressed finding came back

Suppressions travel with the world in `.pwk`. If you imported an older export made before you suppressed it, the suppression wasn't in that file.

---

## Reading mode

### Screens and buttons are missing

The world is in **[reading mode](Reading-Mode)**, which puts away everything that only makes sense to the writer — Manuscript, Structure, Corkboard, undo/redo, the Writer's Brief, the Continuity Checker, and every add/generate/delete control.

Turn it off in **Settings** and everything returns exactly as it was.

### Most of my cast is missing

That's the point — reading mode hides what the story hasn't introduced by your chapter cursor. Move the cursor forward, or select **All chapters** to reveal everything.

---

## Undo

### Undo is greyed out right after an import

Importing a world, generating one from AI, or importing a manuscript **starts a fresh history**. Your work is safe; it just can't be stepped back through. Export before a big import.

### I can't undo an edit from earlier in the session

History is a stack — only the newest edit can be undone. Taking one from the middle would leave later edits resting on a state that never existed. **Recent changes** (the clock icon) shows the stack.

---

## Themes

### The app looks broken after switching themes

Hard-refresh (`Ctrl+Shift+R`, or `⌘+Shift+R`). If it persists, clear the `plotweave-ui` key from local storage and reload.

---

## Performance

### The relationship graph is sluggish

With a very large cast, use the character page's **Relationships** tab to browse in list form instead of the graph.

---

## Reporting a bug

1. Note any error from the browser console (`F12 → Console`).
2. [Export](Export-and-Import) the world so the problem can be reproduced.
3. Open an issue at **https://github.com/SirFoxworthTheThird/PlotWeave/issues** with the steps to reproduce and the error text.
