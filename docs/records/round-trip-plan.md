# The round trip with an editor: a plan

**Status:** proposed 2026-11-09. The decisions marked *proposed* need a yes before their part is built.

## Where it comes from

The first run of a writer and an editor together (2026-11-09) sent one book back and forth three times. The writer
used the app; the editor never saw it and worked on the Word file in LibreOffice. Both records are in this folder:

- `writer-run-2026-11-09-blind-editor.md` (and `.pwk`): the writer's side, findings W-*, RT-*, LT-*;
- `editor-run-2026-11-09.md`: the editor's side, findings E-*.

**What held.**
- Every change and all 56 comments came in against the right scene, in both rounds. That was true even though
  LibreOffice broke 13 of 18 scene bookmarks on its first save.
- A line the writer changed after sending survived.
- Nothing of the editor's leaked into the revision the writer sent back.

R4's main promise stands. What failed is narrower, and each failure is in one place in the code.

**What failed, by cost to the writer:**
- **RT-1, the worst.** A tracked paragraph split arrives as two changes. Accepting the tracked one first runs two
  sentences together ("time.At the edge"), and the second change then blames the writer.
- **RT-2, RT-3.** Moves and replacements arrive in pieces that can each be accepted alone. Accepting half of a move
  deleted a paragraph or doubled a sentence. Accepting half of a replacement left "a letter under his hand".
- **W-A.** After a paste of several scenes, the headers naming people and places the world doesn't have are offered
  one scene at a time. The rest sit unapplied, looking applied, until a reload.
- **W-G.** Italics written `*like this*` go to the editor as asterisks.
- **LT-1.** The letter splitter misses numbered and question headings, and keeps the greeting and sign-off as
  tasks, against what the guide says.

The rest are smaller, and listed in T6.

The mechanisms below were read from the code at `5ed6572`. The writer's were read after the behaviour was seen.
RT-1's and LT-1's were checked again for this plan, LT-1's by running `splitLetter` on both of the editor's real letters.

## The plan

Six parts, T1 to T6, each one or more PRs, in the order given. T1 comes first because it is the only part that
corrupts prose. T2 to T4 are each a day or two. T5 is a feature, and needs a decision before it is planned in
detail.

**Fixtures from the run.** The run's files are the best test material this repository has had for R4, because a
person-shaped editor made them in a real word processor, unprompted by the tests. Copy them into
`src/lib/__tests__/fixtures/docx/run-2026-11-09/`:
- `round1-from-writer.docx`, `round1-from-editor.docx`;
- `round2-from-writer.docx`, `round2-from-editor.docx`;
- both letters, as `.txt`;
- the sent draft each file names, taken from the `.pwk`, so the untracked edits can be found as the app found
  them.

Each part below names the counts the tests must reproduce from them.

### T1: an editor's changes come in as the editor made them

**T1.1 Paragraph marks (RT-1, E-4).**
- **The mechanism.** `docxRead.ts` reads a paragraph's `pPr` only for its style (line 100; "pPr … say nothing
  about the words", line 126). A paragraph mark inserted with tracking on, `w:pPr/w:rPr/w:ins`, is never seen.
  - So the *original* view of the file already has the split, and the deleted space beside it is the only tracked
    change.
  - The split itself is found only against the sent draft, as an "untracked edit".
  - Two changes overlap on one gap, and applying one makes the other's words disappear.
- **The fix.** Read the paragraph mark's own `ins`/`del`.
  - An inserted mark: in the original view, that paragraph and the next are one, with nothing between their words.
    In the edited view they are two.
  - A deleted mark is the reverse, which is how an editor joins two paragraphs.
  - Then the split is one tracked change with the space, and nothing is left for the untracked comparison to find.
- **Label it.** A change whose only effect is a paragraph break is labelled *New paragraph at "…time. | At the
  edge…"*, or *Paragraphs joined*, not "time. → time.". `shownChange` gets a case for a change that is only
  whitespace across a break.
- **Order safety, for whatever is left.** Two pending changes in one scene whose ranges touch or overlap are made
  one change at import. No order of accepting can then run them into each other.
  - A guard in the apply step, for edits made since the import: if accepting a change would leave a sentence's end
    against a capital with no space (`[.!?]["”’)]?[A-Z]`) where neither the scene before nor the change had one,
    refuse it and say why.
  - The writer found the corruption only by scanning the store for that pattern.
- **"Accept all 1" did nothing (RT-1).** In `ChangesDialog.tsx:98`, `acceptScene` marks stale changes and accepts
  none, silently.
  - With every remaining change stale, the button is disabled, and the scene says *These changes no longer match
    the scene: make them by hand, or reject them*.
  - With some stale, it says how many it could not make.
- **Measure.**
  - The round-1 file brings in 3 paragraph splits as 3 tracked changes and **0 untracked**. Today it gives 6
    changes, 3 of them "made with tracking off".
  - The editor never edited untracked, so the round-1 file's untracked count must be 0.
  - Accepting each split in either order gives `time.\n\nAt the edge`.
  - A paragraph join in a hand-made fixture comes in as one change.
  - A unit test for the guard.
  - An e2e test that accepts a split from the Changes dialog and reads the scene.
  - Mutants: drop the mark's `ins`; drop the overlap merge; drop the guard.
- *As built (`t1-1-paragraph-marks.md`):* as planned. Each view of the file joins paragraphs by their marks, so a
  split is one tracked change, and round 1 finds 0 untracked edits. For every scene in both rounds, accepting all
  its changes in either order gives the file's text.
  - The overlap merge works on each change's place in the text both comparisons share (`locatedHunks`). The run's
    files no longer need it.
  - The guard counts sentence ends against a capital (`runTogether`).
  - `acceptSuggestion` says why it did not make a change (`gone`, `runs-together`).

**T1.2 A move is one change (RT-2).**
- **The mechanism.** `docxRead.ts:108-109` maps `moveTo` to an insertion and `moveFrom` to a deletion, by design
  (`r4-word-round-trip.md`).
  - The halves are then separate suggestions.
  - The deletion half of a moved paragraph shows the paragraph struck through, "→ (removed)". That is the
    paragraph the editor's letter praised.
- **The fix.** Pair the halves by the `w:name` on their `moveFromRangeStart`/`moveToRangeStart`. Fall back to
  identical text in the same scene when a word processor drops the name.
  - The pair is one suggestion: **Moved**, showing the words and where they go ("before *The Black Mare cleared
    the bar…*").
  - Accept applies both halves, or neither. Reject drops both.
  - A move across scenes is one suggestion listed under both scenes, accepted from either.
- **Storage.** `EditSuggestion` gains an optional `pair` id, and the apply step takes a pair as one edit.
  - The `editSuggestions` table is not in backups (R4), so there is no `.pwk` change.
  - A Dexie version bump is needed only if the field is indexed. It need not be.
- **Measure.**
  - Round 1 gives 1 move. Round 2 gives 2: a sentence, and a paragraph whose text and mark move together.
  - Each move is one suggestion with one Accept. Accepting it leaves the sentence once and the paragraph once, in
    the new place.
  - Unit tests over the fixtures. An e2e test of the paragraph move. Mutants: unpair; apply one half.
- *As built (`t1-2-moves.md`):* LibreOffice writes no `w:name` on a move, so the halves are not paired by name. The
  file is read in steps instead: the moved words taken out, then put where they went, then every other change.
  Each half is laid on the words the markup says moved, and the halves are paired by those words.
  - That reads each move as the editor made it. A comparison of the whole had described her paragraph move as the
    other paragraph moving down.
  - Each half is a row of its own, sharing a `move` id. It is accepted, rejected, counted and shown as one change.
  - The e2e test is of a moved sentence. The paragraph move is held by the run's round-2 file.

**T1.3 A replacement is one change (RT-3).**
- **The mechanism.** The tracked changes are found by diffing the file's original view against its edited view
  (`hunks`, `docxEdits.ts:143`). The diff is refined to words within the changed paragraphs.
  - So a deletion of "in his hand" next to an insertion of "under his seal" becomes `in → under` and
    `hand → seal`, with "his" in common.
  - The app counted 85 changes where the editor made 67, and 24 where she made 14.
- **The fix.** A hunk is cut along the *file's* change runs, not the word diff. Contiguous `del` and `ins` runs,
  with nothing unchanged between them, are one change.
  - Inside it, the word diff still decides what is drawn struck through and what is drawn new. So the marks on the
    Page stay as tight as they are.
  - Untracked edits have no runs to follow. They keep the word diff, merged where pieces are separated by a single
    word, as `joins` already does for whitespace.
- **Measure.**
  - Round 1 comes to **67** changes and round 2 to **14**, matching what the editor counted in her own file.
  - "in his hand → under his seal" is one change.
  - Unit tests, and the R4 fixtures re-counted. R4's `edited-libreoffice.docx` must still give what its test says.
  - Mutant: cut by the word diff again.
- *As built (`t1-3-replacements.md`):* as planned. Each reading of the file records where every piece is, and
  `changeRuns` gives each run of tracked changes its place in both texts. The comparison's changes inside one run
  are made one.
  - Edits made with tracking off, one word apart within a sentence, are merged.
  - Round 1 comes to **64** changes and round 2 to **14**: the editor's own counts (66 and 14), less the 2 of
    round 1's that were on the title page, which T1.4 lists apart.

**T1.4 What came in outside the scenes (RT-4, E-5).**
- The editor's two title-page edits were dropped, uncounted.
- **The fix.** A tracked change or a comment before the first scene, in the title page and contact block, is
  listed first in **Changes** as *On the title page*, with its words, for the writer to read and act on by hand.
  - The title page is generated, so there is nothing to accept into.
  - The import's summary counts them: *2 on the title page*.
- **Measure.** Round 1 lists 2. A unit test, and a mutant that drops them.
- *As built:* chapter headings as well as the title page (`outsideScenes`). Round 1 lists the 2.

**T1.5 A scene break restyled (E-3).**
- Cutting the paragraph before a `#` in LibreOffice saved the `#` as Normal, with no record of the change.
  `docxRead.ts` decides what is prose by style (`NOT_PROSE`, line 58).
  - So a restyled break would come in as a scene's new last paragraph, "#": an untracked insertion of a `#` into
    the prose.
  - The editor saw this happen and redid her cut, so it did not reach the writer this time.
- **The fix.** A paragraph whose whole text is the export's break (`#`) is a break, whatever its style. The same
  goes for the `END` marker.
- **Measure.** A fixture with a restyled break, made the way the editor made it (`scripts/docx-fixture-edit.py`
  extended), brings in no change and keeps the scene's end.
- *As built:* the fixture is the editor's own first save from the run (`round1-restyled-break.docx`), which has the
  restyled `#`. It brings in no `#` and no edit with tracking off. A `#` inside prose ("Room #4") is still prose.

**T1.6 LibreOffice's bookmarks (E-1).**
- The importer survived the duplicated starts because a bookmark is read as where a scene *starts*
  (`docxRead.ts:15-18`). That held across 13 broken bookmarks.
- Nothing tests that shape against a real save, though. Add the round-1 editor file as the fixture that does.
- **Look into, before changing anything:** whether a bookmark made empty at the scene's first paragraph
  (start and end together) survives a LibreOffice save whole.
  - If it does, the file the editor receives is no longer broken, and S-1 (what Word makes of duplicate names)
    stops mattering.
  - Measure with `soffice`: open, save, count starts against ends. It is a change to the export only if the
    count says so.
- *As built:* the count said so. A plain LibreOffice save of the round-1 file gave **34 starts for 18 names** with
  range bookmarks, and **18 for 18, whole**, with each bookmark a point at its scene's first word. The export now
  writes points.
  - Files already sent with ranges still come in as before.
  - S-1 is moot for files made from now on.

### T2: what goes out

**T2.1 Asterisk italics (W-G).**
- `proseEmphasis.ts` reads `_underscores_` only. The reason is that the Library's Gutenberg books have no
  `*italic*`, and `* * *` is a scene separator.
  - The reason is about published books. A writer's own drafts use asterisks often: this one had 19 spans.
  - The Page shows the asterisks literally, and the export ships them.
- **Decision D-1 (proposed): read `*word*` as italic too.**
  - It counts where the opening `*` is followed by a non-space and the closing `*` is preceded by one, within a
    paragraph.
  - A line of only asterisks and spaces is never emphasis, so `* * *` keeps its meaning.
  - `**bold**` is left as it is. The app has no bold, and the export shows it literally.
- **Before deciding,** run the probe over the Library and count paragraphs whose reading would change. The run
  claims there are none; the probe measures it. If the count is not 0, look at every one.
- *Alternative*, if the count says no: convert on paste only, and warn in the export dialog when a scene has
  `*…*`. That keeps reading as it is and stops the shipping.
- **Measure.**
  - The probe's count, kept in the record.
  - Unit tests: a span, a separator, a lone `*` (a footnote mark, "5 * 3"), a span across a line break.
  - The writer's round-1 text exports 19 italic runs and 0 asterisks.
- *As built (`t2-what-goes-out.md`):* D-1 taken. The probe (`npm run probe:emphasis`) read 51 books and 98,474
  paragraphs, 150 of them with an asterisk.
  - **32 read differently, all in *The Undersong*.** It is an original book written with asterisks, whose italics had
    shown as asterisks until then.
  - **None of Gutenberg's change.** Its footnote marks, `* * *` lines and NIND markers all stay as they are.
  - **The import was changed too.** A scene that writes `*so*` gets the file's italics back as asterisks, so that
    none of them comes in as an edit.

**T2.2 The title page (E-6, RT-4).**
- **The name printed twice.** The contact block's first line is the writer's name, then the contact lines. This
  writer, like most, put their name at the top of the contact field.
  - Drop a first contact line that equals the name.
  - Say under the field: *Your name is put above these lines.*
- **The count.**
  - `roundedWordCount` rounds to the nearest thousand from 10,000 words: 12,724 → "about 13,000". Both the editor
    and the writer wanted "about 12,700".
  - Round to the nearest hundred under 20,000 and the nearest thousand from there. A writer of a novella is the
    one this rounding is wrong for.
  - Offer a **Word count on the title page** field. Left blank it rounds. Filled, it says what the writer says.
- **Measure.** Unit tests on `roundedWordCount` and the contact block, and an export of the run's book.
- *As built:* as planned. The count field takes a bare number ("12700" reads *about 12,700 words*) or the writer's
  own words.

**T2.3 Which draft a file came from (W-H, S3).**
- Two exports gave two drafts both named "Sent for editing (the-salt-ledger.docx)"
  (`ExportManuscriptDialog.tsx:147`).
- **The fix.**
  - Name the draft *Sent for editing, 9 Nov 14:05*, after the editor's name where the writer gave one (*Sent to
    Margit Hale, 9 Nov*).
  - Mark in the Drafts list the draft a pending import was made from: *Changes waiting from this draft*.
  - Ask before deleting it: *Margit Hale's file was made from this draft. Without it, edits she made with tracking
    off cannot be found.*
- **S3 (a draft saved when no file was delivered)** is measured first: cancel the save dialog in a real browser,
  and look at Drafts. If it happens, save the draft only once the download has started, where the browser says
  so.
- **Measure.** Unit tests on the name, an e2e test of the delete warning, and S3's result in the record.
- *As built:* the draft's name, `sentAs`, `fromDraft` on each suggestion, the mark in Drafts and the delete
  warning are as planned. The draft is named for when it was sent, to the minute, and the file.
  - **S3 is not measurable from the page.** A download made by clicking a link gives the page no word of a
    cancelled save dialog, so a draft saved before it cannot be undone on a cancel. Left as it is; the warning on
    deleting a sent draft covers the cost.

**T2.4 Small, in the same PR.**
- `styles.xml` marks Normal `w:default="1"` (E-9).
- **Scene titles for the editor (E-8)** is left out: an editor's manuscript has none, and the writer can name a
  scene by its words.

### T3: a letter into tasks (LT-1)

- **The mechanisms.**
  - **The greeting.** It is looked for only in the first item (`editorialLetter.ts:89-90`). Both letters opened
    with a title line, so "Dear Ruth," was the second item.
  - **The sign-off.** It is matched at the start of a line (`SIGN_OFF`, line 31), and "With best wishes," starts
    with "With", which is not on the list. That held for both letters, which is why the name under it was kept as
    well. In letter 1 a signature block of two more lines ("Margit Hale", "Fiction editor") stood after it besides,
    beyond the three items the search looks back over.
  - **Headings.** `headingLike` takes a line with no stop. "1. THE CLOCK" starts with a list marker and is read as
    a point. "DOES THE CLOCK HOLD?" ends with a stop.
- **The fix.**
  - **The greeting.** Look for it anywhere before the first heading or point.
  - **The sign-off.** Allow a leading "With" (*with best wishes*, *with love*, *with thanks*), and look for it among
    the last five items, with everything after it, being short lines, unkept as the signature.
  - **Numbered headings.** A numbered line is a heading when it is short, has no stop, and stands over points or
    paragraphs. So is a line in capitals ending "?".
  - **Make a heading** on a point, beside **Not a heading**, so a wrong guess can be put right either way.
  - **The checkbox with no name.** A point's checkbox is named by its first words, in every case, including a
    point built from indented lines.
- **Not now:** the same task from two letters ("the ship italics", twice). Linking a new letter's points to old
  tasks is a feature of its own. Note it in the record.
- *As built (`t3-letter-splitter.md`):* as planned, with one rule added. A sentence that introduces bullets heads
  only those bullets, and the paragraphs after them are the section's again: that was the other half of tasks being
  filed under the wrong heading.
  - The measure was overstated. The letters now split to **68 and 23 points kept**, not 42 and 14. Every heading
    is the editor's, and the title, greeting, sign-off and signature are unticked without a click.
  - The rest of the writer's unticking was judgement — praise under *WHAT'S WORKING*, answers to her own
    questions — which the splitter does not make, by design (R5).
- **Measure.**
  - The run's two letters split to **42 and 14 points kept**, with **no unticking**. Today they need 39 and 16
    unticks.
  - Their headings are the editor's: "THE CLOCK", "WHO KNOWS WHAT", and so on.
  - The greeting and sign-off come unkept.
  - Unit tests over both letters. An e2e test for **Make a heading**. Mutants on each of the three detections.

### T4: headers after a paste (W-A)

- **What happened.** After a paste of several scenes naming unknown people and places, the note said three headers
  waited and offered **Create** for one scene's names.
  - The others were offered only after a reload, one reload per scene.
  - On the Page a waiting header looks like an applied one.
- **To read first.** The note is built in `DraftBook.tsx` and `SceneDraftSection.tsx` from
  `keptHeaderLines.ts`/`pendingNames.ts`. The finding's mechanism was not read. So the first step is to reproduce
  it in an e2e test (paste three scenes, each with an unknown place and person) and find why only the first is
  offered.
- **The fix, whatever the mechanism.**
  - The note offers every waiting scene's names at once, grouped by scene: *Create "Mother Gannet" (person) ·
    Create "The Pans" (place)*, and **Create all**.
  - Creating them applies each waiting header whose names are now all known, without a reload.
  - A waiting header is marked on the Page, so that it no longer looks like an applied one. Read first how the Page
    draws a header line now, and use the mark it already has for a line it could not apply, if there is one.
- **Measure.** An e2e test: the paste, **Create all**, every scene's cast and place in the store, no reload. Pair
  it with the same paste's waiting mark shown before the creates (CLAUDE.md, *pair an absence with a presence*).
  Mutants per the mechanism found.

### T5: the revision goes back marked (E-2) — needs a decision

- The writer's revision reached the editor clean: no tracked changes, and none of the 30 replies the writer wrote
  to her comments.
  - She reconstructed what had changed by accepting her own edits and diffing paragraphs, and found 39 changed
    regions, including a 21-paragraph scene move.
  - An editor without scripts rereads the book, or runs Word's Compare.
- **What it would be.** **For an editor** gains *Show my changes since the file I sent*.
  - The book is written as tracked changes against the draft the last import was made from, signed with the
    writer's name.
  - The editor's comments go back with the writer's replies under them, as Word reply comments
    (`commentsExtended.xml`, `w15:paraIdParent`).
  - Resolved comments are marked done.
- **What it touches.** The export's writer (`manuscriptExport.ts`) learns to write `w:ins`/`w:del` and comments.
  The import must then not read the writer's own tracked changes as the editor's when the file comes back with
  both. Authors are distinguished by name, and the writer's are skipped.
- **Decision D-2 (proposed): plan it as its own part after T1–T4,** with a fixture of Word's own reply-comment
  shape before any code. It is worth doing: it was the editor's costliest finding, and it closes the loop R4
  opened. It is also the largest piece here, and nothing in T1–T4 waits on it.

### T6: smaller findings

Each is a small PR or part of one, with a test.

- **W-C, "Recently edited" ignores the Page.** It sorts by the scene's `updatedAt` (`WorldDashboardView.tsx:218`).
  Page typing writes only `sceneTexts`. Sort by the later of the two.
  - Reopen **DASH-3** in `ux-review.md`: it was closed as fixed with a label the list does not live up to.
- **R2-D, a note's quote follows the reply.** Answering moves a note onto its words as they now read, by design
  (R1). Keep the words it was **made on**, shown under the note as *Made on: "the three tallyclerks"* once they
  differ.
  - The record of what was asked stays true.
  - The note gains `madeOn`, set once. It travels in `.pwk`. Whether an optional field needs EXPORT_VERSION bumped
    is decided as R1 decided it for notes.
- **W-D, an off-stage place.** The Current State location picker gains **New place…**, which makes the place and
  picks it.
  - Mark **W19-3** in `ux-review.md` as out of date: places no longer need a map.
- **W-E, the flashback warning.**
  - Name the scenes, not "Ch. 3" twice.
  - Give it **Mark as a flashback**.
  - Make Enter and **Go to scene** go to the scene.
  - Make "+ Flashback" one click, with `aria-pressed`.
  - It is the HB-1a pattern, for another check.
- **The splitter's twin task, W-A's cosmetic "Tomas Brenn or Tomas Brenn"**, and the first-run guide's step 3: in
  the record, fixed only if they come up in the same files.

### Suspicions to settle, not build

Each gets a measurement in the record of the part it belongs to. None is built on until measured.

- **Writer S1:** the side panel followed the wrong scene after a paste (T4).
- **Writer S2:** "+12,710 words today" on a 12,285-word book (T4: is a paste's header text counted?).
- **Writer S4:** a header line lost when left with the autocomplete open (T4).
- **Editor S-1:** Word and duplicate bookmark names (T1.6).
- **Editor S-2:** LibreOffice's `autoHyphenation` in a file it saved. That is the editor's software, not the app;
  note it in the guide only if Word does hyphenate.

## Order and size

| Part | What | Size | Waits on |
|---|---|---|---|
| T1.1–T1.3 | Paragraph marks, moves, replacements; Accept all | the largest; 2 PRs (T1.1, then T1.2–1.3) | the fixtures |
| T1.4–T1.6 | Title-page changes, restyled breaks, bookmark probe | small; with T1.3's PR | — |
| T2 | Asterisks (D-1), title page, draft names | 1 PR | D-1 |
| T3 | The letter splitter | 1 PR | — |
| T4 | Headers after a paste | 1 PR, after its mechanism is found | — |
| T5 | The revision goes back marked | its own plan | D-2 |
| T6 | Small findings | 1–2 PRs | — |

Each PR follows the editorial plan's process:
- unit or integration tests, and e2e where the behaviour is in the browser;
- mutants gated on `tsc`, `eslint` and a grep;
- the guide's sections updated, with screenshots where a screen changes;
- a record, `docs/records/tN-*.md`, and the relevant e2e specs run.

**Close the loop.** When T1–T4 are in, run the same pair of agents again: a new book, the same two rounds. Do it
blind, with the counts above as the expectation:
- 0 untracked changes from an editor who never edited untracked;
- the app's count equal to the editor's;
- no unticking of a letter's greeting.

A test that passes on fixtures is not yet a writer getting their book back.

## Decisions

- **D-1 (T2.1):** read `*word*` as italic in the prose, if the Library probe finds no paragraph whose reading
  would change. *Proposed.*
- **D-2 (T5):** send the revision back marked, as its own part after T1–T4. *Proposed.*
- **D-3 (T1.2, T1.3):** a move and a replacement are each one change to accept or reject. A partial accept of
  either is not offered: the writer who wants half of an edit makes it by hand, as with any change they half
  agree with. *Proposed.*
