# One book, one numbering — a plan

**Status:** built in the same PR.
**Asked 2026-10-14:** before a blind run of a space opera told in three
timelines centuries apart, all feeding one story. A book is read in one order,
however many timelines feed it, so its chapters should be numbered in one
order too.

## What happens now

A chapter's number is its position, and the app already reads it as a
position *in the book*:
- **All timelines → Chapter order**, **Read** and the export put every
  timeline's chapters in number order (`useManuscriptBook`).
- **"Last known state"** is found by a stored position, `chapter.number` plus
  the scene's place in it, across every timeline (`sortKey`). Only the map
  scopes it to one timeline.

But a chapter is *numbered* within its own timeline:
- **Making one** — the Binder's and the dialog's **New chapter**, the place
  panel's, the AI chapter — suggests one past the highest in its timeline
  (`nextChapterNumber` over the timeline's chapters).
- **A taken number** moves up only that timeline's chapters
  (`createChapterAt` → `planChapterInsert` over the timeline's chapters).
- **`# Title` on the Page** takes the number after its chapter, or the next
  chapter in the timeline where that is closer (`startChapter`).

So a book whose timelines were each started at chapter 1 has three chapter
1s. In chapter order they tie, and are read in whatever order the database
gives them. A state recorded in one era's chapter 1 is "before" another era's
chapter 1, or after it, by the same accident.

**What the books do.** Every multi-timeline book in the library — *The
Odyssey*, *The Name of the Wind*, *The Wise Man's Fear*, *The Two Towers*,
*Journey to the West* and *The Time Machine* (6 of 47) — numbers its chapters
across the whole book: 0 of their 410 chapters shares a number with another
timeline's. The two writer runs kept in `docs/records` have one timeline each.
A writer who braids timelines in this app, though, gets per-timeline numbers
unless they type every number themselves.

## The plan

**Chapters are numbered across the world**, not the timeline.

- **The suggested number** is one past the highest in the book, wherever
  that chapter is: the dialog, the Binder, the place panel and the AI chapter.
- **A taken number** means *put it there*, as now, and the chapters that move
  up are the book's — any timeline's. Said before anything is written, as now
  ("Chapters 8–12 become 9–13"), and one undo.
- **`# Title` on a timeline's Page:**
  - **Typed after the last scene of that timeline's last chapter**, the new
    chapter goes **at the end of the book**. A writer drafting a braid adds the
    next chapter of one era while the others' chapters come after it; putting
    it straight after its era's last chapter would cut in front of them.
  - **Typed anywhere else** — mid-chapter, splitting it, or between two of the
    timeline's chapters — it goes **straight after the chapter it is typed in**,
    in the book's order, and the chapters after it move up, in every timeline.
    A chapter split from another reads next to it.
- **Moving a chapter** within its timeline (Alt+↑ ↓, or dragging it in the
  Binder) keeps doing what it does: the timeline's chapters change places and
  take each other's numbers, so the other timelines' chapters keep theirs. A
  braid stays braided.
- **Joining a chapter** to the one before it on the Page is unchanged: the one
  before it *on that Page*.

**Books already numbered per timeline** are not renumbered silently: their
state lookups would move. Where two timelines share a chapter number, the
**All timelines** tab says so and offers **Number the chapters as one book**:
every chapter, in the order the book reads now — by number, ties in the
timelines' tab order — numbered from its first number upwards with no ties.
Said before it is done ("23 chapters are renumbered"), and one undo.

## Tests

- **Unit** (`chapterNumbering`): the book's next number; the number for a
  chapter typed on a Page, at a timeline's end and in its middle; the plan for
  numbering a book with ties as one.
- **Integration** (fake IndexedDB): a taken number moves another timeline's
  chapters up; `startChapter` at a timeline's end goes to the book's end, and
  mid-chapter goes next to it; moving a chapter within its timeline leaves the
  others alone; numbering as one book, and its undo.
- **e2e:** on a timeline's Page, `# Title` after its last chapter is
  numbered after the book's last; the binder, the dialog, the AI chapter's
  prompt and a place's panel on the map all offer the book's next number; the
  All timelines notice appears where numbers are shared, and not where they are
  not, and its button numbers the book.

## Not in this plan

- **A Page on All timelines.** One numbering is what makes it possible — a
  chapter typed there could take the timeline of the chapter above it — but it
  is its own piece of work, to be planned after this.
- **"Last known state" by in-world time rather than book order**, for
  something that recurs across eras. Book order is now at least one order; the
  space opera run will say whether it is the right one.
