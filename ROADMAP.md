# Kathala Roadmap

What is left, in the order I would do it. Everything shipped up to 23 September
2026 is in
[`docs/records/roadmap-2026-09-23.md`](docs/records/roadmap-2026-09-23.md),
archived whole — 184 completed items, with the reasoning written at the time.

**A shipped item is removed from this file rather than moved into that one.**
`docs/records/` is never edited, deliberately — see
[`docs/README.md`](docs/README.md) — so appending to it would break the one rule
that makes a record worth keeping. The short list below is where a finished item
goes instead: one line and the pull request that carries the reasoning, which
keeps this file about what is left without pretending the work never happened.

## Shipped since the split

- **Automatic local backup** — #465. The folder copy already worked; it was
  silent. The chip beside a world's name now says whether it is backed up and
  when the last copy was written, the dashboard offers a folder once there is a
  scene to lose, and browsers without the folder picker are told what they *can*
  do instead of being told they need a different browser.
- **Finish testing the continuity checks** — #467. The seven rules with no
  issue-level coverage have it: travel distance, region traversal, characters
  inside a region, cross-timeline artifacts, and the three thread cadence rules.
- **Export by scene status** — #473. *Scenes to include* sends a partial draft
  without the scenes that are not ready, on all five formats, and the word and
  scene counts beside the button now describe the export rather than the book.
- **One Timeline, written from the keyboard** — #487, #489, #491, #493, #495,
  #497, #499. The binder beside the writing; the chapter page folded into the
  book, so there is one page and one scene card; next, previous and new scene
  without leaving the draft; chapters and scenes moved with Alt+↑ ↓ or by
  dragging; split and join, each undone in one step with its prose. These are
  what the plan below is built on.

---

## What is left

### One screen for the book: write it as one document

Raised by the author on 28 September 2026, after split and join shipped, and
recorded here before any of it is built so the reasoning is not lost between
sessions.

**The idea.** A writer should be able to write the book as one continuous
document and make its structure by typing — a line that starts a chapter, a
line that starts a scene — rather than by reaching for buttons. Writers who
draft in Scrivener, Ulysses or plain Markdown already work this way.

**Why it means merging the Timeline and the Manuscript.** The Manuscript screen
already stitches every scene into one document, in book order, but read-only.
Making it editable while the Timeline's scene cards also edit prose would put
the same text in two editors on two screens — the duplication #491 and #493
removed from the Timeline itself. So there should be one screen.

The merge goes the other way round from how the two screens look today: **the
prose is the body of the page, and the Timeline's structure sits around it.**

| Where | What |
|---|---|
| Left | The binder, as now — chapters and scenes, moving and dragging. |
| Middle | The book as one document: chapter headings, scene headings, each scene's header line, and the prose. |
| Right | What is true where the caret is: the chapter's panel (character states, relationship states, writer's notes) and the scene's status, POV, tension and cast. The chapter panel already sits beside the list when the screen is wide; this is the same place. |

**What does not become one document**, and stays a view of the same screen:

- **Outline.** Planning before any prose exists needs cards, not text, and seven
  of the shipped books are structural notes with no prose at all. The screen
  has two layouts, **Cards** (the scene cards) and **Page** (the prose flowing)
  — the same data and the same binder. They were to be *Outline* and *Draft*,
  but an open scene card already has status buttons with exactly those names,
  on the same screen.
- **Chronological order.** The Timeline can order scenes by in-world time. A
  new scene heading typed there has no sensible place to go, so that order
  stays as cards.
- **Reading mode.** The Manuscript screen is also what a reader reads the book
  in: the cursor that follows the page, *In this scene*, reading type, and
  nothing past the reader's place. All of it has to survive the merge, and
  none of it is editable.

**Where things stand today**, which is most of the foundation:

- `src/lib/manuscriptImport.ts` reads `#` **and** `##` headings as chapters,
  and lines of symbols (`***`) as untitled scene breaks. Markdown export
  (`src/lib/manuscriptCompile.ts`) writes each chapter as `# Ch. N — Title` and
  separates scenes with a separator line; scene titles are not written.
- The scene header line (`[#Place @@Name]`) is already text that does what a
  control would, applied when the writer leaves it rather than on every key.
  It is built from the scene's fields and not stored in the prose.
- Split (#499) is what typing a scene heading in the middle of a scene has to
  do; join (#499) is what deleting one has to do; `createEventAt` and
  `createChapter` are what a new heading at the end has to do. Split and join
  are each one step of undo, prose included, because operations can carry a
  prose change (`ProseChange`).
- Prose is stored one `SceneText` per scene, and stays that way. The document is
  a view composed from those records and written back to them per scene.

**Decided.** One screen for the Timeline and the Manuscript, and continuous
writing with lines that make structure. **The editor is CodeMirror 6**, chosen by
the spike in step 1: about 4 ms a keystroke anywhere in *Monte Cristo*, against
a median of 70–145 ms for ProseMirror and a `<textarea>`. The numbers, and what the choice
costs, are in
[`docs/records/editor-spike-2026-09-28.md`](docs/records/editor-spike-2026-09-28.md).

**Open, each with a recommendation (the second since decided):**

1. **The syntax.** The author suggested `#### Chapter` and `**** Scene`. I
   recommend `# Chapter title` and `## Scene title`: `#` is already a chapter
   to both import and export, and one syntax across the editor, import and
   export means a book written here, exported and imported again keeps its
   shape. `####` is a heading the importer deliberately leaves in the prose,
   and `***` is already a scene break there, so `**** Scene Name` would read as
   a break with text after it. The cost of `##`: import reads it as a chapter
   today, and plenty of manuscripts use it that way, so step 6 has to decide
   how an import tells the two apart (for instance, `##` is a scene only under
   a `#`).
2. **The name.** *Decided in step 4:* **Manuscript**, at `/manuscript`, with
   the in-world ordering as its *Chronological* view. Not *Timeline*: in
   Kathala a timeline is also a thing a writer creates (a main timeline, a
   frame narrative), and this screen shows the book. `/timeline` still lands on
   it. In reading mode the navigation calls it **Book**, since the reader is not
   writing it.
**The hard parts**, to be solved before or during the steps below:

- **A scene is a record, not a line of text.** It has an id that snapshots,
  goals, threads and History point at. Editing a heading must rename the scene,
  never delete it and make a new one. The id belongs to the heading inside the
  editor (attached to the line, so retyping the title keeps it), not to a
  parse of the text, or a small edit can quietly drop a scene's recorded states.
- **Moving by cut and paste.** Cutting a whole scene and pasting it elsewhere
  reads to an editor as a delete and a create, and would lose the scene's
  states. Moving stays with the binder at first, which already does it.
- **When structure applies.** Not on every keystroke, or typing `## T` makes a
  scene called "T". It applies on leaving the line, the way the scene header
  does.
- **Two undos.** Inside a text field `Ctrl+Z` belongs to the browser; outside
  one it is the journal's. In one continuous editor a structural change (a new
  scene) is a journal operation made from a text edit. What `Ctrl+Z` does
  straight after typing a heading has to be decided and tested, not discovered.
- **The test suite.** 152 of the 235 spec files mention `timeline`. Each step
  below has to leave the suite green; none of them can be one change.

**Steps**, each its own pull request:

1. **The editor spike.** *Done* — CodeMirror 6; the harness is in
   [`spikes/editor/`](spikes/editor/README.md).
2. **The Page view on the current Timeline screen.** *Done* — Cards | Page;
   the prose of a whole timeline in one editor, saved per scene, headings
   renaming their records, Ctrl+F searching the whole book. Headings are fixed
   in this step: an edit that would join, split, add or remove a chapter or
   scene is refused with a reason. Of the spike's heading-id rules only one is
   reachable once headings are fixed — a line break typed at a heading's start
   pushes it down — and it is tested against real CodeMirror transactions with
   undo; the drop-and-restore rules wait for step 5, which is the first step
   that can reach them. **Still owed:** a timing check on a real machine and on
   a phone. The phone test proves the page works at 390 px, not how fast it is.
   And the page does not yet have the scene header line, `@` mentions, the
   scene keys or Focus mode; those stay on the scene cards until they are
   brought across.
3. **Bring the Manuscript's parts across**, in two pull requests so the suite
   stays green between them.
   - **3a** *Done* — the Timeline gains a **Read** layout, which is the
     Manuscript's own reading page (moved into shared pieces, not rewritten, so
     every reading spec still covers it): in reading mode it is the reader's
     book and follows their place. Export, Find & replace and the book's word
     goal are on Page and Read; the chapter's goal is in its panel.
   - **3b** *Done* — `/manuscript`, and the navigation's Manuscript (Read, for
     a reader), land on the Timeline: Page for the author, Read for a reader.
     The Manuscript screen is gone, and with it the reading page's Draft view,
     which Page replaces. The Timeline remembers each world's layout, because a
     reader stepping out of the book has to come back to it; and a reading spot
     is only written once the page is where the spot says, which the move
     exposed.
4. **The name and the routes.** *Done* — one entry in the navigation,
   **Manuscript** (**Book** for a reader), at `/manuscript`; the sixteen source
   files' links moved there, and `/timeline`, with any chapter and query after
   it, redirects. The layout a world was left on is remembered as before; until
   one is chosen, a reader of a book with prose opens it on Read — which the
   navigation's *Read* used to do — and everyone else on Cards. The dashboard's
   *Set where you have read to* asks for Cards, where *Read to here* is. The
   code keeps its `timeline` names (`features/timeline/`, `TimelineView`): the
   rename is what a person sees.
5. **Structure from text.** `##` in the middle of a scene splits it, deleting a
   heading joins it, and `#` starts a chapter — each undoable in one step. This
   lifts step 2's refusals, and brings in the spike's drop-and-restore rules
   for heading ids with them.
6. **The round trip.** Markdown export writes scene titles as `##`, and import
   reads `##` under a `#` as a titled scene, so a book written here and one
   pasted in agree.

Focus mode as the whole document rather than one scene is a candidate after
step 5, not part of this plan.

---

## Already shipped, and listed here by mistake

Two items were carried into this file when the roadmap was split on 23
September, from unchecked boxes at lines 610–612 of the archive. Neither box had
ever been ticked; both features had been in the app for weeks. The split trusted
the checkbox instead of the code, which is the whole of the error, and it is
recorded rather than quietly deleted so the next reader of that archive treats
its `[ ]` marks as claims rather than facts.

- **Global undo** — shipped 29 July 2026 as #137, *Local undo, built on the
  operation journal*. Undo and redo in the top bar, each labelled with what it
  will take back; `Ctrl+Z` and `Ctrl+Shift+Z`, which leave text fields to the
  browser; undo on the delete toast; a Recent Changes panel listing the stack;
  and a phone path, where there is no keyboard. Bulk edits route through
  journalled singles sharing a `groupId` and `undoableBatch` returns the whole
  group, so the roadmap entry's own example — a wrong bulk tag — was covered
  too. Eight e2e tests in `e2e/undo.spec.ts`.
- **Full-text search across prose** — `e2e/searchProse.spec.ts` finds a scene by
  a word that appears only in its draft, previews the line that matched rather
  than the opening of the scene, and does not search prose the reader has not
  reached. The entry's stated worry — that results must respect the spoiler
  cursor — is the thing that spec's last test exists to check.

---

## Considered and not doing

Recorded so they are not proposed again from scratch. Any of them can come back
with a reason; none has one now.

- **Physical description snapshots** — an `appearance` field on every character
  snapshot. It adds a fifth thing to fill in on the most-written table in the
  app, to serve the handful of stories where how someone looks changes as they
  go. Status notes already carry it for those. The proposed companion check —
  nudging when appearance is *never* recorded — would nag every writer who
  reasonably does not want the field.

- **Character-goal contradiction check** — warn when a character acts against a
  declared fear or goal. It needs events tagged with motivations to work, which
  the original entry admits ("may stay manual"). A check that only runs when
  somebody has done bookkeeping first is a check that does not run.

- **Calendar continuity: season mismatches and age-inappropriate actions** —
  same dependency on manual tagging, and the second half misreads fiction. A
  fifteen-year-old commanding an army is a genre, not a continuity error, and a
  checker that says otherwise trains writers to ignore it.

- **Proactive travel-day suggestion** — offering a `travelDays` value in the
  editor before anything is wrong. The reactive path already exists and is the
  better interaction: the checker flags the impossible journey and offers the
  one-click fix. A suggestion on every scene is noise attached to the case that
  is usually fine.

- **Cross-map/floor travel estimates** — skipped today because map layers share
  no metric. That is a modelling problem, not a missing feature, and inventing a
  conversion would put confident wrong numbers inside the continuity checker,
  which is the one component that must not guess.

- **Multi-user collaboration (the rest of #124)** — the valuable near-term
  increment for one author is durability, which is item 1. Multi-user editing
  needs a server or a CRDT, and both cost the no-backend property that makes
  this app what it is.

- **"Push map logic into pure units"** — true, and an engineering preference
  rather than a plan. It happens when the map code is next touched; a standing
  line saying *write more tests* is the kind of roadmap entry nobody ever
  closes.

---

## Before any of this

The last blind writer run is
[`docs/records/writer-run-2026-08-25-blind.md`](docs/records/writer-run-2026-08-25-blind.md),
about fifty pull requests back. Since then the app has gained a name, a tagline,
a reading mode, three books and two different Library layouts.

Everything above is a judgement made from the code and the guide, which is
exactly the evidence that makes a product look better than it is. A fresh writer
run and a reader run at the current tip would either confirm this list or
replace it, and that is worth more than any item on it.
