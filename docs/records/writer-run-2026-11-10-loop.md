# Writer run, 2026-11-10: "The Salt Ledger", three rounds with an editor

I am the novelist Nell Garrow, an agent playing one, working blind. I wrote a book in the app, sent it
to a freelance editor (Jonah Pryce, also an agent, who never saw the app) as Word, brought his edits
back in twice, and revised.

His side of the loop is recorded in `editor-run-2026-11-10-loop.md`. The finished world is
`writer-run-2026-11-10-loop.pwk` beside this file. It includes the book's 8 drafts, 51 revision tasks
and 61 notes.

**Setup.**
- Build 5c46413, frozen, served at `http://localhost:4191/`.
- Chromium driven by Playwright through a persistent profile at 1440×900, closed and reopened between
  steps.
- Every change went through the UI. `window.__pwdb` was read only to check what had been saved.
- Working files are in the session scratchpad, under `loop/writer/`:
  - notes: `notes-round1.md`, `notes-round2.md`;
  - scripts: `s*.cjs`, `r*.cjs`, `t*.cjs`;
  - screenshots: `shots/`, `shots2/`, `shots3/`;
  - read-only prose dumps after each step: `cur/` … `cur6/`.

**Blindness caveat.** The repository's CLAUDE.md was injected into my context at the start. It
describes the app's data model: snapshots, scene headers, custody. I read no source, `e2e/` or
`docs/records/` file until I had seen each behaviour; the guide I used as a writer would. Where a
mechanism below comes from the source, it says **read afterwards**. I opened `ux-review.md` and the
round-trip records only at the end of round 3.

**Interruption.** A usage limit stopped round 2 after the revision was written and before the notes,
tasks, draft and export. The server was restarted from the same build. I checked the profile and
carried on without redoing anything (`notes-round2.md`).

---

## What I set out to do, and how far I got

**Round 1. Write the book and send it.**
- Wrote a second-world fantasy outside the app:
  - 6 chapters, 13 scenes, 13,109 words by `wc`;
  - a cast of 9: Tamsin, Corin, Vane, Agathe, Iska, Wren, Hale, Mell, Pell.
- New World, then the first-run guide, then the Manuscript's Page.
- Wrote a header for every scene: place, cast, days, item hand-offs, facts learned, relationships, and
  Hale's death.
- Pasted the chapters onto the Page with their `#`/`##` headings and headers. The app made 6 chapters
  and 13 scenes, 13,083 words by its own count, and every header applied.
- Recorded Corin's arrest in a new place from his Current State.
- Asked the app the questions a writer actually asks:
  - Where is Corin when Vane uses him?
  - Who holds what at Vane's Office?
  - Who knew the tide fact by the night of the fire?
  - Where did I mention fog?
- Saved a draft, ran the prose pass, and exported Word (Submission, For an editor).
- Wrote a cover note.

**Round 2. Bring his edits in and revise.**
- Brought in his 60 changes and 40 comments. Accepted 48 and rejected 12.
- Answered 7 notes and resolved 36.
- Split his 2,650-word letter into 44 tasks.
- Revised for real:
  - rewrote the fraud as four register entries;
  - moved the false entry to a neap and made it backdated;
  - closed the two-key hole;
  - redid the tide calendar;
  - rebuilt the Tide Court so Agathe fights;
  - gave Tamsin a reason to go to Vane and a failed attempt at the arrest;
  - fixed a dozen continuity points.
  The work was 55 book-wide Find & replace edits plus a full scene rewrite on the Page.
- Ticked 38 of 44 tasks, saved a draft, compared, and re-exported with "Chapter One" headings.

**Round 3. A lighter edit, then finish.**
- Brought in his 21 changes and 23 comments. Accepted 18 and rejected 3.
- Made the 8 small continuity fixes he left to me.
- Added his second letter as 7 tasks; 44 of 51 are now done.
- Saved a final draft, compared it with the first file sent and with my second draft, and exported
  the `.pwk`.

The book went from 13,083 words to 14,201, in the same 13 scenes. **Everything asked was done.**

---

## The round trip with the editor, as a whole

All counts below are measured. "XML" means my own count of the `.docx` parts
(`docx_changes.py`, `docx_map.py`).

| | Round 1 (his first edit) | Round 2 (his second edit) |
|---|---|---|
| Sent | 13,083 words, 13 scene bookmarks, "Ch. 1 — Title" headings | 14,049 words, 13 bookmarks, "Chapter One / Title" headings; no markup of his left in it |
| His file, XML | 44 `w:ins`, 53 `w:del`, 1 move, 40 comments, all one author, bookmarks intact | 16 `w:ins`, 22 `w:del`, 0 moves, 23 comments, bookmarks intact |
| My grouping | 63 runs → **60** (the move's two halves are 1; 2 are empty `w:ins` LibreOffice writes beside paragraph splits) | 22 runs → **21** (1 empty marker) |
| His own count | "about sixty", later "61, or 60 if you count the moved sentence once" | "22 tracked changes" |
| **The app said** | **60 changes in 13 scenes; 39 notes; 1 comment "on words that matched no scene … read it in the file"** | **21 changes in 10 scenes; 22 notes; 1 comment not brought in** |
| Changes in the right scene | 60/60 (per-scene counts identical to the XML in all 13 scenes); the move as one "⇄ Moved"; both paragraph splits as "¶ New paragraph" | 21/21; the two-paragraph cut came in as one change containing a ¶ |
| Notes in the right scene | 39/39, in file order | 22/22 |
| The comment not brought in | On the chapter heading ("Ch. 1 —") | On the chapter heading again ("Chapter One"), placed there by him as a test (**R3-1**) |
| My decisions | 48 accepted, 12 rejected | 18 accepted, 3 rejected |
| Landed as decided | 59/60. One accepted change was written into the **wrong sentence** (**R2-1**) | 21/21, including "He → Vane" in a scene full of "He" |
| His audit of what came back | "47 in as I wrote them … 8 declined … 4 went with the old Tide Court"; the boot was my own fix. That agrees with my log exactly: R2-1's misplaced accept is the one not "as written" | (not sent back) |
| Of his, in my next export | No `w:ins`/`w:del`, no comments part, no "Jonah" anywhere in the package; a new draft id; every paragraph of the app's book present. Track Changes is off (no `settings.xml`) | (the `.pwk`, not Word) |

**Where the counts disagreed.**
1. **The heading comment, both rounds.** The app counted it and said to read it in the file, but its
   words are nowhere in the app (**R3-1**).
2. **22 against 21 in round 2.** Jonah counts 22; the app and my XML grouping both give 21 real
   changes. The likeliest cause is his one deletion spanning two paragraphs (C18). The app shows it as
   one change with a "¶" in it, and LibreOffice may list it as two. I can't see his Manage Changes
   list, so this is a **suspicion** (S4).
3. **Round 1, after I revised.** The notes kept faith in their own scenes, with one exception:
   - 10 notes on words I had removed said honestly "Unplaced: these words are no longer in the book".
   - 3 said "Its words have been edited since" and stayed in their scene.
   - **1 moved to another chapter** (**R2-3**).

**The line I changed after sending** (the coordinator asked). The only edit after the first export was
a chapter title, changed and restored at once, and it had no effect. What I really tested was
rewriting the Tide Court **while 6 of his changes waited on it**:
- 2 were on sentences I kept word for word, and applied cleanly.
- 3 were on words I had removed, and were refused with "The scene no longer has these words: you have
  changed them since. Make this change by hand, or reject it."
- 1 was applied to a different sentence without a word (**R2-1**).

---

## What stopped me (most costly first)

### R2-1. Accepting a change whose sentence I'd rewritten wrote it into a different sentence, silently. Seen once; mechanism read afterwards. High.

**What I did.**
- Rebuilt *The Tide Court* on the Page (selected its prose, pasted mine) while 6 of Jonah's changes
  still waited on it.
- One was "looked at → raised his eyes to", from "…several times, and then he looked at Edric Vane."
  That sentence was gone; my scene had four other "looked at"s.
- Pressed **Accept**.

**Expected.** The refusal the other three stale changes got a minute later: "The scene no longer has
these words."

**What happened.**
- The card vanished, the count went 6 → 5, and there was no message.
- Agathe's line now read: "she **raised his eyes to** him for a long moment". The wrong sentence, the
  wrong pronoun, in the last scene of the book.
- I found it only because I diffed the saved scene against my file. Without that, it would have gone
  back to the editor.

**Evidence.** `r36.cjs` and `prose.cjs`. Screenshot `shots2/r36-looked_at_raised.png`. Before and after
are in `rev/tc_before_accepts.txt` and the subsequent dump.

**Control, same scene, same minute.** "afterward", "where the witnesses stood" and "¶ after 'reached it
alone'" were all refused properly (3/3). So the failure is specific to a change whose replaced words
still occur **elsewhere** in the scene.

**Mechanism, read afterwards.**
- The path is `acceptSuggestion` (`src/db/hooks/useEditImport.ts:130`), then `applyHunk`
  (`src/lib/docxImport.ts:339`), then `placeNote` (`src/lib/noteAnchor.ts:230`).
- That is the margin-note anchoring search. It treats the surrounding words only as a cost
  (`cost = distance + (own ? 0 : 2) + 2*(1 - context)`) with **no minimum context**, so an exact match
  of "looked at" with no matching surroundings still wins.
- Approximate placement is right for a note. For writing words into prose it isn't.

**Not yet shown.** A second instance. In round 3 "He → Vane" applied correctly, because its context
was intact. See S5 for what would settle the general case.

**Cost.** A silent grammatical error in the climax, that I would have shipped. And I trusted Accept
less for the rest of the run, diffing every scene after it.

### N1. A name typed into a scene header is silently wiped when a chapter-title edit saves. Reproduced 3/3. Medium-high.

**What I did.**
- On the Page, retitled a chapter heading (select the line, type `# New title`).
- Within about a second, clicked the scene header's Characters line and typed a name.

**What happened.** Sampling the line every 0.6 s, at about 1.2 s (the moment the binder showed the new
title) the line reverted and my name was gone. There was no notice and nothing to undo. The runs:
- `@@Corin Dask` before Corin existed: "Tide F" and "Tide G" (`tF.cjs`);
- `@@Wren`, a known character: Ch. 6, "Spring Tides" (`tG.cjs`). Wren was not added to the scene.

**Control.** The same typing with no retitle before it stays put for 4+ s (`tE.cjs`, twice).

**Mechanism, read afterwards, likely rather than proven.**
- `sync()` in `src/features/timeline/DraftBook.tsx` rebuilds the whole editor state
  (`view.setState(draftState(bookToShow(...)))`) when the store reports a change to take. Here that
  change is the title.
- Only after that does it call `syncHeaders()`, which is the part that protects the header under the
  caret.

**Cost.** I lost the line twice before I understood why, and only noticed because I was watching for it.

### R2-3. A note whose words I'd rewritten moved to another chapter, onto a correct sentence. Seen once; mechanism read afterwards. Medium.

**The note.** Jonah's note on *The Tide Court*'s "the tide was going out" said: "If high water was at
dawn, by four or five in the afternoon the tide is coming in, not going out."

**What happened.**
- After my rewrite, the Notes panel listed it under **Ch. 4 · The Salt Pans**, labelled "Its words
  have been edited since".
- **Go to it** selected "The tide was coming in" on the Cray's End slipway: a correct sentence in a
  different chapter.
- The note record still holds the Tide Court's `eventId` (read-only check).

**Evidence.** `shots2/r40-goto.png`, `notes_after_rev.txt`, `notedb.cjs`.

**For comparison.** The 3 other "edited since" notes stayed in their own scenes, and 10 were honestly
unplaced.

**Mechanism, read afterwards.** The same `placeNote`: when a note's exact words are nowhere, a fuzzy
match in **another scene** may win (`if (!anyExact) for (const s of others) … fuzzyIn`).

**Cost.** A note telling me a correct tide in ch. 4 was wrong. The label made it look like my own
words, reworded.

### R2-2. Undo straight after that Accept undid an older, unrelated edit in another chapter. Seen once. Medium.

**What happened.**
- Right after R2-1 I pressed the top bar's **Undo** to take the Accept back.
- Its label read "Undo: Replaced 'You stamped her inbound … twenty-fifth …' with '… fifteenth …'".
  That was my last Find & replace, in *Vane's Office*, and that is what it undid.
- Neither the Accept nor the Page paste was on the stack.
- Redo restored it. I mended Agathe's line by hand.

**Is it by design?** The guide says an accepted change's "before" goes to the scene's History, so
perhaps. But the obvious reflex after a bad Accept reverted a correct edit elsewhere, and I noticed
only because my script printed the label.

### N2. Typing before a header's `[` turns the whole header into prose (words) and draws a fresh one above. Reproduced 1/1. Medium.

**What I did.** Clicked the `[` line, pressed Home, typed `Fog. `, then arrowed away.

**What happened.**
- A new header was drawn above, from the records.
- The scene's saved prose became `Fog. [\n  Characters: @@Tamsin Orrey\n]`, so the old header now
  counts as words.
- Anything on the old header not yet applied survived only in that prose copy. Earlier, by accident,
  it had cost me my unapplied place and a cast member.

Evidence: `tA.cjs`.

### R2-4. Letter tasks don't link chapters written "ch.3" with no space. Reproduced 7/7 in one letter; mechanism read afterwards. Low-medium.

- Jonah writes "ch.1", "ch.3", "ch.6". **None of the 7** points naming a chapter that way got a
  chapter link; all 4 that said "chapter N" did. Those 7 tasks are missing from their chapters' panels.
- The guide's example is "ch. 12". The rule is `src/lib/editorialLetter.ts:180`, `chs?\.?\s+`, which
  needs whitespace after the dot.
- In round 3 a separate quirk showed: "In chapter 3 she doesn't even open her own door" linked the
  task to Ch. 3, though the fix it asks for is in Ch. 6.

### R3-1. A comment on a chapter heading is counted but never brought in, and the message misdescribes it. Reproduced 2/2; mechanism read afterwards. Low-medium.

**What the app said.** Both rounds: "1 comment was on words that matched no scene, and is not brought
in: read it in the file." The words did match something: the chapter heading.

**What happened to it.** Its text appears nowhere in the app, not in Changes, not in Notes. Round 1's
was a real house-style request (spell out chapter headings). I acted on it only because I read the XML.

**Why it matters more than it looks.**
- `round-trip-plan.md` T1.4 says "A tracked change **or a comment** before the first scene … is listed
  first in **Changes**", and "As built: chapter headings as well (`outsideScenes`)".
- In code, `outsideScenes` (`src/lib/docxEdits.ts:225`) does keep a comment-only heading. But
  `useEditImport.ts:76–77` stores an outside item only `if (o.before !== o.after)`, and
  `BringInEdits.tsx:39` counts the comment into "lost".
- So **T1.4 looks closed more narrowly than it is written**: changes to headings are listed, comments
  on them are not.

### R2-5. Two exports a minute apart make two drafts with identical names. Reproduced (that is how it happened). Low.

- Drafts listed "Sent for editing, 10 Nov, 06:47 (the-salt-ledger.docx) — Sent as the-salt-ledger.docx"
  **twice**, beside the round-1 one, which also says "Sent as the-salt-ledger.docx".
- The file name never changes and the label stops at the minute.
- The file carries its draft id, so the app will match it. I can't tell the drafts apart when I want
  to compare. I re-exported only to change the heading style, which is a normal thing to do.

### R2-6. An italic in the editor's insertion is shown as a stray `*` in Changes. Not an app error. Low.

- In *The Patience*, the words Jonah typed after *Gannet* inherited its italic in LibreOffice (in the
  XML, that run has `<w:i/>`). The app imported it faithfully, as `*Gannet was Vane, … knew.*`.
- In Changes it showed only as a trailing asterisk in "knew.*". Word would show italic. I fixed it by
  hand.
- So the round trip was right, but markdown in the Changes context hides formatting changes.

### Smaller, all observed

- **The letter splitter's headings** (two letters, 4 instances):
  - A numbered section followed by bullets stays a point, not a heading: "2. The vault…",
    "3. Leftovers…", "Smaller", and round 1's "6. Continuity…". Meanwhile "1. Hale's key (ch.3, 5 and
    6)" became a heading.
  - "WHAT STILL NEEDS WORK" was offered as a ticked task.
  - Unticking was easy, so the cost was only reading.
- **Two letters' tasks sit side by side in one list.** I saw "38 of 51 done", round 1's open tasks
  first, each tagged only with the free text I typed in "Whose letter". His closing "your own pass on
  'looked' and the 'and… and' sentences" sits beside my two open round-1 tasks on exactly those, with
  nothing relating them. That is three entries for two jobs.
- **The header notice names a person twice** when they are on both the Characters and the
  Relationships line ("Agathe Sorrel" or "Iska Sorrel" or "Agathe Sorrel" …).
- **Read and the top bar.** The top bar's scene arrows move the time cursor but not the book open in
  Read, and the prose-pass panel follows the book. So the bar said Ch. 1 while page and panel said
  Ch. 4. The guide says the binder moves Read, so this is as designed; it cost me a minute.
- **Coming back.** Opening `localhost:4191/` lands on the world list, not the book. Once in, the
  dashboard's "Recently edited" answers *where was I* correctly.

---

## What I only suspect

**S1 (N3). A retitle that showed on the page but never saved, and fragments left in the prose.**
- In my first, very fast scripted attempts, a chapter retitle displayed but wasn't written. Later, the
  scene's saved prose had accumulated ` C`, ` B` and ` Count Two`, each followed by a copy of the
  header (25 words in an unwritten scene).
- With about 400 ms between click and typing it never recurred (5 runs).
- It is plausibly N1 and N2 combined at machine speed, and may not reach a human.
- **What would settle it:** ten runs of click-heading-and-type at human pace (100–300 ms).

**S2. "+13,460 words today" against 13,083 in the book** (round 1 dashboard).
- My guess is that header lines were counted for a moment between paste and header (13 headers), plus
  the junk from S1.
- **What would settle it:** paste one chapter into a fresh world and read the writing log before and
  after its header is read.

**S3. On reopening, the time cursor sat at Ch. 5 · Fire at Tidewatch**, not the Ch. 6 scene I had last
pasted into. Unexplained; a single observation.

**S4. 22 changes by the editor's count, 21 by the app's** (round 2).
- Probably his two-paragraph deletion (C18) is two entries in LibreOffice's list and one in the app's.
- **What would settle it:** open the file in LibreOffice and count Edit ▸ Track Changes ▸ Manage.

**S5. R2-1 is general.** From the mechanism, any waiting change whose replaced words occur elsewhere
in its scene, with its own context rewritten, will be applied at the other occurrence. Likely victims
are "very → (removed)", "He → Vane" and "quite → (removed)": short, common words, exactly what line
editors touch.
- **What would settle it:** rewrite the sentence under a waiting "very → (removed)" in a scene with
  another "very", accept it, and diff. Or a unit test on `applyHunk` with prefix and suffix that match
  nothing.

---

## What worked

These are the things I'd keep using the app for. The next change shouldn't undo them.

- **Pasting drafted chapters with `#`/`##` headings and header blocks.**
  - Six chapters in, each in about a minute.
  - Every unknown name was offered with **Create all that the N waiting headers name**.
  - Every header applied, checked against the saved records.
- **Asking it questions**, each in one or two screens:
  - Characters showed Corin in Tidegate Gaol at Vane's Office, after I had recorded it; before that it
    said honestly "The Patience — carried forward".
  - Items showed who held each object at that scene, all correct.
  - **Knowledge** showed who knew the tide fact by the fire, plus "Might also know: Iska — with Tamsin
    in Ch. 4". That is exactly the prompt a novelist needs.
  - Ctrl+K "fog" found the four scenes that mention it.
- **The prose pass was right where the editor was wrong.**
  - It counted "looked" 42 and "looked at" 26, matching `grep` on my source exactly.
  - It never flagged "very". Jonah's first letter put "very" at 56, then retracted it: he had counted
    "every". The app had it right all along.
- **The round-trip counts.**
  - 60 = 60 and 39 + 1 = 40 in round 1, scene by scene, including the move and both paragraph splits.
  - Round 2 matched as well (21 changes, 22 notes plus the heading comment).
  - Changes whose words were gone were refused, with a clear reason, every time (3/3).
  - Nothing of his markup leaked into my next export.
- **Find & replace across the book**, with "N matches in N scenes" and context.
  - 65 revisions (55, then 2, then 8), several of them multi-paragraph.
  - The saved prose matched the expected result exactly after each batch (`cur2`, `cur6`).
- **Rewriting a scene on the Page.** The binder put the caret at the start of the prose, and the pasted
  scene saved identical to my file.
- **Drafts and Compare.**
  - "13 scenes changed · 13,083 → 14,201 words (+1,118)" against the first file sent.
  - "10 scenes changed · +152" against my second draft.
  - Each with per-scene deltas and the marked prose.
  - The app saved a "Before Jonah Pryce's changes" draft by itself each time.
- **The letter into tasks.** The greeting, title and sign-off were unticked for me. I could untick
  praise and recaps. The tasks were then ticked through to 44 of 51 across both letters.
- **Export.** It remembered the byline. Submission format, "Chapter One / Title" headings, scene
  bookmarks and the draft id all survived Jonah's LibreOffice round trip intact both ways.

---

## Already known, or new?

Checked at the end against `ux-review.md`, and, because the backlog has no Word round-trip entries at
all, against `round-trip-plan.md`, `r4-word-round-trip.md`, `r5-revision-tasks.md`,
`t3-letter-splitter.md` and `part-a-close-anywhere.md`.

| Id | Status |
|---|---|
| R2-1 accept into the wrong sentence | **New.** The round-trip plan's order-safety and runs-together guards (T1) don't cover a stale change with a context-free match |
| N1 header wiped by a heading save | **New on the Page.** Same class as **X-16** (keystrokes lost to an in-flight save, fixed for the old scene-draft box). Part A covers a reload while typing a header, not a rebuild |
| R2-3 note moved to another chapter | **New** |
| R2-2 Undo after Accept | **New** |
| N2 typing before `[` | **New** |
| R2-4 "ch.3" with no space | **New.** `r5-revision-tasks.md` lists "*ch. 12*" only |
| R3-1 heading comment not brought in | **Contradicts a closed item**: `round-trip-plan.md` T1.4 says comments before the first scene are listed; as built, only changes are (`useEditImport.ts:76–77`, read afterwards) |
| R2-5 identical draft names | **New** |
| R2-6 italic shown as `*` | **New** for the incoming direction (W-G in the round-trip plan is the outgoing one) |
| S1–S5 | Unverified; none found in the backlog |

I found nothing in the backlog that I believe was closed wrongly, other than the narrowing of T1.4
above.
