# T9.2–T9.3: the app's line out of the editor's comment, and every comment its own date

**Plan:** `round-trip-plan-3.md`, T9.2 with decision D-8 as taken, and T9.3.
**Findings:** the sixth and seventh of `loop-2026-11-12.md`: the editor's E-4 and E-5, the writer's F5 and part of F7.

T9.4, a heading's comment going back, was planned with these two. It was left for a PR of its own: it changes what
such a comment is in the book and where it is seen, and these two change only what a file holds. It was then built
on the same branch before this was merged, and has its own record: `t9-4-heading-comments.md`.

## T9.2: the line on words since rewritten (D-8)

**What happened.** A thread whose words the writer has rewritten goes at the start of its scene. The export said
which words by writing *On words since rewritten: "…"* into the editor's own comment, before the editor's words and
under the editor's name: on 5 comments in round 2, and 10 in round 3. The editor: *I would rather it didn't look as
though I'd said it.*

**What the export writes now.**
- **The editor's comment is the editor's words**, and nothing else.
- **The line is a reply**, the first under that thread, signed with the writer's byline and initials, and dated as
  the file is made.
- A thread whose words are still there has no such line.

**Coming back** (`useEditImport.ts`).
- The line is known for the app's by its opening words, where it is signed by the writer who marked the file. It
  is never made one of the writer's replies in Notes.
- So it is not doubled: sent a second time, it is there once, made afresh.
- **A file sent before this change still reads.** Its line is taken off the front of the editor's comment, as T5.3
  did it, so the thread is matched to its note.

**Two things put right on the way:**
- **A new note took the line with it.** A thread that came back with no note to match was made a note with the
  line still in front of the editor's words. It is made with the editor's words alone.
- **Replies under a new note were all signed as the editor's**, the writer's own among them. Each is now by
  whoever wrote it.

## T9.3: every comment its own date

**What happened.** The export wrote its own time on every comment, the editor's included. A comment from round 1
carried three dates by the end. Neither side could tell from the file which pass a comment belonged to.

**What is kept, and written.**
- **Bringing in** reads each comment's date and each reply's (`w:date`). A note made from a comment is dated when
  the comment was made, and each reply when it was made.
- **The export** writes each comment's own date. The writer's replies carry the time they were typed in Notes.
- **Only two things carry the export's time:** the writer's tracked changes, and the line of T9.2.

**The figures go back as they came** (`commentTime`, `commentDate`).
- Word writes the clock where a comment was made and calls it UTC. Those figures are kept, to the second, and
  written back the same: *2026-11-08T10:00:00Z* in, *2026-11-08T10:00:00Z* out.
- A date with no zone is read the same way, so its figures are kept too.
- A date with a zone is the moment it names.
- **A date that does not read is now.** LibreOffice writes *0-00-00T00:00:00Z* for a comment given no date, as R4's
  own fixture has it. Such a note is dated as it came in, as every note was before.

## Tests

- **`markedDocx.test.ts`:**
  - **The line:** known for the app's; an older file's comment read without it; none on a thread whose words are
    there; once, signed with the writer's name and initials, where they are gone; the editor's comment written as
    its own words alone.
  - **The threads, as before, in their new shape:** the line as the first reply; three comments on no words at
    the scene's start; the resolved thread's three all done, each reply linked to the thread's first.
  - **Dates:** each comment carries its own, one with none the export's, and every tracked change the export's;
    the figures in and out; the plan gives the note's date and each reply's.
- **`docxReplies.test.ts`:** Word's own file gives every comment a date.
- **`editImport.test.ts`:**
  - **Dates:** a reply is dated as the file says, and a new comment's note the same; the fixture's unreadable date
    is now.
  - **The line, there and back:** the words rewritten; the file holds the editor's comment as made and the line
    under it as the writer's; brought back as it went, no new note, and the line no reply; sent again, once.
- **`wordRoundTrip.spec.ts`**, in the app: the editor's comment goes back dated *2026-11-08T10:00:00Z*, as the
  editor's file had it.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All 12 were killed:
- the line: not said at all; signed by the editor; made a reply coming back; an older file not read without it;
- dates: every comment the export's time, by the unit tests and again by the e2e; the plan giving now; a reply
  given its note's date; not read from the file; a new note dated now; a reply dated now; written to the
  millisecond.

One did not build at first and was redone.

**One was not run, because here it would prove nothing.** A date with no zone read as local time is the same as
reading it as UTC wherever the tests run on a UTC clock, as they do. The test of it holds only on another clock.

## Not done here

- **Comments already in a book** keep the date they were brought in. Only a comment brought in from now on has
  its own.
- **The line is told by its opening words.** A reply the writer typed by hand beginning *On words since rewritten:*
  would be taken for the app's and not kept.
- **A comment on a heading** did not go back as of these two parts. T9.4 does that.
