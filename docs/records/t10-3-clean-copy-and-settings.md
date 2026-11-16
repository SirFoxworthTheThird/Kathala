# T10.3–T10.5: a clean copy, tracking on, and what the file says of itself

**Plan:** `round-trip-plan-3.md`, T10.3 with decision D-10 as taken, T10.4 and T10.5.
**Findings:** the eighth and ninth of `loop-2026-11-12.md`, and the editor's E-8 and E-9.

## T10.3: a clean copy beside the marked one (D-10)

**What happened.** The editor asked for a copy with no marks to read the revision through. The writer made one with
a second export. With it, checking took *an hour instead of an afternoon*.

**Now.** Under **Show my changes since…**, **And a clean copy to read**, ticked. A second file comes down beside the
marked one, named for it with `-clean` before the extension: *the-long-road-clean.docx*.
- **What it is:** the book as it is, every change made. It has no tracked changes, comments or scene bookmarks, and
  does not open recording changes.
- **What it says of itself:** one custom property, `KathalaCleanCopyOf`, the marked file's name. Nothing else the
  app reads back.
- **Brought in, it is refused**, by name: *This is the clean copy, made to read alongside the-long-road.docx, and
  changes cannot be brought in from it. Bring in the-long-road.docx, the marked file, with the editor's changes in
  it.* Nothing is saved.
- **Unticked**, one file comes down, as before.
- **Offered only with the marked revision.** The first file sent has no revision to read through.

## T10.4: the file opens with tracking on

**Every file for an editor** carries `word/settings.xml` with `w:trackRevisions`: the first one sent, the marked
revision and a submission. A file not for an editor does not, and nor does the clean copy.

**Measured in LibreOffice 24.2** (`scripts/lo-settings.py`, in `npm run probe:marked`), as it opens:

| File | Recording changes | Language | Title | Author |
|---|---|---|---|---|
| Before, for an editor | no | en-US | — | — |
| For an editor | **yes** | en-GB | The Salt Ledger | Elin Ashgrove |
| Marked back | **yes** | en-GB | The Salt Ledger | Elin Ashgrove |
| A submission, for an editor | **yes** | en-GB | The Salt Ledger | Elin Ashgrove |
| Its clean copy | no | en-GB | The Salt Ledger | Elin Ashgrove |
| Exported plainly | no | en-GB | The Salt Ledger | Elin Ashgrove |

The editor's LibreOffice is set to British English for the run, as an editor's would be where they work.

**Why it matters beyond this run.** Edits made with tracking off are the round trip's oldest hazard. They are still
found, against the draft saved as the file went out, but not as the editor made them.

## T10.5: smaller

- **The file can be renamed** (E-8). The writer asked the editor to keep its name, and the name does not matter: a
  file is known by what is inside it. The dialog says *…whatever the file is called by then*, and the guide says
  so.
- **The file says what it is** (E-9). Every Word file has `docProps/core.xml` with its title and its writer: the
  submission's name, else the book's author, else the name the marks are signed with. A title alone where there is
  no name.
- **The language tag** (E-9) was `en-US` on every book. Measured first, with the editor's LibreOffice set to British
  English:
  - **with the tag**, the file came up in American English;
  - **without it**, in British English: the editor's own, with their own spelling dictionary.
  It is left out.

## Tests

- **`manuscriptExport.test.ts`:**
  - a file for an editor has `word/settings.xml` with tracking on, linked and typed; a plain export and a clean
    copy have none;
  - every file's title and writer: the submission's name, the book's author, the name the marks are signed with,
    and a title alone with no name, its `&` escaped;
  - no `w:lang` in the styles;
  - the clean copy has no bookmarks, tracked changes, comment ranges or comments, and reads back as the clean copy
    of its marked file, with no draft or book; the marked file says no such thing.
- **`editImport.test.ts`**, against the real store: a clean copy brought in is refused with its message, and no draft
  or change is saved.
- **`wordRoundTrip.spec.ts`**, in the app, in the marked round trip of T10.1:
  - the dialog offers the clean copy, ticked, and names it; the file for an editor says it can be renamed;
  - two files come down, *the-long-road.docx* and *the-long-road-clean.docx*;
  - the clean one has no marks, comments or bookmarks, has the book's text, and does not record changes; the
    marked one does;
  - unticked, one file comes down;
  - the clean copy brought in is refused, with its message.
- **`npm run probe:marked`**, LibreOffice 24.2: the table above, from `scripts/lo-settings.py`.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. 17, all killed, 5 of them by the e2e:
- **tracking (4):** never written; written off; not linked; written on every file;
- **the file's properties (4):** no writer; not the submission's name; not the name the marks are signed with; not
  linked;
- **language (1):** still `en-US`;
- **the clean copy (8):** no marker; the marker not read; not refused; not made; made whatever the box says; made
  as the marked file; not ticked; named as the marked file.

Three were redone: two did not build as first written, and one, the properties not linked, only renamed the link
and so took nothing away.

## Not done here

- **Word itself was not run.** `w:trackRevisions` and `docProps/core.xml` are Word's own parts, written as Word
  writes them. The table above is LibreOffice's.
- **A clean copy renamed** is still refused, by what it says of itself. It names the marked file by the name it had
  when it was made.
