# The round trip, part 3: a marked file an editor can read

**From:** `loop-2026-11-12.md`, the blind run of the writer and the editor at 79371d8, and its two reports:
`writer-run-2026-11-10-loop2.md` and `editor-run-2026-11-10-loop2.md`.

**Where it stands.** The marked file carries the right text and the right threads, and bringing a file in was exact
three times running. An editor still cannot read the marked file where the writer rewrote. That is the one
expectation of plan 2 that failed, and it comes first.

Six parts, in this order:
- **T8**, the marked file readable. The costliest finding of the run, for both people.
- **T9**, nothing of a thread lost.
- **T10**, what the editor can tell from the file, and is given with it.
- **T11**, bringing a file in: the smaller findings on the writer's side.
- **T12**, writing: the single Enter, and the small ones.
- **T13**, the suspicions, each measured.

Every finding of the run is in one of them. The table at the end says which.

The process is the one every T-part followed:
- measure first where a number decides the design, and keep the number in a test;
- tests first where a behaviour can be reproduced;
- mutants gated on `tsc && eslint && echo MUTANT-OK && grep`;
- the guide and its screenshots;
- a record, and the touched e2e specs on a production build;
- a PR each, merged on the word.

**The fixtures are in the repository:** `src/lib/__tests__/fixtures/docx/run-2026-11-12-loop2/` holds the six files
that went each way and the two letters. The drafts each file names are in `writer-run-2026-11-10-loop2.pwk`.

---

## Decisions

Five, each needed by one part only. **All five are taken, as proposed** (12 November 2026).

| | The question | Taken | Needed by |
|---|---|---|---|
| D-7 | How is a change that turns the editor's edit back told from the writer's new writing? | A second name on those changes | T10.1 |
| D-8 | Where do the app's words *On words since rewritten* go? | In a reply of the writer's, not in the editor's comment | T9.2 |
| D-9 | What happens to a comment on a heading? | It is kept when dismissed, and goes back on its heading | T9.4 |
| D-10 | Is a clean copy sent with the marked file? | Offered, ticked | T10.3 |
| D-11 | What does one Enter on the Page mean? | A line, as now; the Page shows it is one, and Word reads it as Read does | T12.1 |

Each is set out in its part, with the other choices.

---

## T8: the marked file readable

**Findings:** the record's 1 and 4. The writer's F1 and S1. The editor's E-1, E-6 and E-10.

**What happened.**
- Where the writer put new paragraphs before a lightly changed one, the new paragraph was compared word by word
  with the old one. One paragraph carried 113 alternating one-word marks, another 95.
- The old paragraph then came back whole, as an insertion.
- The dialog said *160 changes*, then *134*. The writer counted about 82 and 52.
- LibreOffice's reject-all left an empty paragraph for 2 of 8 new paragraphs in the round-2 file, and 1 in round 3.

**Why.**
- `markedParagraphs` (`markedDocx.ts`) finds the paragraphs that are the same in both texts. Those between them it
  pairs **in order**, first with first, and compares each pair word by word. It never asks whether two paragraphs
  resemble each other.
- `markedPlan` counts every stretch put in or taken out.

### T8.0: the measure, before any code

- **The two marked files are made again from the `.pwk`.** Each is the book as a *Sent marked* draft has it, marked
  against the *As Ines Marlowe sent it back* draft before it. They should equal the files the run sent, marks and
  all. If they do not, that is found out first.
- **The numbers to beat are written down as tests that fail:**
  - the most marks in one paragraph: 113 and 95;
  - paragraphs wholly put in that an unchanged-but-for-a-clause paragraph follows: counted;
  - the dialog's count against the count below, in T8.3.
- **LibreOffice's own reject-all and accept-all** join `npm run probe:marked`. That is the test the editor ran. The
  probe so far reads a LibreOffice-saved file with the app's reader, which is kinder.
  - Expected today: 2 empty paragraphs after reject-all in the round-2 file, 1 in round 3.
  - The pattern seen is that both follow a paragraph with no change of its own. The probe isolates it with files
    of one case each.

- *As built, T8.0 (`t8-0-measure.md`):*
  - The fixtures' drafts make the run's two files mark for mark, in 16 of 16 scenes each.
  - The numbers to beat: 112 and 94 marks in one paragraph; the dialog's 160 and 134 against the import's 49 and
    42; two paragraphs displaced in each file.
  - **The empty paragraph is isolated, and it is not what the loop's record guessed.** LibreOffice's reject-all
    leaves one where a new paragraph follows a paragraph that carries a comment. With the mark on the new
    paragraph's own break it does not.
  - A bag of words leaves little room between a new paragraph (up to 0.5) and a displaced one (from 0.61). T8.1
    measures words in order, and one paragraph inside another.

### T8.1: a paragraph is paired with the one it resembles

- **What to do.** Between two unchanged paragraphs, the changed ones are paired by likeness, in order. One with no
  like on the other side is put in whole or taken out whole, as one insertion or one deletion.
- **Likeness is measured, not chosen.**
  - **The floor:** every pair in the fixtures that a reader would call the same paragraph must pair. Wren's note in
    chapter 6 changed by one clause.
  - **The ceiling:** a new paragraph must not pair with its neighbour. The new chapter 4 opening is one.
  - The threshold is set between them and written down with the numbers.
- **The test the reader keeps stays:** rejecting every change gives the editor's text, and accepting every one the
  writer's, in 16 of 16 scenes of both fixtures and 13 of 13 of the first loop's.

### T8.2: a rewritten sentence is one stretch out and one in

- **What to do.** Within a paired paragraph, a sentence whose marks interleave is marked whole: its old words out,
  its new words in. The Changes dialog met the same fault and has the rule already (`shownChange`,
  `r4-word-round-trip.md`).
- **Where the line falls is measured** on the fixtures: a single word replaced stays a single word; *brandy behind a
  cable tier* made *brandy, without Nessa, three…* is one stretch.
- **Tests.** No paragraph in either fixture carries more than a number of marks that the measure sets. A one-word
  change is still one word.

### T8.3: the count is of changes, as bringing in counts them

- **What to do.** The dialog's number is what the import would say of the same file: `hunks` over the base and the
  book, scene by scene. A writer and an editor then count alike.
- **Test.** For both fixtures, the marked file read back and planned gives the dialog's number.

- *As built, T8.1–T8.3 (`t8-1-readable-marks.md`):*
  - The most marks in one paragraph went from 112 and 94 to 4 and 6, and no paragraph is displaced.
  - **Two paragraphs are alike** at half the longer's words in order, or four fifths of the shorter's with an
    unbroken run. The numbers are set between the cases of both loops' files.
  - **Most of T8.2 came with T8.1.** What was left is one rule: changes a word or two apart, in one sentence,
    are one. A sentence with several changes marked whole was written, measured, and taken out: it changed nothing
    on these files and would strike a whole sentence for three small corrections.
  - **The dialog says 36 and 31** where it said 160 and 134, and that is what bringing the marked file in would
    say, in all 32 scenes.

### T8.4: rejecting every change gives the editor's file, in LibreOffice too

- **What to do** depends on T8.0's isolating the case. The form of a new paragraph's mark is changed only where
  the probe shows LibreOffice needs it, and Word's form is kept where it does not.
- **The title page's word count** changed without a mark in both rounds. It is written as a tracked change when
  the base's count and the book's differ. Both are known.
- **Tests.** A unit test on the XML for each form the probe settles, since CI has no LibreOffice. The probe's
  table, before and after, in the record.

- *As built, T8.4 (`t8-4-reject-all.md`):*
  - **Neither form of a new paragraph's mark is right everywhere in LibreOffice, and each fails in one place.**
    Word's, on the break before, leaves an empty paragraph after a paragraph with a comment in it. The mark on the
    new paragraph's own break joins two paragraphs after one that ends in words put in.
  - **So the form is chosen by case:** the new paragraph's own break where the paragraph before holds a comment and
    does not end in words put in, and Word's everywhere else. 29 cases are right both ways, read by LibreOffice
    as made and by the app after a LibreOffice save.
  - **The title page's count** is read from the editor's file on the way in and kept with the draft of it. Where the
    count has changed, the marked file strikes the one and puts in the other.

**T8 size.** T8.0 is a PR of its own, the measure and nothing else. T8.1–T8.3 go together. T8.4 follows.

---

## T9: nothing of a thread lost

**Findings:** the record's 3, 5, 6, 7 and 10. The writer's F3, F5 and parts of F7. The editor's E-3, E-4 and E-5.

### T9.1: a comment with no range is read (the record's 3)

- **What happened.** The export puts a thread whose words were rewritten at the start of its scene, on no words.
  LibreOffice saves such a comment as a bare reference, without range marks. `docxRead` places a comment by its
  range marks only. So 5 threads in round 2, and 10 in round 3, were never read on the way back in.
- **What it cost.** Nothing this time. A reply to one of them, or its resolving, would have been lost without a
  word.
- **Measure first.** With the probe: what LibreOffice writes for a comment an editor makes with nothing selected. If
  it is the same bare reference, such a comment has never come in.
- **What to do.** A reference with no range is a comment at that point.
  - One that answers a thread that went out is matched as now.
  - A new one becomes a note on the word at that point, as Word anchors a comment made with nothing selected.
- **Tests.** The run's files: round 2 back gives 53 threads and 31 replies where it gives 48 and 29 today; round 3
  gives 59 and 43 where it gives 49 and 37.

- *As built, T9.1 (`t9-1-comments-with-no-range.md`):*
  - **Measured: LibreOffice saves a comment made with nothing selected as a reference alone.** So no such comment
    from an editor had ever come in.
  - The reader takes a reference with no range for a comment at that point. The planner already put a comment on
    no words onto the word it stands before; after a scene's last word it now takes that word.
  - The run's files give every thread: 53 and 31 replies in round 2, 59 and 43 in round 3.

### T9.2: the app's words are not put under the editor's name (D-8; the record's 6)

- **What happened.** *On words since rewritten: "…"* was written into the body of the editor's own comment: 5
  comments, then 10. The editor: *I would rather it didn't look as though I'd said it.*
- **D-8, taken:** the line goes in a reply signed by the writer, first under the thread. On the way back in it
  is known for the app's and is not made a reply.
- **The other choices, not taken:**
  - leave it in the comment, in brackets, signed *Kathala*;
  - leave the thread on the nearest surviving words and say nothing.
- **Tests.** The editor's comment's body is byte for byte what was sent, in both fixtures. The line is not doubled
  on a second export, and is not a reply in Notes.

### T9.3: a comment keeps its date (the record's 7)

- **What happened.** `compileDocx` writes the export's time on every comment. A round-1 comment carried three dates.
- **What to do.**
  - Bringing in reads each comment's and each reply's date from the file, and keeps it.
  - The export writes each comment's own date. Only the writer's changes carry the export's time.
- **Tests.** A file with comments of three dates, brought in and sent back, has the same three.

### T9.4: a comment on a heading goes back (D-9; the record's 5)

- **What happened.** The editor sent 39 comments and got 38 back. The one on a chapter heading is listed in Changes
  with Dismiss, and dismissing it deletes it. There is no way to answer it.
- **D-9, taken:** dismissing keeps it. It can be given a reply. The marked export writes it on its heading, with
  the reply under it, resolved if dismissed.
- **The other choice, not taken:** it stays as it is, and the dialog says so: *1 comment on a heading is not sent back.*
- **Tests.** Round 1's file: 39 comments go back, the heading's on its heading.

### T9.5: replies and a resolved thread are announced (the record's 10)

- **What happened.** *Edits brought in* speaks of changes and new comments only. Six of seven replies sat in
  resolved threads, which Notes hides by default. A reply has no mark and no date.
- **What to do.**
  - The dialog says them: *7 replies were added to your notes, and 1 thread was resolved.*
  - It offers to show them. Notes then lists the threads with a reply from that file, open or resolved, each new
    reply marked.
  - A reply shows its date.
- **Tests.** Unit: the import's result counts replies and resolved threads. E2E: the marked round trip in
  `wordRoundTrip.spec.ts` gains the sentence, the link, and the reply shown in a resolved thread.

**T9 size.** T9.1 with its probe is one PR. T9.2–T9.4 go together: what the file holds. T9.5 is one.

---

## T10: what the editor can tell, and is given

**Findings:** the record's 2, 8 and 9. The editor's E-2, E-7, E-8 and E-9, and wishes 3, 7 and 8.

### T10.1: a change that turns an edit back says so (D-7; the record's 2)

- **What happened.** The file is measured from the editor's text (D-4). So an edit the writer declined is a change
  of the writer's, and looks like any new writing. The writer turned one sentence back and left it off the list in
  the cover note. The editor could not tell a choice from an accident.
- **What can be known.** Three texts are on the device: the book as it went to the editor, as the editor sent it
  back, and as it is. A change that puts back, at its place, the words the book had when it went is the editor's
  edit turned back. T5.3 reads the same thing the other way round.
- **D-7, taken:** those changes are signed with a second name, the byline and *(edit declined)*.
  - Every word processor colours changes by author and can list or filter by one.
  - Bringing the file in treats both names as the writer's.
- **The other choices, not taken:**
  - a comment of the writer's on each: *Declined: "…" kept.* That is nine more comments in round 2;
  - nothing in the file, and the tally of T10.2 only.
- **Tests.** Round 2's fixture, with the number stated from the file. By the two reports it is eight turned back,
  the unlisted *Nessa* sentence among them. A ninth the writer rejected and then rewrote, *heart stopped*, is new
  writing and is not signed so.

### T10.2: the tally (the editor's wish 8)

- **What to do.** The dialog says what became of the editor's changes: *Of Ines Marlowe's 58 changes: 48 stand, 9
  turned back, 1 rewritten since.* **Copy** puts it on the clipboard for the cover note.
- It is counted from the three texts. The Changes list cannot be asked, because a change is deleted once decided.
- **Tests.** Both fixtures' tallies against the writer's own records, each difference explained. The writer
  accepted 48 and rejected 9, then 15 and 4. A change rejected and then made by hand stands, and one rejected and
  rewritten is rewritten, so the tallies are near those figures and not equal to them.

### T10.3: a clean copy beside the marked one (D-10; the record's 9)

- **What happened.** The editor asked for one. The writer made it with a second export. With it, checking took *an
  hour instead of an afternoon*.
- **D-10, taken:** under the marked option, **And a clean copy to read**, ticked. A second file comes down,
  named `…-clean.docx`: no marks, comments or bookmarks, and nothing the app reads back.
- **The other choice, not taken:** offered, unticked.
- **Tests.** E2E: two downloads; the clean one has no scene bookmarks and is refused by *Bring in edits* with a
  message that says which file to bring.

### T10.4: the file opens with tracking on (the record's 8)

- **What to do.** Every *For an editor* file carries `word/settings.xml` with tracking on: the first one sent too.
- **Measure.** The probe opens it in LibreOffice and reads whether changes are being recorded.
- **Why it matters beyond this run.** Edits made with tracking off are the round trip's oldest hazard.
- **Tests.** A unit test on the part. The probe's answer in the record.

### T10.5: smaller

- **The file can be renamed** (E-8). The writer asked the editor to keep its name, and the name does not matter.
  The guide and the dialog say so.
- **The file says what it is** (E-9): `docProps/core.xml` with the title and the byline.
- **The language tag** (E-9) is `en-US` on every book. It is left out, so the editor's own default applies.
  Measured in LibreOffice first: what the file then reads as.

**T10 size.** T10.1–T10.2 go together. T10.3–T10.5 go together.

---

## T11: bringing a file in

**Findings:** the record's 11, 12 and 13. The writer's F4, F6 and parts of F7.

### T11.1: a change says before the click whether it can be made (the record's 11)

- **What happened.** A change on words the writer had rewritten looked ordinary until Accept refused it. The writer
  then typed the editor's words in by hand. The change stayed, refused again, and only Reject cleared it.
- **What to do.** When the list opens, each change is tried against its scene.
  - One whose result is already in the scene, at its place, says *Already in the scene* and offers **Clear**.
    Accept all clears those too.
  - One that cannot be made says why at once, as it does now after the click.
- **Tests.** Unit: the run's case, *four hours in the rain*. E2E: a change made by hand is listed as made, and
  cleared.

### T11.2: the letter (the record's 12)

Three variants that `t3-letter-splitter.md` does not cover, all in the run's two letters:
- **A heading over a one-line introduction that ends in a colon** loses its heading to the introduction: *WHAT MOST
  NEEDS WORK*, *6. Smaller continuity, quickly*, *SMALL THINGS I'VE CHANGED*.
- **A sign-off with a clause after it** is ticked: *With warm regards, and thanks for a book I was glad to spend a
  week in,*. The name under it becomes a heading.
- **An indented table** is flattened into one point, its lines run together.

**Tests.** The two letters are fixtures. Today they give 55 proposed for 35 real, and 28 for 9. The test states what
they should give, and T3's own tests stay green.

### T11.3: a note keeps its place when words go into its passage (the record's 13)

- **What happened.** Five words put into the middle of a nine-word passage left its note unplaced: *folded small [in
  its scrap of oilcloth] inside the left one*.
- **What to do.** In its own scene, a note whose words are not found is placed by its surroundings: the words before
  it and the words after it both stand, in order, with a passage of fitting length between them.
- **Measured, not chosen.** T7.2's cases stay as they are: the note that must be unplaced, and the passage moved to
  another chapter. The oilcloth note is placed.

### T11.4: an italic in a change's surroundings is not shown as marks

In Changes, the text around a change showed `*Heron — 6th —…`. T7.6 said an italic *change*; the surroundings still
show the marks. This is the first loop's R2-6, in what is left of it.

**T11 size.** One PR, or two if the letter grows.

---

## T12: writing

**Findings:** the record's 14 and 15. The writer's F2, F8, F9 and the smaller ones.

### T12.1: one Enter (D-11; the record's 14)

- **What happened.** A scene typed on the Page with one Enter between paragraphs looked like paragraphs there. Read
  ran it into one block. The Word file held one paragraph with eleven line breaks. It cost the writer a scene, found
  by luck before sending.
- **What each reading does today:**

  | | A single line end in prose |
  |---|---|
  | The Page | a new line |
  | Read, HTML, EPUB | joined, as one paragraph |
  | Markdown, plain text | kept as typed |
  | Word | a line break inside the paragraph |

- **The guide says both** that a single Enter is not a paragraph, and that the book and every export read the prose
  the same way. `ux-review.md` W23-8 closed this with a paragraph count under the scene card. The Manuscript opens
  on the Page, which has none.
- **D-11, taken:** a single Enter stays a line.
  - **Word reads it as Read does:** joined. Verse keeps its lines, as everywhere.
  - **The Page shows it is not a paragraph:** a lone line end is marked, and the first one typed says why, with what
    to press.
- **The other choices, not taken:**
  - **Enter types a paragraph on the Page**, and Shift+Enter a line. That is what every prose editor does, and the
    writer said so. It changes typing in verse and after a header line, and has to be tried on both.
  - **A single line end is a paragraph everywhere.** That breaks text pasted with hard wraps, which the blank-line
    rule exists for.
- **Tests.** Unit: the Word file of the run's scene is one paragraph with no line break in it, as Read has it, and
  verse keeps its lines. E2E on the Page: a lone line end is marked, and the first one says why.

### T12.2: someone only quoted is not offered as speaking (the record's 15; F8)

- **What happened.** Scene 1 offered *Speaking here, not in the header: @@Pell*. The prose has *Pell said it looked
  like his aunt*: reported, not spoken there.
- **What to do.** A word of speech counts for a name only with a quotation beside it.
- **Measured with D1's probe** on the Library's books, as the rule was first set: the precision gained and the
  recall lost are written down, and the change is kept only if the numbers say so.

### T12.3: the book's tools on Cards (F9)

Export, Drafts, Find & replace and Bring in edits are offered on Page and Read only. They are done to the book, and
are offered on Cards too.

### T12.4: smaller

- **The end of a scene on the Page.** The writer pressed the up arrow twelve times. The guide gives Ctrl+Alt+↑ for
  the end of the scene before. What exists is checked first, and then said where the writer looked: in the binder.
- **The setup guide's words.** Step 3 asks *when* and not *where*, and the cast then says *Whereabouts not
  recorded*. Step 4 says *Your world is alive*, then *Your story is alive*.
- **Compare says only *Edited*** for a scene whose header alone changed, or its paragraph breaks alone. It says
  which.

**T12 size.** T12.1 is a PR of its own. The rest go together.

---

## T13: the suspicions, each measured

Each was seen once or not settled. Each is reproduced first. A real one is fixed with its test. One that is not is
written down as not a fault, with what was seen.

| | The suspicion | What settles it |
|---|---|---|
| S2 | The dashboard said *7 alive · 1 dead* with the cursor on *All chapters*; two die in the book | The card read again at that cursor, on the run's `.pwk` |
| S3 | *Backup: Not backed up* after exporting a `.pwk` copy | What the pill promises, and whether a copy counts |
| S4 | The cursor read *All chapters* straight after the first bring-in | A second bring-in with the cursor watched |
| S5 | Pasting a chapter with a fact known before the story replaced the notice of what the paste made | The paste again |
| S6 | Find & replace saves a history entry for each replacement: 143 revisions for 16 scenes, and 20 kept a scene | Whether a run of replacements pushes out the versions worth keeping |
| S7 | The other exports and a single line end | Answered above in T12.1 by reading the code; a test for each keeps it |

**Not planned, and why.**
- **The editor's own tools** (T-1 to T-8 of the editor's report) are LibreOffice's scripting, not the app.
- **Automatic hyphenation** in a file LibreOffice saved needs Word to settle. The app discards the setting.
- **The file still says who marked it** after the editor has accepted every change. That is harmless: the import
  then finds none of the writer's marks and reads the file as any other.

---

## Order

| Part | What | Size | Waits on |
|---|---|---|---|
| T8.0 | The two marked files remade, the numbers to beat, LibreOffice's own reject-all in the probe | 1 PR | — |
| T8.1–T8.3 | Paragraphs paired by likeness; a rewritten sentence whole; the count | 1 PR | T8.0 |
| T8.4 | Reject-all gives the editor's file; the title page's count | 1 PR | T8.0 |
| T9.1 | A comment with no range is read | 1 PR | — |
| T9.2–T9.4 | The app's words, the dates, a heading's comment | 1 PR | — |
| T9.5 | Replies announced | 1 PR | — |
| T10.1–T10.2 | An edit turned back says so; the tally | 1 PR | T8.1 |
| T10.3–T10.5 | The clean copy, tracking on, the small ones | 1 PR | — |
| T11 | A change says whether it can be made; the letter; a note's place; italics in Changes | 1–2 PRs | — |
| T12.1 | One Enter | 1 PR | — |
| T12.2–T12.4 | Someone only quoted; the tools on Cards; the small ones | 1 PR | — |
| T13 | The suspicions | 1 PR | — |
| — | Close the loop a third time | a run | T8, T9, T10 |

**Closing the loop a third time.** The same agents, the same rounds. One expectation carries over, the one that
failed: **the editor checks the writer's account without a script.** Two are new:
- the dialog's count and the editor's own are within the grouping the first loop explained;
- every comment the editor sent comes back, with its own words and its own date.

---

## Every finding, and where it is

| Finding | Whose | Part |
|---|---|---|
| Rewriting marked word by word; the old paragraph back as new | F1, E-1 | T8.1, T8.2 |
| The dialog's count is of marks | S1, E-10 | T8.3 |
| Reject-all leaves empty paragraphs; the cover's count unmarked | E-6 | T8.0, T8.4 |
| A thread at a scene's start not read back | found in the record | T9.1 |
| The app's line under the editor's name | F7, E-4 | T9.2 |
| Every comment's date is the export's | F5, E-5 | T9.3 |
| A heading's comment does not go back | F7, E-3 | T9.4 |
| Replies and a resolved thread unannounced | F3 | T9.5 |
| A declined edit looks like new writing | E-2 | T10.1 |
| The tally, said | the editor's wish 8 | T10.2 |
| No clean copy | F1's cost, the editor's wish 7 | T10.3 |
| The file opens with tracking off | F7, E-7 | T10.4 |
| The file's name, what the file says of itself, the language | E-8, E-9 | T10.5 |
| A change made by hand waits for ever; no warning before the click | F6 | T11.1 |
| The letter's headings, a long sign-off, a table | F4 | T11.2 |
| A note unplaced by five words | F7 | T11.3 |
| Raw `*` beside a change | the writer's smaller | T11.4 |
| One Enter | F2, S7 | T12.1 |
| Someone only quoted offered as speaking | F8 | T12.2 |
| The book's tools not on Cards | F9 | T12.3 |
| The end of a scene; the setup guide's words; *Edited* with no figure | the writer's smaller | T12.4 |
| The dashboard's count, the backup pill, the cursor, the paste notice, history after Find & replace | S2–S6 | T13 |
| The editor's tools; hyphenation; who marked it | T-1 to T-8, suspected | not planned |
