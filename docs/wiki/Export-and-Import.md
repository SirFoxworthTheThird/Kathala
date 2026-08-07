# Export and Import

PlotWeave stores everything locally. Export to back up a world, move it between devices, or share it.

---

## The formats

| File | Contents |
|---|---|
| **`.pwk`** | The world's data — characters, items, locations, chapters, events, timelines, every snapshot, relationships, routes, regions, annotations, lore, factions, knowledge, scene prose and history, continuity suppressions, the writing log, the calendar |
| **`.pwb`** | The images — portraits, map images, item thumbnails, covers — split out separately |

A `.pwk` can carry its images inline, or you can split them into a `.pwb` so the data file stays small. Both are the app's portable, offline save format.

**Deletions travel with the file.** A record you deleted is recorded as deleted rather than merely absent, so merging on another device doesn't resurrect it.

Your local edit history (undo) is **device-local** and deliberately stays out of the file.

---

## Exporting

From the **world card menu** (⋯) on the world selector, export the world as a `.pwk`, optionally split with a `.pwb`.

From **Settings**, **Export as HTML** produces a read-only, shareable snapshot anyone can open in a browser.

> **Export regularly.** PlotWeave has no automatic cloud backup. If your browser's storage is cleared, anything unexported is gone. Consider binding the world to a [sync folder](World-Settings) instead of remembering to click export.

---

## Importing

1. On the world selector, choose **Import**.
2. Select the `.pwk` file. **If your export was split, select both the `.pwk` and its `.pwb` together.**

---

## Merging two copies of the same world

If the same world was edited on two devices, importing one into the other offers a **merge** rather than a replace.

**Lists are combined rather than replaced.** If you added one character to a scene's cast and someone else added another, the scene ends up with both. Tags, aliases, inventories, and plot threads work the same way, and the order you each had is kept.

**Reordering survives.** Moving a card writes only that card's position, so two people rearranging different scenes both get their way, and both devices end up with the same sequence.

**Single values cannot be combined** — a name, a description, a status. The file records what each copy *says*, not what each person *changed*. Where both copies changed one, PlotWeave shows you the two versions side by side before anything is applied, and you choose: **Most recent**, **Keep mine**, or **Use theirs**.

**Deletions are applied.** Anything you deleted stays deleted rather than reappearing because the other copy still had it. If you deleted something on one device and then *edited* it on the other, the **edit wins and the record is kept** — keeping is recoverable, discarding later work is not.

**Replace all** overwrites the local world with the file instead of merging.

---

## Folder and cloud sync

Rather than exporting by hand, bind a world to a `.pwk` in a local folder — including one managed by Google Drive, OneDrive, or Dropbox. See [World Settings → Folder and cloud sync](World-Settings).

---

## Moving between the web app and the desktop app

Export from one, import into the other. They use the same format.

---

## Backward compatibility

`.pwk` files carry a version number. PlotWeave imports older files and fills in missing fields automatically. Older versions of PlotWeave may not read files from newer ones.

Imported worlds are also read **defensively**: a file written by hand or by an AI can carry values PlotWeave has never heard of, and an unrecognised status or goal type is shown as itself rather than crashing the screen.

---

## Note on undo

Importing a world **starts a fresh edit history**, so [undo](Undo-and-Redo) is empty straight afterwards. Export before a big import if you want a way back.

---

## Common problems

**The export produced no file.**
Check your browser's download settings; some block automatic downloads.

**Import fails with an unrecognised-format error.**
The file must be a genuine PlotWeave export. Renaming something to `.pwk` won't work.

**Imported images are missing.**
If the export was split, import the `.pwk` and `.pwb` **together**.

**The merge option didn't appear.**
PlotWeave matches worlds by their internal id. Two worlds created separately have different ids and import as separate worlds even if they describe the same story.

---

## Related pages

- [World Settings](World-Settings) — folder sync, HTML export, database health
- [The Library](Library) — the same format, distributed
- [Troubleshooting](Troubleshooting)
