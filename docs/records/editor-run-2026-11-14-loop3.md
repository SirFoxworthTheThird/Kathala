# Editor run, 2026-11-14, loop 3: three rounds on THE SALT LEDGER

I was the freelance editor, Maren Hollis, on Tamsin Hale's novella THE SALT LEDGER (fantasy mystery; 12,496 words in draft 1, 13,839 in draft 3). There were three rounds. I worked blind: I read no source, records, issues or guide, and never opened the app. All I know about her tools comes from the files and her notes.

My tools were LibreOffice 24.2, headless, driven through UNO from Python (port 2032, its own profile, signed "Maren Hollis"), plus python-docx and plain XML reading for measurement. Working files are in the scratchpad: `.../loop3/editor/` (scripts, logs, dumps, renders, and `notes-round1.md`, `notes-round2.md`, `notes-round3.md`). Hand-offs are in `.../loop3/handoff/`.

**Interruption.** A usage limit stopped me early in round 3, after I had read her round-3 note and hashed her files, and before any other round-3 step. The worker restarted, and with it my LibreOffice. I restarted LibreOffice from the same profile and carried on from receiving the files. Nothing was redone or lost. The gap is visible in the dates: her round-3 export is 19:47, my round-3 marks 23:04.

The novel's merits and faults are in my letters (`round1-editorial-letter.txt`, `round2-editorial-letter.txt`) and in the margins, not here.

## What I was sent

### Round 1: `round1-from-writer.docx` (105,818 bytes)

- **Format.** A clean, standard manuscript:
  - A4, Times New Roman 12, double spaced, 0.5" first-line indent.
  - Contact block, then title and byline on the title page. Running header "Hale / THE SALT LEDGER / n", suppressed on page 1.
  - 45 pages in LibreOffice.
- **Styles.** Every structure has its own style:
  - Heading 1 "Chapter One"… (6), each with page-break-before. Heading 2 chapter titles (6).
  - Scene Break (11 × `#`, 1 × `END`). Contact, Title, Byline. `Verse` is defined but unused.
  - 442 paragraphs, none empty.
  - Italics are consistent (34 runs: ship names, the letter, notes). Quotes are straight; 16 em dashes. No hidden text, no fields except PAGE.
- **Tracking.** `settings.xml` held only `<w:trackRevisions/>`, and LibreOffice opened the file with recording on, as her note promised.
- **Things a reader never sees:**
  - 17 bookmarks `KathalaScene_0`…`_16`, collapsed at the start of each scene's first paragraph.
  - Custom properties `KathalaDraft` and `KathalaWorld`, with opaque IDs.
  - `core.xml` holds title and creator only. There is no `app.xml`, theme or font table: a generated package. Nothing was missing that I needed.
- I would not have asked for a different file.

### Round 2: `round2-from-writer.docx` (marked, 178,787 bytes) and `round2-from-writer-clean.docx` (111,097 bytes)

- **Package.** Rewritten by her software, not edited from mine. `styles.xml` and `header1.xml` are byte-identical to round 1's, and all LibreOffice's additions were gone.
- **Custom properties.** New: `KathalaMarkedBy` = "Tamsin Hale" and `KathalaMarkedAgainst`. `KathalaDraft` has a new value.
- **Structure.** 7 chapters, 18 scenes, 18 bookmarks (`_17` new). 51 pages with markup.
- **Tracked changes, XML.**
  - "Tamsin Hale": 43 deleted runs, 17 deleted paragraph marks, 93 inserted runs, 42 inserted paragraph marks.
  - "Tamsin Hale (edit declined)": 3 deleted runs, 1 deleted paragraph mark, 4 inserted runs.
  - LibreOffice reads 88.
  - **All 203 marks dated `19:18:35.054Z`.**
  - None of mine pending: my round-1 changes arrived **pre-accepted** into the base.
- **Comments.** 57: my 40, plus 17 under her name. Of hers, 9 are her real replies; 8 are machine notes, "On words since rewritten: “…”". Threads and resolved states are in `commentsExtended.xml`; 4 threads open.
- **The clean copy.** No settings, comments or bookmarks. One property, `KathalaCleanCopyOf` = "the-salt-ledger.docx". 469 paragraphs, 13,560 words.

### Round 3: `round3-from-writer.docx` (marked, 175,922 bytes) and `round3-from-writer-clean.docx` (112,746 bytes)

- **Package.** Same parts as round 2; styles, header and settings byte-identical. Two Kathala properties have new values.
- **Tracked changes.** "Tamsin Hale": 14 deleted runs, 22 inserted runs, 3 inserted paragraph marks. "(edit declined)": 1 deleted, 3 inserted. LibreOffice reads 35. **All 43 marks dated `19:47:15.844Z`.**
- **Comments.** 88: my 64, her 24 (7 new replies). 2 threads open.
- **Clean copy.** 473 paragraphs, 13,839 words. No structural change, and Reject All confirms it.

## What I did

| | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| Her changes | — | accepted all (88 → 0) | accepted all, at her request (35 → 0) |
| My edits (acts) | 67: 37 replace, 25 delete, 2 insert, 2 split, 1 join (incl. 1 move, 1 added sentence, 3 longer cuts) | 26 changes as 23 acts: 13 replace, 5 delete, 1 insert, 1 split, 3 moves | 5: 3 replace, 2 delete |
| In the XML | 64 `w:del`, 40 `w:ins`, 1 del ¶, 2 ins ¶ | 20 `w:del`, 15 `w:ins`, 1 ins ¶, 3 `w:moveFrom` + 3 `w:moveTo` | 5 `w:del`, 3 `w:ins` |
| Reopened in LibreOffice | 65 Delete + 42 Insert = 107 | 23 Delete + 18 Insert = 41 | 5 Delete + 3 Insert = 8 |
| New comments | 40 | 17, plus 7 replies (4 threads resolved) | 3, plus 2 replies (2 threads resolved) |
| Comments in file (mine / hers) | 40 / 0 | 64 / 17 | 69 / 24 |
| Letter | 3,026 words; strengths, seven themes, next steps | 1,061 words | closing note only |
| Reply email | yes | yes, with file notes | closing note, with file notes |

- **Authorship.** Every change and comment in every file I sent is signed "Maren Hollis" (initials MH), with nothing by anyone else pending.
- **Reject All checks.**
  - Round 1: gives back her text exactly.
  - Round 2: gives back her clean copy exactly, except one paragraph split LibreOffice won't rejoin (T-4).
  - Round 3: gives back her clean copy exactly.
- **Sent files**: `round1-from-editor.docx` (sha256 `c58fe7db…`), `round2-from-editor.docx` (`34f91a49…`), `round3-from-editor.docx` (`6ae4e9c7…`).

## What I could and couldn't verify from the file alone, and what it cost

- **Round 1.** Everything I needed was in the file. The one cost was my own reading copy: the text conversion silently dropped dashes and italics (T-7).
- **Round 2.** The marked file alone could not answer the four questions an editor asks of a revision:
  1. **Which of my edits stand?** They arrive pre-accepted, so the file is silent; only the five she declined are marked. Her note gives totals that don't agree with each other (F-5).
  2. **Did the moved last scene come through intact?** It shows as 10 paragraphs struck and 10 re-inserted 30 paragraphs lower, and "word for word" can't be checked by eye.
  3. **What changed structurally?** The new Chapter Seven heading is untracked, so the markup doesn't show it at all (F-2).
  4. **Where were my comments?** Eight had moved to scene openings, and only the machine note's quotation says what they had been on (F-1).

  To answer them I ran LibreOffice's Accept All and Reject All on her marked file. I diffed the results, paragraph by paragraph, against her clean copy and against my own accepted round-1 text. And I wrote a classifier that checks each of my 67 edits against the clean copy. Results: 55 stand, 7 not taken, 5 in rewritten passages. That was most of round 2's checking effort. In Word I would have used Compare Documents for the same answers.
- **Round 3.** Her changes were small and local, so the marked file was readable on its own for *her* changes. To confirm that my 26 round-2 changes landed (23 stand, 3 declined) I still needed the comparison, for the same reason as round 2. Reject All equalled my round-2 text exactly, and Accept All her clean copy.
- **Which file was the reference.** I read from the clean copy each round, and treated it as the reference for what the book now says. The marked file was the reference for what she changed. I put my changes only into the marked file, as she asked.

## Receiving a revision with the author's changes marked

**What it gave me.**
- Her changes were readable in place, with declines signed distinctly ("edit declined").
- Her replies sat under the comments they answered.
- Resolved and open states were honest and matched her notes exactly, both rounds.
- My comments came back word for word with their original dates.
- The base text was exactly my text, with all my edits accepted and nothing mangled: no joined words, doubled sentences or lost paragraph marks, in any round.
- Accept All on the marked copy equalled the clean copy both times. That made the clean copy trustworthy.

**What would have made it usable without a comparison:**
1. **Mark structural changes.** A new chapter heading or scene break should be a tracked insertion, and a removed `#` a tracked deletion (F-2).
2. **Say which of the editor's changes stand.** Either leave them visible as accepted, or list them (in a note, a comment, or the cover note) with counts that match the file (F-5).
3. **Keep comments on their words.** Keep them there when the words survive, and on the replacement text when the words are replaced. Moving a comment to the top of the scene loses the point of it (F-1).
4. **Don't sign software's notes with the author's name, and don't re-date them** (F-3).
5. **Give tracked changes their real dates** (F-4).
6. **Represent a moved scene as a move** (Word has `w:moveFrom`/`w:moveTo`), or say in a comment that it is one.
7. **Represent a declined join or split as one change with one signature** (F-6).

## Findings about the file and the round trip, most costly first

Each finding was found from the editor's side, through the files alone.

- **F-1. Comments detached from their words and moved to the top of their scene.**
  - *What I expected:* each of my comments on the words it was about, or on the text that replaced them.
  - *What happened (round 2):* 8 of my 40 round-1 comments came back as zero-width points at the start of their scene, each with a machine reply quoting the old words. The distances, in paragraphs from where they had been, were 1, 2, 10, 11, 17 and 22, and about 35 for two more. The boots comment now sits in a different scene from the boots.
  - In two of the eight the words still existed: "He says he woke … and the boat was gone" had an insertion inside it, and "The letter's ash" was replaced like-for-like. Two others were adapted instead: one now ends inside her insertion, one was re-anchored onto her rewrite. The other 30 came back on exactly the same words.
  - *Evidence:* `editor/r2-comments-dump.txt`, `editor/r2-marked-view.txt` (paragraphs 7, 105, 152, 188, 397, 427, 441).
  - *Reproduced:* measured in round 2. Still there in round 3.
- **F-2. Structural changes are untracked.**
  - Round 2: "Chapter Seven" (Heading 1) and "The Hearing" (Heading 2) replaced a `#` with no `w:ins`/`w:del`. A new `#` before the last scene is untracked too. The LibreOffice PDF has no change bar there (`editor/conv3/m-47.png`), and Reject All leaves Chapter Seven in place.
  - The author confirmed it in round 3: "My software doesn't mark a new chapter or a new scene break as a change."
  - *Reproduced:* Reject All diff and XML, round 2. Not exercised in round 3, which had no structural change.
- **F-3. Software-written text under the author's name, re-dated each export.**
  - The 8 "On words since rewritten" replies are signed "Tamsin Hale". They are dated after her real replies but listed before them in their threads.
  - In round 3 the same 8 notes, untouched, were **re-dated from 19:18:35Z to 19:47:15.844Z**.
  - *Reproduced:* comparison of comments.xml between rounds 2 and 3.
- **F-4. Every tracked change carries the export moment as its date.**
  - Round 2: all 203 marks at `19:18:35.054Z`. Round 3: all 43 at `19:47:15.844Z`. Her replies carry real times (19:03–19:15, 19:46).
  - *Reproduced:* both rounds.
- **F-5. The cover note's counts disagree with the file.**
  - Round 2: "of your 66 changes … 4 I turned back". I made 67; 5 are marked declined; and the same note lists seven she didn't take.
  - Round 3: "your 27 changes". I made 26 (23 acts); 23 stand and 3 are declined, which matches the file.
  - *Reproduced:* both rounds, by my classifier against the clean copy.
- **F-6. A declined join is written as two changes with two signatures.**
  - Undoing my round-1 paragraph join shows the sentence **inserted as a new paragraph, signed "Tamsin Hale"**, and deleted from the joined paragraph, signed "Tamsin Hale (edit declined)". The sentence appears twice in the markup. Reject All in LibreOffice leaves an empty paragraph there.
  - Accept All gives the right text.
  - *Reproduced:* once (round 2). Only one join was ever declined.
- **F-7. The cover note describes a change the file doesn't show (round 3).** "The Vael move in the cellar, which I made by hand… it may look like my change." In the file the moved text is simply in the base, identical to mine, with no mark of either of us. Possibly her software did not take my `w:moveFrom`/`w:moveTo` (see S-3). *Not reproducible from the file.*
- **F-8. "(edit declined)" is a second author name.** LibreOffice lists two authors. That Word shows it as a separate reviewer, with its own colour, is *a guess*: I have no Word.
- **Not findings, for the record:**
  - The KathalaScene bookmarks and the custom properties are invisible to a reader and harmless.
  - They survived every LibreOffice save of mine, and the bookmarks always sat at the scene starts.

## Editor-side tool problems (LibreOffice and my scripts)

These are separate from the findings above. They would affect any editor using LibreOffice, and some of them shape what the author's side receives.

- **T-1. A comment inserted with recording on becomes a tracked insertion.** My first round-1 save had 77 `w:ins` where my edits account for 37: an empty insertion at nearly every comment anchor. Word doesn't do this. I fixed it by turning recording off for comments. The evidence is kept (`editor/r1-draft-comments-tracked.docx`). The author's importer should tolerate empty insertions. *Reproduced.*
- **T-2. Through UNO, LibreOffice cannot make a threaded reply.**
  - Setting `ParentName` or `ParaIdParent` on a new annotation, before or after insertion, exports no `w15:paraIdParent`.
  - The `.uno:ReplyComment` dispatch does nothing in a hidden frame.
  - Without a fix, my replies would have arrived as free-standing comments. *Reproduced* (`editor/test-reply.docx`, `editor/r2-edited-draft.docx`). I patched the saved file (next section).
- **T-3. Zero-width comment ranges are written as points, and LibreOffice then loses the threading under them.**
  - Her 8 relocated comments, and their replies, came back from LibreOffice without `commentRangeStart`/`End`.
  - When LibreOffice reopened my own file, it showed replies under those parents as top-level: 14 in round 2; 11 of hers and 3 of mine in round 3. The XML threading was intact both times.
  - Her software read my round-2 file back with every thread right.
  - *Reproduced:* twice.
- **T-4. Reject All didn't rejoin my round-2 paragraph split.** The paragraph-mark insertion is in the XML. In round 1 two splits rejoined. My guess at the cause is that this paragraph begins with a comment range; *not proven*.
- **T-5. LibreOffice exports an identical cut-and-insert as `w:moveFrom`/`w:moveTo`.** That was round 2; round 1's move had different wording and came out as `w:del`/`w:ins`. LibreOffice still reports these as Delete/Insert when it reopens the file.
- **T-6. A reply can't be inserted over a range that already carries comments** ("no SwTextAttr inserted"). Replies went in as points at the parent's start. An annotation made without a date is written `0-00-00T00:00:00Z`; I always set dates.
- **T-7. Reading copies and search.**
  - `soffice --convert-to txt` wrote ASCII here: 16 em dashes became hyphens and all italics vanished. I nearly queued edits for dashes that were fine.
  - In LibreOffice's model a tracked replacement leaves both old and new text ("lovedliked"), so later searches spanning an edit fail. I worked around it with contexts that don't overlap.
- **T-8. LibreOffice reshapes the package on save.** It adds `app.xml`, a font table, a theme and extra headers, and writes an explicit Normal style and empty `rPr` everywhere, even with no edits (`editor/noop-roundtrip.docx`). I measured no losses. Her software rewrote all of it away each round.

## Where I edited a saved file by hand, and why

- **Round 1: none.**
- **Rounds 2 and 3: yes, only `word/commentsExtended.xml`.**
  - After LibreOffice saved each file, `editor/thread_replies.py` added a `w15:paraIdParent` attribute to the `commentEx` entry of each of my replies, pointing at its parent's `paraId`. That was 7 attributes in round 2 and 2 in round 3. Nothing else in the package was touched.
  - Why: T-2. LibreOffice driven through UNO can't produce a threaded reply, and an editor clicking Reply in Word (or, I assume, in LibreOffice's own window) would have sent threaded replies. Without the patch, my answers to her replies would have arrived as loose comments.
  - The unpatched files are kept: `editor/r2-edited-draft.docx` and `editor/r3-edited-draft.docx`.
  - In round 3 her file came back with all 7 patched replies under the right parents.
- Everything else (edits, comments, accepting her changes, resolving threads) went through LibreOffice.

## What I only suspect

- **S-1. Untested in three rounds:** what happens to a `KathalaScene` bookmark when an editor's change deletes or moves a scene's opening words, or joins across a `#`. None of my edits touched a scene's first characters. To settle: a tracked deletion of a scene's first sentence, then the next round's file.
- **S-2. Untested:** how Word displays my LibreOffice files (comment placement, the "(edit declined)" author, moves). I have no Word.
- **S-3. A guess:** her software may not take `w:moveFrom`/`w:moveTo` back as a move. That rests on her note about "the Vael move… made by hand" (F-7); she mentions only that one of my three moves. The file can't show it.
- **Settled:**
  - Her software threads my patched replies correctly (round 3).
  - It knew I had accepted her changes: her round-3 note thanks me, and the base text confirms it.

## What worked

- In all three rounds my text came back exactly as I made it, under her decisions: Reject All gave my text back each time. Nothing was mangled.
- My comments came back word for word with their dates. 30 of the first 40 sat on exactly the same words.
- Every reply, hers and mine, sat under the right comment. Resolved and open states matched her notes exactly in both returns.
- Accept All on her marked copy equalled her clean copy both times.
- Styles, header and page set-up came back byte-identical every round. The bookmarks followed the new scene structure. Italics survived.
- Her declines are clearly marked and easy to read. In round 3, with small local changes and no untracked structure, her marked file was readable on its own.
