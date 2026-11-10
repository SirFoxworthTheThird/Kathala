# T5.1–T5.2: the revision written back marked, with the threads

**Plan:** `round-trip-plan-2.md`, T5.1 and T5.2, with decisions D-4, D-5 and D-6 taken as proposed.
**Finding:** E-2 in `editor-run-2026-11-09.md` and the first finding of `editor-run-2026-11-10-loop.md`. Both editors
had to diff the revision by script to see what the writer had done with their edits.

This part is the writing. The dialog that offers it, T5.4, and the file coming back with both people's marks, T5.3,
come next. Nothing a writer can reach in the app sends a marked file yet.

## What the marked file is measured from (D-4)

**The book as the editor sent it back.** On bringing a file in, the import now saves a second draft beside *Before
Ana's changes*: *As Ana sent it back (file)*.
- It holds the scenes the file had, each as the file has it with every change taken (`PlannedScene.edited`,
  `BookDraftRecord.sentBack`).
- A scene the writer adds afterwards is not in it, so it goes back as all new.

## T5.1: the writer's changes as tracked changes (`markedDocx.ts`, `manuscriptExport.ts`)

- **How a scene is marked.** `markedParagraphs(base, current)` aligns the scene's paragraphs. One the same in both is
  unchanged. The rest are paired in order and compared word by word (`diffWords`). One left over on either side is
  put in or taken out whole. Italics are read off each paragraph and carried on every run, so a mark is never
  written as text.
- **How it is written.** `compileDocx` writes the runs as `w:ins` and `w:del`, each with its own id and signed with
  the byline (D-6). Deleted words are `w:delText`.
- **A paragraph taken out** carries its own deleted mark.
- **A paragraph put in after one that is in both** marks the break at the end of that paragraph as inserted, and the
  last new paragraph keeps the break it had, as Word marks a paragraph typed after another.
  - The first form marked the new paragraph's own break.
  - LibreOffice re-saved that as both breaks inserted, and rejecting it then joined two of the editor's paragraphs.
    That was the Tide Court, twice.
- **The test is the reader.** The loop's own book was used: the writer's second draft, marked against the editor's
  round-1 file as he sent it back.
  - Read back by the app's reader, every one of its 13 scenes is the editor's text with every change rejected, and
    the writer's with every one accepted.
  - All changes are signed *Nell Garrow*.

## T5.2: the threads (D-5)

- **What goes back.** Each thread is the editor's comment and the writer's replies, in order, with whether it is
  resolved. It is placed on its words as the writer's text now has them.
- **The shape is Word's,** as T5.0 measured it:
  - every comment has its own range and reference;
  - `comments.xml` carries each comment's last paragraph's `w14:paraId`;
  - `commentsExtended.xml` links a reply to its thread's first comment by `w15:paraIdParent`, with `w15:done` on
    every comment.
- **A thread whose words were rewritten** goes at the start of its scene. It quotes them: *On words since rewritten:
  "…"*.
- **A scene's bookmark comes after the comment marks at its start,** just before its first words. With the marks after
  it at the same point, LibreOffice dropped the bookmark on saving, and the scene was lost to the file coming back.
- A book with no threads writes no comment parts.

## Through LibreOffice (`npm run probe:marked`, the export's own file)

The loop's whole revision was marked against the editor's file, with two of his threads answered and one of them
resolved, then saved through LibreOffice 24.2 and read back.

| | As made | Saved by LibreOffice |
|---|---|---|
| Scenes found | 13 | **13** |
| Rejected is the editor's text | 13 of 13 | **13 of 13** |
| Accepted is the writer's | 13 of 13 | **13 of 13** |
| Bookmarks | 13 whole | **13 whole** |
| Threads, each reply under its comment | 2 | **2** (renumbered, replies first) |
| Done | the resolved thread's two, and only those | **the same** |
| Signed | Nell Garrow | **Nell Garrow** |

The probe found both faults above: the bookmark lost to the comment marks, and the paragraph breaks doubled. Both were
fixed, and the table is after the fixes. Each now has a unit test on the XML, since CI has no LibreOffice.

**The export's checksums are sound.** A bad CRC reported on the way came from a throwaway script reading the same
archive twice. Python's `testzip` finds the export's and both fixtures' entries whole.

## Tests

- **`markedDocx.test.ts`:**
  - **`markedParagraphs`:** unmarked when unchanged; a word replaced; a paragraph put in, and one taken out; a new
    scene; italics.
  - **The XML Word reads**, which the app's reader is kinder than:
    - each paragraph put in or taken out carries its break, in Word's form, and one at a scene's start its own;
    - deleted words are `w:delText` in `w:del`, and every change has its own id;
    - the bookmark comes after the comment marks.
  - **The loop's revision:** 13 scenes, rejected and accepted, signed.
  - **The threads:** read back with replies under them, by author; on their words, or at the scene's start when
    rewritten; done on the resolved thread only; replies linked by paragraph id; no comment parts where there are
    none.
- **`editImport.test.ts`:** the sent-back draft holds the editor's text, every change taken, and the book is untouched.

**On a production build**, the specs that bring a file in and work with what it brings passed: `wordRoundTrip`,
`revisionTasks`, `proseNotes`, `betaReaders` and `closeAnywhere`, 23 tests. The full unit suite passed (3,520 tests).

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All 14 were killed:
- T5.1:
  - no paragraph mark;
  - changes not wrapped;
  - deleted words as `w:t`;
  - no paragraph alignment;
  - italics dropped;
  - the base ignored;
  - the sent-back draft's text wrong.
- T5.2:
  - threads not written;
  - replies unlinked;
  - done never said;
  - a range empty;
  - a rewritten thread not quoted;
  - the break on the new paragraph's own mark;
  - the bookmark before the comment marks.
- Two of them, the missing paragraph mark and deleted words as `w:t`, survived the first tests. They are what the
  app's reader forgives and Word does not, and they were killed by the tests on the XML.

## Not done here

- **A scene the writer deleted since** is not in the marked file. It is not in the book, so the export has nothing to
  write it from. The editor sees it gone only by its absence.
- **Italics changed alone** are not marked as a change: the words are compared, not their formatting
  (`w:rPrChange`).
- **Which threads go back, and from which file,** is chosen by the dialog in T5.4. Here the export takes whatever it
  is given.
