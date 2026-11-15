# T17: whose name and which date

**Plan:** `round-trip-plan-4.md`, T17.1 (D-12) and T17.2 (D-13).
**Findings:** the fifth and sixth of `loop-2026-11-14.md`; the editor's F-3 and F-4, the writer's W3-5.

## What happened

- **The app's line.** The eight lines *On words since rewritten* in the third loop's round 2 were signed Tamsin Hale,
  who did not write them. They were dated with the export, so each was listed first in its thread, ahead of replies
  made earlier, and the next export dated it again though nobody had touched it. The editor: *"in Word they look like
  your words."*
- **The changes' dates.** All 203 marks of round 2 were dated 19:18:35, the moment of the export; all 43 of round 3,
  19:47:15. The writer's replies kept their own dates.

## Why

- D-8 made the line a reply of the writer's, so that it would not sit under the editor's name. The line had no date of
  its own and took the file's.
- `markedPlan` gave the whole file one date, and `compileDocx` signed every change with it.

## Now

**The app's line is the app's (D-12):**
- it is signed **Kathala**, initial *K* (`APP_SIGNER`, `markedDocx.ts`). Word and LibreOffice list it as another
  reviewer, which it is;
- it carries **the date of the comment it is under**. So it always stands first under that comment, before the
  writer's replies, and every export gives it the same date;
- the heading line, *On the chapter's heading: "…"*, which a file without headings sends at the scene's start, is
  signed and dated the same way.

**When it comes back**, the line is still never one of the writer's replies (`useEditImport.ts`). The import knows it
by its words, signed Kathala, or signed by the writer in a file made before this part.

**A change is dated when its scene was last written (D-13):**
- **a scene's changes** take its prose's `updatedAt`, to the second, as Word writes a date. Every change in a scene
  shares it. `buildManuscript` carries it on each scene (`writtenAt`);
- **a scene break put in or taken out before a scene**, a split's or a join's, takes that scene's date;
- **a chapter's heading** put in, taken out or renamed takes the chapter's `updatedAt`. Where the manuscript has none,
  it takes its first scene's date;
- **the export's moment** is left only where nothing says when: the title page's word count, which is counted then,
  and a scene with no prose record.

An edit of the editor's that the writer declined is dated the same way: when the scene was last written. That can be
before the editor's file came back, where the writer took none of that scene's changes and wrote nothing since. It is
true: the words are the writer's from then.

## Tests

- **`markedDates.test.ts`:**
  - each scene's changes, the break before a split's second half, a renamed chapter's heading, and a scene added to,
    each dated when its scene or chapter was last written;
  - the export's moment where nothing says when, and a heading with no chapter date taking its first scene's date;
  - `buildManuscript` carries both dates;
  - the app's line under the editor's comment, signed Kathala, *K*, with the comment's date, and the writer's reply
    after it with its own date;
  - the comments the same when exported a week apart.
- **`markedDocx.test.ts`, `editImport.test.ts`, `headingComments.test.ts`:** the line's signature and date, as they
  were tested before, now the app's. One case added: a file made before this part, its line signed by the writer,
  brought in again, the line no reply.
- **`wordRoundTrip.spec.ts`**, in the app: the writer's change in the marked file dated when her scene was last
  written, read from the store.

**Mutants**, in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. 14, all killed, 1 by the e2e:
- **the dates (6):** the scene's date not used (and again by the e2e); a scene not dated; a heading by its first scene
  only; a heading with no chapter date given the export's; a date to the millisecond, as the export's was;
- **the manuscript (2):** when a scene was written not carried; when a chapter changed not carried;
- **the line (4):** signed by the writer; with the writer's initials; dated with the export; under another name;
- **coming back (2):** the app's line taken for a reply; an older file's line, signed by the writer, taken for one.

One did not build as first written, leaving `commentDate` unused. It was redone and killed.

## Not done here

- **A change is not dated on its own.** Every change in a scene carries the scene's last save, as D-13 chose. The
  scene's history is grouped by session, so a date for each change would be a guess, and would cost a reading of every
  version.
- **Word itself was not run.** Word and LibreOffice both read `w:author` and `w:date` on a comment and a change.
