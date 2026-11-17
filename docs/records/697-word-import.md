# Import Manuscript from Word (issue #697)

**Issue:** #697. **Measure:** `docx-import-measure.md`, with the owner's decisions D-1 to D-4 and the fault D-5.
**Code:** `src/lib/docxDraft.ts` (the reader), `src/lib/manuscriptImport.ts` (D-5), `createWorldFromManuscript` in
`src/db/hooks/useManuscript.ts`, `src/features/worlds/ImportManuscriptDialog.tsx`.

## What it does

A Word draft is read into the same manuscript the Markdown and text import already make, so a draft from Word and
one pasted from it come in by one parse. The reader gives that parse the lines Word's layout means:

- **Chapters and scenes by heading style**, read by the style's name (`heading 1`) and never its id, so a localised
  id (`Titre1`) reads the same. A style of the writer's own counts by its outline level, and through its `basedOn`
  chain. The top heading level holds the chapters; the next one down titles scenes.
- **No heading styles at all:** a line that reads as a chapter heading (D-5), or a short line, with no closing
  stop, at the top of a new page.
- **Scene breaks** by a line of symbols, a *Scene Break* style, or more empty paragraphs than the draft's usual gap.
  The usual gap is the commonest count of empty paragraphs between two paragraphs, those with none between them
  counted too. Counted over gaps alone, a draft whose only empty paragraphs were its breaks took them as the usual
  gap and found no break.
- **Italics** by direct formatting or a character style, written as `_…_` with the spaces at their edges outside the
  marks. Bold and underlining come in plain, and the preview says so.
- **Tracked changes accepted (D-1):** insertions and moves-to kept, deletions and moves-from dropped. A deleted
  paragraph mark joins the paragraph to the next, as Word shows it accepted.
- **Fields:** a field's result is text, its instruction is not.
- **Comments as notes (D-2)** on their words, with their replies, their dates and whether they were done. A comment
  with no range, as LibreOffice writes one, is on the word it stands before. One on a heading is the heading's, and
  one on the title page is the title page's, as an editor's are (T9.4). One on a scene break or a part's heading goes
  on with the next line of prose. The notes are the writer's own, since the draft is theirs.
- **Parts (D-3):** where the top headings are all *Part*, *Book* or *Volume*, the chapters are the headings under
  them, and each part's name is put in the notes of the chapter it begins: *Begins Part One*. A single *Part One*
  heading over chapters at the same level does not make parts.
- **A title page (D-4):** what stands before the first chapter, where none of it is a paragraph of prose. Its title
  is Word's *Title* style or its centred line that is neither a byline nor a contact line, and is offered as the
  world's name. The other lines, and a closing *END*, are left out and listed in the preview.
- **Kathala's own export** comes back as it went: a *Chapter One* heading with its title as a Heading 2 under it is
  one chapter with that title.
- **Left out and counted:** images, tables, footnotes, endnotes.

The dialog takes a `.docx` by its picker or dropped on it. The draft stands in for the text box, with **×** to put it
back. Any other file than `.docx`, `.md` or `.txt` is turned away with a message saying which are read.

## D-5: a chapter line must read as a heading

Any line starting *Chapter*, *Part*, *Prologue* or *Epilogue* was a chapter, in every format. Now a line on its own
is a chapter only where it reads as a heading:
- at most 80 characters;
- the word, then its number, in figures, a numeral, words or an ordinal (*the First*), none for *Prologue* or
  *Epilogue*;
- then nothing, or a separator and a title, or a title starting as one does (*Chapter 3 The Road*, not *Chapter one
  of the book was…*).

*Part of the house was dark, and she went on.* is prose now. A bare chapter line straight after a chapter's heading,
with only blank lines between, is that heading's second line, not a second chapter. Its title is taken where the
first had none (*CHAPTER ONE*, then *PROLOGUE*). Found on the way: *Chapter Twenty-One* was titled *One*, since its
hyphen read as the separator before a title. The number is now read whole first.

## The ten drafts, after

| | Book | Chapters | Scene counts | Words |
|---|---|---|---|---|
| 01 | *Persuasion* | 6 of 6 | all | all |
| 02 | *Carmilla* | 6 of 6 | all | all |
| 03 | *Os Maias* | 5 of 5 | all | all |
| 04 | *The Sign of the Four* | 6 of 6 | all | all |
| 05 | *Frankenstein* | 6 of 6, two parts | all | all |
| 06 | *Kidnapped* | 6, as its text says | — | the title page's lines out |
| 07 | *Alice in Wonderland* | 5 of 5 | all | all |
| 08 | *Pride and Prejudice* | 4 of 4 | all | with the 12 changes accepted |
| 09 | *Peter and Wendy* | 5 of 5 | all | all |
| 10 | *The Salt Ledger* | 6 of 6 | all | all |

Every italic span in every file is read as written. 06 has six chapters where its truth file says five. Its text
holds the book's own *CHAPTER I* as a line after a dedication and a preface, under the first heading, and that line
is a chapter. The test holds the shape `[1, 3, 3, 3, 3, 3]`. Each row is a test in `docxDraft.test.ts`.

**Speed:** the issue asks for 120,000 words in under 10 seconds. The reader takes 368 ms for 120,000 words here, and
the test fails at 10 seconds.

## Tests

- `src/lib/__tests__/docxDraft.test.ts`: the ten drafts, and a small draft for each rule. 30 tests.
- `src/lib/__tests__/manuscriptImport.test.ts`: D-5's lines, and a heading typed twice.
- `src/db/hooks/__tests__/manuscriptImport.test.ts`: parts into chapter notes, comments into notes with reply, date,
  done, heading, title page and point, and fixture 08's six comments on words their scenes hold.
- `e2e/wordDraftImport.spec.ts`: a draft by the picker and by drop, the preview's lines, put back, and a file turned
  away.

## Mutants

58 mutants, in a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed: 49 on the reader, D-5 and
the store, run against the three unit files; 8 on the dialog, against `e2e/wordDraftImport.spec.ts`; and one more on
the fix below. **Every one is killed at 2cc7d76.**

- **30 killed on the first run**: 23 of the 49, 7 of the 8.
- **10 survived it**, each now killed by a test written for it:
  - a style based on a heading style (`basedOn`);
  - a style of the writer's own at an outline level, where fixture 04's headings also read as chapter lines;
  - a deleted run's footnote, image and converter's `w:t`: Word writes deleted words as `delText`, which is never
    read, so dropping the rule left every fixture as it was;
  - a field nested in another's instruction;
  - an italic run's spaces outside its marks;
  - a draft headed only by parts;
  - a short line after a page break as a chapter's start;
  - a byline never the title;
  - a chapter's title under its bare heading used once, not also as its first scene's;
  - a comment whose end is written before its start.
- **17 did not build** the first time, each an unused name left behind. Each was rewritten so that it builds, and
  killed: the part notes' only on a third form.

**Found by them:** the test written for the page-break mutant showed that a book opening on short sentences (*She
walked.* *She stopped.*) was taken for a title page, left out and only listed. A paragraph was prose only when long or
two sentences. A sentence of two words or more is prose now, and its mutant is the 58th.

## Not done

- **A real writer's own drafts, from Microsoft Word.** The corpus writes Word's forms by hand, and one file by
  LibreOffice. Two or three real drafts, shared privately, would be the best check before release.
- **Headers, footers and text boxes** are not read. A draft's running header is not its text, but a text box can be.
  None of the corpus has one.
