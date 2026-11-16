# Writer run, 10–12 November 2026 — blind, with an editor, four rounds ("loop 2")

A novelist's run, blind, against one frozen production build served at `http://localhost:4192/`, driven with
Playwright from a persistent Chromium profile so the book survived between rounds. A separate editor ("Ines
Marlowe", another agent who never saw the app) edited the Word file three times. Everything the book contains went
in through the UI. The finished world is beside this file: `writer-run-2026-11-10-loop2.pwk`.

**How the evidence was taken.**
- The build has no `window.__pwdb`, so what the app saved was read with the browser's raw `indexedDB` API, read-only.
- Each `.docx` was unzipped and counted from its XML *before* the app was shown it, so the app's numbers could be
  checked against the file and not against themselves.
- Mechanisms were read from `src/` only after the behaviour had been seen; each is marked *read afterwards*.
- `docs/records/ux-review.md` and the other records were opened only at the very end (see "Already known, or new?").
- Working notes, scripts, screenshots and file listings are in the run's scratch directory (`loop2/writer/`:
  `notes-round1.md` … `notes-round4.md`, `shots/`, `ed*list.txt`, `out*-changes.txt`, `render2/`).

## What I set out to do, and how far I got

I set out to write a short second-world novel, send it to an editor I hadn't worked with, and take it through
three rounds of her edits. I got all the way.

- **The book.** *The Salt Ledger*, by "Elin Ashgrove": harbour noir, one timeline, 6 chapters, 16 scenes, a cast
  of 8, 8 places, 5 items with who-has-what, 4 facts with who-learns-them, two deaths.
- **Round 1.** Wrote 12,374 words (the app's count). Five and a half chapters were pasted onto the Page with `##`
  headings and header blocks; one scene was typed there. Saved a draft, ran the prose pass, sent it as Word,
  Submission layout, *For an editor*.
- **Round 2.** Brought in her 58 changes and 39 comments, turned her 3,600-word letter into tasks, and rewrote
  structurally (the copied letter's payoff, the calendar, Tamsin's act at the climax, the hat). Sent it back
  marked at 13,361 words.
- **Round 3.** Brought in 19 changes, 15 comments and 7 replies; closed four knowledge gaps; built a tide table
  and moved two days to fit it. Sent it back marked, with a clean reading copy she had asked for, at 13,693 words.
- **Round 4.** Brought in 6 changes, 6 comments and 2 replies; fixed the one line the tide table had broken.
  Final draft 13,756 words; 59 notes, all resolved; 42 of 44 tasks done; 17 drafts; `.pwk` exported.

The app earned its place. The bookkeeping I came for worked first time, and bringing an editor's file in was
exact three times running. What it cost me, and cost her, is below.

## The round trip with the editor, as a whole

### Counts each way

"Mine" is my own count from the file's XML, grouping adjacent insert/delete marks as one change.

| Leg | What the file held (measured) | What the app said | Agreement |
|---|---|---|---|
| R1 out | 16 scene bookmarks, 2 Kathala properties, no marks; title page "about 12,400 words" | dialog: 12,374 words · 16 scenes | yes |
| R1 back | 53 ins, 56 del, 1 move, 2 paragraph-mark changes; 39 comments (38 on prose, 1 on a chapter heading) | "58 changes in 15 scenes … 38 comments are now notes … 1 comment is on the title page or a chapter's heading" | yes; I made it ~62 changes, and the gap is grouping (the app's is the more sensible) |
| R2 out (marked) | 174 ins + 110 del, all mine, ~82 by my grouping; 62 comments (her 38 + my 24 replies); 36 of 38 threads done | dialog: "160 changes and 38 comment threads" | comments yes; **changes no** |
| R2 back | 18 ins, 20 del, 1 paragraph mark → 19 changes in 9 scenes; 84 comments (her 38 + 15 new + 7 replies, my 24); 37 done | "19 changes in 9 scenes … 15 comments are now notes" | yes; her email said "20" and both the file and the app say 19. **Her 7 replies and 1 resolve: not mentioned** |
| R3 out (marked) | 135 ins + 113 del, all mine, ~52 by my grouping; 94 comments (her 60 + my 34); 53 of 53 threads done | dialog: "134 changes and 53 comment threads" | comments yes; **changes no** |
| R3 back | 6 ins, 7 del → 6 changes in 4 scenes; 102 comments (her 60 + 6 new + 2 replies, my 34); 53 done, 6 new | "6 changes in 4 scenes … 6 comments are now notes" | yes; **her 2 replies: not mentioned** |

### What came in right

Across the three bring-ins there were 83 changes, 59 comments and 9 replies. Checked one by one against the
bookmark each sat under in her file and against the store afterwards:

- **Nothing landed in the wrong scene, nothing was dropped, nothing came in twice.**
- My own changes, which she accepted in the file, were never offered back to me.
- My replies were not duplicated when they returned inside her file.
- Her replies went under the notes they answered, after mine.
- A thread she resolved was resolved (the seventy steps, round 3).
- The five comments carrying the app's "On words since rewritten" line came back onto their own notes with the
  line stripped, and it was not doubled on the next export.
- A moved sentence came in as one "⇄ Moved" item; a paragraph split as "¶ New paragraph"; a paragraph join with a
  punctuation change as one item.
- She renamed the file every round and saved it from LibreOffice, twice from a marked file. None of that mattered.

### What I decided

| Round | Accepted | Rejected | Other |
|---|---|---|---|
| 2 | 48 | 9 | 1 made by hand, then cleared with Reject (F6) |
| 3 | 15 | 4 | 1 of the 4 then made by hand when I saw why she'd made it |
| 4 | 5 | 1 | — |

Every accept and reject was checked in the stored text (19, 20 and 9 phrases respectively); all landed as decided.

### Sending it back marked: the dialog, the file, and what it cost her

**What the dialog told me.** Once her file had come back, *Export → Word → For an editor* offered, ticked: *Show
my changes since Ines Marlowe's file (round1-from-editor.docx) — 160 changes and 38 comment threads, signed Elin
Ashgrove*. Round 3 said 134 and 53. It kept Submission layout and my byline from before. It offered no clean copy
alongside.

**What the file held.**
- Only my marks. Her edits that I accepted were plain text; the ones I rejected showed as my changes turning them
  back. That is as the guide describes.
- Her comments with my replies under them, resolved where I had resolved them.
- Comments whose words I had rewritten were moved to the start of their scene with a line the app wrote: *On
  words since rewritten: "…"*.
- Not her comment on the first chapter heading (I had dismissed it in Changes, the only thing the app lets you
  do with one).
- Every comment, hers included, dated to the minute of my export.
- No `word/settings.xml`, so nothing asks Word to open with tracking on.

**What it cost her.** This is from her two covering emails; I did not see her side.
- Round 2: "the Stair paragraph alone carries over a hundred separate marks and can't be read with the markup
  showing." She checked by comparing texts instead of reading the marks, and asked for a clean copy.
- Round 3, with the clean copy: "an hour's work instead of an afternoon's."
- She noticed the missing heading comment, the app's line under her name, and the restamped dates, and that the
  file "didn't open with Track Changes switched on".

So the marked file did carry the right text and the right threads, and her checks proved it both rounds: accepted,
it equalled my text; rejected, it equalled hers. But she could not *read* it where I had done real rewriting, which
is where an editor most needs to. Finding F1.

### The usage-limit interruptions and restarts

- **One usage-limit stop, in round 3.** It fell after I had brought her file in, decided all 19 changes and added
  the second letter's tasks, and before any revision was applied (the replacement list was prepared and checked,
  not run). The app server had also been restarted. On resuming I verified from the app: no changes waiting, 53
  notes, 44 tasks, stored prose identical to my dump from before the stop. It cost a re-check and nothing else.
  Nothing was redone.
- **The machine was restarted before rounds 3 and 4.** Each time the profile opened with the whole book: scenes,
  notes, replies, tasks, drafts, custody and facts all counted and intact.
- **One slip of my own, round 1.** A script re-run exported the editor file twice, leaving two "Sent for editing"
  drafts a minute apart (23:53, 23:54). The file carries its draft's id, and round 2's bring-in found untracked
  edits against the right one, so no harm.

## What stopped me

Most costly first. Ids are this report's; the working notes' ids are in brackets.

### F1. The marked file shreds real revisions, and its change count isn't a count of changes. [W2-1]
**Reproduced** in rounds 2 and 3 (file XML both times, a LibreOffice render in round 2), and confirmed from the
editor's side both times. **Cost: high, and it lands on the editor.**

- **What I did.** Revised normally: put new paragraphs in front of existing ones, rewrote some sentences. Then
  exported with *Show my changes* ticked.
- **What I expected.** A new paragraph marked as new, an untouched paragraph left alone, a rewritten sentence
  shown as old sentence out, new sentence in.
- **What happened.**
  - A new paragraph placed before a lightly changed one is compared word by word against that old paragraph. The
    result alternates struck and inserted words. The old paragraph then reappears *wholly as an insertion*. Round 2:
    Wren's note in ch6 changed by one clause and looked entirely rewritten (`render2/p-41.png`, `p-42.png`). Round
    3: the same at the opening of ch4 and the soup paragraph in ch3 (`out3-changes.txt`).
  - A rewritten sentence becomes alternating single words: `brandy behind a cable tierbrandy, withoutNessa,
    threeI goesdon't atshoot it."people."` on the rendered page.
  - The dialog said 160 changes (round 2) and 134 (round 3). The files held 284 and 248 separate marks, and about
    82 and 52 changes by a reader's grouping. The number matches neither.
- **Mechanism (read afterwards).** `src/lib/markedDocx.ts`: identical paragraphs are aligned, then "the rest
  paired in order and compared word by word." There is no test of whether two paired paragraphs resemble each
  other, and no point at which a sentence is replaced whole.
- **What it cost.** Her afternoon in round 2. For me, a warning paragraph in two cover notes and a second export
  each round to make a clean copy by hand (untick *For an editor*, download, re-tick).

### F2. One Enter on the Page is not a paragraph; Read runs the lines together and Word breaks them. [W-A]
**Reproduced twice** (a typed scene in my book; a hard-wrapped paste in a scratch world, since deleted).
**Cost: a whole scene, and I found it by luck.**

- **What I did.** Typed "The lamp-room" on the Page, pressing Enter once between its 12 paragraphs.
- **What I expected.** Twelve paragraphs.
- **What happened.**
  - On the Page each sat on its own line and looked like a paragraph (`shots/16a`).
  - Read showed one block, the dialogue joined with spaces (`shots/25b`).
  - A Word export held one `<w:p>` of 1,896 characters with eleven `<w:br/>` line breaks.
  - The scene card's draft says "1 paragraph" under its box. The Page, where the Manuscript opens by default, says
    nothing.
  - Second reproduction, the other way round: text hard-wrapped at about 60 columns, which is the case the
    blank-line rule exists to protect. Read joined it cleanly; Word put a `<w:br/>` at every wrap.
- **Against the guide.** It says "The book and every export read your prose the same way." The Word file does not.
  The same page says, of the `@` picker, "Enter means 'new paragraph' in every prose editor there is."
- **Mechanism (read afterwards).** `splitParagraphs` in `src/lib/manuscriptParagraphs.ts` splits on blank lines
  only, deliberately. `docPara` in `src/lib/manuscriptExport.ts` turns each remaining newline into `<w:br/>`.
- **What it cost.** About five minutes to repair, possible only because I still had the text in a file. I noticed
  only because I happened to open Read before sending. From then on I pressed Enter twice on the Page.
- Not checked: the Markdown, HTML, EPUB and plain-text exports.

### F3. An editor's replies, and her resolving a thread, arrive unannounced. [R3-1]
**Seen in rounds 3 and 4** (dialog text, panel and store each time). **Cost: I would have missed six replies.**

- "Edits brought in" reported changes and new comments only. Round 3's file also carried 7 replies and 1 resolve;
  round 4's carried 2 replies. All were applied correctly, and none was mentioned.
- Six of round 3's seven replies, and both of round 4's, sat in *resolved* threads. The Notes panel shows *Open*
  by default, so they were not on screen. A reply has no "new" mark and no date (`shots/r3e-resolved-thread.png`).
- I found them because her email said how many to look for.

### F4. The letter splitter files section headings as tasks, and misses a sign-off with a clause in it. [W2-2]
**Reproduced** (round 1's letter split twice; the same heading mistake a third time in round 2's letter).
**Cost: 19 clicks of clean-up per letter, and one wrong task that got through.**

- A heading followed by a one-line introduction ending in a colon loses the heading role to the introduction.
  Three cases: "WHAT MOST NEEDS WORK" (before a numbered heading), "6. Smaller continuity, quickly", and "SMALL
  THINGS I'VE CHANGED". The first became a ticked task filed under "WHAT'S WORKING"; I missed it and had to
  delete it from Revisions (`shots/r2n-revisions.png`, `shots/r2u-split-again.png`).
- "With warm regards, and thanks for a book I was glad to spend a week in," was ticked as a task, and "Ines"
  under it became a heading. A bare "With warm regards," in the second letter was recognised.
- Her indented calendar table was flattened into one point with its lines run together.
- Round 1: 55 proposed, 35 real. Round 2: 28 proposed, 9 real.

### F5. Every comment is re-dated to the moment I export. [R3-2]
**Reproduced twice** (her report of the round-2 file; one date across all 94 comments in the round-3 file; her
round-3 file then showed exactly two dates, mine on 94 and hers on 8). **Cost: low for me, real for the record.**

- In her words: "neither of us can tell from the file which of my comments are from which pass."
- Mechanism (read afterwards): `src/lib/manuscriptExport.ts` writes the export's date on every comment.

### F6. A change I had already made by hand waits forever, and only Reject clears it. [W2-3]
**Seen once**, as a full sequence. **Cost: low; the file came out right.**

- I had edited "four hours in the rain" after sending. Her change to the same words was listed as ordinary, with
  Accept enabled. Only on clicking Accept: "The scene no longer has these words: you have changed them since."
- I made her version by hand. The item then showed Accept enabled again, gave the same message, and could only
  be cleared with Reject, though I had taken her wording.
- No text was duplicated, and the marked file shows no change there. The refusal itself is right: the earlier
  loop's writer run reports this case writing a change into a different sentence (its R2-1), and here it did not.

### F7. What the editor found in my file that I never chose. [R3-3, R3-4, and two lines above]
**Each seen in both marked files.** **Cost: low individually; together they made her ask what the program was doing.**

- **The file does not open with tracking on.** She reported it; neither exported file has a `word/settings.xml`.
  The app does look for untracked edits against the sent draft, so the risk is covered when the draft is still
  on the device.
- **A heading comment, once dismissed, is gone from the file.** Round 2's file carried 38 of her 39. She noticed.
  There is no way to reply to one in the app.
- **The app's line appears under her name.** "On words since rewritten: …" is written into the body of a comment
  signed by her: 5 comments in round 2, 10 in round 3. Useful, but she "would rather it didn't look as though
  I'd said it."
- **One insertion lost a comment its place.** Putting five words into the middle of a nine-word anchor ("folded
  small [in its scrap of oilcloth] inside the left one") made the note Unplaced. A one-word change elsewhere only
  said "Its words have been edited since."

### F8. The Page suggests somebody who is only quoted. [N1]
**Reproduced twice**, including after a reload. **Cost: one click.**

- Scene 1 offered "Speaking here, not in the header: @@Pell". Pell is not there; the prose has "Pell said it
  looked like his aunt" and "Pell says everything looks like his aunt".
- The guide says somebody the scene only talks about is not offered. Mechanism not looked at.

### F9. Export, Drafts, Find & replace and Bring in edits are not on Cards. [W-B]
**Reproduced twice** (a screenshot; a script that failed looking for Export there). **Cost: low.** The guide
puts them on Page and Read. I looked for Export as something done to the book, not to a layout.

### Smaller, each seen once
- **Getting to the end of a scene on the Page.** The binder puts the caret at the start of a scene, and the page
  only draws what is on screen. To add a scene after "Behind the chart" I went to the next scene and pressed the
  up arrow twelve times. Later I found Ctrl+F, Enter, Escape puts the selection on a phrase, which is a fair way
  to get anywhere.
- **Setup guide wording.** Step 3, "Place them in the story", asks only *when*; the cast list then says
  "Whereabouts not recorded". Step 4 says "Your world is alive", then "Your story is alive."
- **Raw `*` in Changes.** An italic in the context of a change shows as `*Heron — 6th —…`.
- **"Edited" with no figure in Compare.** A scene whose header alone changed, or whose only change was paragraph
  breaks, reads "Edited" with no word count. Correct, but it made me look.

## What I only suspect

None of these is settled. Each says what would settle it.

- **S1. What the export dialog's "N changes" counts.** 160 and 134, against 284 and 248 marks, and about 82 and 52
  changes. Reading how the number is produced would settle it; I did not.
- **S2. The dashboard's alive/dead count on "All chapters".** It read "7 alive · 1 dead" once with the cursor
  pill on *All chapters*; with the cursor on the last scene it reads 6 and 2, which is right. Two characters die
  in the book. Putting the cursor on *All chapters* again and reading the card would settle it.
- **S3. "Backup: Not backed up" after exporting a `.pwk` copy.** The pill did not change (round 4, once). It may
  mean only a bound folder. The guide's section on it would settle what it promises.
- **S4. The cursor pill read "All chapters" straight after the first bring-in**, having been on a scene. Seen
  once; a second bring-in with the pill watched would settle it.
- **S5. A paste notice replaced.** Pasting chapter 3, whose header had a `:before` fact, showed "Known before the
  story: shown on the first scene…" and not "The pasted headings made 2 scenes and 1 chapter." Seen once.
- **S6. Find & replace and scene History.** After 27 single replacements one scene showed *History (6)*; the
  exported world holds 143 scene revisions for 16 scenes. Whether twenty versions per scene (the guide's figure)
  then pushes out the ones worth keeping is unchecked.
- **S7. Other exports and single line breaks (F2).** Markdown, HTML, EPUB and plain text were not opened.

## What worked

- **Pasting a drafted chapter with its headers.** Headings became scenes; each header was read; one *Create all
  that the N waiting headers name* per chapter made every place and item. The store matched what I wrote, first
  time, for all 15 pasted scenes. This is the thing I came for.
- **Asking the book a question.** *Who knew Thale wrote the letter?* Knowledge, then the fact: everyone who knows
  it and the scene each learned it, in two clicks. *What did I say the weather was?* Ctrl+K "fog": four scenes
  with a snippet each, on one screen.
- **Bringing an editor's file in.** Exact three times (table above), from LibreOffice, from renamed files, from
  files made out of marked files. Honest counts, right scenes, right threads, drafts saved before and after
  without being asked.
- **A change to words I'd rewritten was refused, not guessed at.**
- **Notes following their words.** After some sixty replacements only the notes whose words I had really
  rewritten went Unplaced (with the one exception in F7), and each kept the words it was made on.
- **Find & replace takes paragraphs.** The Replace box is a textarea, so a whole new paragraph with blank lines
  went in exactly where I wanted it; 54 replacements over three rounds, each "1 match in 1 scene", all landed.
- **Drafts and Compare.** "16 scenes changed · 12,374 → 13,756 words (+1,382)" against the first sent draft, 12
  scenes against the second, 5 against the third, each scene openable with its changes marked.
- **Revision tasks.** One list across two letters, each task naming its letter, ticked as I went: 42 of 44.
- **The Continuity Checker's "Record every name as mentioned".** Ten items, one click.
- **The prose pass.** "looked" ×45, 4.2× books in general. The editor counted the same 45 independently.
- **The Word file as a manuscript.** Title page, running header, double spacing, `#` breaks, italics kept, no
  header blocks leaking into the prose.
- **Keeping its place.** The setup guide across reloads, the Page across sessions, and the whole book across a
  usage-limit stop and three restarts.
- **The `.pwk`.** One tick for the drafts, one button; 1,510,347 bytes holding everything listed above.

## Already known, or new?

Checked at the very end, against `ux-review.md` first and then the related records.

- **F2 is partly known.** `ux-review.md` W23-8 ("A single Enter is not a paragraph break, and nothing said so")
  is closed as fixed: the scene card now counts paragraphs under its box, and I saw that count. Two things are
  not covered by that closure, and I think it was closed too narrowly:
  - the fix lives on the card, and the Manuscript opens on the Page, which has no count;
  - W23-8 says "the export carries the same collapse". The Word export does not collapse; it writes line breaks.
    That half is new.
- **F1 is the design working as written.** `t5-1-marked-export.md` describes the pairing "in order … word by
  word". `r4-word-round-trip.md` records the *Changes dialog* being unreadable for the same reason and being
  fixed there. The marked file has the same problem and the fix did not reach it. The cost evidence here is new.
- **F4.** `t3-letter-splitter.md` covers a sign-off starting "With" and an introduction heading its bullets. A
  sign-off with a trailing clause, and a heading losing its role to the introduction under it, are not there.
  New variants.
- **F7's raw `*`** is the earlier loop's R2-6. Known.
- **F6's refusal** is the earlier loop's R2-1 not recurring. The stuck item after a hand-made change is new.
- **F3, F5, the other parts of F7, F8 and F9**: not in `ux-review.md`. `editor-run-2026-11-10-loop2.md` is the
  editor's own record of this run; I did not read it, and it may report F1, F5 and F7 from her side.

## The files

- This report: `docs/records/writer-run-2026-11-10-loop2.md`
- The finished world, exactly as exported, drafts included: `docs/records/writer-run-2026-11-10-loop2.pwk`
- Sent and received, in the run's `loop2/handoff/`: `round1-from-writer.docx`, `round2-from-writer.docx`,
  `round3-from-writer.docx`, `round3-from-writer-clean-reading-copy.docx`, the three cover notes, and the
  editor's three files, two letters and three emails.
