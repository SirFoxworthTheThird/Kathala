# T12.2–T12.4: someone quoted, the book's tools on Cards, and the smaller ones

**Plan:** `round-trip-plan-3.md`, T12.2 to T12.4.
**Findings:** the fifteenth of `loop-2026-11-12.md`; the writer's F8, F9 and the smaller ones of
`writer-run-2026-11-10-loop2.md`.

## T12.2: someone only quoted is not offered as speaking

**What happened.** The Page offered *Speaking here, not in the header: @@Pell* for "The tide-book". Pell is not in
that scene. Tamsin and Mallory talk about him:
> "There was a heron on the bow. A bad one. Pell said it looked like his aunt."
> "Pell says everything looks like his aunt. …"

**The plan's rule, measured first:** a word of speech counts for a name only with a quotation mark beside it. Then
another: the name must not be inside a quotation. Each was measured with D1's probe (`npm run probe:suggest`) on the
Library's books against their curators' headers, tuned books and held-out books apart, and on the six writer runs'
books. The figures are for a whole suggested line, as one key accepts it, given as precision / recall:

| Rule | Tuned | Held out | Writers' books |
|---|---|---|---|
| As it was | 80% / 27% | 74% / 20% | 90% / 69% |
| A quotation in the same sentence | 82% / 22% | 77% / 16% | 92% / 58% |
| A quotation within 24 characters of the name | 81% / 25% | 79% / 19% | 96% / 62% |
| A quotation within 40 | 81% / 26% | 78% / 19% | 92% / 61% |
| A quotation within 80 | 80% / 26% | 78% / 19% | 91% / 63% |
| **The name outside any quotation** | **83% / 25%** | **80% / 18%** | **98% / 67%** |
| Outside a quotation, and one within 24 | 84% / 23% | 81% / 17% | 100% / 58% |

**Kept: the name outside any quotation** (`insideQuotes`, in `headerSuggest.ts`).
- **On the tuned books** it is the most precise rule with the recall of the best, so it is chosen there.
- **Held out**, precision rises six points for two of recall.
- **On the writers' books** it is right 55 times in 56, and finds 67% of what they put in their headers.
- **The plan's rule** helped, but less, and cost more recall.
- **Both together** removed suggestions that were right 76% of the time on the tuned books, below the 83% left: to
  add the second rule would take away more right than wrong.

**The run's case:** *Pell said it looked like his aunt* is inside Tamsin's speech, which closes at the end of the
line. Pell is offered for none of the three scenes he was offered for before.

**How a quotation is read:** in its paragraph, by its double quotation marks. Straight ones are taken in turn, and
curly ones by the way they face. Single ones are not read: they are apostrophes as often as quotes.

## T12.3: the book's tools on Cards

**What happened.** Export, Drafts, Find & replace and Bring in edits were offered on Page and Read only (F9). The
writer, on Cards, went looking for them.

**Now** they are offered wherever the book is in its own order, Cards included, with Bring in a reader's notes,
which sits with them. They are done to the book, not to a view of it. In chronological order, which is not the book,
none of them is offered, as before.

**Cards stays cheap.** The book is compiled for Read and Page, and not on Cards, since on a long book the compile is
the one step that costs anything. On Cards it is compiled only while Export, which needs it, is open. Find & replace
and Drafts need only the world. The tools are enabled on Cards by whether the world has prose, which Cards already
knew.

The word goal and the book's word count stay with Page and Read.

## T12.4: smaller

### The end of a scene

**What happened.** To add a scene after "Behind the chart", the writer went to the scene after and pressed ↑ twelve
times: the binder opens a scene with the caret at its start.

**What exists, checked first.** **Ctrl+Enter** on the Page adds a scene after the one the caret is in, from anywhere
in its prose: its line is made at the scene's end. It was named among the Page's key hints, under the page. The
binder, where the writer started, said only its list's own keys.

**Now the binder says it too**, under its list: *In a scene's prose: Ctrl+Enter adds a scene after it, from anywhere
in it; Ctrl+Alt+↑ ↓ goes to the scene before or after*. On a Mac, ⌘ and ⌥, as the Page names them.

### The setup guide's words

- **Step 3 asks when, and says so.** It was *Place them in the story*, under *Where does their story begin?*, and
  asked only for a moment. The cast list then said *Whereabouts not recorded*. It is now *When we meet them*, under
  *When do we first meet them?*, and says where they are is the writer's to say in that scene.
- **Step 4 says it once.** *Your world is alive*, then *Your story is alive.* It is now *Your story is alive*, once.
- **The moment chosen is in the select's name**, as for a select in a `Field`. Its label alone named it *Starting
  moment*, and the moment it showed was not in its accessible name. The test for step 3 found it.

### Compare says which

**What happened.** A scene whose only change was its header line, or its paragraph breaks, read *Edited* with no
figure. The writer looked for what had changed.

**Now** (`editedOnly`, in `bookDraft.ts`):
- the words the same and only the paragraphs run differently: *Paragraph breaks changed*;
- only a header line at the scene's start: *Header line changed*;
- words changed with the count the same: *Edited, same length*;
- otherwise *Edited* with the words gained or lost, as before.

## Two things found on the way

- **A select named by its label alone**, in step 3 (above).
- **A check for a header's presence** in the Compare rule was redundant: without a header, the header comparison is
  the breaks comparison. It came out before the mutants ran.

## Tests

- **`headerSuggest.test.ts`:**
  - the run's own passage, Pell not offered;
  - who speaks outside the quotation still counts, straight or curly, and a name in another's speech does not;
  - a quotation runs to its paragraph's end at most.
- **`bookDraft.test.ts`:**
  - paragraph breaks alone, and one Enter's line end;
  - a header line alone, changed, put on and taken off;
  - words changed, the same count and not;
  - a header changed and words too.
- **`cardsBookTools.spec.ts`**, in the app:
  - on Cards, Find & replace, Export, Drafts and Bring in edits, enabled;
  - Export downloads the book as Word with its prose;
  - Find & replace and Drafts open, and the view stays Cards;
  - in chronological order, none is offered, and back in the book's order, they are.
- **`pageSceneKeys.spec.ts`:** the binder says the keys. A scene opened from the binder, caret at its start, and
  Ctrl+Enter makes the new scene after its last paragraph.
- **`onboardingSteps.spec.ts`:**
  - step 3's heading, and no *Where does…*;
  - its words on where;
  - the select named with its moment;
  - step 4's heading, and *alive* once.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. MUTANTS

## Not done here

- **Single quotation marks** are not read as quotes. A book that sets speech in them is read as before.
- **A key for the end of a scene on the Page.** What the writer wanted was a scene after it, which exists.
