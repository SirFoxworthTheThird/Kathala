# The round trip, part 2: the loop's findings, then the revision back marked

**From:**
- `loop-2026-11-10.md`, the blind rerun of the writer and the editor at 5c46413, and its two reports;
- `round-trip-plan.md` T5, which waited on decision D-2.

**D-2 is taken:** T5 is planned as a part of its own, with a fixture of Word's own reply comments before any code.

Two parts, in this order:
- **T7**, the loop's findings. One of them writes an editor's change into a sentence it was never on, without a word.
  That is worse than anything T5 adds, and it is in the code T5 builds on.
- **T5**, the revision goes back to the editor marked.

The process is the one every T-part followed:
- tests first where a behaviour can be reproduced;
- mutants gated on `tsc && eslint && echo MUTANT-OK && grep`;
- the guide and its screenshots;
- a record, and the touched e2e specs on a production build;
- a PR each, merged on the word.

---

## T7: the loop's findings

Each was found in `writer-run-2026-11-10-loop.md`. The ids are the writer's.

### T7.1: a change is applied only where it was made (R2-1, S5)

**What happened.** The writer had rewritten the sentence that held *"…and then he looked at Edric Vane"*. Accepting
the editor's change on it found another *looked at* in the scene and replaced that one: *she raised his eyes to him*.
No message was shown.

**Why.**
- `applyHunk` (`docxImport.ts`) places a change through `placeNote`.
- `placeNote` counts surroundings that do not match as a cost, never as a reason to refuse. Any exact copy of a short
  passage wins.
- For a note that is the R1 design: a note follows its words. For a change it is wrong. A change is to *those* words,
  where they stood.

**What to do.**
- A change is applied only where its own surroundings are found too. That means its exact words with enough of the
  words before or after, or its words lightly retyped (`fuzzyIn`) in that same place. Anywhere else, it is refused,
  as a change whose words have gone is now (*The scene no longer has these words…*).
- Where its words are there more than once, the surroundings decide. Where they decide nothing, it is refused.
- **What "enough" means is measured, not chosen.**
  - Every change in both runs' files (`docxRunFiles.test.ts`, and the loop's two files added as fixtures) must still
    apply, in either order. That is the floor.
  - The writer's case, and S5's common words (*very*, *looked at*), must be refused once their sentence is rewritten.
    That is the ceiling.
  - The threshold is set between them and written down with the numbers.

**Tests.**
- **Unit:**
  - the loop's case, verbatim;
  - a two-word change in a scene that has the same two words elsewhere;
  - a change whose neighbour was retyped by one word, which still applies.
- **The run files' accept-all, both orders.** This already exists, and has to stay green.

### T7.2: a note does not jump to another chapter on a near-match (R2-3)

- **What happened.** A note whose words the writer had rewritten moved onto a sentence in another chapter that merely
  read alike. It was labelled *Its words have been edited since*.
- **What to do.** In another scene, a note follows only its exact words, which is a passage moved, as R1 intends.
  Retyped words are looked for in its own scene. Otherwise the note is **unplaced**, which R1 already shows and
  explains.
- **Tests.** The loop's note, unplaced; a passage moved to another chapter, followed.
- *As built, T7.1–T7.2 (`t7-1-placement.md`):*
  - A change needs 24 characters of its surroundings beside it. That was measured: at least 32 where each of 326
    changes was made, and at most 21 at any other copy of its words.
  - A note in another scene follows its exact words only.
  - Notes are not held to the context minimum: a split leaves a note's words with none of their surroundings, and R1
    follows them.

### T7.3: a scene header line being typed is not lost (N1, T4's S4)

- **What happened.** A chapter heading was retitled on the Page, and then a name was typed into a scene header's cast
  line. About 1.2 s later, as the retitle saved, the line went back and the name was gone. Reproduced 3 of 3.
- **Why (read afterwards by the writer, to be confirmed).** `DraftBook`'s `sync()` replaces the editor's state with
  `view.setState` when the store changes. It reaches `syncHeaders()`, which protects the line under the caret, only
  after that.
- **Order.**
  1. Reproduce it in e2e, as the writer did.
  2. Find the mechanism.
  3. Fix it, so that a store change never replaces a line the caret is in, or one with unsaved typing.
- `e2e/closeAnywhere.spec.ts`'s rule applies: what is typed is owed, and a reload must find it.

### T7.4: Undo after an Accept undoes the Accept (R2-2)

- **What happened.** Undo straight after an Accept undid an older Find & replace in another chapter.
- **Why.** An Accept writes the prose in `inOneWrite`, with no journal entry, so Undo reached the last thing that had
  one.
- **What to do.** An Accept, a Reject and an Accept-all are each one journalled step, so Undo takes the Accept back
  and restores the change to the list. Check first how Undo restores a deleted suggestion. If it cannot, the Accept
  keeps the suggestion as decided rather than deleting it.

### T7.5: typing before a header's `[` (N2)

- **What happened.** Typing at the start of a scene header's line, before its `[`, turned the whole header into prose.
  It was counted as words, and a fresh header was drawn above it.
- **What to do.** First decide what the writer meant: most likely a new first line of prose. Typing there then goes
  to a new line under the header, which stays a header. Reproduce it in e2e first.

### T7.6: smaller

- **"ch.3" with no space (R2-4).** `CHAPTERS` in `editorialLetter.ts` wants a space after the dot. *ch.3*, *Ch.3*
  and *chs.3–5* are to link. Unit-tested against "ch" inside words.
- **A comment on an unchanged heading (R3-1).** T1.4 stores a heading or title-page line only where its text changed,
  so a comment on an unchanged one is only counted, under *matched no scene*. Both editors put one there.
  - It comes in as an item in *Changes outside the scenes*: the line, the comment and its author, with **Dismiss**.
  - The summary names it as outside the scenes.
  - T1.4's record is corrected where it reads as if this were already so.
- **Two drafts with one name (R2-5).** `sentDraftName` is to the minute. A second draft in the same minute takes
  *(2)*.
- **An italic shown as `*` in Changes (R2-6).** The change's text is shown with its emphasis, as the Page shows it.
- **Measure, don't build: S2.** *"+13,460 words today"* against 13,083 in the book. The same suspicion was raised in
  the first run, and is still unmeasured. Measure what a chapter paste with headers adds to the day's count, and fix
  it only if it is counting header lines.

- *As built, T7.3–T7.6 (`t7-3-page-and-small.md`):*
  - N1 was reproduced first, and was two faults: the line lost on the rebuild, and leaving it no longer applying it
    (`stillTyping`).
  - Undo now carries the suggestion rows an Accept removed (`Operation.rows`), not a new journalled entity.
  - S2 is measured: a paste with headers counts the book's words exactly, so header lines are not the cause. The
    count leaves out deletions and Find & replace. That fits, but is not proven, so it is not built.

**T7 size:** two PRs. T7.1–T7.2 are the matcher. T7.3–T7.6 are the Page and the rest.

---

## T5: the revision goes back marked

**The finding.**
- The editor's costliest finding, in both runs: the revision comes back clean.
- Jonah diffed 14,000 words by script to check Nell's account of what she took and declined. Margit did the same.
- An editor without scripts rereads the book, or runs Word's Compare against a file they must keep themselves.

### T5.0: the fixtures, before any code

**Word's own reply comments.** We cannot run Word here, so the shape is taken from a file Word made.
- **The file.** `tests/testthat/docs_dir/test-docx_comments.docx` from the R package *officer* (MIT). It was saved by
  Microsoft Word 16. It has 16 comments, four of them replies and one a reply to a reply, in five parts:
  `comments.xml`, `commentsExtended.xml`, `commentsIds.xml`, `commentsExtensible.xml` and `people.xml`.
- **Measured already.** Our reader (`readEditedDocx`) threads it correctly: replies 8 and 9 under comment 7, 11 under
  10, 13 under 12. Word flattens a reply to a reply to the thread's root. So the reading half of T5 holds on Word's
  own file.
- **What it shows about writing.** A reply has its own `commentRangeStart`/`End` and its own `commentReference` in the
  document, around the same words as the comment it answers. It is linked in `commentsExtended.xml` by
  `w15:paraIdParent`, the `w14:paraId` of the parent's last paragraph. A resolved thread is `w15:done="1"`.
  `commentsIds.xml` and `commentsExtensible.xml` give durable ids and dates for Word 2019 and later. Neither is needed
  to read a thread.
- **Committed as a fixture with the people taken out.** Its `people.xml` holds a real person's name and sign-in. The
  fixture keeps the structure, with names and ids replaced, and a note of its source and licence.
- **A resolved thread.** The file has none. LibreOffice, which the editors used, writes `w15:done`. A resolved thread
  is made with it and kept beside the Word file, marked as LibreOffice's.

**What LibreOffice does with ours.** A probe like `probe:emphasis`, run by hand because CI has no LibreOffice. It
writes a marked file, opens and saves it headless in LibreOffice, and reads it back:
- the threads;
- the done flags;
- the authors of the tracked changes;
- the scene bookmarks, which T1.6 found LibreOffice can break.

Its results are kept in the record.

- *As built, T5.0 (`t5-0-fixtures.md`):*
  - Word's file is committed with the person's name and sign-in replaced, and the reader threads its replies.
  - Through LibreOffice 24.2, the threads, done flags, the writer's tracked changes and the point bookmarks all
    survive.
  - LibreOffice renumbers the comments, puts each reply first, and writes no flag for an open thread.
  - The marked file, as made and as saved, is kept for T5.3.

### Decisions

*Taken (10 Nov), each as proposed:* D-4, the book as the editor sent it back; D-5, that editor's threads only; D-6, the
byline.

- **D-4: what "my changes" are measured from.**
  - **Recommended: the book as the editor sent it back.** That means the editor's file with all their changes taken.
    - An edit the writer accepted then shows nothing: it landed as made.
    - An edit the writer declined shows as the writer turning it back.
    - The writer's own rewriting shows as the writer's.
    - That is exactly what both editors checked by script.
  - **The alternative, measuring from the file the editor was sent,** shows the editor's own accepted edits back to
    them as the writer's insertions: 48 of them, in the loop's round 2.
  - This needs the editor's text kept at import. Each import saves one more draft, *As Jonah Pryce sent it back
    (file)*, beside the *Before …* draft it saves now. Compare can then use it too.
- **D-5: which comments go back.** The threads from that editor's file, with the writer's replies under them, as
  Word replies. Resolved threads are marked done. The writer's own notes do not go, unless a later part adds *for the
  editor* to a note.
- **D-6: whose name the tracked changes carry.** The byline the export already asks for: *Nell Garrow*. It is the
  name the editor knows. It is also what the import uses to tell the writer's changes from the editor's when the file
  comes back.

### T5.1: writing tracked changes

- **What it is.** `compileDocx` learns to write a paragraph's words as `w:ins` and `w:del` runs, with author and date.
  It also writes an inserted or deleted paragraph mark, as `w:pPr/w:rPr/w:ins` or `w:del`, which T1.1 learnt to
  read.
- **How it is cut.**
  - Paragraphs are aligned first. Then words are diffed within each pair.
  - A run is cut along whole words, as T1.3 reads them, so a replacement is one deletion beside one insertion.
  - Italics stay italics inside a tracked run.
- **Scenes.** A scene added is all inserted. A scene deleted is all deleted, with its bookmark kept so the file still
  places it. A heading changed is tracked like prose.
- **The test is the reader.** For every scene, `readEditedDocx` on the marked file gives the base text with the
  changes rejected and the current text with them accepted. It runs on the loop's own drafts: *Second draft* against
  *As Jonah Pryce sent it back*.

### T5.2: comments and replies

- **What goes out.**
  - Each of the editor's notes from that file, placed in the current text (`placeNote`) and written as a comment
    under its author's name and initials.
  - Each reply as a Word reply: its own range and reference, and `w15:paraIdParent`.
  - A resolved note is `w15:done="1"`.
- **A note that is unplaced** is put at the start of its scene, if the scene is still there, else at its chapter's
  heading. It is quoted in the comment: *On words since rewritten: "…"*.
- **The parts.**
  - `comments.xml` and `commentsExtended.xml` are written, with their relationships and content types, matching
    the fixture's.
  - `commentsIds.xml` too, if the LibreOffice probe and the Word fixture show that one written without it loses
    threading.
  - No `people.xml`: it is optional, and it carries identity.
- **The test.** The marked file read back gives the same threads, the same text, the same authors and the same done
  flags as the notes it was made from.

- *As built, T5.1–T5.2 (`t5-1-marked-export.md`):*
  - Read back by the app's reader, the loop's whole revision marked against the editor's file is his text rejected
    and hers accepted in 13 of 13 scenes. Through LibreOffice it is still 13 of 13, and the threads and done flags
    survive.
  - The probe found two things only LibreOffice shows: a scene bookmark lost beside comment marks, and an inserted
    paragraph's break written twice. Both were fixed, each with a unit test on the XML.
  - A scene deleted since, and italics changed alone, are not marked.

### T5.3: the file coming back with both authors' marks

When the editor returns a marked file, it holds the writer's tracked changes as well as the editor's. The editor may
have accepted the writer's, rejected them, or left them pending.
- **Three readings, not two.** `docxRead` gives, besides *original* and *edited*:
  - ***as sent***: the writer's changes taken, the editor's not. Changes are told apart by author: the byline, D-6.
- **What the editor did to the writer's changes.**
  - Where *as sent* is the draft the file was made from, the editor left the writer's changes alone, or accepted
    them.
  - Where it differs, the editor turned one back. Each such difference comes in as its own kind of change, *Jonah
    turned back your change*, with Accept and Reject, rather than as an edit made with tracking off.
- **The editor's own changes** are found between *as sent* and *edited*, by the T1 machinery, unchanged.
- **Threads.**
  - A thread that went out comes back with the editor's new replies. Those are added under the note that went out,
    matched by its root comment's author and text.
  - Replies already there are not added twice.
  - A thread the editor resolved resolves the note.
  - New root comments are new notes, as now.
- **The test.**
  - The marked file brought back untouched gives no changes and no new notes.
  - A file where the editor accepted one of the writer's changes, rejected one and replied to two threads gives
    exactly those. It is made with `scripts/docx-fixture-edit.py`, as T1's fixtures were.

### T5.4: the dialog, the guide, and closing the loop again

- **The dialog.** *For an editor* gains **Show my changes since Jonah Pryce's file**. It is offered only once a file
  has come back, and it names the file. It says what will be in it: *N changes, M comment threads, signed Nell
  Garrow*.
- **The draft.** The draft saved as it goes out (T2.3) says *Sent marked*.
- **The guide.** *An editor's changes, through Word* gains the way back. It gets a screenshot of the dialog, and one of
  the marked file as LibreOffice shows it.
- **Close the loop again.** The same agents, with one round more than before, in which the editor receives the
  marked revision. What is expected:
  - the editor checks the writer's account without a script;
  - every reply arrives under its comment;
  - the file the editor sends back brings in no change twice.

**T5 size.**
- **T5.0** is a PR of its own: the fixtures, the probe and nothing else.
- **T5.1–T5.2** go together: the writing.
- **T5.3** is its own PR: the reading.
- **T5.4** goes with T5.3, or after it.

---

## Order

| Part | What | Size | Waits on |
|---|---|---|---|
| T7.1–T7.2 | A change applied only where it was made; a note does not jump | 1 PR | — |
| T7.3–T7.6 | The header line kept, Undo after Accept, before the `[`, the small ones, S2 measured | 1 PR | — |
| T5.0 | Word's reply fixture, the LibreOffice probe | 1 PR | D-2 (taken) |
| T5.1–T5.2 | Tracked changes and threads written | 1 PR | D-4, D-5, D-6 |
| T5.3–T5.4 | The marked file read back; the dialog; the guide | 1–2 PRs | T5.1–T5.2 |
| — | Close the loop again, with the extra round | a run | T5 |
