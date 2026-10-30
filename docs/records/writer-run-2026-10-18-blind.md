# Writer run, 2026-10-18 (blind): *The Glass Ledger*

A novelist's account of writing a whole short novel in Kathala, starting from an
empty browser profile. I came to the app cold. I did not read `docs/records/`,
the roadmap, `CLAUDE.md`, the issue list, the e2e specs or the git history
before or during the run. I used the app, its in-app help (the header cheat
sheet and the notes), and `docs/GUIDE.md` the way you use a manual: I looked
things up when I got stuck. I read source code only after I had seen a problem
in the running app, and only to name what caused it.

- Build: `VITE_E2E=1 KATHALA_LIBRARY=… npm run build`, served with
  `vite preview` on port 4417, and driven from Playwright in Chromium at 1440×900.
  The browser profile was persistent, so IndexedDB survived from one session to
  the next the way it would on a real machine.
- Everything I made through the UI is in the world export
  `docs/records/writer-run-2026-10-18-blind.pwk`.
- The manuscript exports, scripts, screenshots and notes are in
  `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/blind-run-11/`.
  The manuscript files are in `out/`, the screenshots in `shots/`, and my running
  notes in `notes.md`.
- Every timing given in seconds is the wall-clock time of my Playwright script,
  not of a person. Where I give a click count it is the clicks the path needs,
  counted by me.

---

## 1. What I set out to write, and how far I got

**The book.** *The Glass Ledger* is a multi-POV historical heist set in Venice
and Murano in spring 1605. Isotta Ferro is a glassmaker's widow. The Council of
Ten has confiscated her dead husband's book of glass receipts and is holding her
son in the Pozzi. She hides the book's last leaf, the lost receipt for
*calcedonio* glass, in a lace collar her niece Lucia makes. Then, with Matteo
(a disgraced notary who is secretly informing for the secretary Zuane Dolfin)
and Fra Anselmo (a friar who forges seals), she steals the book back out of the
Secret Chancery on Ascension Day while the Doge marries the sea. The theft is
also the bait that exposes Dolfin's deal with a Flemish buyer. I chose it for
the bookkeeping the app is meant to help with: three POVs, who-knows-what (the
informer, the betrayal, the forgery), objects changing hands (a ledger, a forged
copy, a burned leaf, a collar, a bead, a letter), and real dated days that end
on a fixed feast (Ascension Day, Thursday 19 May 1605).

**Where it ended (all counts measured):**

| | |
|---|---|
| Chapters | 12 |
| Scenes | 28 (26 in the first draft, plus 2 added in revision) |
| Words | **25,226** in the final export dialog. The first draft was 23,058 on the dashboard. |
| Characters | 11 |
| Places | 11 |
| Items | 7 |
| Knowledge facts | 25, with 75 who-learns-it records |
| Character state records | 79 |
| Scene status | all 28 marked *Revised* |
| POV set | all 28 scenes (Isotta 12, Lucia 9, Matteo 7) |
| Continuity Checker at the end | 0 errors, 0 warnings, 1 informational observation, 3 issues suppressed with written reasons |
| Exports | `.pwk` (763,376 bytes); manuscript as `.docx` (two variants), `.md`, `.epub` |

**How I worked.** I drafted each chapter in my head and in a scratch text file a
moment before it went in, then pasted it into the Page view, scene headings and
scene headers included. For revision I typed directly in the Page, used Find &
replace, edited header lines in place, and used the scene panel and the
character state editor. Wherever a header or record went wrong, I fixed it
through the UI. Nothing was written to the database directly. I read
`window.__pwdb` only to check what the app had saved.

**Leaving and coming back.** I closed the browser between almost every step, and
did one deliberately cold return after finishing the first draft. On reopening,
the world list showed *The Glass Ledger, Edited Oct 18, 12 chapters, 11
characters*. The dashboard's *Recently edited* list and the time-cursor pill
(*Ch.12 · The first gather*) put me back exactly where I had stopped. That part
works.

---

## 2. Where the app helped the book

- **The scene header** is the best idea in the app. One bracketed block under
  each scene heading covers who is there (`@@`), where (`#`), when, what changes
  hands (`^Item:@Person`), and who learns what (`?Fact:@Person`, `:before`,
  `:reader`). Once I had learned it, I could keep the books for a 2,000-word
  chapter in about six lines without leaving the page.
- **The calendar suits a historical novelist.** I set the start year to 1605 and
  the story's first day to 21 April. It got the weekdays right (21 April 1605 was
  a Thursday, and so was 19 May). It accepted the header `When: Thursday 19 May`
  with the weekday checked. Its month grid also caught two of my own date
  slips. My chapter 4 says "It took her four" days, but I had typed `+3 days`.
  My last chapter says the gather happened "on a Wednesday in June", but `+3
  days` put it on a Sunday. Both showed up on the grid.
- **The Knowledge screen** answered the questions I actually ask. *At the moment
  Matteo betrays them, who knows Isotta means to steal the book?* With the cursor
  on "The price", the fact card read **known by 3 / 11**: Fra Anselmo and Matteo
  from Ch. 3 "The malvasia", Dolfin from Ch. 3 "The price", and Vos not until
  Ch. 6. Its *Might also know* list ("Lucia Zen — with Isotta Ferro in Ch. 1")
  was a good prompt for leaks I hadn't recorded. The scripted path took 8.6 s
  and three screens: binder, Characters, Knowledge.
- **The early-reveal check** caught a real mistake (section 4).
- **Search** found a weather detail in one hit. Ctrl+K "bora" returned "The door
  of the Pozzi — The bora had come down off the mountains…" (4.9 s scripted).
- **Find & replace across the book** did five revision edits cleanly. Each one
  is listed in *Recent changes* in plain words, for example *Replaced "in the
  eleven days since the funeral" with "in the nineteen days since the funeral"*.
- **Item whereabouts** (Items → an item) lists, scene by scene, who carried it
  and where. It is the clearest view of an object's life in the app.
- **Export is clean.** No header text, sigils or `[ … ]` blocks leaked into the
  `.md` or `.docx`. I checked with grep and by unpacking the docx: 0 occurrences
  of `@@` or `Place:`. Each chapter starts on a new page (12 page-break-before
  paragraphs) and scenes are separated by `* * *` (16 separators, which is 28
  scenes minus 12 chapters).

---

## 3. Where it got in the way: findings

Findings are ranked by what they cost me as a writer. **Reproduced** means I made
it happen at least twice, and at least once in a fresh scratch world. Each
scratch world is named after the finding it reproduces, and its world name is
given. Mechanisms come from reading source after I had seen the behaviour.
Mechanisms I did not instrument are marked as such.

### W-1 · serious (data loss): pasting scenes under a new, empty chapter silently drops the first scene and its prose

**Steps**
1. Create a new world, choose *Skip and explore*, then *Create Timeline*.
2. *Add Chapter* "One", then open Page.
3. Click the page, press Ctrl+End, then Enter (the guide: *Enter on the title of a chapter with no scenes makes the line to type it on*).
4. Paste:
   ```
   ## S1

   First scene prose, which matters.

   ## S2

   Second scene prose.

   ## S3

   Third scene prose.
   ```
5. Wait 3 s and reload.

**Expected:** three scenes, S1, S2 and S3, as the guide says (*A paste can go
there if it starts with a `## ` heading*).

**Actual:** the app creates only S3 and S2 (events `['S3','S2']`). After reload,
`## S1` and "First scene prose, which matters." are **gone from the book**. No
notice appears.

**Reproduced:** three times, in worlds "Repro order", "Repro paste B" and
"Repro paste C".

**Cost:** I lost one scene's heading, its header and its prose in my first
scratch world without noticing until I reloaded. In a real book this is a
chapter opening that vanishes without a word.

**Mechanism (read, not instrumented):** pasted heading lines are made bottom-up
(`revisitLeft` sorts the lines descending, in `DraftBook.tsx`). Under a chapter
heading, `typedHeading` (`src/lib/draftEditor.ts:466`) treats `##` as
`first-scene` and anything else as `stray`, and a stray is cleared with the
`chapter-text` refusal. Once S3 and S2 have been made, the S1 block seems to
fall into the "only a heading may sit under a chapter heading" rule. I have not
confirmed which step removes S1.

### W-2 · serious (wrong records): a scene header is applied against whatever is recorded at that moment, so applying headers out of story order leaves later scenes contradicting their own headers

This happens on every multi-scene paste, because pasted headers are applied
bottom-up. It also happens whenever you go back and fill in or correct an
earlier scene's header.

**Steps (scratch world "Repro paste order"; Anna, Bruno and Carla already exist)**
1. S1 header: `Place: #Quay`, `Characters: @@Anna @@Bruno`, `Items: ^Book`.
2. In one paste, add:
   - S2: `Characters: @@Anna`, `Items: ^Book:@Anna`
   - S3: `Characters: @@Anna @@Carla`, `Items: ^Book:@Carla`

**Expected:** at S3, Carla has the book and Anna does not. S3's header says
"Book: Carla's from this scene".

**Actual:** S3 has no record for Anna. At S3 the Characters screen shows **Anna
"1 item, carried forward"** and **Carla "1 item"**: the book is in two hands.

**Control:** typing the same two scenes one at a time, in story order (world
"Repro handoff in"), writes Anna's S3 record with an empty inventory, and the
result is correct.

**The same with places (world "Repro handoff out"):**
1. Write S3's header first (Anna hands Carla the book on the Quay).
2. Then give S2 a header that puts Anna at the Vault.

The Checker then reports *"Anna is in "S3" but recorded at "Vault" — the scene's
setting is "Quay", and nothing records where they are in it."* S3's own header
still says Quay.

**In the book:** pasting chapter 10 (The Molo / The press / Across the courtyard)
gave the Checker's four errors, *"The Glass Ledger" is held by 2 people at once*
in chapters 10, 11 and 12, and *"Matteo Lion is in "Across the courtyard" but
recorded at "The Secret Chancery"*. My prose and my headers were both right.
Lucia hands Isotta the basket on the Molo steps.

**Cost:** about 20 minutes of Checker-chasing for errors I had not made, plus a
loss of trust. The page shows the header I wrote, so the mistake is invisible
where I write.

**Mechanism:** `applyHeaderNow` (`DraftBook.tsx` ~868) plans each header against
the records as they stand when it runs, and writes only the difference:
`placeCastAtScene` writes no record for someone already resolved at the place,
and a hand-off removes the item only from whoever holds it at that moment.
`applyPastedHeaders` runs in the order the headings were made, which is
bottom-up.

### W-3 · serious: a correction at one scene is quietly undone at the next scene where the character has a record

Each state record stores the character's **whole inventory** as it was when the
record was written. Changing an earlier scene therefore never reaches past the
next record.

**Steps (scratch world "Repro stale copy")**
1. S1: `^Book:@Anna`.
2. S2 (Tower): Anna and Bruno are present, so S2 records them, and Anna's S2
   record now holds Book.
3. Edit S1 to `^Book:@Bruno`.

**Expected:** Bruno holds the book from S1 on.

**Actual:** at S1, Bruno has it. At S2, the records still read **Anna=Book,
Bruno=∅**, so the book jumps back to Anna. The Checker says *"No issues found."*

**In the book:**
- The burned leaf. I removed it from Lucia's hands at "The leaf burns". The 14
  later records that had copied it were unchanged, and the Checker still listed
  14 *Destroyed item still carried* rows. Clearing them took **14 separate
  edits** (character → Current State → *Take … out of the inventory* → Save, at
  each scene; 45 s scripted).
- The lace collar. I handed it to Isotta in "The ash pit". At the very next
  scene, "Gold on the table", it was back with Lucia, because both women's
  records there were older copies. I had to rewrite the Items line in three
  consecutive headers.

**Cost:** the most tedious hour of the run. The app's own fix advice ("Take it
out of their inventory there") is right for one scene and wrong as a method.

### W-4 · serious: pressing Tab while writing either throws the words away or overwrites the chapter title

Tab moves focus out of the page.

- **With the chapter panel open:** focus lands in **Chapter title** with its
  text selected, so the next sentence replaces the chapter's name. The binder
  and the `#` heading change to match.
- **With the panel closed:** focus goes to the "Kathala" logo link, and the
  sentence typed afterwards is lost.

**Steps (scratch world "Repro create item")**
1. Click at the end of a paragraph and press Enter twice.
2. Press Tab, as you would to indent a paragraph in a word processor.
3. Type "It was a dark night."

**Measured:**
- Round 2: `activeElement` was the *Chapter title* input. The chapter became
  "It was a dark night." in the binder, the page heading and the panel.
- Round 1: focus was on the logo link, and the sentence was nowhere.

**In the book:** this is how my first chapter came to be called
**"# :@Orsato ^The calcedonio leaf"** and got a synopsis of header fragments. I
had pressed Tab on the Items line expecting it to *"make the highlighted row"*
(guide, line 1630). The Items line has no picker (only `@`/`@@` have one; this
is by design, guide line 1977), so there was no row to make, and the Tab left
the editor.

**Cost:** about 10 minutes to notice and repair. Writers press Tab to indent
without thinking.

### W-5 · moderate: after a paste, the "pasted headings made N scenes" notice hides the note that something in the pasted headers doesn't exist, along with its Create buttons

**Steps**
1. Paste a scene whose header names a new place: `## S2` / `[ Place: #Tower … ]`.

**Actual:** the note reads only *"The pasted headings made 1 scene."* Clicking
into the header and back out does not change it. Only after I typed a character
and deleted it did the note change to *"Nothing in this world is called "Tower"
— the line was not applied… Create "Tower" as a place"*.

**Reproduced:** world "Repro stale copy" (in the `r18` scratch script, the note
before and after typing), and after every one of my 12 chapter pastes.

**Expected:** the guide says *"Anything it names that the world has not got yet
is kept as typed, with the note above the page offering to create it."*

**Cost:** after each chapter I had to visit every scene's header to find out what
had silently not applied (whole lines, so whole casts and hand-offs).

**Mechanism:** `DraftBook.tsx` renders `{notice ?? warningText}`, and the
Create buttons are gated on `!notice`. Only the writer's own edits clear a
notice.

### W-6 · moderate: a new person in a pasted (or retyped) header can't be created from the note, and their whole Characters line waits for them

**Steps**
1. Paste a header with `Characters: @@Isotta Ferro @@Lucia Zen`, where Lucia
   doesn't exist yet.

**Actual:** the note says *"Nothing in this world is called "Lucia Zen"…
Nobody is in its cast yet."* Isotta, who does exist, is not put in the cast
either. The note offers Create buttons for the place and the facts on the same
header, but **none for the character**.

**Reproduced:** Orsato, then Lucia Zen in the book, then Sanudo in chapter 10.

**Workaround:** backspace one letter of the name and retype it, so that the `@@`
picker appears, then press Tab. Or make the cast up front on the Characters
screen, which is what I ended up doing.

**Mechanism:** `src/lib/sceneHeader.ts:740` deliberately leaves Characters-line
names to the picker. A pasted header never gets a picker.

### W-7 · minor: on opening the Page, the note can describe a different scene, with stale information

**What I saw:** on load, with the caret and the panel on "The press", the note
said *"Nothing in this world is called "The Molo"… It has no setting yet. Create
"The Molo" as a place."* The Molo already existed, and those tokens belonged to
"Across the courtyard". Clicking Create did not duplicate the place (1 Molo in
the DB afterwards), so this is confusing rather than harmful.

**Mechanism:** `warnedRemembered` (`DraftBook.tsx` ~935) restores the unknown
list saved when the line was kept, for the first such scene in book order. It
does not plan it again against the current records.

### W-8 · minor: `:destroyed` in a header leaves the item in the holder's hands, and the Checker then lists one warning per later scene

`^The calcedonio leaf:destroyed` in "The leaf burns" left the leaf in Lucia's
inventory. The Checker produced **14 rows** of *Destroyed item "The calcedonio
leaf" in Lucia Zen's inventory*, one for each later scene and several listing
the same chapter. That is one mistake in my records, and it is buried under 14
rows. Combined with W-3, fixing it took 14 edits.

### W-9 · minor (accessibility, measured from the accessibility tree)

- **Scene panel selects.** They are named only by their value. The aria snapshot
  shows `text: Point of View` followed by `button "Isotta Ferro"`, and
  `text: Setting` followed by `button "The Ferro furnace"`. A screen-reader or
  voice user hears a name with no hint that it is the POV.
- **The Library.** 40 buttons are named only by file size, and four sizes repeat:
  `Download (1.7 MB)` ×3, `Download (1.3 MB)` ×2, `Download (1.2 MB)` ×2 and
  `Download (1.1 MB)` ×2. Nothing in the name says which book.

### W-10 · minor: "X is new. Other names they go by:" prompts pile up and survive every reload

All three of my prompts (Orsato, Lucia Zen, Sanudo) were still above the page
dozens of sessions later. Together they pushed the start of the page down about
96 px (the editor's top at y=265). They go only when dismissed one by one.

### W-11 · minor: the export dialog's chapter-heading examples show another book's chapter

The *Chapter headings* choices are "Ch. 1 — Flat 114", "Chapter One / Flat 114",
and so on. I stopped to wonder what "Flat 114" was. My chapter 1 is "The Furnace
Goes Cold", which would have made the choice obvious. The examples are hardcoded
in `src/lib/chapterHeading.ts:16`.

### Wishes (not bugs)

- **A POV token in the header** (for example `POV: @Lucia Zen`). Setting POV on
  28 scenes through the panel takes 28 × (binder, dropdown, option) = 84 clicks.
- **Correcting a holding "from here on".** With W-3 as it is, one "Lucia no
  longer has the leaf after Ch. 4" action would have saved 14 edits.
- **A Word export a manuscript reader expects.** The `.docx` has no paragraph
  styles: 682 paragraphs, 0 `w:pStyle`, no `styles.xml`. Chapter titles are
  direct-formatted bold text rather than Headings, so Word's navigation pane will
  show no chapters. There is also no manuscript-format option (12 pt, double
  spaced).
- **Acknowledge an export on the backup chip.** It still says *Not backed up*
  after I exported a `.pwk`. The guide says this is intended (the chip tracks a
  bound folder), but a writer who has just exported reads "Not backed up" as
  wrong.
- **A sensible calendar start year.** *Enable calendar* starts in year 1 ("The
  story's first day, 1 January, 1, is a Monday"). A start year near the present
  or a prompt for one would be friendlier.

---

## 4. What the checks told me about my book

**First run, after the first draft:** 4 errors, 17 observations, 16 warnings.

| What the Checker said | Verdict |
|---|---|
| *"The Glass Ledger" is held by 2 people at once* (×4, chapters 10–12) | **Wrong about the book, right about the records.** The prose is unambiguous: "a moment, one, with a gondola bumping on one side… when both baskets were in the air between them". The records were wrong because of W-2. |
| *Destroyed item "The calcedonio leaf"… still carried* (×14) | **Right about the records, wrong about the book.** The leaf burns on the page: "it was ash, and her aunt crumbled the ash in her fingers". W-8 and W-3 explain the records. |
| *Matteo Lion is in "Across the courtyard" but recorded at "The Secret Chancery"* | Caused by W-2. *Move to The Molo* fixed it in one click. |
| *"The Glass Ledger" changes hands… Zuane Dolfin… Doge's Palace, but Lucia Zen… The Secret Chancery — they never share a location* | **Half right.** My modelling had Dolfin "holding" a book that sat in a press inside his own palace. Suppressed with that reason. |
| *3 names in the prose of "Gold on the table" are not in its cast — Zuane Dolfin (6×), Orsato (5×), Alvise Contarini (3×)* | **Right, and useful.** They walk in at the end of the scene: "Zuane Dolfin came into the room in a gown of black damask". I added them to the cast. The other 15 rows of this kind were people who are only talked about, and *Record as mentioned* cleared them. |

**After I gave facts their spoiler words:**

- *Possible early reveal: "The false ledger will be left in the press"… "Fra
  Anselmo comes to Murano" (Ch. 9) already references it (matched "copy a
  book")*. **Right.** The plan is spoken in that scene ("Brother. Can you copy a
  book?"), not in "The glory-hole" where I had set the reader's moment. I moved
  it. This was the best catch of the run.
- *matched "collar"* in Ch. 2. **Wrong.** It is Isotta's dress: "The black wool,
  the good collar". Suppressed.
- *matched "punto in aria"* in Ch. 1. **Wrong, but useful.** It is Lucia's cover
  story ("learning the punto in aria from Suor Benedetta"), a deliberate plant.
  Suppressed.
- *The reader never learns "The last leaf of the ledger is missing"*. **Right
  about my records, wrong about the book.** The reader watches Orsato find "the
  stub of paper sewn into the gathering where the last leaf should have been" in
  chapter 1. I set the reader's moment and moved Orsato's learning from Ch. 2 to
  Ch. 1. The Checker could not have known that he learns it there.

**What the checks missed** (things I know were wrong in my book):

- **A date contradiction.** Chapter 2 said "in the **eleven** days since the
  funeral", but chapter 1 has the fire dying "on the ninth day after the
  funeral" and out for nine more. I found it on a reread and fixed it to
  nineteen.
- **A plot hole with the bead.** In chapter 12 Nane says "Messer Lion gave it
  back to me… on the Sensa night", but Isotta had taken the bead from Matteo in
  chapter 9. The Checker was silent: Isotta and Nane are both at the furnace, so
  the hand-off looked plausible. I rewrote the line as "You sent it back to
  me…".
- **A letter in the wrong hands.** In chapter 11, Matteo "took the letter out of
  his gown", but my own item records had it with Isotta since chapter 9. The
  records showed this when I looked an item up. The Checker did not flag it.
- **A contradiction my revision introduced.** Chapter 10's "she had bought two
  from the same man" contradicted the new "Two baskets" scene. I caught it on a
  reread.
- **Two date slips** (chapter 4 "+3" for four days, chapter 12's Wednesday). The
  Calendar view showed them when I looked. The Checker did not mention them.
- **The lace teleport** (W-3). The Checker is silent about it, and the toy world
  says "No issues found".

**The Moonstone, as real material.** I opened Collins's *The Moonstone* from the
Library and used it as if it were mine. It opened in 0.57 s and in reading mode,
which was clearly explained, and I turned that off in settings. Its Checker run
took about 8 s and gave **78 observations and 6 warnings**. 62 of the
observations are *named in the prose but not in the cast*; *Record every name as
mentioned (62)* is one click. Several warnings look like real modelling gaps in
the curated data, for example *"Lady Julia Verinder joins "The Verinder
Household" before they appear"* (membership from Ch. 2, appearance in Ch. 16). I
did not dig further.

---

## 5. What I only suspect

These are guesses until settled. Each says what would settle it.

- **S-1. An uncaught page error.** I saw `PAGEERROR Cannot read properties of
  null (reading 'length')` once. It came right after I pasted a new scene ("Two
  baskets") onto the end of a mid-book scene and then clicked a scene in another
  chapter (Ch. 9) in the binder. The scene was created correctly and I saw no
  visible damage. A three-round attempt to reproduce it in a scratch world
  ("Repro pageerror") produced 0 errors. **To settle it:** repeat the exact
  sequence (paste with a header into chapter 5 of a 12-chapter book, then
  binder-jump to chapter 9) with the stack trace captured.
- **S-2. The first "Create … as an item" dropped the rest of the line.** Once,
  in chapter 1, clicking *Create "The Glass Ledger" as an item* redrew the Items
  line as just `^The Glass Ledger`. `:@Orsato ^The calcedonio leaf:@Isotta
  Ferro` was gone and no hand-off was recorded (itemPlacements and inventories
  were empty). A clean repro with two unknown items (world "Repro create item")
  kept the line intact. The difference may be that I had pasted over the
  header's lines just before. **To settle it:** paste a multi-token Items line
  over an existing header body, leave, then click Create.
- **S-3. A `When:` header line was lost** on reload after I typed it and closed
  the browser within about 0.5 s. The guide promises typed prose survives a close
  inside the save second. Header lines are "applied when you leave", so they may
  not be covered. I did not retest with a deliberate close.
- **S-4. The `.docx` in Word.** I could not check how it renders. LibreOffice in
  this sandbox fails to load *any* file, including a one-line `.txt`. The XML
  looks valid and minimal.
- **S-5. Suppression count.** The `.pwk` holds 6 continuity suppressions, but I
  deliberately made 3. My first scripted attempt clicked *Suppress this issue*
  three times on the same finding without confirming, which may have stored
  empty suppressions. **To settle it:** click Suppress, click elsewhere, and
  count the records.

---

## 6. What worked (honestly, so that a change doesn't undo it)

- **The header block as a bookkeeping surface**, and its cheat sheet, which is
  complete and accurate. Every token I used did what the cheat sheet said
  (`:before`, `:reader`, `:dead elsewhere`, `+2 weeks`, `same day`, weekday
  dates).
- **The guide** matched the app nearly everywhere I checked it. Two things I
  thought were bugs (no item picker in headers; Enter not making a new
  character) were documented design that I hadn't learned yet. They were
  unfamiliar, not confusing.
- **The knowledge model and the Knowledge screen**, including *Known before the
  story*, which quietly moves to the first scene, and *Might also know*.
- **The calendar and its month grid**, for a book pinned to real dates.
- **The Continuity Checker's prose-versus-record and early-reveal checks.**
  Their wording says how sure they are ("Possible early reveal… matched
  "collar""), and suppression asks for a reason.
- **Find & replace, Recent changes, and per-scene History** for revision.
- **Coming back.** The world list, *Recently edited*, and the cursor restored at
  my last scene.
- **The exports**: clean, with no header leakage, and with chapter page breaks
  and scene breaks in the docx.
- **The Read view** typesets the book well and has an *In this scene* sidebar.

---

## 7. Would I keep using it for the next book?

**For the next book, yes, but not the way I used it this time.**

The header-and-knowledge system answered "who knew what, where was she, what day
was it" faster than my notebook ever has, and two of its catches (the false
ledger's reader moment, and the three people who walk in at the end of "Gold on
the table") made the book better.

What I will not do again is trust the item and location records after a paste or
after going back to revise an earlier scene. W-2 and W-3 mean the records drift
from the headers I can see, and the Checker then blames me for the drift. Twice
it was silent about drift that was real. Next time I would:
- paste one scene at a time, in story order;
- make every character before writing their first scene;
- never press Tab on the page.

The unconditional bug is W-1, the vanished first scene. It deletes prose without
saying so, and for a writer that is the one unforgivable thing.
