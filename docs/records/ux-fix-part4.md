# UX fixes, Part 4: crashes, traps and one-click losses

Part 4 of `ux-expert-fixes-plan.md`: the places where the app fell over, held the reader in a screen with no way
out, or lost work on one click. Each mechanism the review named was checked in the code at `6c0b70c` before it was
fixed, and each was still there. `e2e/crashesAndTraps.spec.ts` takes the state the review found and shows the way
out of it.

| Finding | What it was | Now | Test |
|---|---|---|---|
| UX-1-4 | **Link Timelines** on *The Odyssey* replaced the whole app with React Router's developer page. | The relationship is mended on import and on every read. A screen that fails shows a plain message inside the frame. | the Link Timelines and error-screen tests; `timelineRelationshipShape.test.ts` |
| UX-3-1 | A map whose picture was missing replaced the Maps screen, with no way back from a sub-map. | The layers, sections and canvas stay; a bar above the map says why there is no picture. | `mapImageMissing.spec.ts`, four tests |
| UX-3-4 | Help opened under the map's toolbar and pills, which took its clicks. | Help is above them. | the Help test |
| UX-3-5 | A 12px ✕ at the menu's corner cleared the map's scale, with no word and no Undo. | **Clear scale** is a named item; it goes through the journal and says so with **Undo**. | the Clear scale test; `mapLayers.test.ts` |
| UX-3-18 | A map could not be deleted from the keyboard, and on touch only after a tap that also opened it. | The delete is the next Tab stop after the name, drawn on focus, and always drawn on touch. | the map delete test |
| UX-3-21 (D-9) | The map panel's green *Alive* strip looked like a badge, and one click recorded a death without a word. | **Alive — mark as dead**, with a toast and **Undo**. | the Alive test |
| UX-2-7 | A reply typed under a note was dropped on **Resolve**. | Resolve sends it first, in the same act; the button reads **Reply and resolve** while one is waiting. | the reply test |
| UX-2-8 | *Also rename*, ticked by default, gave *Poole* the name *Bradshaw* while there was a Bradshaw. | Unticked and unavailable, with the reason, when the new name is already a character's. | the rename test; `characterNames.test.ts` |
| UX-1-16 (D-8) | Each timeline tab was two Tab stops with a 12px hover-only delete inside, and its confirm said "permanently" with no count. | One button per tab, arrow keys between them; rename and delete in the ⋯ beside the tabs; the confirm counts what goes and says Undo brings it back. | the tabs test; `timelineDelete.test.ts`; `timelineDeleteUndo.test.ts` |
| UX-3-25 | A map picture or a pin portrait that failed drew the browser's broken-image mark. | No overlay for a picture that did not load; a pin's portrait that fails is removed and its initials show. | the portrait test; `brokenPortrait.test.ts`; `mapImageMissing.spec.ts` |

## The crash

*The Odyssey*'s file stores its one relationship in an older shape: `fromTimelineId` / `toTimelineId` for the two
timelines, a type of `flashback` (not one of the four), `fromEventId` / `toEventId`, and no `anchors` or
`syncPoints`. The panel read `rel.anchors.length`.

- **`src/lib/timelineRelationshipShape.ts`:** `mendTimelineRelationship` reads any stored shape as the one the app
  reads. The timelines go under their names now, `flashback` becomes a frame narrative, and the two scenes become
  the frame's sync point: the outer scene the telling is at, and the inner scene it tells. Both lists are always
  present. A record already in shape is returned as it is, the same object.
- **Where it runs:** on import (`normalizeImport`), and on every read: the two hooks, the scene join's sync-point
  repair, the echo-locations read, and the timeline delete's cascade. So a world imported before this, with the old
  shape stored, reads in the new one too.
- **The six staged books:** the unit test reads every `.pwk` in the Library when `KATHALA_LIBRARY` is set. All six
  books with a timeline relationship read whole once mended, and only *The Odyssey* needed mending.

**The error screen** (`src/components/RouteError.tsx`).
- *This screen stopped working*, with **Reload** and **Copy the details**: the error, its stack, the address and
  the browser, for a report. If the browser will not copy, the details are shown open.
- It sits in a pathless route inside the book's frame, so the top bar and the menu stay to leave by. The shell
  and the world list have their own.
- An address that names no screen says *There is no page here*, with a way back to the worlds, never the router's
  page.
- The e2e suite reaches it through `__throw`, a route that fails as it renders. It exists only where `__pwdb`
  does: dev, and builds made with `VITE_E2E`.

**Found on the way.** The first version of the reply test seeded a note in the wrong shape. The Page failed on it,
and the new screen caught it inside the frame, with the top bar still there. That is the case it was built for.

## The map

- **A missing picture** (`MapExplorerView`):
  - The two early returns that replaced the screen are gone. A picture never set, never downloaded or unreachable
    is said once, in a bar above the map (`role="note"`), with **Add map image** for a writer.
  - The canvas draws the map's places on its own, as F-7 settled for a picture that would not load. Where a map has
    neither picture nor size to draw on, the empty state stands where the picture would go, and everything beside
    it stays.
  - A root map is no longer called a sub-map.
- **No broken-image mark:**
  - The canvas is given a picture's address only once the picture has loaded, and draws no overlay without one.
  - A pin's portrait is drawn over its initials, and a capture-phase `error` listener removes one that fails. It is
    not an `onerror` attribute, because the page's content-security policy has no `'unsafe-inline'` for scripts.
- **Help** is at `z-[3000]`, with the Brief, Search and the Checker. It was at `z-40`, under Leaflet's panes
  (about 400) and the map's floating controls (about 1000).
- **Map layers join the journal for their edits.**
  - `updateMapLayer` writes through `journalUpdate`, so a rename, a scale set and a scale cleared are each a step
    of Undo. `clearMapScale` is the menu item's act, and its toast offers the same Undo the top bar runs.
  - Making a map, deleting one, adding a floor and replacing a picture still write the table directly, as they did.
    The delete says "This cannot be undone", which stays true. Bringing those writes into the journal too is the
    larger change, and it is not this part's.
- **The map's delete** is always in the row. It is drawn on hover, on focus anywhere in the row, and always under a
  coarse pointer.

## Losing words

- **Resolve** (`NotesPanel`): with a reply typed and not sent, Resolve sends it first and then resolves, both in
  the panel's one journal group, so one Undo takes back both. Part 0 found that Edit keeps a typed reply, so only
  Resolve needed this.
- **Also rename** (`FindReplaceDialog`): `nameHeldBy` (`characterNames.ts`) finds who else already goes by the new
  name, by their name, an alias or an earlier name, in any case, leaving out the characters being renamed.
  - Where someone does, the box is unticked and disabled, with the reason. The prose is still replaced; only the
    rename is held back.
- **The Alive control** (D-9): it stays one click, since Undo already works. It now reads as a control:
  - a border;
  - the state with its verb beside it, *Alive — mark as dead*;
  - a toast saying what it recorded, with **Undo**.

  **Departure from D-9:** no `aria-pressed`. D-9 suggested it, but a button whose words change with its state and
  that also reports *pressed* is the very fault D-6 found in the reading-mode toggle. This one says what a press
  does, in its name, and nothing else.
- **The timeline tabs** (D-8):
  - Each tab is the name's button, with `role="tab"`, and only the open tab is in the Tab order. **←**, **→**,
    **Home** and **End** move between tabs and choose them; **Alt+←/→** still reorders.
  - Rename and delete are in the open timeline's ⋯, beside the tabs rather than in them.
  - The confirm says *Its N chapters and M scenes go with it, prose and all. Undo brings them back.*, counted. That
    sentence is a claim, so `timelineDeleteUndo.test.ts` holds it: one Undo brings back the timeline, its
    chapters, its scenes and their prose. A journalled delete keeps what its cascade removed.

## Tests

- **`e2e/crashesAndTraps.spec.ts`, 10 tests.** Each pairs the state with its control case:
  - Link Timelines on the Odyssey shape;
  - the error screen inside the frame, its details copied, and the not-found address;
  - Help over the toolbar, where the same point was the toolbar before it opened;
  - Clear scale and its Undo, and no item without a scale;
  - the map delete, opacity 0 under a mouse and 1 when focused;
  - Alive and its Undo;
  - the broken portrait, showing initials and no image;
  - Reply and resolve, and its one Undo;
  - Also rename, ticked for a new name and held back for a taken one;
  - the tabs: their Tab order and arrows, the menu, the counted confirm, and Undo.
- **`e2e/mapImageMissing.spec.ts`:** rewritten for the kept screen, plus the sub-map trap and the way back from it.
- **Unit and integration:**
  - `timelineRelationshipShape` (4, one reading the Library);
  - `characterNames` (2 new);
  - `timelineDelete` (1) and `brokenPortrait` (1);
  - `mapLayers` (clearing the scale and its Undo);
  - `timelineDeleteUndo` (1).

## Mutants

MUTANTS-PENDING

## Checks at the commit shipped

CHECKS-PENDING
