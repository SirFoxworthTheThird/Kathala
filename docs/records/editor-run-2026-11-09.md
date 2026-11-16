# Editor run, 2026-11-09: THE SALT LEDGER, two rounds

Played as Margit Hale, a freelance fiction editor, editing Ruth Callan's novella from the Word file alone. I used
LibreOffice 24.2.7.2, driven from Python (uno), plus python-docx. I did not read the app's source, docs or history.
This report is about the round trip, not the book; the editorial judgement went to the author in the letters.

Working files live in the session scratchpad, `rounds/` (handoff/ and editor/): the four .docx files, both letters,
both replies, the edit and comment lists (`edits_r1.py`, `comments_r1.py`, `edits_r2.py`, `comments_r2.py`), the
apply/verify/bookmark scripts, and the working notes `notes-round1.md` and `notes-round2.md`. Finding ids below are
renumbered from those notes.

## What I was sent

### Round 1: `round1-from-writer.docx` (98,530 bytes) and a cover note

- **Package: seven parts.** These were `document.xml` (92,312 bytes), `styles.xml`, one header, the rels files,
  `[Content_Types].xml` and `docProps/custom.xml`. All were stored uncompressed.
  - There is no `core.xml`, `app.xml` or `settings.xml`. So the file carries no author, title or dates, and
    nothing in it turns Track Changes on.
  - `custom.xml` holds two properties a reader does not need: `KathalaDraft = mY6DkE7SV24Au4BiZVtVQ` and
    `KathalaWorld = jEoeUiqEF92tsA3Kga6E0`.
- **As a document.** LibreOffice renders 44 pages: US Letter, 1" margins, Times New Roman 12, double spaced,
  0.5" first-line indent. The running header reads "Callan / THE SALT LEDGER / n", with none on the title page.
  It is standard manuscript format, and I could work in it as sent. I would not have asked for another file.
- **Structure.** 394 paragraphs.
  - 6 chapter headings in Heading 1, reading "Ch. 1 — Sixty Measures" and so on.
  - 12 "#" scene breaks and a final "END", all in a "Scene Break" style.
  - That gives 18 scenes, which matches the note.
  - The paragraph style counts are SceneBreak 13, Heading1 6, Contact 4, Title 1, Byline 1. The other 369
    paragraphs carry no style.
  - Two styles are defined but never used: Heading 2 and Verse.
- **Bookmarks.** There are 18 of them, `KathalaScene_0` to `KathalaScene_17`. Each starts in the first paragraph
  of its scene and ends in the last.
- **Nothing hidden.** There was no `w:vanish` text, no fields in the body, no tracked changes and no comments.
  19 runs are italic.
- **The cover block.** It reads "Ruth Callan⇥about 12,000 words", then "Ruth Callan" again on the next line, then
  the email address and the phone number. So the name appears twice. The body measures 12,285 words, and her note
  says "about 12,300".
- **Typography.** The quotes are straight throughout (682 `&quot;`, no curly ones). There are 62 spaced em dashes.
  Ship names are in roman.

### Round 2: `round2-from-writer.docx` (100,905 bytes) and a cover note

- **Package.** It has the same seven parts as round 1, again uncompressed.
  - `styles.xml` and `header1.xml` are byte-identical to round 1's.
  - None of the parts LibreOffice had added to my file came back: no settings, no core properties, no comments
    part, no theme, no extra headers.
  - `KathalaDraft` has a new value (`D80iCqKoueiDy4QZZru5o`); `KathalaWorld` is unchanged.
- **Nothing of mine came back.**
  - There are 0 `w:ins`, `w:del`, `w:moveFrom`/`w:moveTo`, comment ranges or comment references.
  - "Margit" and "Hale" occur 0 times, and there are no `w:author` attributes.
  - No paragraphs are empty, no words are run together, and no sentence is doubled (the two repeats are her
    deliberate echoes).
- **Structure.** 398 paragraphs, 46 pages, still 6 chapters and 13 Scene Break paragraphs.
  - The 18 bookmarks are back to one per scene, each spanning its scene, numbered in the new scene order: the
    chase scene she moved is now `KathalaScene_6`, at the head of ch. 3.
- **The cover block.** It now reads "Ruth Callan⇥about 13,000 words", then the email and the phone, so the name
  appears once. The body measures 12,724 words.
- **Can I tell what she changed?** Not from the file; see E-2. I reconstructed it by diffing against my own
  file with every change accepted:
  - 39 paragraph-level hunks;
  - one scene moved (21 paragraphs, including its break);
  - four new paragraphs;
  - sentence-level changes in about 25 paragraphs.
- **Her account against the file.** I checked all 66 of my round-1 edits against her text.
  - 52 are present exactly as I made them, including the moved sentence (present once) and the inserted sentence.
  - 11 are back to her wording. These are exactly the eleven she lists as declined.
  - 2 front-matter edits were superseded, and 1 she says she redid by hand.
  - Her account matches the file in every case.

## What I did

| | Round 1 | Round 2 |
|---|---|---|
| Edits made (all found and applied, 0 failures) | 66 | 14 |
| Tracked changes in LibreOffice before saving | 116 (53 ins, 63 del) | 26 (12 ins, 14 del) |
| Tracked changes on reopening the saved file | **115** (52 ins, 63 del), see E-4 | 26 (12 ins, 14 del) |
| In the XML | 52 `w:ins`, 66 `w:del`, 1 `w:moveFrom`/`w:moveTo` pair | 10 `w:ins`, 12 `w:del`, 3 move pairs |
| Paragraph marks inserted / deleted | 3 / 2 | 0 / 0 (the paragraph move is a moved mark) |
| Comments (XML = reopened) | 40 (27 queries, 10 praise, 3 remarks) | 16 (9 praise, 5 queries, 2 remarks) |
| Author on every change and comment | Margit Hale (initials MH) | Margit Hale |
| Letter | 3,659 words | 1,328 words |
| Covering email | 415 words | 375 words |

**Round 1 edits by kind:**
- phrase 18, word 16, short cut 8;
- consistency 7 (afterwards ×3, towards ×3, Gods);
- punctuation 5;
- long cut 3 (one a whole paragraph);
- paragraph break 3, rewrite 2, insertion 2 (one a new sentence);
- paragraph cut 1 (the duplicate name);
- moved sentence 1.

20 of the 39 "looked" were changed. The comments spread 7, 13, 3, 5, 7 and 5 across the six chapters.

**Round 2 edits by kind:** phrase 4, cut 3, rewrite 2, word 2, punctuation 1, moved sentence 1, and one moved
paragraph.

**Checks on the round-2 file.**
- Rejecting all changes in LibreOffice gives back her file paragraph for paragraph (398 = 398).
- Accepting all gives the intended order.
- 13 Scene Break paragraphs, none restyled.

**The letters.**
- Round 1 had the strengths first, then nine themed sections: the clock (with a day-by-day reconstruction), who
  knows what (10 items), structure, the ending, Corin's turn, characters, point of view, continuity and prose. It
  closed with an ordered list of what to do next.
- Round 2 answered her three questions, listed four new problems her fixes had made, accepted her declines, and
  covered small things.

## What got in the way (most costly first)

**E-1. LibreOffice's save breaks every scene bookmark it can. Reproduced in both rounds, with no edits needed.**
- **What I did.** I opened the writer's round-1 file and saved it as MS Word 2007 XML with no edits
  (`roundtrip.py`).
- **What I expected.** 18 bookmark starts and 18 ends, each `KathalaScene_N` spanning its scene.
- **What happened.** 34 starts and 18 ends.
  - For 16 of the 18 names there are now two starts with the same name. One is unpaired, at the scene's first
    paragraph. The other is at the start of the scene's last paragraph, and that is the one paired with the end.
  - So the only complete range covers one paragraph. For example: "`KathalaScene_0` … paired start para 27 → end
    para 27 (1 paras) 'When the bell went for the end of the day…' UNPAIRED start at para 7 'The Salt House kept
    its ledger…'".
- **In the files I returned.**
  - Round 1 had 31 starts / 18 ends: 13 of 18 broken. The five that survived whole include three scenes whose
    last paragraph I had edited.
  - `KathalaScene_4`'s paired range sat entirely inside a paragraph I had cut, and its stray start was inside the
    `w:del`.
  - Round 2 had 33 starts / 18 ends: 15 of 18 broken.
- **LibreOffice's own view.** It reports 18 bookmarks on load, both before and after; the damage is only in
  what it writes.
- **What it cost.** Less than I feared, as far as the text shows. Her round-2 text has my round-1 edits in 17 of
  18 scenes (the 18th had only edits she declined), and 12 of those 17 scenes had broken bookmarks. Her file came
  back with 18 clean bookmarks.
- **Why it still matters.** Every editor who uses LibreOffice will send this shape: duplicate bookmark names and
  one-paragraph ranges.

**E-2. The revision came back with no record of what changed, and neither did her answers to my comments.**
- **What I expected.** Some way to see what she had changed, on the page.
- **What happened.**
  - The round-2 file is clean: no tracked changes, no comments.
  - She writes "I've answered each of your margin comments at my end", but none of those answers is in the file.
  - The only account of her revision is her cover note.
- **What I did instead.** I accepted all my round-1 changes in LibreOffice (`acceptall.py`), diffed paragraphs
  against her text, then checked each of my 66 edits individually (`r2-edit-status.txt`). Her note turned out to
  be complete and accurate.
- **The cost for an editor without scripts.** A full reread, or a Word Compare against their own file. The
  reconstruction found 39 changed regions, including a 21-paragraph scene move, none of them marked.

**E-3. A tracked deletion of a whole paragraph restyled the scene break after it, untracked. Reproduced, then
avoided.**
- **What I did.** In round 1 I cut the last paragraph of ch. 2, scene 2, as tracked. I selected it the way a
  person does: from its start to the start of the next paragraph, which was a "#" in Scene Break style.
- **What happened.** LibreOffice saved that "#" paragraph with style Normal and no `w:pPrChange`. The PDF shows
  the "#" left-aligned and indented, and the file had 12 Scene Break paragraphs instead of 13.
- **Evidence.** `editor/r1-edited-v1-scenebreak-restyled.docx`, paragraph 111:
  `<w:pPr><w:pStyle w:val="Normal"/>…<w:t>#</w:t>`.
- **The fix.** I cut the previous paragraph's mark plus this paragraph's text instead, so the "#" kept its style.
  An editor who didn't look closely would have sent the restyled break. The writer had asked that "the scene
  breaks (#) stay where they are".

**E-4. One tracked paragraph break stops being a change once LibreOffice has saved it.**
- **What I did.** In round 1 I split three paragraphs as tracked changes.
- **What happened.** All three are in the XML as inserted paragraph marks. On reopening, LibreOffice reports only
  two, and the count drops from 53 to 52 insertions. The missing one is after "…something sharper, like cloves."
  in ch. 4; that paragraph also carries a comment.
- **Rejecting everything doesn't undo it either.** Reject-all on my round-1 file in LibreOffice gives 395
  paragraphs, not the original 394. That split survives (`r1-rejected.txt` against `orig.docx`).
- **Her side.** Her note says "One of your three paragraph splits ran two sentences together at my end, and I've
  put it right by hand." Both splits she kept are correct in her file now, so I can't tell which one it was. I
  asked her.

**E-5. My edits to the title page did not arrive.** This comes from her account, and the file agrees.
- **What she wrote.** "Your title-page fixes didn't come across as changes, so I've fixed the duplicate name
  myself. My software now rounds the count to 'about 13,000'."
- **What I had done.** Both edits were tracked changes in the contact block: "12,000" → "12,300", and the deleted
  duplicate line. That block is before the first scene bookmark.
- **What came back.** The count reads 13,000, and the name appears once.
- **What I expected.** That an edit anywhere in the file is an edit.

**E-6. The cover block misstates the book.**
- Round 1 printed her name twice and said "about 12,000 words" against the 12,285 I measured.
- Round 2 says "about 13,000" against 12,724, and her own estimate of "about 12,700".
- A reader of the manuscript sees this before anything else.

**E-7. Comments I added through the API without a date were written as `w:date="0-00-00T00:00:00Z"`.**
- This happened to all 40 comments in my first round-1 save. Setting `Annotation.DateTimeValue` fixed it.
- It was my tool, not her file. But a scripted editor could send exactly that.

**E-8. The author names scenes the editor cannot see.**
- Her note says "'very faint' in Night Work". The manuscript has no scene titles, only "#".
- I found the scene by searching for the phrase.

**E-9. Normal is not marked as the default style.** In `styles.xml` the Normal style lacks `w:default="1"`.
- As a result, python-docx reports `p.style` as None for 369 of the 394 body paragraphs, and `p.style.name`
  raises an error.
- Word and LibreOffice render the file fine. A tool reading styles does not.

## What I only suspect

- **S-1. Word and the duplicate bookmark names (E-1).** Which of two same-named starts does Word keep, and does
  it call the file damaged? Opening my round-1 file in Word would settle it.
- **S-2. Hyphenation.** LibreOffice adds `w:autoHyphenation w:val="true"` to `settings.xml` on every save, even a
  plain round trip, so Word may hyphenate a manuscript that wasn't hyphenated before. Opening my file in Word
  would show it.
- **S-3. Which split ran together (E-4).** That the run-together split is the "like cloves" one is a guess. It
  rests on that being the one LibreOffice no longer sees as tracked. Her answer to my question would settle it.
- **S-4. Why the title-page edits were dropped (E-5).** That they were dropped because they lie outside every
  scene is a guess from her note's "scene by scene". An edit placed before the first scene break, within the
  front matter, in another run would test it.
- **S-5. Moved paragraph marks.** My round-2 paragraph move is written as moved text plus a moved paragraph mark
  (`w:moveTo` on one paragraph's mark, `w:moveFrom` on another's). In round 1 a sentence move "reached me as a
  separate deletion and insertion", which was fine. Whether a moved paragraph mark comes back intact is untested
  until she replies.

## What worked

- The file she sent both times was a clean, conventional manuscript, and I could edit it without cleaning
  anything up. It had semantic styles (Heading 1, a real Scene Break style), a correct running header, no
  leftover codes, and no hidden text.
- Everything I did in the margin and the text landed in my file, verified three ways: XML, reopening, and
  accept/reject.
  - 66 of 66 and 14 of 14 edits applied.
  - 40 of 40 and 16 of 16 comments placed.
  - Everything signed Margit Hale.
- Her revision took my changes exactly as I made them. 52 edits are verbatim, including a moved sentence that
  appears once, not twice. The 11 she declined are cleanly gone, and nothing of mine came back pending,
  duplicated or as markup.
- Scene breaks survived in both directions, including her move of a whole scene to another chapter. The
  bookmarks I sent broken came back regenerated and whole.
- Her cover notes were precise enough to check against the file, and every claim checked out.
