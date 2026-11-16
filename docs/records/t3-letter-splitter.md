# T3: an editorial letter into tasks

**Plan:** `round-trip-plan.md`, T3.
**Finding:** LT-1 in `writer-run-2026-11-09-blind-editor.md`.

## What was wrong

Pasting the editor's two letters into **Paste an editorial letter…** gave 81 and 30 points. The writer unticked 39
and 16 of them by hand. Of what went wrong, this part was mechanical:

- **Numbered headings were taken for points.** "1. THE CLOCK" to "9. PROSE" matched the numbered-point marker.
  Every task under them was then filed under the last heading the splitter had recognised, *WHAT'S WORKING*.
- **Questions in capitals were taken for points.** "DOES THE CLOCK HOLD?" failed the rule that a heading has no
  stop.
- **The greeting was ticked.** It was looked for only as the first piece, and both letters opened with a title line.
- **The sign-off was ticked.** The sign-off list had "Best wishes" but not "With best wishes". The signature
  "Margit", short and with no stop, was taken for a heading, which also stopped the search.
- **A sentence introducing bullets swallowed the section.** *The storm is where it feels rushed…:* became a heading,
  and every paragraph after its three bullets stayed filed under it until the next heading.
- **One checkbox had no name**, the writer reported, on a point built from the letter's indented clock table.
- **There was no way to make a point a heading.**

## What was done (`editorialLetter.ts`, `LetterDialog.tsx`)

- **A numbered heading.** A numbered line is a heading when its words read as one — short, not a sentence — with a
  blank line after it and prose, not another point, after that. "1. Pacing" over "2. Rename Tom" is still two
  points.
- **A question in capitals** is a heading. One in ordinary case is still a point to answer.
- **The greeting** is looked for among the first four pieces, headings included. It, and everything above it — a
  title, a date, who the letter is from and to, a title short enough to look like a heading — are unticked.
- **The sign-off** may start with "With". It is looked for among the last five pieces. It, and the short lines under
  it — the name, a second name, what they are — are unticked and are not headings.
- **A sentence that introduces bullets** (`intro`) heads those bullets only (`marker`). `lettersTasks` gives the
  pieces after them back to the section's heading.
- **Make a heading** (`makeHeading`) on a point of up to 80 characters makes it a heading over the points after it.
  **Not a heading** already did the reverse.
- **Every checkbox is named** `Keep: ` and its point's first ten words. The point's whole text was the name before,
  which is too much to hear for a long point. Whatever left the writer's checkbox unnamed, the e2e test now requires
  that every checkbox has a name.

## Measured, on the editor's letters

| | Before | After |
|---|---|---|
| Letter 1: headings | *WHAT'S WORKING*, the storm sentence, "Margit" | **the editor's 11**, *WHAT'S WORKING* to *WHAT I'D DO NEXT*, plus the storm sentence over its 3 bullets only |
| Letter 1: unticked without a click | 0 | **5**: the title, the greeting, the sign-off, "Margit", the signature |
| Letter 1: points kept | 81 of 81 | **68 of 73** |
| Letter 2: headings | none of the 7 | **all 7**, including the four questions |
| Letter 2: unticked without a click | 0 | **4** |
| *The coda is lovely…* filed under | the storm sentence | *THE ENDING* |

**The plan's target was overstated.** It asked for 42 and 14 points kept with no unticking, which were the writer's
own final counts. The rest of the writer's unticking was judgement, not mechanics: the praise under *WHAT'S
WORKING*, the answers to the writer's own questions, a paragraph explaining the next one. The splitter makes no
judgement about what a letter means, by design (R5). What it cuts is now cut where the letter is visibly cut.

## Tests

- **`editorialLetter.test.ts`:**
  - both of the run's letters: their section headings, exactly; what is unticked, exactly; *The coda* back under
    *THE ENDING*, while the storm's bullets stay under its sentence;
  - each rule against its counter-case: a numbered heading against numbered points; a capital question against an
    ordinary one; a greeting under a title against "Dear me" further down; a "With" sign-off and a two-line
    signature against a thank-you inside the letter;
  - `makeHeading`.
- **`e2e/revisionTasks.spec.ts`:** the editor's letter 1 pasted in:
  - its headings shown;
  - its greeting, sign-off and title unticked, and a point ticked;
  - *68 tasks to add, of 73 points*;
  - all 73 checkboxes named;
  - **Make a heading** on a point turns it into a heading, with the count following.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All nine were killed:
- numbered lines never headings;
- capital questions not headings;
- the greeting looked for first only;
- no "With" sign-off;
- the sign-off looked for last only;
- an introducing sentence unbounded;
- `makeHeading` doing nothing;
- checkboxes unnamed (e2e);
- the **Make a heading** button inert (e2e).

## Not done here

- **The same task from two letters** — "the ship italics", from both — is not linked. Linking a new letter's points
  to old tasks is a feature of its own.
