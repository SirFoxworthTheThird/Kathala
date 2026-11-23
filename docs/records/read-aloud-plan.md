# Read the prose aloud: the plan (issue #704)

**Asked:** read the prose aloud from Read, highlighting each sentence as it is spoken, so a writer can hear rhythm,
missing words and dialogue. The browser's own speech is used, and nothing leaves the device.

## Measured

On the Library (`/home/user/kathala-library/library/*.pwk`) with `scripts/readaloud-probe.ts`. It reads each scene as
the prose pass does: `plainScene` for the text a reader sees, then its `sentences`.

- **Sentences.** 51 books with prose and 5,263 scenes give 273,079 sentences.
- **Sentence length.**
  - The median sentence is 74 characters, the 90th percentile 206 and the 99th 404.
  - 2,826 sentences run over 400 characters, and 63 over 1,000.
  - The longest is 2,764 characters, in *Moby-Dick*'s chapter on whiteness.
- **Sentences with no letter in them: 1,613.** They are dividers inside the prose (`* * * * *`, `*       *`) and lone
  dashes. A voice reads them as "asterisk asterisk asterisk".
- **Markup left in the text a reader sees.** `plainScene` takes paired italics underscores away, but not every
  underscore.
  - 24 sentences keep a `_`. Italics inside a word stay as written (`_Un_important`, *Alice*), and so does an opening
    with no partner (*Dracula*'s letters).
  - 124 keep a `*`, nearly all of them in dividers.
- **Brackets: 311 sentences.**
  - Some are footnote markers: `[1]` and the like occur 138 times in seven books. *Kidnapped* has 72, *The Count of
    Monte Cristo* 30 and *The Phantom of the Opera* 26.
  - Some are an editor's words, which are prose and are read: "the wild calots [dogs]" (*A Princess of Mars*),
    "[later editions continued as follows" (*Alice*).
- **No scene keeps a header line or a note marker in its text.**
  - The scene header is the Page's, and is not in the text that Read shows.
  - Notes are anchored by quotation (`noteAnchor.ts`), not marked in the prose.
- **The speech API can offer online voices.** Each voice says whether it is `localService`. One that is not sends its
  text to a service to be spoken, and online services are out of scope (see the issue).
- **Read already follows the reader.** In reading mode, a scene counts as reached when its top passes the upper quarter
  of the view (`cursorForScene`, `e2e/readingFollows.spec.ts`).

## Decisions

- **D-1: a reader can listen too.**
  - In reading mode, **Read aloud** is in the reader's row.
  - Listening moves the reader's place as reading does. The spoken sentence is kept in view, and the scene it is in
    counts as reached by the same rule as a scene scrolled to, which never goes backwards. Nothing new writes the place.
  - Speech starts at the scene on screen, so it never starts past what the reader has in front of them.
- **D-2: local voices only.**
  - Only voices whose `localService` is true are offered.
  - Where there are none, the control is disabled and says why: no voice on this device, or only online voices, which
    would send the prose away.
  - Where speech is missing altogether, the control is also disabled and says why.
- **D-3: what is spoken is the reader's text, cleaned for speech** (`src/lib/readAloud.ts`, pure).
  - **Headings:** each chapter is announced as *Chapter 4. The Lizard on the Wall.*
  - **Breaks:** a scene break is a pause, and so is a sentence with no letters, like a divider.
  - **Markup:** `_` and `*` are taken out wherever they are left, and footnote markers `[1]`, `[*]`, `[†]` go too.
  - **Editorial brackets** are read.
  - **Whitespace,** verse line ends included, is one space.
- **D-4: a long sentence is spoken in parts, and highlighted whole.**
  - Over 300 characters, a sentence is split at clause punctuation (`;`, `:`, `—`, then `,`), each part one utterance.
  - The highlight stays on the sentence, and *next* and *previous* go by sentences.
- **D-5: pausing stops at the sentence.** Resuming speaks that sentence again from its start, so the listener hears it
  whole.
- **D-6: the highlight is the browser's** (CSS Custom Highlight API).
  - The sentence is marked with a `Range` over the text on the page, so the page's markup is not changed, and the
    prose pass's and spoiler pass's marks stay as they are.
  - The page scrolls to keep the sentence in view.
  - Where the API is missing, the sentence is still scrolled to.
- **D-7: the controls.**
  - **Read aloud** sits beside *Prose pass* for a writer, and in the reader's row in reading mode.
  - Pressing it starts speech from a sentence selected in the book, or else from the scene on screen. Starting is always
    a deliberate press.
  - A bar above the book holds *Previous*, *Pause*/*Resume*, *Next*, *Stop*, the voice and the speed.
  - Space pauses and resumes while it reads, unless the focus is in a field, and does not scroll the page.
  - Leaving Read, or the page going away, stops the speech.
- **D-8: the voice and the speed are kept per device** in `localStorage`, read and written inside `try`, so a refused
  write never breaks the page.
- **D-9: the speech does not fight a screen reader.** No live region speaks each sentence. The bar's controls are named,
  and its status changes only on start, pause and stop.

## Parts

1. **Logic** (`src/lib/readAloud.ts`):
   - the queue of headings, sentences and pauses;
   - the text spoken;
   - the parts of a long sentence;
   - where to start.

   Unit tests cover each. The sentence counts are kept for the four fixture books in `src/test/fixtures/worlds`.
2. **The player** (`src/features/manuscript/ReadAloud.tsx`):
   - the speech;
   - voices and speed;
   - the highlight and scrolling;
   - Space;
   - stopping on leaving.

   Then the controls on Read for a writer and a reader.
3. **Checks:**
   - an e2e with `speechSynthesis` replaced by a recorder: the utterances, the highlight moving, pause, next, previous,
     stop, leaving the screen, a reader's place, and the disabled reason;
   - mutants;
   - the GUIDE's *Reading the book* section, with a screenshot;
   - a record;
   - the full suites;
   - a PR.
