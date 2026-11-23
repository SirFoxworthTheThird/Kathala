# Research and reference material (issue #700)

**Asked:** a place for the sources behind the book: reference pictures, PDFs, web links and clippings, kept with the
scenes, places, characters and items they inform, and a mood board of a record's pictures. The measurements and
decisions are in `research-plan.md`, D-1 to D-6.

**Code:**
- `src/types/research.ts`: the item, its kind, and what it is attached to.
- `src/lib/research.ts`: what a file or a link may be, attachments, the filter and search, the order. Pure.
- `src/db/hooks/useResearch.ts`: the hooks and every write, journalled; `detachEverywhere`, which the deletes of
  scenes, chapters, timelines, characters, items and places call.
- `src/lib/exportImport.ts`: `researchItems` in a `.pwk` (version 23), and `withoutResearchFiles`.
- `src/features/research/`: the Research screen, the add dialog, a card, the panel with its mood board, and the
  Page's side panel.
- The Page (`DraftBook`), the character Overview, the item page, the place panel, Search and the backup panel use
  them where they are.

## What it does

**Kinds.** A file, an image or a PDF of at most 20 MB, stored as it came in `blobs` (D-2). A link: nothing is fetched
from it, then or later. A clipping: words, and where they came from. Each has a title, defaulting to the file's name, the
link's site or the clipping's first line, and a research note.

**The Research screen** (`/research`, in the rail) lists every item in the items' own order.
- **Add research** puts the new item on the world as a whole.
- **Attach to…** on a card puts it on a scene, place, character or item too. Each chip's **×** takes it off one.
- Search runs over titles, notes, clippings, sources and addresses. It can be filtered by kind (images, PDFs,
  links, clippings) and by what an item is on: one record, any of a kind, the world, or *Attached to nothing*.

**Beside the work.** A character's Overview, an item's page and a place's panel show a *Research* section.
- It lists what is attached there and has **Add research**, which attaches the new item there. **Attach research you
  have…** attaches one already kept.
- On the Page, **Research** beside **Notes** shows the same for the scene the caret is in, in the Notes panel's
  column. One of the two is open at a time.
- A record's pictures are its **mood board** (D-1), in the items' order. Dragging one onto another reorders them, and
  the Research screen shows the new order, since there is one.
- An image opens full size, a PDF in the browser's viewer in a new tab, and a link in a new tab with
  `noopener,noreferrer`.

**Deletes** (D-5). Deleting a scene, chapter, timeline, character, place or item takes it off every item's list,
journalled with the delete, so its undo puts it back. The item stays, and one left on nothing says *Attached to
nothing*. Deleting an item deletes its file unless another item names it, and one undo brings back both.

**Backups** (D-3).
- A `.pwk` carries `researchItems`, and the files in its `blobs`.
- The backup panel's **Include research files (N MB)** leaves the files out when unticked. Above 200 MB it starts
  unticked, with why.
- Replacing from a copy made without the files keeps the files already here. A merge never deletes one.
- An item whose file is in neither says *File not in this copy*, and opening it says why.

**In a series** research is the series' (D-4, `SHARED`). **In reading mode** there is none (D-6):
- the rail has no Research;
- its address goes to the dashboard;
- no entity page shows the section;
- Search does not look in it.

The Page is not offered in reading mode, so its button needs no gate of its own.

## Found on the way

- **The Page's reading-mode gate was dead code.** The Research button on the Page was first written behind
  `gate.active`. The Page is only offered while writing (`pageOffered` in `TimelineView`), so that branch could not
  be reached. It was taken out, with a comment saying why, per CLAUDE.md on unreachable branches.
- **A card laid out for the screen did not fit beside the Page.** Its actions were a column on the right. In the
  Page's 320px column that squeezed the title to a word a line, and the panel's *Add research* was cut off. The actions
  now wrap in a row under the card. Beside a record, a picture's card has no thumbnail, since the mood board above
  shows it.
- **The dialog opens on the kind last added.** The e2e expected a file input after adding a link. The dialog keeps the
  kind between openings, which suits adding several of one kind, and the spec now says so.
- **The new names collided with lookups by part of a name**, as CLAUDE.md warns. *Research* contains *arc*, so
  `getByRole('link', { name: 'Arc' })` matched both rail links and five Arc specs failed strict mode. *Add research* on a
  place's panel contains *Add*, so the map spec's `name: 'Add'` matched two buttons. Both lookups were exact-name
  lookups written as substring ones, and they now say `exact: true`.
- **The guide shot of the Page clicked into the prose before the page was laid out,** and sometimes no scene took
  the caret. The shot waits for the page to say *Saved* first.

## Tests

- `src/lib/__tests__/research.test.ts`, 10: what a file and a link may be; a size as a writer says it; the files'
  total; attach, detach, attached to nothing; the filters by kind and by what an item is on; search over titles,
  notes, clippings, sources and addresses; the order and `moved`.
- `src/db/hooks/__tests__/research.test.ts`, 11, against the real hooks:
  - a file stored raw, in `blobs` and never in the record; refusals; a link and a clipping with their titles;
  - attach, detach, rename, reorder, each undone;
  - a delete with its tombstone and its file, and undo bringing both;
  - the cascades: scene, chapter, timeline, character, item, place, and world;
  - a series;
  - a backup with and without files, a replace keeping the files left out, and a merge with deletions.
- `e2e/research.spec.ts`, 2:
  - **a writer, from the Page:** a file over 20 MB refused, saying why; a picture and a link attached to the scene the
    caret is in; the picture's bytes in the store; a second picture dragged before the first; the picture opened
    with its own bytes, and the link opened in a new tab with no opener; the Research screen in the board's order,
    filtered by kind and searched; Search finding the link by its note; a backup holding the picture's bytes, one
    without them holding the items and not the file, and the first brought into an empty library giving the same
    bytes back;
  - **a reader:** each thing present while writing and absent in reading mode: the rail link, the character's
    research, Search's research result, and the screen, whose address leads to the dashboard.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed: 20 against the unit and hook tests, and
9 against `e2e/research.spec.ts`.

- **At 55cdc8e, 20 unit mutants:** 15 killed, 2 survived, 3 did not build.
  - Killed: the 20 MB limit, any kind of file, any scheme of link, a file not checked when added; the scene,
    chapter and world cascades; a deleted item's file left behind; a reorder that writes nothing; files kept in a
    backup made without them; a replace deleting the files it was made without; research kept per book in a series;
    an image filter taking any file; *attached to nothing* taking everything; the order by creation alone.
  - Survived: a timeline's delete leaving its scenes on the research. Nothing tested it. There is a test now.
  - Survived: `moved` without its upper clamp. This one is equivalent, since `splice` past the end already appends.
  - Did not build: the character, item and place cascades, each removed outright and so leaving its import unused.
    They were rewritten as never-true conditions.
- **At e2c5aa6, those four:** the timeline cascade, against its new test, and the three rewritten. All killed.
- **At e2c5aa6, 9 against the e2e spec:** all killed:
  - a reader shown the research section, given the rail link, and found research by Search;
  - the backup's box ignored, and the box off by default;
  - a link opened with its opener;
  - a drop putting the picture one place on;
  - the Page's panel given no scene;
  - the dialog putting an item on the world when it was opened from a scene.
