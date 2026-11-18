# A PDF export (issue #701)

**Asked:** the manuscript as a PDF, as a reading copy and as a print interior for self-publishing, made in the
browser and offline in the desktop app. The measure and decisions are in `pdf-export-measure.md`:
- **D-2:** pdf-lib, with a layout of our own, drawn one line at a time.
- **D-3:** bundled static fonts: EB Garamond; Liberation Serif and Mono; DejaVu Sans as the fallback.
- **D-1:** the submission layout as PDF too.

**Code:**
- `src/lib/pdfLayout.ts`: the layout, pure.
- `src/lib/pdfExport.ts`: the fonts, the writer, and `makePdf`.
- `src/lib/pdfCheck.ts`: a PDF read back, and checked as a printer would.
- The fonts and their licences: `src/assets/fonts/pdf/`.
- The Export dialog, and the details kept per book in `submissionDetails.ts`.
- `npm run check:pdf` and `npm run probe:pdf`.

## What it does

**Export → PDF**, with a **Layout** of three:

- **Reading copy**, on A4 or US Letter:
  - a title page;
  - each chapter on a new page;
  - scene breaks, italics, page numbers.
- **Print interior**, on one of six trims: 5 × 8 in, 5.25 × 8 in, 5.5 × 8.5 in, 6 × 9 in, A5, and B-format
  (129 × 198 mm).
  - Mirrored margins. The inside margin is set by the page count, from the minimums KDP gives plus a quarter of an
    inch, so the book is laid out again when its count crosses a band.
  - Running heads: the author over left pages and the title over right ones, none on a chapter's opening.
  - Page numbers at the foot.
  - Each chapter on a right-hand page, with a blank page before it where one is needed.
  - An optional copyright page on the back of the title page, a dedication on a right-hand page, and an About the
    Author page at the back.
- **Submission**: the Word submission's layout, from the same details.
  - Liberation Serif or Mono, in Times New Roman's or Courier New's metrics.
  - 12 pt, double-spaced, with one-inch margins and the first line of each paragraph set in.
  - The title page has the contact block and the rounded word count.
  - *Surname / TITLE / page* from page 2.
  - Each chapter on a new page, `#` between scenes, and *END*.

In every layout:

- **The type** is greedy justified lines (ragged right on a submission) on a grid of whole lines, with italics in the
  italic face.
- **Missing characters:** one the face lacks is drawn from the fallback. One no bundled font has is drawn as �, and
  the dialog says how many there were.
- **Page breaks:** a paragraph keeps two lines either side of a page break. A scene break looks ahead and goes over
  with what follows it, unless that can stay whole or split cleanly. A heading always has text under it on its page.
- **Fonts:** every font the pages use is embedded as a subset, and only those.
- **The file:** it is named as the other exports are (`the-salt-ledger.pdf`), and the dialog says how many pages it
  came to.
- **The dialog's choices** (layout, paper, trim, front and back matter) are kept for the book's next export, on this
  device, beside the submission details.

## Measured

- **Three Library books, as 6 × 9 print interiors, in Chromium**, through the dialog (`e2e/pdfExport.spec.ts`). Each
  file was read back and checked as a printer would (`printProblems`), with no problems. Each had 0 widows, 0 orphans
  and 0 stranded headings or breaks.

  | Book | Words | Pages | Time |
  | --- | --- | --- | --- |
  | *Pride and Prejudice* | 122,276 | 382 | 2.9–3.2 s |
  | *The Odyssey*, the timeline the manuscript exports | — | 222 | 1.9–2.1 s |
  | *The Cold Choir*, one strand of its braid, with ✓ from the fallback | — | 48 | 0.5–0.6 s |

  Taken over four runs, the last at 1b000a5.

  The issue's bound is 30 s for 120,000 words.
- **Node** (`npm run probe:pdf`), the same three books whole, in every layout:
  - 0 widows, orphans or stranded headings throughout, and no characters missing.
  - Every print interior passed the check.
  - *Pride and Prejudice* as a print interior: 382 pages, 940 KB, 3.7 s.
  - Loose lines, where a word space is over three times its own width, since there is no hyphenation: 122 in its
    382-page interior, about 1 in 90. 4 to 17 in the reading copies, and none in a ragged-right submission.
  - Taken at 1b000a5, the code as shipped.

## Found on the way

- **A scene break could be left alone at a page's foot.** The first layout's widow rule sent a three-line paragraph
  that had only two rows left whole to the next page, and the break before it stayed behind with nothing under it.
  The break now looks ahead at the paragraph after it, and goes over with it unless that can stay whole or split
  cleanly.
  - A second rule, that a page ending in a heading or break must take lines, was written beside it. A surviving
    mutant showed it could not be reached: a heading's drop leaves room for more than two lines under it, and the
    break decides first. It is gone.
- **Ligatures, kept after all.** The measure turned them off (D-2), because a gap followed every "fi". That was
  pdf-lib's per-word `drawText`, which spaces words by kerned positions. A mutant that turned them back on
  survived, so they were looked at again. Drawn a line at a time by advances, with widths from the same layout, they
  set as they should, and "office", "first", "filed" and "affidavit" read back as written. They are on, and the
  measure record says so.
- **Nothing checked that a justified line reaches the margin.** A mutant measuring widths without ligatures survived:
  its lines fell short of the margin, and no test looked. `pdfCheck` now works out where each line ends, from the
  glyph widths in the file (`W` or `Widths`) and the moves in `TJ`. A test requires every line of a paragraph thick
  with ligatures, but its last, to end within half a point of the right margin.
- **A redundant check.** Of the two orphan checks in the page-break rule, the first was subsumed by the second, as an
  equivalent mutant showed. The first is gone.
- **The widow and orphan counts first sat on branches the layout cannot reach.** Counted where the rules made their
  choices, they could only ever say 0. They are now counted from each page as it closes, from its first and last
  lines of text, each knowing its paragraph and its place in it. A test shows the counts rise when the rule is
  relaxed to one line.
- **A name that matched another's.** *About the author (optional)* contains *Author (optional)*, the field above it,
  so a lookup by the one found both. It is *About the Author page (optional)*.
- **The checker read only this app's PDFs.** A simple font, such as pdf-lib's standard ones, writes `Tj` with
  one-byte codes and places its lines with `Tm`. The checker reads both now, so it does not pass a file only because
  it cannot read it.

## Tests

- `src/lib/__tests__/pdfLayout.test.ts`, 19:
  - **print interior:**
    - chapters on right-hand pages, with blank pages that carry nothing;
    - heads by side, and none on an opening or the front matter;
    - page numbers on text and openings only;
    - mirrored margins;
    - the six trims;
    - the gutter by page count;
    - the front matter's order;
  - **page breaks:**
    - a one-line foot carried over;
    - two lines carried, never one;
    - a paragraph that fits kept whole;
    - a scene break never last, and looking ahead;
    - a heading with text under it;
    - the counts, none with two lines kept and some with one;
    - a stranded break counted when nothing is kept;
  - **reading copy:** A4 and Letter, no heads, no blank pages, italics and the fallback face;
  - **submission:** its settings, `#` and *END*, the title page, and the header from page 2;
  - **the book from the compiled manuscript:** headings, breaks, italics, verse, and back matter.
- `src/lib/__tests__/pdfExport.test.ts`, 9, the real fonts and writer, read back with `pdfCheck`:
  - **print interior:**
    - trim, fonts, metadata, Greek, the long s and ✓;
    - front and back matter;
    - heads by side;
    - and no problems;
  - **reading copy:** both papers, and the check finding its left-hand openings;
  - **submission:** in Liberation Serif and Mono, with its header and *END*;
  - **the counts and the time** said;
  - **ligatures:** words they join read back as written;
  - **justified lines:** they end at the right margin, by the glyph widths in the file;
  - **a character no font has:** drawn as � and counted;
  - **the checker:** an off-trim page, an unembedded font, and a line above a heading, each present and absent.
- `src/lib/__tests__/submissionDetails.test.ts`: the PDF's choices kept, and anything else read as the default.
- `e2e/pdfExport.spec.ts`, 2:
  - the three layouts from the dialog, each downloaded and read back, and the choices there on reopening;
  - the three Library books above.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed. They were run against `pdfLayout`,
`pdfExport` and `submissionDetails` (unit), or against `e2e/pdfExport.spec.ts` (the dialog's).

- **At 9c01544, 26 mutants: 19 killed, 2 survived, 5 did not build.**
  - Killed:
    - **right-hand starts:** no blank page put in, and a print interior not held to them;
    - **running heads:** heads on openings, and the sides swapped;
    - **trim:** 6 × 9 a tenth of an inch wider, and the trim chosen ignored;
    - **layout:** no mirroring; widows carried a line at a time; the gutter laid out once; a submission numbered from
      1;
    - **fonts:** the fallback never used, and a missing character not counted;
    - **the checker:** passing a left-hand opening, a head above a heading, or an unembedded font;
    - **the details:** the PDF layout forgotten;
    - **in the dialog:** the layout, the trim and the front matter each ignored.
  - Survived:
    - the first orphan check removed: an equivalent mutant, and the check is gone;
    - ligatures turned on: they are on now (*Found on the way*).
  - Did not build: five, each left a binding unused. They were rewritten and run again below.
- **At c45dbef, 6 mutants: 4 killed, 2 survived.**
  - Killed: the five rewritten, less one: the break not looking ahead, and widows, orphans and stranded headings each
    not counted.
  - Survived:
    - a page ending in a heading allowed to: unreachable, and gone;
    - widths measured without ligatures: now tested.
- **At 1b000a5, 2 mutants, both killed:** widths measured without ligatures, and the checker's line ends ignoring the
  moves between words.

25 mutants stand against the code as shipped, and every one is killed. The two that survived on removed code have
nothing left to mutate.
