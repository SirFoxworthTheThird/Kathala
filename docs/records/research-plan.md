# Research and reference material: the plan (issue #700)

**Asked:** a place for the writer's sources — reference images, PDFs, web links, clippings and research notes —
attached to the scene, place, character or item each one informs, or to the world as a whole. Lore holds the world's
own facts; this holds the writer's sources.

## Measured

In Chromium, against the built app, at 7a87cc0.

**A file stored and exported.** A file of each size was written to the `blobs` table and read back, then encoded as
the base64 a `.pwk` carries it in:

| File | Stored and read back | Encoded | In the `.pwk` |
| --- | --- | --- | --- |
| 1 MB | 54 ms | 13 ms | 1.3 MB |
| 5 MB | 14 ms | 58 ms | 6.7 MB |
| 20 MB | 8 ms | 261 ms | 26.7 MB |
| 50 MB | 26 ms | 687 ms | 66.7 MB |

Storing costs nothing worth counting. Encoding is linear, and a file grows by a third in a `.pwk`. The export writes
its files one at a time (`writeJsonWithBlobs`), so its size does not limit it.

**A `.pwk` read back.** Importing reads the whole file as one string and parses it. Files totalling:
- 100 MB (a 133 MB `.pwk`) parsed in 0.43 s;
- 160, 200, 240 and 280 MB (up to a 373 MB `.pwk`) parsed in a fresh page each, in 0.18–0.29 s;
- 300 MB and 500 MB, in a page that had already read the 100 MB file, could not be read back at all
  (`NotReadableError`).

So the limit on a backup is how much a browser can read back in one string, and memory already in use lowers it.
Files totalling a few hundred megabytes are where a backup stops opening.

## Decisions

- **D-1: the mood board, taken.** An entity's attached images, shown as a grid on its research panel, in the items'
  own order. Dragging one reorders the images, and the Research list follows, since there is one order.
- **D-2: a file is at most 20 MB.** A bigger file is refused when added, with the limit said. Twenty such files make a
  backup of about 530 MB, past what a browser reads back (Measured), which is why the export does D-3.
  - Files are stored as they come: an image is not recompressed, as a portrait is (`storeBlob`), since a reference
    image's detail is its point. They go in `blobs`, never in a record.
  - Only images and PDFs are taken. Any other file is refused, saying what is.
- **D-3: the export says how much research there is, and can leave the files out.**
  - The backup's options say the research files' total, and a box, *Include research files*, which is on.
  - Above 200 MB of files it is off, and the dialog says why: a backup that size may not open on another device.
  - Without the files, the items travel, with title, note, link, clipping and attachments, and their files stay on
    this device. An item imported without its file says *file not in this copy*.
  - A merge never deletes a file the incoming backup leaves out.
- **D-4: in a series, research is the series'.** Sources inform the world, as lore does, and lore pages are the
  series' (`SHARED`). An item attached to a scene names a book's scene; from another book, that attachment is not
  shown.
- **D-5: attachments live on the item.** An item lists what it is attached to: scenes, places, characters and items.
  - *To the world* is a flag of its own, so an item attached to the world is not the same as one attached to nothing.
  - Deleting a scene or an entity takes it out of every item's list, in the same transaction. The item stays. Once
    nothing holds it, and it is not on the world, it is listed under *Attached to nothing*.
  - Deleting an item deletes its file, with the item's tombstone, and undo brings both back.
- **D-6: reading mode.** Research is the writer's, so it is hidden in reading mode, as the Structure board is. Its
  address takes the reader to the dashboard (`WRITING_ONLY`), and no entity page shows its panel.

## Data

- **Dexie v69:** `researchItems: 'id, worldId, kind'`.
  - Each item has `kind` (`file`, `link` or `clip`), `title`, `note`, `url`, `text` (a clipping's words), `source` (where
    a clipping came from), `blobId`, `mimeType`, `size`, `attachedTo`, `toWorld` and `order`.
- **The journal:** a new entity group, `researchItem`. Its file rides with it: the delete's cascade captures the blob
  row, and undo restores it.
- **`.pwk`:** a new array, `researchItems`, and file version 23. The files go in the backup's `blobs` unless D-3 leaves
  them out. A file without the array imports as none.

## Parts

1. **Data:**
   - the type and v69;
   - files stored raw, with the limit and the kinds;
   - journalled create, update and delete;
   - attach and detach;
   - the cascades;
   - `.pwk` with and without files;
   - merge and tombstones.
2. **Screens:**
   - the Research screen: every item, filtered by what it is attached to and by kind, searched across titles, notes and
     clippings;
   - adding a file, link or clipping;
   - the research panel on characters, places, items and scene cards, with the mood board;
   - the scene's research beside the Page;
   - search with Ctrl/⌘+K;
   - the reading-mode gate;
   - the export's option.
3. **e2e, mutants** (the cascade, the limit, the gate), **the guide's *Research* section** with a screenshot, the
   record, and the PR.
