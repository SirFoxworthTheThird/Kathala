# R2: standard manuscript format, and Word styles

The second part of the editorial plan (`editorial-plan.md`).

## What was built

- **Word styles, for every Word export** (`docxStyles`, `src/lib/manuscriptExport.ts`).
  - Paragraphs carry a named style, not their own formatting: *Normal*, *Title*, *Byline*, *Heading 1*
    (the line a chapter opens with), *Heading 2* (its title beneath), *Scene Break* and *Verse*. A
    submission's title page also uses *Contact*.
  - `styles.xml` is in the package and declared in it. The two heading styles carry outline levels
    (`outlineLvl`), which are what Word reads a document's outline from.
  - Only italics stay on the text itself, as character formatting.
- **A Submission layout for Word**, in standard manuscript format:
  - 12-point Times New Roman or Courier New, double-spaced, one-inch margins, on US Letter or A4, each
    paragraph's first line indented half an inch;
  - a title page with the legal name (or the byline's) and the contact lines top left, and the word
    count top right on a right tab, rounded to the nearest hundred under 10,000 and the nearest thousand
    from there;
  - the title and *by* the byline's name, centred lower down the page;
  - a running header, *Surname / TITLE / page*, with the page as a `PAGE` field, on every page but the
    title page (`titlePg`);
  - each chapter on a new page, lower down; `#` between scenes; *END* at the close; no cover.
- **The dialog.** Word's export offers **Layout: Book / Submission**. A submission asks for:
  - the name on the byline, which it cannot be made without;
  - a legal name and contact details;
  - the font and the paper.

  The byline's name is every book format's author line, as the old *Author* field was.
- **A store-only zip reader** (`readStoredZip`, `src/lib/zip.ts`). The tests and the e2e spec read the
  Word file back with it, part by part. R4's import will need a reader for compressed files as well.

## Where it departs from the plan

The plan kept the writer's name and contact details in World settings. They are kept per book on
this device instead (`src/lib/submissionDetails.ts`), and edited in the export dialog.

A world's settings are part of its records, and its records travel in its `.pwk`, which is what a beta
reader is sent (D-2). The writer's home address and telephone number would have gone with it. Kept in
this browser, they reach only the Word file downloaded. A test makes a backup with them stored, and
checks that the address is not in it while the graph positions stored beside it are.

## Checked

- `manuscriptExport.test.ts`, reading each part back:
  - the styles, and that no paragraph centres, bolds or sizes itself;
  - the submission's title page, contact block, tab stop, byline, `#`, *END*, and no cover;
  - margins, paper sizes, the header, `titlePg`, and the content types and relationships;
  - double spacing, the indent, one size throughout, Courier, and A4;
  - a submission without chapter headings still starting its text on a new page;
  - word counts rounded at each boundary, and surnames;
  - `readStoredZip` reading what `zipStore` wrote, and refusing a compressed entry.
- `submissionDetails.test.ts`: remembered per book; anything malformed read safely; kept out of the
  backup.
- `e2e/submissionExport.spec.ts`:
  - a submission cannot be downloaded without a name, and says so;
  - it is downloaded in Courier, and its header, title page, *END* and styles are read back from the
    file;
  - closed and opened again, the dialog holds the layout and the details;
  - switched back to Book, a book layout is downloaded with the same name as its author line.
- Mutants, each caught. Unit:
  - the title not in capitals; single spacing;
  - no *END*; the rounding threshold moved;
  - no styles relationship; the cover on a submission; no `titlePg`;
  - formatting put back on paragraphs; the legal name ignored.

  e2e:
  - the details not kept;
  - the submission not passed to Word;
  - a submission downloadable without a name.

## Not yet

- R4's reader will read these files back. Until then the tests read the XML, and no Word or
  LibreOffice has opened a file in this container.
- The header carries the full title in capitals. A long title is not shortened to a key word, as a
  writer might do by hand.
