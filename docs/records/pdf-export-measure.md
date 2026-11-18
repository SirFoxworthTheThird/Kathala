# A PDF export: the measure (issue #701, part 0)

**Asked:** a PDF of the book, both as a reading copy and as a print interior for self-publishing, made in the
browser like the other exports, and offline in the desktop app. The issue asks for the approaches to be compared
before anything is built, and for a decision (D-2).

**Measured with:** *Pride and Prejudice* from the Library (122,276 words, 61 chapters), set at 6 × 9 in, 11 pt on
14.5 pt, with mirrored margins, running heads (author on the left page, title on the right, none on a chapter
opening), page numbers, and every chapter on a right-hand page. The probes are in the session's scratchpad, not the
repository. All timings are Node 22 on this container, and `pdfinfo`, `pdffonts`, `pdftotext` and `pdftoppm` read the
results back.

## The two approaches

### A. A JavaScript PDF library, with the layout our own

`pdf-lib` 1.17.1 with `@pdf-lib/fontkit` 1.1.1 (both MIT, no network) writes the PDF. The line and page breaks are
ours: greedy, justified lines from the font's own advance widths, then pages, with two-line widows and orphans.

| Run | Pages | Time | Size | What it showed |
| --- | --- | --- | --- | --- |
| Variable EB Garamond, subset | 345 | 11.3 s | 3.3 MB | **Most letters missing when drawn.** The text extracts correctly, but fontkit's subset of a variable font loses glyphs. |
| Variable, whole font embedded | 345 | 11.3 s | 4.1 MB | Draws correctly. "fi" and "ffi" ligatures leave a gap after them. |
| Static EB Garamond, subset, ligatures off | 345 | 11.0 s | 3.3 MB | Draws correctly, with no gaps. |
| Static, subset, one text object per line | 345 | **3.4 s** | **947 KB** | Draws the same page. Drawing each word on its own had taken 8.8 s of the 11. |

- Every chapter starts on a right-hand page: 61 of 61, with a blank page put in where one is needed.
- There is no running head on any chapter opening, and the fonts are embedded as CID TrueType.
- The layout is plain code over the compiled manuscript, so page breaks, right-hand starts and running heads can be
  unit-tested in Vitest.

### B. The browser's own printing of a paged HTML layout

The same book as HTML with `@page` rules, printed by Chromium 153 (`page.pdf`, the engine Electron's `printToPDF`
uses): `@page :left` / `:right` margins, margin boxes for the running heads and the page number, `break-before: right`
on each chapter, and a named page on the chapter heading to drop the running heads there.

| Run | Pages | Time | Size | What it showed |
| --- | --- | --- | --- | --- |
| Variable EB Garamond | 368 | 2.0 s | 2.2 MB | **Fonts embedded as Type 3**, which print services commonly reject. |
| Static EB Garamond | 368 | 1.4 s | 1.7 MB | Fonts embedded as CID TrueType. |

- **`break-before: right` is not honoured:** 25 of 61 chapters start on a left-hand page, and no blank page is put in.
- **A named page on the heading puts the heading on a page of its own.** The chapter's first page is the title
  alone, and its text starts overleaf. A named page is the only way Chromium has to change the margin boxes for one
  page. So running heads cannot be dropped on a chapter opening without breaking the opening.
- In the web app, the only way to this output is `window.print()`: the print dialog, where the reader must choose
  *Save as PDF*, and its paper and header settings override ours. Firefox and Safari do not draw margin boxes at all.
  Only the desktop app could produce the file directly.
- The page breaks are the browser's, so they can be tested only in a browser, and only after the fact.

## Decisions

- **D-2: A.** The PDF is written in the app, from the compiled manuscript (`BuiltManuscript`, as the Word and EPUB
  exports use), by `pdf-lib`, with our own layout. Only it meets the print interior's two hard requirements: chapters
  on a right-hand page, and no running head on an opening. It works the same in every browser and in the desktop
  app, with no dialog. The layout is unit-testable, and it was fast enough when measured: 3.4 s for 122,000 words in
  Node. The issue's bound is 30 s in Chromium. The libraries and fonts are loaded only when a PDF is made, so the
  rest of the app does not carry them.
  - Text is drawn **a line at a time**: one text object per line, with word spacing as `TJ` adjustments. Drawing
    each word on its own cost 2.6 times as long and 3.5 times as much file.
  - **Ligatures are off.** With them, pdf-lib's widths and the glyphs it draws disagree, and a gap follows every
    "fi".
- **D-3: the fonts, bundled, static, and openly licensed.** pdf-lib's subsetting breaks a variable font, so each font
  is a static instance, embedded as a subset, and every one is embedded.
  - **EB Garamond** (Georg Duffner and Octavio Pardo; SIL OFL 1.1), regular and italic, for the reading copy and the
    print interior. Of every character in the Library's 58 books (Latin with Portuguese and French accents, the long
    s, polytonic Greek, dashes, quotes, primes and the dagger), it lacks one: ✓, which *The Cold Choir* uses.
  - **Liberation Serif** and **Liberation Mono** 2.1.5 (SIL OFL 1.1), regular and italic, for the submission layout.
    They are metric-compatible with Times New Roman and Courier New, the two fonts the submission Word file names,
    so the PDF breaks its lines where Word would.
  - **DejaVu Sans** (Bitstream Vera licence, which allows bundling and embedding) as the fallback for a character
    the main font lacks. It covers every character in the Library, ✓ included. A character no bundled font has is
    drawn as a visible substitute, and the export says how many there were, rather than leaving a gap.
  - Fonts that were measured and not taken:
    - Literata lacks the long s.
    - Noto Serif and Literata ship only as variable fonts.
    - Source Serif 4 lacks polytonic Greek.
    - Crimson Pro lacks Greek.
- **D-1: the submission layout as PDF, taken.** It is the same layout the submission Word file has: 12 pt (Liberation
  Serif for Times, Liberation Mono for Courier), double-spaced, one-inch margins on Letter or A4, the first line of
  each paragraph set in half an inch, *Surname / TITLE / page* in the header from the second page, the title page
  with the contact block and the rounded word count, each chapter on a new page, `#` between scenes, and *END*. The
  engine costs nothing more to drive, and some agents and contests ask for a PDF.

## Not measured here

- Speed in Chromium on the CI runner, which the issue bounds at 30 s. It is measured in part 3, by the e2e, on the
  Library's longest books.
- Widows, orphans and stranded headings on three Library books. They are counted in part 3, and the counts are kept
  in a test.
- Hyphenation stays out, as the issue says. Lines are justified without it, so a long word can leave a loose line.
  How loose, and how often, is for part 1 to measure and part 3 to keep in a test.
