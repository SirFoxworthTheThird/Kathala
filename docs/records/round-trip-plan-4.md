# The round trip, part 4: a file that says what happened to the book

**From:** `loop-2026-11-14.md`, the blind run of the writer and the editor at 5322f62, and its two reports:
`writer-run-2026-11-14-loop3.md` and `editor-run-2026-11-14-loop3.md`.

**Where it stands.** Bringing a file in was exact a fourth time running: the app said what its import plan holds in
every round, and every comment came back with its words and its date. The marked file is readable within a scene.
What the editor still could not tell from it is what happened to the book as a whole: which of their edits stand, a
scene that was split, a chapter that was added, and where eight comments went. That is the expectation that has failed
three runs running, and it comes first.

Eight parts, in this order:
- **T14**, a split scene: in the marked file, in the tally, and in the store.
- **T15**, the book's shape marked: a new chapter, its title, a scene break.
- **T16**, a comment on the words that took its words' place.
- **T17**, whose name and which date: the app's own line, and the changes' dates.
- **T18**, what the editor is told of their changes.
- **T19**, bringing in a move.
- **T20**, revision tasks from a letter.
- **T21**, the smaller ones, and the suspicions measured.

Every finding of the run is in one of them. The table at the end says which.

The process is the one every T-part followed:
- measure first where a number decides the design, and keep the number in a test;
- tests first where a behaviour can be reproduced;
- mutants gated on `tsc && eslint && echo MUTANT-OK && grep`;
- the guide and its screenshots;
- a record, and the e2e suite on a production build at the commit shipped;
- a PR each, merged on the word.

**The fixtures are in the repository:** `src/lib/__tests__/fixtures/docx/run-2026-11-14-loop3/` holds the eight files
that went each way, the two letters, and the editor's round-1 file as LibreOffice first saved it, with a tracked
insertion at each comment. The drafts each file names are in `writer-run-2026-11-14-loop3.pwk`. Rounds 2 and 3 of the
editor's files carry reply links the editor added by hand (`w15:paraIdParent`, 7 and 2), since LibreOffice's scripting
cannot make them; nothing else in them was touched.

---

## Decisions

Four, each needed by one part. **All four are taken, as proposed** (15 November 2026). Each is set out in its part,
with the other choices.

| | The question | Taken | Needed by |
|---|---|---|---|
| D-12 | Who signs the app's own line, *On words since rewritten*, and when is it dated? | **Kathala**, not the writer; dated when the editor made the comment | T17.1 |
| D-13 | What date does a tracked change carry? | When its scene was last written, not the export's moment | T17.2 |
| D-14 | How does the editor learn which of their changes stand? | The tally made right, and the changes not taken listed with their words, in the cover-note copy | T18.1 |
| D-15 | Does **Create all** make the people a header names? | **Yes**, as the code does, and it says whom first; the guide is put right | T21.1 |

---

## T14: a split scene

**Findings:** the record's 1, 3 and 13. The writer's W3-1, W3-2 and W3-13; the editor's round-2 measure; part of the
writer's S-6.

**What happened.**
- The writer split the last scene of chapter 6, *The Magistrate*, and moved the second half into a new chapter 7,
  *The Tally Desk*.
- **In the marked file** 150 unchanged words were struck under the first scene and put in again under the second:
  *"Now it adds."* twice, and the editor's *"Perfect last line. Don't touch it."* on the struck copy. The editor saw 10
  paragraphs struck and 10 put in 30 lower, and needed a comparison to know the scene was intact.
- **In the store** nobody was recorded in the new scene. Its header showed the place and cast it came from. When the
  writer changed the place of the scene before, everyone in the new scene went there too, against its header.
- **Notes** on the second half stayed filed under the first scene.

**Why** (confirmed after the run).
- `markedPlan` marks each scene against the same scene in the editor's file (`markedParagraphs(base.get(s.eventId),
  …)`). A scene made by a split has no base: all of it is new. Its words are gone from the scene they came from.
- `editTally` reads each change in its own scene as it is now. A change of the editor's in the half that left is not
  there, so it counts as *rewritten*.
- `splitScene` gives the new scene its place and cast fields (`splitCarries`) and writes no record of anyone there. A
  typed or pasted header does write one, and the guide promises a header keeps its people where it says.

### T14.0: the measure

The run's round-2 marked file is remade from the `.pwk` (the book as sent, the draft the editor's file names, the
notes), as T8.0 did. The numbers to beat, kept in a test:
- the paragraphs struck and put in again with no change in them: 10 and 10 now, **0** after;
- the editor's round-1 changes the tally calls *rewritten*: 9 now; the editor's own count of those in rewritten
  passages is 5;
- the people recorded at *The Tally Desk* after the split: 0 now, the cast of its header after.

### T14.1: the marked file reads a split as a split

- **A scene that is not in the editor's file is marked against the scene it came from.** Where Compare would say
  *Split from* (`splitFrom`, which `bookDraft.ts` already works out from two drafts), the two scenes are marked together against the one: the
  paragraphs that stayed and those that went are *same*, and the break between them is the change.
- **The break is what goes in:** the new scene's heading and its break, marked as inserted (T15 is how).
- **A scene joined from two** is the same in reverse: one scene, marked against the two.
- **Reject All gives the editor's text**, in LibreOffice too (the T8.4 probe, on the remade file).

### T14.2: the tally counts a split's changes where they went

`editTally` reads a change of the editor's in the scene it is in now, following the split as T14.1 does. The test:
the remade round-2 tally, against the editor's classifier (55 stand, 7 not taken, 5 in rewritten passages), changes
in the split half no longer counted *rewritten*.

- *As built, T14.0–T14.2 (`t14-split-marked.md`):*
  - **A split is marked against the scene it came from** (`basesFor`): the run's round 2 struck and put in again 9
    paragraphs, now none. Paragraphs are given to a half by `likeness`, so the edited boots paragraph went with its
    half.
  - **The tally's 9 were not the split's:** none of the editor's round-1 changes was in the half that went. A change
    there now stands where it was counted rewritten (a built case). The gap to the editor's figures is T18's.
  - **LibreOffice:** rejected, a split or a join differs from the editor's file by the book's shape alone (T15).
  - **Found on the way:** a scene's last paragraph cut lost its scene break in LibreOffice's save; it is now marked as
    Word marks it.

### T14.3: a split records the new scene's people

- **What a split carries is said, at the new scene:** its place, for each person of its cast, as a header typed there
  says it (`sayPerson`, with `says: ['place']`). A split with nothing after it carries nothing, as now.
- **Notes on words that went** are filed under the new scene, as the panel already labels them.
- **The test:** the writer's scratch case. *Hall* with `[#Kitchen @@Pia Lund]` split into *Hall* and *Garden*, then
  *Hall* changed to `#Cellar`: Pia is in the Kitchen at *Garden*. Undo takes the split and its records back in one.

- *As built, T14.3 (`t14-3-split-people.md`):* a split says, at the new scene, where each of its cast is, as the
  first scene's record has it; the writer's case keeps Pia in the Kitchen when *Hall* moves to the Cellar. Notes follow
  their words into a split, and out of a join, which did not move them either.

---

## T15: the book's shape marked

**Findings:** the record's 2. The editor's F-2, the writer's W3-4.

**What happened.** The new *Chapter Seven*, its title *The Hearing*, and a new `#` before the last scene carried no
mark. The `#` they replaced had no deletion. Reject All left the new chapter in place. The editor: *"Chapter Seven
appears as if it had always been there."*

**Why.** The headings and breaks are written afresh in each export, from the book's chapters. The marked file marks
only the prose of each scene against the same scene.

**What to do.**
- **The book's shape is compared with the editor's file's**, from the draft it names: the chapters and their order,
  and each scene's place in them.
- **A chapter that is new:** its heading paragraphs are a tracked insertion, with their paragraph marks, signed as
  the writer's other changes. **One taken out:** a tracked deletion.
- **A scene break put in or taken out:** the `#` paragraph is inserted or deleted, tracked.
- **A chapter renamed:** its title paragraph, marked as any changed line.
- **Reject All gives the editor's file's shape**, and Accept All the book's, in LibreOffice as well as by the app's
  own reader. The probe is T8.4's.
- **The count** in the dialog says them: *1 new chapter*, as it says changes.

- *As built, T15 (`t15-shape-marked.md`):* the book's headings and breaks are marked against the file's shape
  (`bookShape`): a chapter put in or taken out, a heading renamed, a split's break put in, a join's taken out as Word
  marks a paragraph cut after another. In LibreOffice every split, join and chapter case rejects to the editor's file
  exactly, and accepts to the book. The dialog says it: *1 chapter put in, 1 scene break put in and 1 taken out*.

---

## T16: a comment on the words that took its words' place

**Findings:** the record's 4. The editor's F-1.

**What happened.** 8 of the editor's 40 round-1 comments went back at their scene's start, as points, with the app's
line. The farthest was about 35 paragraphs from its words.

**Measured after the run**, on the book as it went out: `placeNotes` leaves the same 8 unplaced. In **5 of them**
the words either side of the comment still stand, and between them is what the writer put in its place:

| The editor's comment was on | Between its surroundings now |
|---|---|
| *whose sevens looked like ones* | *whose twos were a byword in the tally room* |
| *Bottom of the ebb is two hours before dawn.* | *Low water's about four in the morning.* |
| *The letter's ash,* | *I burned the letter before you were home,* |
| *He says he woke and the boat was gone* | *He says he woke because her chain stopped knocking on the wall under your window, and the boat was gone,* |
| *And a westerly behind it.* | *And a north-easter behind it.* |

In the other 3 the surroundings went too.

**Why.** T11.3's rule (`bySurroundings`) places a note between its surroundings only where most of its own words are
still there, and what lies between is at most twice as long. The fourth row kept every word and failed the length;
the others are new words.

**What to do.** The editor asked for exactly this: *"on the replacement text when the words are replaced."*
- **A note whose words are gone, with both its surroundings still standing in its own scene**, goes on what lies
  between them, where that is no longer than a paragraph.
- **It says so:** in Notes, *Made on: "…"*, as a note whose words were partly rewritten does now; in the marked file,
  the app's line (T17.1), on the new words rather than at the scene's start.
- **Measured before it is kept**, on the three loops' books and their notes: how many go from unplaced to placed, and
  each one read, to say whether the words between are the ones the note was about. The rule is kept if none is wrong.
  The 5 above are the test.

- *As built, T16 (`t16-replaced-words.md`):* a note whose words are gone, its surroundings standing in its own scene,
  goes on what lies between them, within a paragraph (`replacedBetween`). Measured on the four runs with an editor's
  notes: 19 notes placed that were unplaced, none wrong. Notes says *it is on the words that took their place*; the
  marked file ranges the comment on the new words, with the app's line. The third loop's round 2 places the 5 above,
  and leaves 3.

---

## T17: whose name and which date

**Findings:** the record's 5 and 6. The editor's F-3 and F-4, the writer's W3-5.

### T17.1: the app's line (D-12)

**What happened.** The 8 lines *On words since rewritten* were signed Tamsin Hale, who did not write them, and dated
with the export: listed first in their threads, before replies made earlier, and dated again in the next export
though nobody touched them. The editor: *"in Word they look like your words."*

**Why.** D-8 put the line in a reply of the writer's, so as not to put it under the editor's name. The line has no
date of its own, and takes the file's.

**D-12: who signs it, and when.**
- **(a) The writer, as now.** It is the writer's tool speaking; the editor reads it as the writer.
- **(b) Kathala.** The software says what it did. Word and LibreOffice list it as another reviewer.
- **(c) The writer, with a mark:** *Tamsin Hale (Kathala)*, as D-7 marks a declined edit.
- **(d) No line:** the comment at its scene's start with nothing said.

**Taken: (b)**, dated when the editor made the comment, so it sits first under it and stays put from one export
to the next. With T16, there are fewer of them: 3 of the run's 8.

### T17.2: the changes' dates (D-13)

**What happened.** All 203 marks of round 2 were dated 19:18:35, the export's moment; all 43 of round 3, 19:47:15. The
writer's replies kept their own.

**Why.** `markedPlan` gives the file one date (`date: new Date(o.now)`).

**D-13: what date a change carries.**
- **(a) The export's, as now.** True of nothing but the file.
- **(b) When its scene was last written.** The store has it. Every change in a scene shares it, and a scene untouched
  since the editor's file has none.
- **(c) When each change was made**, read from the scene's history. History is grouped by session, so it is a guess
  at best, and costs a reading of every version.

**Taken: (b).**

- *As built, T17 (`t17-name-and-date.md`):* the app's line is signed *Kathala*, initial *K*, and dated with the comment
  it is under, so it stands first under it and is the same in every export. A file made before this, the line signed by
  the writer, still brings it in as no reply. A change is dated when its scene was last written, a heading's when its
  chapter was last changed, and the export's moment only for the title page's count and where nothing says when.

---

## T18: what the editor is told of their changes

**Findings:** the plan's first expectation, failed three runs running; the record's 7; the editor's F-5 and F-6; the
writer's S-6.

**What happened.**
- The editor's edits come back accepted into the text, as D-4 has them, and only those turned back are marked. To know
  which stood, the editor wrote a classifier that checked each against the clean copy: 55 stand, 7 not taken, 5 in
  rewritten passages.
- **The figures disagreed.** The dialog said *66*, *6 put back* and *4 turned back*, and *53 stand, 9 rewritten
  since*. The writer listed 7 not taken.
- **A declined join** went out as two changes under two names: the sentence put in as a new paragraph, signed Tamsin
  Hale, and taken out of the joined one, signed *(edit declined)*. Reject All then left an empty paragraph.

**Why** (the first two read after the run; the third to be measured in T18.0).
- *Put back* counts the file's declined marks, where the join counts twice; *turned back* counts the editor's changes.
  They are told apart nowhere.
- *Rewritten since* takes in the changes in the half of a split scene (T14.2).
- The rest of the gap, between 4 and 7, is how the tally places a change turned back in a passage then rewritten. To
  be measured.

### T18.0: the measure

The round-2 tally remade from the `.pwk`, change by change, beside the editor's classifier's. Each disagreement is
named, and the test holds the figures after T14.2 and T18.1.

### T18.1: the editor is told (D-14)

**D-14: how the editor learns which of their changes stand.**
- **(a) The dialog's tally, put right, only.** The writer copies it into a note.
- **(b) The figures, and a list of the changes not taken**, each with its scene and words, in the cover-note copy the
  dialog offers. Every change of the editor's not listed stands.
- **(c) That list as a comment**, at the start of each scene that has any.
- **(d) The editor's changes left marked in the file, as theirs.** Word has no mark for a change accepted, so the file
  would offer them to accept again.

**Taken: (b).** One set of figures, *stand*, *turned back* and *rewritten since*, said the same in the dialog and
in the copy, and each borne out by the file: every *turned back* is a change signed *(edit declined)*.

### T18.2: a declined join or split is one change

Turning back a join puts the paragraph mark back, tracked, signed *(edit declined)*: one change, the sentence once.
The same for a split. Reject All leaves no empty paragraph, in LibreOffice too.

- *As built, T18 (`t18-editor-told.md`):* measured change by change, round 2 now reads 53 stand, 5 turned back, 8
  rewritten since, and round 3 24, 3 and 0. Each disagreement with the editor's classifier is named. The editor's join
  is read as the break taken out, a change made on a move as standing, and a paragraph taken out after a split as
  beside it. The dialog gives the tally as its one count, and the copy for the cover note lists each change not
  taken, with its chapter, scene and words. A split or join whose words are as they were is one change, the break,
  signed as declined where it turns the editor's back. Where its first half holds a comment it is marked as before,
  because LibreOffice keeps a break marked there. 63 of 68 probe cases read right, all nine new ones among them.

---

## T19: bringing in a move

**Findings:** the record's 8. The writer's W3-3.

**What happened.** The editor made three moves, and LibreOffice wrote each as a real move, the first in any loop.
- **One came in as three changes**, two of which read as nonsense: `Hanne grunted. "WhenThe gate's at the river…`.
  Accepting all three gave the editor's text.
- **One was refused**, as *Made here, this would run two sentences together*, and the two spacing edits beside it as
  *you have changed them since*, in a scene the writer had not touched. The writer made it by hand.

**Why** (confirmed after the run, with the import's own `tryChange` on the book as it was).
- **The first:** its words going out are ` The gate's at … from behind the gate.` and coming in `The gate's at … from
  behind the gate. `, the space on the other side. `planImport` pairs a move's halves on their words exactly.
- **The second:** the move moves `" Vael set the lamp down on a pallet. "`, quotation marks and spaces with it. The
  editor then put the spacing right with two small edits beside it, which the file measures with the move made
  (`coat.I ` exists only after it). Tried alone, the move runs two sentences together, and each spacing edit finds
  words not yet there.

**What to do.**
- **Halves are paired on their words, their spaces either side apart.**
- **A change that touches a move's half is made with it**, as one change: the move and its spacing, accepted or
  rejected whole. The list shows it as the move.
- **The test:** both of the run's cases from the round-2 file, against the book as it was: the first one change, the
  second one change that can be made.

- *As built, T19 (`t19-moves-brought-in.md`):* a move's halves are placed by their words in the text (`placeRun`),
  not read from a comparison. That comparison had found the first move's half put in as two pieces around the word
  *the*. A tracked change touching a half is made with its move (`'with'`), so the second move and its two spaces are
  one change that can be made. Round 2 counts 23 changes, from 27.

---

## T20: revision tasks from a letter

**Findings:** the record's 9. The writer's W3-6 to W3-9.

Each was seen in both of the editor's letters, which are fixtures now.
- **"Ch3" is a chapter.** 16 of the 18 tasks that name a chapter were linked to none. `CHAPTERS` takes `Ch3`, `ch3`,
  `Ch 3` and `Ch. 3`. The test: every chapter the two letters name, linked.
- **A sign-off is read by where it is, not only by its words.** *With warm good wishes, and congratulations…* and
  *Maren* were ticked as tasks, three times. T11.2 listed phrases. A line at the letter's end that opens *With* and ends
  in a comma, and a name alone under it, are the sign-off. The test: both letters, and the three earlier runs' letters
  still read as they do.
- **A numbered heading may be long.** *1. The scheme: told too often, and never quite pinned down (your question 1)*,
  74 characters, became a task, where the others were headings. A numbered line with no sentence after it, among
  numbered headings, is one.
- **Two letters' tasks are told apart.** Each says which letter: *From Maren Hollis's letter of 14 November*, or its
  round where there is no date.

---

## T21: the smaller ones, and the suspicions measured

### T21.1: Create all, and its note (D-15)

**Findings:** the record's 10 and 11. The writer's W3-10 and W3-11.

- **D-15: does Create all make the people a header names?** The guide says *a name on a cast nobody answers to is not
  made for you — it is as likely misspelt as new*. The code makes them, on purpose (`createAllWaiting`).
  - **(a) Yes**, and say first whom: the button names them, *Create Anna Brisk, Bo Tallis and Cara Lind, and 2
    places*. The guide is put right.
  - **(b) No**: Create all makes the places and things, and each person is asked for apart.
  - **Taken: (a).** It is one click asked for, and the names said before it are the check against a misspelling.
- **The note after it** says the headers were not applied, after they were. Create all takes its own sentence out
  (`keptByPaste`).

### T21.2: the first scene's header

**Finding:** the record's 12. Six people knowing a fact *before the story* made the first scene's header 10 lines long,
at the top of the book. As the guide describes. **Not planned** unless a writer run finds it costs more than space: it
is what the writer recorded, said where it is true.

### T21.3: the suspicions, each measured

As T13: each is reproduced first; a real one is fixed with its test, and one that is not is written down as not a
fault, with what was seen.

| | The suspicion | What settles it |
|---|---|---|
| S8 | The dashboard said *+12,704 words today* for a 12,496-word book | A chapter with headers pasted into a fresh world, and the day's count read |
| S9 | A one-line header typed after Ctrl+Enter and a title stayed as prose, once | The sequence typed again, in the app |
| S10 | A scene's bookmark when an edit takes out its opening words, or joins across a `#` | An edited file made so, brought in |
| S11 | Round 1 counted 66 where the editor made 67 | The pair found in the file, and said to be grouping or not |
| S12 | The file LibreOffice saves with an empty insertion at each comment reads as 65, where the file sent reads as 66 | The two plans compared change by change |

**Not planned, and why.**
- **The editor's tools** (T-1 to T-8 of the editor's report) are LibreOffice's. T-1 is S12 on the app's side.
- **Word itself** was not run, again. Nothing in this plan writes a part Word has not read before; T15's marks are the
  ones Word writes for a heading inserted.

---

## Order

| Part | What | Size | Waits on |
|---|---|---|---|
| T14.0–T14.2 | The measure; a split marked as one; the tally follows it | 1 PR | — |
| T14.3 | A split records its people; notes follow | 1 PR | — |
| T15 | The book's shape marked | 1 PR | T14.1 |
| T16 | A comment on the words that took its words' place | 1 PR | — |
| T17 | The app's line, the changes' dates | 1 PR | — |
| T18 | What the editor is told; a declined join as one | 1 PR | T14.2 |
| T19 | Bringing in a move | 1 PR | — |
| T20 | Revision tasks from a letter | 1 PR | — |
| T21 | Create all, its note; the suspicions | 1 PR | — |
| — | Close the loop a fourth time | a run | T14–T18 |

**Closing the loop a fourth time.** The same agents, the same rounds. The expectation that has failed three times
carries over: **the editor checks the writer's account without a script.** For it to be fair, the writer's revision
must again split a scene or add a chapter, which the prompt will not ask for and the last two writers did unasked. Two
are new:
- every comment the editor sent comes back **on its words or on the words that took their place**, and the app's line
  under no one's name but the app's;
- the figures the editor is given of their changes are the ones the editor counts.

---

## Every finding, and where it is

| The record's finding | The reports | Part |
|---|---|---|
| 1. A split scene goes back as deleted and written again | W3-2; the editor's round-2 measure | T14.1 |
| 2. A new chapter and a scene break not marked | W3-4; F-2 | T15 |
| 3. A split records nobody in the new scene | W3-1 | T14.3 |
| 4. A comment goes to its scene's start, its surroundings still there | F-1 | T16 |
| 5. The app's line in the writer's name | W3-5; F-3 | T17.1 |
| 6. One export date on every change and on the app's line | F-4; F-3 | T17.2, T17.1 |
| 7. A declined join under two names | F-6 | T18.2 |
| 8. A move not paired; a move refused | W3-3 | T19 |
| 9. The letter splitter | W3-6, W3-7, W3-8, W3-9 | T20 |
| 10. Create all makes people; the guide says it does not | W3-10 | T21.1 |
| 11. The note after Create all | W3-11 | T21.1 |
| 12. The first scene's header | W3-12 | T21.2, not planned |
| 13. Notes filed under the scene split from | W3-13 | T14.3 |
| The figures disagree | F-5; S-6 | T18 |
| The editor checks without a script | the plan's expectation | T14, T15, T18 |
| The dashboard's day count | S-2 | T21.3, S8 |
| A header after Ctrl+Enter | S-1 | T21.3, S9 |
| A scene's bookmark and its opening words | the editor's S-1 | T21.3, S10 |
| 66 against 67 | the record | T21.3, S11 |
| An empty insertion at each comment | T-1 | T21.3, S12 |
| A note in the cover note the file does not show | F-7 | T19 (the move made by hand) |
| *(edit declined)* a second author | F-8 | not planned: D-7 as taken |
| The prose pass off on coming back | S-3 | not planned: likely meant; to be said in the guide if so |
| The chapter panel a chapter behind, once | S-4 | not planned: seen once, nothing to settle it by |
| A retitle lost on a killed browser | S-5 | not planned: the harness |
| The editor's tools | T-1 to T-8 | not the app's |
