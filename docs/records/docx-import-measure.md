# Import Manuscript from Word: measured (issue #697, step 1)

**Issue:** #697. **Tools:** `scripts/docx-import-corpus.py` (the corpus), `scripts/docx-import-probe.ts` (the
measure). **Fixtures:** `src/lib/__tests__/fixtures/docx/import/`, each `.docx` beside a `.truth.json` of what
it holds.

## The corpus

No real author's draft was available. So each file is a Library book's opening chapters, written as a Word
document in one of the ways drafts are formatted. Each convention is written as Word's own XML, by hand,
including those LibreOffice cannot make (a localised style id, for instance). One file was made by LibreOffice
itself, and one is Kathala's own export. Ten in all:

| | Book | How it marks chapters | Scene breaks | Also |
|---|---|---|---|---|
| 01 | *Persuasion* | Heading 1 | `* * *`, centred | the book in Title style |
| 02 | *Carmilla* | a bold centred *CHAPTER ONE* line after a page break, no style | `#` | |
| 03 | *Os Maias* | heading 1, under the localised style id `Titre1` | `***` | Portuguese |
| 04 | *The Sign of the Four* | the writer's own style, *Chapter Title*, at outline level 1 | two empty paragraphs | |
| 05 | *Frankenstein* | Heading 1 for parts, Heading 2 for chapters | `⁂` | |
| 06 | *Kidnapped* | standard manuscript format: *CHAPTER 1* after a page break | `#` | contact lines, title, byline, *END* |
| 07 | *Alice in Wonderland* | Heading 1 | `* * *` | italics by the *Emphasis* character style; paragraphs open on a tab |
| 08 | *Pride and Prejudice* | Heading 1 | `* * *` | 6 tracked insertions, 6 deletions, 6 comments |
| 09 | *Peter and Wendy* | made by LibreOffice from HTML: `Heading1` | `* * *` | prose in `BodyText` |
| 10 | *The Salt Ledger* (the third loop's book) | Kathala's own Word export | `#` (`SceneBreak` style) | title page |

The source books' chapter titles differ on purpose: *Chapter I*, *Prologue*, Portuguese titles, *Letter I*,
*Chapter 1*, and titles with no number (*Down the Rabbit-Hole*).

## Two readings, measured

- **(A) text only:** each paragraph's words given to the Markdown rules (`manuscriptImport.ts`) as they are,
  as a writer pasting from Word would.
- **(B) knowing Word:**
  - a paragraph styled as a heading, or at an outline level, is a heading line, read by its style's *name*
    (`heading 1`), never its id;
  - several empty paragraphs together are a scene break;
  - a page break before a line that reads as a chapter is a boundary.

Chapters right, against what the file holds. Words are the prose's words.

| | (A) chapters | (B) chapters | (B) scene counts right | (B) words |
|---|---|---|---|---|
| 01 | 7 of 6 | **6 of 6** | 6 of 6 | 16,290 of 16,290 |
| 02 | 6 of 6 | 6 of 6, one empty and one extra | — | 11,812 of 11,813 |
| 03 | **1 of 5** | **5 of 5** | 5 of 5 | 41,771 of 41,771 |
| 04 | 6 of 6, every scene in one | 12, six of them empty | — | 16,034 of 16,046 |
| 05 | 4 of 6 | 4 of 6 | 3 of 6 | 9,501 of 9,501 |
| 06 | 8 of 5 | 12, five empty | — | 12,457 of 12,455 |
| 07 | **1 of 5** | **5 of 5** | 5 of 5 | 10,695 of 10,695 |
| 08 | 4 of 4 | 4 of 4 | 4 of 4 | 4,490 of 4,478 (see D-1) |
| 09 | **1 of 5** | **5 of 5** | 5 of 5 | 16,537 of 16,537 |
| 10 | 7 of 6 | 8 of 6 | 3 of 6 | 12,512 of 12,496 |

Italics, every file: each italic span in the file is read as written, whether by direct formatting or by the
*Emphasis* character style. In 03, the reader counted 15 more italic runs than the truth file lists. All 15
are a lone `*` that the corpus's rough markup parsing made italic: an artifact of building the corpus, not of
reading.

## What it shows

1. **Word's styles are needed.** Without them, a book whose chapter titles are not *Chapter n* (*Os Maias*,
   *Alice*, *Peter and Wendy*) comes in as one chapter (03, 07, 09: 1 of 5). With the heading styles read by
   name, each is right. A localised id (`Titre1`) is no obstacle, since the name stays `heading 1`.
2. **Any paragraph that opens with a chapter word is made a chapter. This is a fault of today's import, not
   only of Word's.**
   - `manuscriptImport.ts` takes any line starting *Chapter*, *Prologue*, *Epilogue* or *Part* as a boundary.
     Reproduced on its own: *Part of the house was dark, and she went on.* became a chapter titled with that
     sentence.
   - In Word every paragraph is a line, so it happens more often. It made the extra and empty chapters in 02,
     04 and 06, where a chapter's own heading, typed again as the first line of its prose (*Chapter I*,
     *PROLOGUE*), became a second boundary right after the styled one.
3. **Parts lose their chapters (05).** Heading 1 *Part One* over Heading 2 *Letter I* makes the letters scene
   titles under a part, and *Part Two* an empty chapter. Kathala has no parts (D-3).
4. **A title page becomes chapters (06, 10).**
   - Standard manuscript format's contact lines, word count, title and byline, and Kathala's own export's title
     page, come in as a leading untitled chapter.
   - Word's *Title* style was taken for a chapter heading, which dropped the real chapters to scene titles in
     10. Kathala's own export does not come back as it went (D-4).
   - *END* at the close is prose.
5. **Tracked changes and comments (08)** are read by the reader as it stands. Taken as accepted, the words
   match plus the six insertions (D-1). The six comments are found (D-2).

## Decisions to make

- **D-1, tracked changes left in a draft.**
  - (a) Take the file with every change accepted, as Word's *No markup* view shows it.
  - (b) Take it with every change rejected.
  - (c) Ask, when the file has any.

  **Proposed: (a)**, with the preview saying how many there were. It is what the writer sees as their text.
- **D-2, comments in a draft.**
  - (a) Bring each in as a note on its words, on the Page, as an editor's comments are brought in.
  - (b) Drop them, with the count shown.

  **Proposed: (a).** The notes import exists; the comments are the writer's own reminders.
- **D-3, parts.** Kathala has chapters and no parts.
  - (a) A part heading is not a chapter. The chapters under it are the chapters, and the part's name goes in
    the first chapter's notes (*Begins Part One*), so nothing is lost.
  - (b) The part's name prefixes its chapters' titles (*Part One · Letter I*).
  - (c) Drop parts, and list them in the preview.

  **Proposed: (a).** Parts as a feature of their own would be a separate issue.
- **D-4, a title page.**
  - (a) Before the first chapter, the book's title (Title style, or the large centred line) becomes the
    suggested world name. Contact lines, word count and byline are left out and listed in the preview. A last
    *END* is dropped.
  - (b) Keep it all as a front-matter chapter.

  **Proposed: (a).** It is how Kathala's own export comes back as it went.
- **D-5, the chapter-word fault in today's import.** A line counts as a chapter only where it reads as a
  heading:
  - short (at most 80 characters);
  - no sentence running on after it;
  - the word followed by a number, a numeral, or a number in words, then optionally a separator and a title
    (*Chapter 3*, *Part Two: The Sea*, *PROLOGUE*).

  Not *Part of the house was dark*. And a chapter line straight after a heading, with no prose between, is the
  same chapter's heading typed twice, not a second chapter.

  **Proposed: fix it for every format**, Markdown and text too. It changes what today's import does with such
  a paragraph, which is the fault.

## Not measured

- **A real writer's own drafts, from Microsoft Word itself.** The corpus writes Word's forms by hand. If you
  can share two or three real drafts, privately, they would be the best check before release.
- **Speed.** The issue's figure is 120,000 words in under 10 seconds. It is for the implementation's tests.
