# Editor run, 2026-11-10: "The Salt Ledger", two rounds

Jonah Pryce, freelance fiction editor (an agent playing one), working blind on the author's
files. Author: Nell Garrow (also simulated). Tools: LibreOffice 24.2.7.2 headless, driven from
Python over UNO (own port 2012, own profile, user name set to Jonah Pryce / JP), python-docx,
unzip, and my own XML counting scripts.

Working files are in the session scratchpad, under `loop/editor/`:
- notes: `notes-round1.md`, `notes-round2.md`;
- edit lists: `edits_r1.py`, `edits_r2.py`;
- scripts: `apply_edits.py`, `count_marks.py`, `views.py`, `fate.py`, `validate.py`.

Handoff files are under `loop/handoff/`.

**Blindness caveat.** The harness injected the repository's CLAUDE.md into my context at the
start. It names the app (Kathala) and describes its internals. I opened no repo file except
`scripts/docx-fixture-edit.py`, and I did not open the app. But I cannot claim I had never seen
the word "Kathala" when I found it in the file's properties. Discount accordingly.

The book's faults are in the letters and the margins, not here.

---

## What I was sent

### Round 1: `round1-from-writer.docx` (105,368 bytes)

**Package**
- Seven parts: content types, rels, `document.xml` (99,136 b), `styles.xml`, document rels,
  `header1.xml`, and `docProps/custom.xml`.
- No `core.xml`, `app.xml`, `settings.xml`, `fontTable.xml` or theme. Zip entries are dated 1980.

**On the page.** This is what a reader of the book sees, and it is a clean standard manuscript:
- 47 pages (rendered through LibreOffice), 387 paragraphs, 13,133 words. The title page says
  "about 13,100 words".
- A contact line ("Nell Garrow⇥about 13,100 words"), then Title and Byline.
- 6 × Heading 1, written "Ch. 1 — The Low-Tide Count" and so on, each with a page break before
  and a 2in drop.
- 8 × Scene Break: 7 `#` plus `END`. That is correct for 13 scenes in 6 chapters.
- Everything else is Normal: Times New Roman 12, double-spaced, with a 0.5in first-line indent.
- A running header, "Garrow / THE SALT LEDGER / {PAGE}", suppressed on the title page.
- Defined but unused: Heading 2 and Verse.
- No fields in the body, no hidden text, no highlights, no hard page breaks, no tracked changes,
  no comments. Quotes are straight throughout (662 `"`, 0 curly). Em dashes are consistent.

**Off the page.** This is what a reader of the book does not see, all of it harmless:
- Two custom properties, `KathalaDraft = Tp34XZfTwfW4lN5E5kQOi` and
  `KathalaWorld = UAX__qUt9OL_Vk9KpTsuf`.
- 13 zero-width bookmarks, `KathalaScene_0` to `KathalaScene_12`, one at the first paragraph of
  each scene.
- No title or author in the document properties.

**Verdict.** I could work in it as it came. I would not have asked for another file. I
mentioned the properties and bookmarks to the author in my reply, in plain terms.

### Round 2: `round2-from-writer.docx` (112,269 bytes)

**Package**
- The same seven-part package, with the same `styles.xml` size and the same 1980 dates.
- Still no `settings.xml`, so Track Changes is off. The author warned me about this.
- `KathalaDraft` has a new value, `mkWw_wc-tbS8RgoWzWzGN`. `KathalaWorld` is unchanged.

**On the page**
- 50 pages, 407 paragraphs, 14,093 words. The title page says "about 14,000"; her note says
  "about 14,050".
- Headings now come as two paragraphs: "Chapter One" (Heading 1) above the title (Heading 2,
  now in use 6 times). This came from my margin note; see S-1.
- 7 `#` scene breaks plus `END`.
- All 13 bookmarks are still at the start of their scenes.

**Nothing of mine came back.** The file has 0 `w:ins`, 0 `w:del`, 0 moves and 0 comments, and
neither "Jonah" nor "Pryce" appears in any part. Nor did any of the package parts LibreOffice
had added to my file (see E-4).

---

## What I did

| | Round 1 | Round 2 |
|---|---|---|
| Edit operations | 61: 36 replacements, 16 deletions, 7 insertions, 2 paragraph breaks (one of the replacement/deletion pairs is a moved sentence) | 22: 14 replacements, 5 deletions, 1 insertion, 1 whole-paragraph deletion, 1 paragraph break |
| By purpose | 31 word, 9 punctuation, 9 cuts (the longest three sentences), 6 rewrites, 1 move, 2 name/consistency | 11 word, 7 cuts, 2 punctuation, 1 rewrite, 1 paragraph |
| Spread by chapter | 10 / 11 / 9 / 13 / 8 / 10 | 4 / 1 / 3 / 6 / 1 / 7 |
| In the saved XML | `w:ins` 44 (42 text, 2 paragraph marks), `w:del` 53, `w:moveFrom` 1, `w:moveTo` 1 | `w:ins` 16 (15 + 1 mark), `w:del` 22 (21 + 1 mark) |
| LibreOffice redline count | 99 | 36 |
| Comments | 40 (queries, remarks, 7 praise; one on a heading) | 23 (12 praise; one on a heading again, deliberately) |
| Author on every mark | "Jonah Pryce" (initials JP on comments) | same |
| Letter | 2,644 words: strengths; then 7 themed sections (plot logic, calendar and tides, who knows what, pace, POV, continuity, prose); length; order of work | 1,317 words: what holds; what the revision fixed; 4 needs-work sections; a correction; declined points; the file |
| Reply email | 291 words | 169 words |

How I checked that the edits landed, each round:
- Every context was checked unique in the source, before the run (python-docx) and again at
  apply time (LibreOffice `findFirst`, with `findNext` required to return nothing).
- Then I reopened the saved file and counted the marks in the XML, as in the table above.
- My own XML walk rejecting every change gave back the author's text exactly, paragraph for
  paragraph (387, then 407).
- Accepting every change gave a word diff containing exactly the intended edits.
- The author's file was untouched (same sha256 before and after) both times.

---

## What got in the way

Most costly first.

### E-1. You cannot tell from the revised file what the author changed, or which of my edits she took (measured)

- **What I did.** I opened round 2 expecting either her changes tracked or my accepted changes
  marked somehow.
- **What happened.** It came back as a clean export (a new `KathalaDraft` id, no tracking, no
  comments). My 47 accepted edits are indistinguishable from her own rewriting.
- **How I found out.** I had to rebuild the history myself. I diffed her revision against my
  round-1 file with every change accepted, and against her round-1 original. 316 paragraphs
  are identical and 54 regions differ (word diff kept in `r1acc-vs-r2.wdiff`). Then I checked
  each of my 61 operations for its "before" and "after" text (`fate.py`).
- **The result.** Her prose account reconciled exactly:
  - 48 operations accepted verbatim (47 edits; the moved sentence counts as two operations).
  - 8 declined.
  - 4 dissolved in her rebuilt Tide Court.
  - 1 (a day count) superseded by her own fix.

  Her "took 48, declined 12" matches if she counts the move as one edit and the superseded day
  count as taken.
- **Why it is costly.** An editor without scripts would have had only her note, and would have
  had to read 14,000 words against two earlier versions to check it. Her note was honest. The
  file gave me no way to verify that without the diff.

### E-2. A comment added while Track Changes is on is saved by LibreOffice as an empty tracked insertion (reproduced, editor side)

- **What I did.** My first round-1 save added the comments with recording on, which is how an
  editor normally works.
- **What happened.** The saved file had 84 `w:ins` for 42 real insertions. The other 42 contain
  no text:
  - 38 hold just `<w:r><w:rPr></w:rPr></w:r>`;
  - 3 hold an empty italic run;
  - 1 wraps a `w:commentReference`.

  Each sits beside a comment anchor. With recording off around the comments, the count drops to
  44 real ones.
- **Evidence.** The first file is kept as
  `loop/editor/attempt1-comments-tracked.docx`. It is a ready test file for whatever reads
  editors' files on the author's side. An editor in LibreOffice who comments with tracking on
  will send exactly this.

### E-3. LibreOffice wrote a move I did not ask for (reproduced)

- **What I did.** I deleted a sentence in one place and inserted the identical sentence earlier
  in the same paragraph (ch.4).
- **What happened.** LibreOffice saved it as `w:moveFrom`/`w:moveTo`, not as a deletion and an
  insertion.
- **Evidence.** One of each in the round-1 file. In round 2 the sentence is in its new place
  only, so the move was understood on her side. Listed so the author's side knows moves arrive
  from LibreOffice unasked.

### E-4. Saving through LibreOffice changes the package around the text (measured, both rounds)

- **Added:**
  - `docProps/core.xml` (empty creator, `lastModifiedBy` Jonah Pryce) and `app.xml`
    (Pages 48, Words 13044);
  - `settings.xml` (with `trackRevisions`), `fontTable.xml` and `theme1.xml`;
  - `header2.xml` and `header3.xml`: the section now has even, default and first-page header
    references, and the first-page and even ones are empty;
  - 8 unused default styles: Heading, BodyText, List, Caption, Index, HeaderandFooter, Header,
    Comment.
- **Changed:** the footer margin went from 720 to 0, and the PAGE field's cached result is "48".
- **Untouched:** the custom properties, the 13 bookmarks and the styles in use.
- **Effect.** None of it is visible on the page, and none of it came back in round 2.

### E-5. Track Changes is off in the author's files (measured, minor)

Neither of her files has a `settings.xml`, so the file opens with tracking off. She said so in
her round-2 note. An editor who did not read the note, or who works in Word with tracking off
by default, would make untracked edits. I turned tracking on in code both times.

### My own errors (not round-trip findings, recorded so they are not repeated)

- **A wrong count sent to the author as a measurement.**
  - What I did: in the round-1 letter I told her "very" appears 56 times and is her real habit.
  - What it actually measured: `grep -o "very"`, which also matches "every", "everyone" and
    "everything".
  - The right count: as a whole word, 28 plus one "Very" in her round-1 draft, 21 after my
    edits, and 23 in the revision.
  - Correction: I made it in the round-2 letter and reply.
  - Exactly what this repo's rule warns about: a number I did measure, measured wrong.
- **Tooling slips that cost time but not the work:**
  - `soffice --convert-to txt` wrote ASCII and turned every em dash into a hyphen.
  - `storeToURL` failed on a relative path (IOException 0x81a).
  - One run appeared to hang because soffice had inherited the stdout pipe into `tail`.

---

## What I only suspect

### S-1. A comment anchored inside a chapter heading may not reach the author

- **Status.** Reported by the author; not reproduced by me.
- **Evidence.** In round 1 exactly one of my 40 comments was in a Heading 1 paragraph, on the
  words "Ch. 1". Her round-2 note says: *"The house-style note on the title page (it didn't come
  through with the others in my software)"*. As far as her revision shows, she acted on many of
  the others, which fits the other 39 having arrived. (She made the change anyway; the note does
  not say how she learned of it.)
- **Why it matters.** If true, it is the costliest item here: an editor's point lost without
  either side being told.
- **What would settle it.** Round 2 carries one comment on "Chapter One" (Heading 1) for exactly
  this purpose. Settle it from her side, by importing `round2-from-editor.docx` and seeing
  whether that comment arrives.

### S-2. Identical timestamps

All of a round's tracked changes share one timestamp, to the second, and all its comments share
another, because a script made them. Anything that sorts or groups an editor's changes by
`w:date` would see a single moment. This is a guess about the author's side, not observed.

### S-3. How Word shows E-2's empty insertions

Unknown; I have no Word. A guess either way.

---

## What worked

- **Both files were ready to work in.** Real styles for the title, headings and scene breaks.
  The scene-break count was right. No stray codes. I would not have asked for a cleaner file.
- **Everything I sent was taken in correctly.** Every edit she accepted came back byte-exact:
  - no joined words, no doubled sentences, no lost paragraph breaks;
  - the move landed in its new place only, and my round-1 paragraph break landed;
  - the scan for joins, double spaces and repeated sentences found nothing of mine.

  The only doubled word in the revision ("mast", ch.2) was hers, made while revising.
- **What she declined is really gone.** All 8 declines read exactly as her original did.
- **Nothing of mine leaked back.** No pending changes, no duplicated comments, no markup, no
  name.
- **The structure survived.** Bookmarks and scene breaks were stable across both rounds. Her
  new heading structure (Heading 1 + Heading 2) is clean.
- **Her account matched the file.** Her note's account of what she took and declined
  reconciled exactly with the file. Her margin answers show the comments were read: she
  answered the queries on Constant/Constance, the statue, the pistol, the swim, Faraday, and
  clerk/assessor, among others.
- **LibreOffice signed everything correctly.** Tracked replacements, insertions, deletions,
  paragraph-mark insertions and a whole-paragraph deletion (`w:del` on the paragraph mark) all
  saved as Word-style markup signed "Jonah Pryce", once the profile name was set.
