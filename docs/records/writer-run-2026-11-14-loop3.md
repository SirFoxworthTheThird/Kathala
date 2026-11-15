# Writer run, 14 November 2026 — loop 3 (blind, with an editor, four rounds)

The writer was *Tamsin Hale*, writing **The Salt Ledger**, a second-world fantasy mystery. The editor was *Maren Hollis*, a separate agent who never saw the app. A coordinator carried files between the two. The writer drove the frozen build at `http://localhost:4193/` through Playwright, with one persistent profile across all four rounds. Every change went through the UI. `window.__pwdb` was read only to check what the app had saved. Source code was read only after a behaviour had been seen; every mechanism below is marked **(read afterwards)**. `docs/records/ux-review.md` was read only at the very end.

Working notes, scripts, screenshots and the unzipped Word files are in the session scratchpad: `loop3/writer/notes-round1.md` … `notes-round4.md`, `loop3/writer/shots/`, and `loop3/writer/{edx1,r2x,edx2,r3x,edx3}`. The finished world is `docs/records/writer-run-2026-11-14-loop3.pwk`: 1,355,300 bytes, including the book's 13 drafts.

## What I set out to do, and how far I got

1. **Write a book and send it to an editor.** I drafted six chapters, 12,584 words (my `wc`, headings included), in plain text. I brought them into a new world by pasting each chapter into the Manuscript's Page, with a scene header on each scene. I saved a draft, ran the prose pass, exported Word with the "For an editor" option, and wrote a cover note. **Done.** The app counted 6 chapters, 17 scenes, 12,496 words.
2. **Round 2.** I brought in Maren's tracked changes and 40 comments, decided each change, and answered her comments in the app. I turned her 3,000-word letter into tasks and did the structural revision: the scheme, the tides, Brennick's reasoning, and a new Chapter 7 holding the hearing as a scene. I sent the book back marked against her version, with a clean copy alongside. **Done.** 7 chapters, 18 scenes, 13,560 words.
3. **Round 3.** Her lighter pass came back with 26 changes (three of them moves), 17 comments and 7 replies. I did the same again: decisions, a second letter turned into tasks, the fixes she left to me, and a habit-word pass. **Done.** 13,802 words.
4. **Round 4.** Her last 5 changes and 3 comments. I made the final fix, saved the final draft, compared it with every earlier one, and exported the `.pwk`. **Done.** 13,806 words. All 36 tasks are ticked and all 60 notes are resolved.

Along the way I asked the book the questions a writer actually asks:

- *Who knew about the cellar salt by the time Ilse goes up the Mount?* Two clicks, once the facts were recorded. Recording them took 62 clicks.
- *Where was Tobin when Ilse found Pell?* Two clicks.

## What stopped me — ranked by what it cost

Each finding has an id, what I did, what I expected, what happened, the evidence, and the cost. All are **reproduced** unless marked otherwise.

### W3-1 (high). Splitting a scene draws its header but does not record the people in it. Change the scene before it, and everyone in the split-off half moves too, against what its own header says.
- **Did:** In Ch.6 I retitled "The Tally Desk" to "The Magistrate", then split it with Ctrl+Shift+Enter at "Kesh did not come to the hearing", making a new scene, "The Tally Desk". The new scene's header was copied: Place: #The Salt Exchange, with Ilse and Sefa. I then changed The Magistrate's Place line to #The Customs House.
- **Expected:** What the guide promises in *The scene header*: "a header that says *#The Quay* keeps them on the Quay whatever an earlier scene is later changed to say."
- **Happened:** With the cursor on Ch.7 The Tally Desk, the Characters screen showed "Ilse Marrow — The Customs House, carried forward" and "Sefa — The Customs House, carried forward". The header on the Page, for that same scene, still said The Salt Exchange.
- **Reproduced:** In a scratch world, I split "Hall" [#Kitchen @@Pia Lund] into Hall and Garden, then changed Hall to #Cellar. At Garden, the screen showed "Pia Lund — Cellar, carried forward". The store held a single person record (at Hall).
- **Control:** A scene pasted with its own header naming the place Pia already had *did* get its own record (records at Yard and at Hall). So a typed or pasted header records the people at its place; a split copies the place and cast but records no one.
- **Fix by hand:** Delete one letter of the Place line, retype it, and leave the line.
- **Cost:** Silent. Nothing on the Page told me; I found it only because two screens disagreed. A writer who splits a scene and later moves the scene before it has moved the second half's people as well, and the header goes on contradicting the records.

### W3-2 (high). After a split, the marked Word file shows the unchanged ending struck through and retyped, including the line the editor said not to touch.
- **Did:** Round 2 export, with "Show my changes since Maren Hollis's file" ticked (the default). The only edit in the split-off scene was its boots paragraph.
- **Expected:** The draft Compare had already described this correctly as "Split from 'The Magistrate'".
- **Happened** (in `round2-from-writer.docx`):
  - Under The Magistrate's bookmark there are 15 deletions. 11 of them, 150 words ("Sefa came at noon with bread." … "Four sacks struck. See the magistrate's record."), reappear word for word as insertions under The Tally Desk's bookmark.
  - Rendered by LibreOffice, page 48 shows the whole ending struck through *before* the new hearing, and page 51 shows it inserted again. "Now it adds." appears twice.
  - Maren's comment "Perfect last line. Don't touch it." is anchored on the struck-through copy.
- **Mechanism:** Not confirmed. `src/lib/markedDocx.ts` matches paragraphs by likeness; my guess is that the matching stays inside one scene, so a new scene has nothing to pair with. **(read afterwards; a guess)**
- **Cost:** I had to put a paragraph in my cover note saying I had not rewritten the ending. Without it, the editor would have seen her "don't touch it" line deleted.

### W3-3 (med-high). Moves: one listed as three garbled changes, one refused with a false reason, and one made by hand not recognised.
- **Hanne's geography sentence** (round 3; seen on two openings of the list):
  - It came in as three items, two of which read as nonsense: `Hanne grunted. "WhenThe gate's at the river was turned they…` and `Hanne grunted. "When the cellar end, the slip beside it …`.
  - In her file the moved text is `" The gate's at … gate."` going out and `"The gate's at … gate. "` coming in. The space falls on opposite sides.
  - Her other Hanne move, where the spaces match, came in as a single "⇄ Moved … accepted or rejected whole".
  - Accepting the three items still produced exactly her text. I checked every paragraph she changed against the text her file means: all matched. So the result is right and the list is unreadable.
- **The Vael move in River Door** (seen on two openings): the list said "The scene no longer has these words: you have changed them since" for its two whitespace parts, and "Made here, this would run two sentences together" for the move itself.
  - I had not touched that scene since sending. The paragraph her file starts from is in my store character for character.
  - I made the move by hand with Find & replace. The two whitespace parts then said "Already in the scene … Clear", which is right. The move itself still said "you have changed them since". Rejecting it left my hand edit in place.
- **Cost:** A hand edit and three clicks for one moved sentence, and an on-screen reason that was untrue.
- **Knock-on:** The app's tally then disagreed with the editor's for the second round running. The app counted 27 changes; she made 26. She also wrote: "The Vael move you say you made by hand is in the text exactly as I made it, so nothing in the file marks it as yours."

### W3-4 (med). The marked Word file does not mark a new chapter, its title, or a new scene break.
- **Found by the editor**, and confirmed in the file I sent (`r2x/word/document.xml`). The paragraphs "Chapter Seven", "The Hearing" and the new "#" before Kesh's boots carry no change mark. The "#" they replaced has no deletion mark.
- **Her words:** "Chapter Seven appears as if it had always been there … if your software counts changes, it hasn't counted these."
- **Guide:** It does say headings are "made afresh each time the book is exported". But nothing in the export dialog, which otherwise describes the file in detail, said that a structural change would go out unmarked.
- **Cost:** Only my cover note warned her.

### W3-5 (med). The app writes comment replies under my name and re-dates them on every export.
- **What it writes:** For each note whose words I had since rewritten, the marked export adds a reply *"On words since rewritten: '…'"*. There were 8. Each is signed **Tamsin Hale** and placed at the start of the note's scene paragraph, without a range. The app never stored these as replies; it writes them into each file.
- **Dates:** In three files the 8 replies carry the export time: 19:18:35 in round 2, 19:47:15 in round 3 (still 19:47:15 in her round-4 file). My own reply kept 19:03:30 throughout.
- **The editor noticed both:**
  - "in Word they look like your words"
  - "new dates this time … though nobody touched them"
  - In LibreOffice some of the replies showed as loose comments, which she put down to her end.
- **Cost:** Small, but it is the app speaking in the author's name to the author's editor.

### W3-6 (med). The letter splitter does not read "Ch3", so tasks are not linked to their chapters.
- **Measured from the stored tasks:** Maren writes chapters as "Ch3", "Ch5, scene 3", "in Ch6". Of the 18 tasks from her first letter that name a chapter, **16 got no chapter link**. The 2 that did both say "Chapter Six" in words.
- **Round 3:** "Ilse goes to the Exchange (Ch5, scene 3) … One line in Chapter Seven" was linked to Ch. 7 and not to Ch. 5.
- **Mechanism (read afterwards):** The `CHAPTERS` pattern in `src/lib/editorialLetter.ts`, around line 207, needs `ch.` or `ch ` with a space. That matches the guide's list ("chapter 3, ch. 12, ch.12"), but it misses the commonest editor shorthand.
- **Cost:** Those tasks never appear on the chapter panels, which is where I'd look while revising a chapter.

### W3-7 (med). The letter splitter ticks a long sign-off and the signature as tasks.
- **Happened (three splits, both letters):** "With warm good wishes, and congratulations on a very good first draft," and "Maren" were ticked as tasks. In round 3 the bare "With warm good wishes," was ticked as well.
- **Guide:** a sign-off, "or a longer one like *With warm regards, and thanks for …*", and the name under it are "offered unticked".
- **Mechanism (read afterwards):** The `SIGN_OFF` list in `src/lib/editorialLetter.ts`, around line 36, has "warm wishes" and "warm regards" but not "warm good wishes".
- **Known?** A variant of a sign-off case already closed in `round-trip-plan-3.md` (T11.2). The fix covers listed phrases, and this phrase isn't listed.

### W3-8 (low-med). A long numbered heading in a letter becomes a task.
- **Happened (two splits):** "1. The scheme: told too often, and never quite pinned down (your question 1)" came in as a point. Sections 2 to 5 came in as headings.
- **Mechanism (read afterwards):** `headingLike` refuses lines over 60 characters, and this one is 74.
- **Cost:** One click on "Make a heading". Until then, the seven scheme tasks sat under no heading.

### W3-9 (low-med). Tasks from two letters by the same editor cannot be told apart.
- **Observed:** After the second letter, the one list reads "29 of 36 done". Every task from either letter says "From the letter: Maren Hollis", with no date and no round.
- **Cost:** The second letter's tasks happened to sit under its own heading ("WHAT'S LEFT"). Otherwise I couldn't have said which round asked for what.

### W3-10 (low-med). "Create all" makes people; the guide says it doesn't.
- **Reproduced in a scratch world:** I pasted a chapter whose headers named three new people and two new places, then clicked once on "Create all that the 2 waiting headers name". All of them were made, and both headers were applied. It did the same for four characters in the book.
- **Guide (paste bullet):** "A name on a cast nobody answers to is not made for you — it is as likely misspelt as new."
- **Code (read afterwards):** `createAllWaiting` deliberately calls `createHeaderCharacter` for `unknown.people`.
- **Cost:** None to me. If the guide is the side that's right, a misspelt cast name quietly becomes a second person.

### W3-11 (low). After "Create all", the note still says the headers were not applied.
- **Reproduced** on four chapter pastes and in a scratch world. Three seconds after "Create all", with both scenes applied in the store, the note above the page still read: *"The headers of 'Alpha' and 'Beta' were not applied, and wait as typed."*
- **Mechanism (read afterwards):** `keptByPaste` adds that sentence to the page notice, and `createAllWaiting` never takes it back out.
- **Cost:** A moment's doubt, and a check of the scene panel.

### W3-12 (low). Recorded knowledge floods the first scene's header.
- **Observed** after recording who knew what. Ch.1's first scene header grew from 3 lines to 10, with a `Facts:` line naming six people who knew "before the story". It is the top of the book on the Page. The guide describes this behaviour.

### W3-13 (low). After a split, notes stay filed under the old scene.
- **Measured in the store:** After the split, the note on "Now it adds." is stored against The Magistrate, the scene it was split from. The Notes panel still labels it correctly ("Ch. 7 · The Tally Desk").
- The boots note, unplaced after I rewrote its words, is labelled "Ch. 7 · The Magistrate" in the panel, though its words were in The Tally Desk.
- In the marked export, that boots comment was placed at the top of The Magistrate.

## What I only suspect

These are not reproduced, or not checked. Each says what would settle it.

- **S-1.** A one-line header (`[#Cellar @@Pia Lund]`), typed straight after Ctrl+Enter, a title and Enter, stayed as prose and was never applied (one try, in a scratch world). My script may have caused it. *Settle by:* typing that exact sequence by hand, twice.
- **S-2.** The Dashboard said "+12,704 words today" while the book was 12,496 words, 208 more than exist. My guess is that header lines or pasted text were counted before the paste's headings were made. *Settle by:* pasting a small chapter with headers into a fresh world and reading the day's count.
- **S-3.** The prose pass was off when I came back, though the Read layout was remembered. It may be intended.
- **S-4.** Once, straight after typing `# The Hearing`, the chapter panel stayed on "Ch. 6 — Spring Tide" while the top bar said Ch.7. Seen once.
- **S-5 (probably harness).** A chapter retitle made less than a second before the browser was killed was lost (3 runs). Closing the tab first kept it (2 runs). After a 3-second wait it was always kept. This is how my script closed things in the first session, and probably not a user finding; a crashed browser may lose its last second.
- **S-6.** The app's own tallies of the changes I declined never matched mine or the editor's:
  - Round 2: the app said 53 stand / 4 turned back / 9 rewritten. I made 7 rejections. Maren counted 55 / 7 not taken / 5.
  - Round 3: the app counted 27 changes; she made 26.

  Part of this is W3-3. The rest I can't settle without knowing how the app counts.

## What worked

- **Bringing a drafted book in.** I pasted each chapter, with `#`/`##` headings and header blocks, into the Page, then pressed "Create all". About 10 clicks beyond the pastes turned 17 scenes into scenes with every place, cast and item hand-off my headers named (checked in the store).
- **The editor export** produced a real manuscript:
  - title page with contact block and word count;
  - running head, double spacing, `#` breaks, italics kept;
  - Track Changes switched on, and scene bookmarks;
  - a draft saved for me at the moment of sending.
- **Bringing edits in,** every round:
  - The counts were exact for comments, replies and resolved threads.
  - All 40 + 17 + 3 comments landed on the right words in the right scenes.
  - Nothing came back twice; the app's own 8 replies were not re-imported.
  - Drafts were saved automatically: "Before …" and "As … sent it back".
  - My own post-send edit was correctly flagged: "you have changed them since; make this change by hand".
- **The Changes list** for ordinary edits: struck-through and inserted words on the Page, Accept all per scene, the paragraph split and join marks, "Already in the scene … Clear", and Undo-safe History. Every accepted change I checked landed exactly as the editor wrote it.
- **Notes:** replies, resolve, a quote that follows words partly rewritten ("Made on: …"), the unplaced state, and the heading comment answered in the panel.
- **Find & replace** carried 55 of my rewrites, multi-paragraph ones included, each one match and one step.
- **Typing `# The Hearing`** made the chapter and moved the scenes after it into it, as the guide says.
- **Drafts and Compare:** per-scene "Edited, +216 words", "Split from …", "Moved from Ch. 6 · Was …", and a readable word-level diff. The final comparisons:
  - with what I first sent: 18 scenes changed, 12,496 → 13,806 (+1,310);
  - with the second draft: 14 scenes, +246;
  - with the third draft: 4 scenes, +4.
- **The export dialog's account of a marked file.** It says what it will hold before you download: "49 changes and 40 comment threads … 6 put back … Of Maren Hollis's 66 changes: 53 stand …". It also offers "Copy for the cover note" and a clean copy, which Bring in edits refuses.
- **Answers once the records were in:** who knew what (Knowledge, with the cursor on a scene), where someone was (Characters), and Cast Balance ("drops out for 3 chapters mid-story" was a true structural note). The prose pass found the three pet words the editor later counted.

## The round trip with the editor, as a whole

| Round | Direction | What the app said | What the file held (my count) | Agreed? |
|---|---|---|---|---|
| 1 | out | 12,496 words, 17 scenes; draft "Sent for editing" | Track Changes on; 17 `KathalaScene_n` bookmarks; 2 custom properties; no scene titles; 45 pages | yes |
| 1→2 | in | "66 changes in 17 scenes … 40 comments are now notes" | 42 insert / 65 delete elements, 3 paragraph-mark changes, no move marks, about 68 changes in my grouping; 40 comments | Comments exact, per scene and on the right words. Changes 66 vs ~68: the difference is how I grouped pairs; per-scene counts agree in 14 of 17. No change in a wrong scene. My own post-send edit was correctly refused. |
| 2 | out | "49 changes and 40 comment threads … 6 put back (edit declined). Of Maren Hollis's 66 changes: 53 stand, 4 turned back, 9 rewritten since." | 139 insert / 64 delete elements; 57 comments (40 hers + my 9 replies + **8 app-written replies under my name**); 36 resolved; 18 bookmarks | The file's contents match the dialog. But 150 unchanged words show as deleted and reinserted (W3-2), and Chapter Seven is unmarked (W3-4). |
| 2→3 | in | "27 changes in 12 scenes … 16 comments … 1 on a chapter's heading … 7 replies … 4 threads resolved" | 16 insert / 20 delete / 3+3 move elements and 1 paragraph split, about 26 changes (her count, 26); 17 new comments; 7 replies; 4 resolved | Comments, replies and resolves exact; nothing twice. Changes 27 vs 26 (W3-3). The editor counted round 2 differently from the app: 67 / 7 / 55 / 5 against 66 / 4 / 53 / 9 (S-6). |
| 3 | out | "23 changes and 57 comment threads … 3 put back. Of Maren Hollis's 27 changes: 22 stand, 3 turned back, 2 rewritten since." | 28 insert / 15 delete elements, 4 "(edit declined)"; 88 comments (64 hers, 24 under my name, of which 8 app-written and re-dated); 2 threads open; heading comment on "The Hearing" | yes; the 8 re-dated replies are W3-5 |
| 3→4 | in | "5 changes in 3 scenes … 3 comments … 2 replies … 2 threads resolved" | 3 insert / 5 delete elements = 5 changes (her count, 5); 3 new comments; 2 replies | exact; nothing twice; right scenes |

**What sending the book back marked was like.** The dialog was the best part: before I downloaded, it told me how many changes, how many threads, how many of hers stood or were turned back, and it offered a clean copy. What it didn't tell me is what the editor then had to work out for herself:

- that a whole scene I had only split would show as cut and retyped;
- that a new chapter would arrive unmarked;
- that eight replies in her comment threads were the software speaking under my name, re-dated each time;
- that its count of her changes would differ from hers in both directions.

None of it damaged the book. Her accepted changes landed exactly, every round. All of it cost her reading time and cost me cover-note paragraphs. She asked about the counts twice.

**Interruptions:**
- The server was stopped and restarted between rounds 3 and 4. I checked on reopening: 18 scenes, 13,802 words, 57 notes, 36 tasks, 10 drafts, all there. It cost nothing.
- In the first session, my own script killed the browser within a second of an edit and lost a chapter retitle (S-5). It cost one retry.
- The app never stopped answering.

## Already known, or new

I checked `docs/records/ux-review.md` at the very end. It has no entries on the Word round trip, the letter splitter, revision tasks, or headers after a split. I also looked briefly through the round-trip plans for overlap:

- W3-7 is a variant of the long sign-off case (`round-trip-plan-3.md`, T11.2) closed there. That fix covers listed phrases; "warm good wishes" is not one of them. **Partly known.**
- `round-trip-plan-3.md` notes a move *between scenes* once counted as two. W3-3 is a different case: a move *within* a scene, where the space falls on the other side, plus the "changed them since" message. **New.**
- W3-1, W3-2, W3-4, W3-5, W3-6, W3-8, W3-9, W3-10, W3-11, W3-12, W3-13: no match found. **New**, as far as these two documents show.

I did not search the other records, and I don't claim these are new beyond the two documents named.

## Files

- Finished world, with drafts: `docs/records/writer-run-2026-11-14-loop3.pwk`. It is the app's export, unchanged: 7 chapters, 18 scenes, 60 notes, 36 tasks, 13 drafts.
- Files exchanged with the editor (in the session scratchpad, `loop3/handoff/`):
  - from me: `round1-from-writer.docx`, `round2-from-writer.docx` (+ `-clean`), `round3-from-writer.docx` (+ `-clean`), and the cover notes;
  - from her: her three edited files, her letters and her replies.
