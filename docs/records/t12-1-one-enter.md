# T12.1: one Enter

**Plan:** `round-trip-plan-3.md`, T12.1, with decision D-11 as taken.
**Findings:** the fourteenth of `loop-2026-11-12.md`, the writer's F2.

## What happened

The writer typed *The lamp-room* on the Page, pressing Enter once between its twelve paragraphs.
- The Page showed twelve paragraphs.
- Read ran them into one block.
- The Word file held one paragraph with eleven line breaks in it.

The guide said both that a single Enter is not a paragraph and that *the book and every export read your prose the
same way*. Read and Word did not. It cost the writer a scene, found by luck before sending.

## D-11: a single Enter stays a line

**Word reads it as Read does.** `paragraphBlocks` now gives a prose paragraph as one line: each single line end in
it, with the spaces either side, one space (`oneLine`). Verse keeps its lines, as it did. Every reading built on it
changes together:
- the Word file, its clean copy and a submission;
- the marked file, measured against the editor's text;
- EPUB and the HTML export, which already ran the lines together on screen and now do in their text too;
- Read and the prose checks.

Markdown and plain text keep the lines as typed, as those formats do.

**Bringing a file back** compares it with the scene as it went out, read the same way (`rendered`, on
`paragraphBlocks`). A file brought back unchanged is nothing to decide, though the scene has line ends where the
file has spaces. A change from the file is placed in a scene that still has its line ends: placing reads a line end
as a space (`fold`, one character for one, so places in it are places in the prose). An edit across a joined line
end is made, and the scene keeps its other line ends.

**The Page marks it.** A faint **↵** at the end of each line that ends in a single Enter inside a prose paragraph,
where it will be joined (`lineEndMarks`, on `loneLineEnds`, the same rule as `oneLine`). Not between paragraphs, at a
paragraph's ends, or in verse.

**Not in a header being typed.** A scene's first lines opening with `[` are prose until the page reads them as a
header, and a header that names a place the world has not got waits unread. Its line ends are not one Enter in prose:
nothing is marked or said up to its `]` line, and the prose under it is marked as any other. The full e2e run found
this. Before it, typing a header by hand marked its lines, and the marks were in the header's text as the page read
it back.

**The first one says why.** The first time the writer's input puts words after a single Enter, a note above the
page says it:
> One Enter starts a new line, not a new paragraph. Read, Word and every export join the line to the one before it;
> the ↵ marks show where. Press Enter twice, leaving a blank line, for a new paragraph.

- **When it is said:** when words follow the line end, not at the Enter, since a line end with nothing after it yet
  is a paragraph's end. A paste of hard-wrapped lines says it as typing does.
- **How long it stays:** until **Got it**, which gives the caret back to the page where it was. The page's own
  status line clears on the next keystroke, which would have taken it away before it was read.
- **Once per device**, in the browser's storage, else once per visit.

## Measured

- **The run's scene**, as typed: its repaired text in the run's `.pwk`, the blank lines between its twelve
  paragraphs taken back to single line ends. That is eleven, the eleven `<w:br/>` of the writer's report. In Word it
  is now one paragraph with no line break, word for word Read's.
- **The four files of the first loop** (`docxRunFiles.test.ts`): every change is still made where it was, in either
  order, and none with its sentence rewritten. One more of them has another copy of its words in the scene: *It was
  the oldest honest thing in the city.*, also in the scene before a line end. It counted 97 such changes and now
  counts 98, none taken for them.

## Tests

- **`oneEnter.test.ts`:**
  - the run's scene in Word: one paragraph, no line break, Read's text;
  - spaces either side of a line end are one space, and a blank line is still a paragraph;
  - verse in Word keeps its lines, two breaks for three lines;
  - the file brought back unchanged: no changes;
  - an edit across a joined line end: made, and the scene keeps its twelve lines;
  - a change placed across a line end on one side, and on both;
  - `loneLineEnds`: one inside a paragraph, none between paragraphs, at its ends or in verse; the run's eleven;
    spaces and blank lines of spaces; prose that starts with a line end.
- **`docxRunFiles.test.ts`:** the count above, 98, with why.
- **`pageOneEnter.spec.ts`**, on the Page:
  - **two Enters:** a paragraph, no mark and nothing said;
  - **one Enter:** nothing said until words follow it, then the line end is marked, at the end of the line it joins
    and not the next, and the note says why;
  - **the mark** is not in the prose;
  - **said once:** **Got it**, and typing goes on where it was; another single Enter is marked and not said, then or
    after a reload;
  - **verse**, indented, is not marked;
  - **a header typed by hand**, line by line, is neither marked nor said, open or closed; the prose under it, with
    one Enter, is.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. 11 on code that is still there, all killed, 6 of
them by the e2e:
- **Word and placing (3):** the lines not joined; the spaces either side kept; a line end not read as a space when
  placing;
- **the marks (2):** verse marked; a mark placed from the paragraph's words rather than the text;
- **the Page (6):** no marks; never said; said every time; not remembered; the caret not given back; a header being
  typed marked.

One more survived, and its code came out: the marks drawn again on the page's own changes of state, added with the
header rule. Once a header being typed is not marked, the page taking its lines out of the prose is an edit, which
draws them anyway.

Two did not build as first written: each took out a line and left a name unused. They were redone, as the marks
emptied and the note remembered under another key, and killed.

## Four specs put right

The full run failed four specs that T12.1 does not touch: `creationFlows` (two), `deleteConfirms` and
`hoverRevealSafety`, each adding a plot thread on the dashboard by `getByRole('button', { name: 'Add' })`. The
dashboard's Revisions has had an **Add** of its own since R5 (#652), so the name matched two buttons. Each now reaches
the thread's own **Add** through the name field beside it.

## Not done here

- **Enter types a paragraph on the Page**, and Shift+Enter a line, as other prose editors do. Not taken (D-11): it
  changes typing in verse and after a header line, and would have to be tried on both.
- **The scene card's box** still counts paragraphs under it and has no mark: it is a plain text box.
- **Word itself was not run.** LibreOffice was not run for this part either: the files have no new part, only fewer
  line breaks.
