# Read the prose aloud (issue #704)

**Asked:** read the prose aloud from Read, highlighting each sentence as it is spoken, so a writer can hear rhythm,
missing words and dialogue. The measurements and decisions are in `read-aloud-plan.md`, D-1 to D-9.

**Code:**
- `src/lib/readAloud.ts` (pure):
  - the book as headings, sentences and pauses, on the page's own paragraph offsets;
  - the text spoken;
  - a long sentence in parts;
  - where to start, and the next and previous.
- `src/features/manuscript/ReadAloud.tsx`:
  - `useSpeech`, the browser's speech and its local voices, with why it cannot read;
  - `ReadAloudButton`;
  - `ReadAloudBar`, which speaks, marks the page and keeps it in view, and handles Space and stopping.
- `ManuscriptBook.tsx` puts the bar above the book, inside the page that scrolls.
- `TimelineView.tsx`:
  - adds the button beside *Prose pass*, and in the reader's row;
  - turns it off off Read.
- `index.css` styles the highlight (`::highlight(read-aloud)`).
- `scripts/readaloud-probe.ts`: the measure on the Library, run with `npx vitest run --config vitest.probe.config.ts scripts/readaloud-probe.ts`.

## What it does

- **Starting** (D-7).
  - *Read aloud* starts at a sentence selected in the book, or else at the scene on screen. Where that is its chapter's
    first scene, it starts at the chapter's heading.
  - It starts only when pressed.
- **The bar.**
  - It has *Previous* and *Next* sentence, *Pause* and *Resume*, *Stop*, *Sentence n of m*, the voice and the speed.
  - Space pauses and resumes, and does not scroll. In a field, Space is left to the field.
  - Resuming starts the sentence again (D-5).
- **What is spoken** (D-3):
  - each chapter announced as *Chapter 4. The Lizard on the Wall.*;
  - a pause at a scene break, and a shorter one at a divider;
  - no `_`, `*` or footnote markers, though an editor's words in brackets are read;
  - one space for any run of space, verse line ends included;
  - a sentence over 300 characters spoken in parts at clause punctuation, and marked whole (D-4).
- **On the page** (D-6). The sentence is marked with the browser's highlight, which leaves the page's markup and the
  passes' underlines alone, and is kept in view.
- **Voices** (D-2).
  - Only local voices are offered.
  - The button is greyed and says why when the browser cannot read aloud, when it offers only online voices, or when it
    has no voices.
  - While the browser is still saying which voices it has, the button says so.
- **Kept per device** (D-8): the voice and the speed.
- **Stopping.** It stops when *Stop* is pressed, at the end of the book, on going to Page, and on leaving Read. Coming
  back to Read does not start it again.
- **A reader** (D-1).
  - In reading mode, *Read aloud* is in the reader's row.
  - Since the sentence being spoken is kept in view, the reader's place follows the voice by the rule it already
    follows the eye by, and is never past the scene being spoken.

## Found on the way

- **The Library's dividers are not all markup.** Most are asterisks, which leave nothing once markup is taken out. A
  divider of dashes leaves dashes, which are not markup either. So a sentence is a pause when it has no letters or
  digits in it, not only when it is empty. A unit test holds the dashes.
- **Pressing Space on the page's body scrolls nothing in this layout**, so a first version of the e2e would have passed
  with the Space handler not stopping the scroll. The e2e now clicks into the book first, which is where Space would
  scroll, and a mutant that lets it through is killed.
- **Coming back to Read after Page would have started the voice again unasked.** *Read aloud* was still on, and the bar
  was mounted again with the book. Leaving Read now turns it off, and the e2e goes to Page and back.
- **A change of hash is not a new document**, so the screenshot's stand-in voice, an init script, did not exist until
  the page was reloaded.
- **The plan's guess at where the footnote markers were was wrong.** It said *Monte Cristo*, and they are in seven
  books, *Kidnapped* most of all. It was measured before the plan was committed.

## Tests

- `src/lib/__tests__/readAloud.test.ts`, 14:
  - ***The Prisoner of Zenda*** and ***Jekyll and Hyde*** (the repository's fixtures):
    - 22 and 10 headings;
    - 4,004 and 1,180 sentences, the Library probe's counts less the dividers;
    - 33 scene breaks and 2 dividers in *Zenda*;
    - no markup, no doubled space and no part over 300 characters in what *Jekyll and Hyde* says;
    - every sentence of both found at its offsets in its paragraph as Read draws it.
  - **What is spoken:** markup, footnote markers and editorial brackets; a divider of asterisks and one of dashes; a
    scene break; a chapter announced, and one with nothing written not; a heading's full stop; a verse sentence's place
    and voice.
  - **Long sentences:** one part, a semicolon before a comma, a comma before a space, and never a scrap.
  - **Moving:** the start at a heading, at a later scene and at a selection; next and previous over pauses, and at the
    ends.
- `e2e/readAloud.spec.ts`, 5, with the browser's speech replaced by a recorder in the page:
  - **a writer:**
    - the heading, then sentences, markup gone and marked on the page, a footnote marker on the page and not in the
      voice;
    - only local voices;
    - pause, then Space to resume from the sentence's start, the book not scrolled, and Space again to pause;
    - next and previous;
    - the scene break and a new chapter;
    - stop, with nothing said after;
    - Page and back, not starting again;
    - leaving Read;
  - **a selection, the voice and the speed:** starting at a selected sentence; the voice and speed applied, and there
    after a reload; the bar gone at the end of the book;
  - **where it cannot read:** online voices only, and no speech at all, each greyed with its reason;
  - **a reader**, on *Jekyll and Hyde*: the place checked against the scene being spoken as the voice goes, never
    past it, and moved on by two scenes.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed.

- **18 against the unit tests:** 18 killed.
  - Asterisks, underscores and footnote markers left in the voice, and an editor's brackets taken out.
  - Line ends kept, and a divider spoken where it is not empty.
  - No heading, and no break after the second scene.
  - The paragraph before taken, and offsets from the scene's start.
  - Never split, a comma before a semicolon, scraps, and a heading with no full stop.
  - The start at any paragraph, the start not at the heading, next into a pause, and previous before the start.
- **18 against `e2e/readAloud.spec.ts`:** 18 killed.
  - Online voices offered and not said, and the button never greyed.
  - Speech going on, and the mark staying, after leaving.
  - No mark, and the mark not kept in view. The reader's place does not follow without the scroll.
  - Space scrolling, and Space not heard.
  - Resuming at the next sentence, and pausing without stopping the speech.
  - The voice not given or not kept, and the speed not kept or not applied.
  - A selection ignored, the bar staying at the end, and Read aloud starting again on coming back to Read.
- Three gaps were found and closed before the run, all in the e2e:
  - Space on the body;
  - Page and back;
  - the end of the book.

  So was one gap in the unit tests: the divider of dashes.

## Checks at the commit shipped

To follow, once the full suite has run.
