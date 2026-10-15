# After run 10 and the experiment: a plan

**Status:** decided 2026-10-15 (see *Decisions*), being built in order.

**Where it comes from:**
- **Blind writer run 10:** *The Cold Choir*, three eras centuries apart, 21 chapters.
- **The controlled comparison after it:**
  - The same brief was given to the same model in plain text files, twice.
  - Six continuity audits were run, and every claimed error was checked against the text.
  - Six blind judgements followed, each pair read in both orders.
  - The results are in the session's `experiment/results.md`.

**What the comparison found:**
- **Continuity:** the app book's verified error rate (2.13 per 10,000 words) fell between the two controls' (1.72 and 2.78).
- **Judging:** it lost all four of its blind judgements.
- **Spoilers:** every judge scored it worst on "no spoilers".
- **Caveats:** one book per side, different instructions, and the app writer was also reporting bugs. Read it as evidence, not proof.

The app is still in development and has no other users, so large refactors are on the table.

## What the evidence says

1. **The app's overhead cost the book.**
   - The app writer took 302 actions, many of them spent on the app rather than the book:
     - repairing 20 scene headers by hand;
     - building placeholder chapters to get numbering right;
     - deleting state records written into the wrong era.
   - It wrote 47,000 words; the controls wrote 87,000 and 93,000.
   - The paste and numbering bugs are fixed (#622). The rest is below.
2. **The app guards the errors this model rarely makes.** Verified errors in all three books were overwhelmingly numbers and time:
   - ages (Hal is 22 at a Bicentennial a century earlier, yet 64 now);
   - elapsed time ("three weeks since the forty-sixth" is six weeks; "twelve hours after" is 22 days);
   - counts (eleven taken, then "you took three"; a bell rung 27 times, then 9,206);
   - distances.

   Who is where, who is alive and who holds what, the app's strengths, barely appear. The controls kept those straight in plain notes.
3. **Spoilers were the quality gap, and the app's early-reveal check was blind.**
   - The writer recorded 13 facts, all 13 with the scene where the reader learns them. None had tags.
   - `computeKnowledgeLeaks` matches only a fact's tags or its exact title. The titles are sentences such as "Ilse Varga flew Deck Nine down to Ninefold", which never appear word for word.
   - Run on the writer's exported book, the check finds 0 early reveals (measured).
   - The judges found the later eras naming Ilse as the Opener in chapters 11–12, eight chapters before her own era reaches it. Nothing told the writer the check could not see.
4. **State across eras is wrong, and it writes wrong data.**
   - "Last known state" is read in book order, across every timeline.
   - The rule lives in about 20 places:
     - `useBestSnapshots` (10 files);
     - `useResolvedCharacterSnapshot` (4);
     - `resolveSnapshot` (6);
     - hand-written `sortKey` comparisons in 7 hooks.
   - There are also two more orderings: `chapter × 10,000 + sortOrder` in the checker and prose checks, and `sortKeysByEvent` in reading mode.
   - Hand-offs write a "no longer holds it" state for the previous holder found that way. In run 10 that put Isidor (311 AL) on the 742 AL map and brought Bram back to life.

## The plan

Six parts, in order. Each part is one or more PRs. "Refactor" marks where structure is replaced rather than patched.

### Part 1: one state engine, aware of eras (refactor)

**Replace** every last-known-state lookup with one module, `src/lib/stateEngine.ts` (pure), and one hook layer over it. The rules:

- **One order.** A single `bookOrder` module replaces `sortKey`, the `× 10,000` comparator and `sortKeysByEvent`. Everything that orders scenes calls it. A test enforces this, in the manner of `snapshotWriteScenes.test.ts`: no other file may compute an order.
- **People stay in their era, not in their timeline.** A hard per-timeline rule would break the library. In all six of its multi-timeline books, characters have states in more than one timeline (measured: *Journey to the West* 15, *The Wise Man's Fear* 5, *The Two Towers* 4, *The Odyssey* 3, *The Name of the Wind* 1, *The Time Machine* 1). Parallel storylines and frame stories share people. So:
  - Each timeline covers a span of in-world days, from its start to its last dated scene.
  - Timelines whose spans overlap (parallel storylines, and frame stories left undated) keep today's rule: a person's last known state is read in book order across them.
  - Between timelines whose spans don't overlap (eras), a person's state never carries. Someone with no record in the cursor's era is "not in this era".
  - This span rule must leave all six library books resolving as they do today. That is checked before anything else changes.
- **Things and places can cross eras, by in-world time.** An item's or place's state at the cursor:
  - comes from its own era first, read as a person's is (book order across overlapping timelines);
  - before its first record there, it comes from the latest record in an earlier era by in-world time (the timeline's start plus the scene's day), never by book order;
  - is shown as carried from that era ("last known in 311 AL"), not as a fact at this scene.
- **Writes never cross eras.** A hand-off or put-down that finds the item's last holder in another era writes only the item's new placement at this scene. It never writes a state for a person in another era.
- **Cross-era items become a chain, not pairs.** `CrossTimelineArtifact` records one origin and one encounter. An item that travels Mercy → Compact → Quiet needs two records, and each record is then checked on its own (run 10's five false warnings).
  - The proposal: an item's eras are wherever it has records, ordered by in-world time.
  - The checker flags an item appearing in an era *earlier* than its first appearance, which is an anachronism.
  - The table stays for its notes ("found in archive box 14"), and the declared-pair check retires.
- **Every consumer moves to the engine:**
  - the Writer's Brief (run 10, issue 6);
  - the Character Arc grid (7);
  - the map;
  - the Current State tab;
  - the item roster;
  - the dashboard;
  - the checker's item rules (8, 14);
  - Cast Balance, so each character is counted within their own timeline;
  - the birth-date check, which must use the timeline's start date, as the Brief already does (issue 5: 43 false "before they were born").
- **`:before` in a timeline of its own.** A `?Fact:@Name:before` is filed at the first scene of the character's own timeline, not the book's first scene.
- **Repair.** A one-off check finds the records already written into the wrong era: a state for a person at a scene in a timeline they never appear in. It lists them on the Continuity screen with one click to remove each.

**Tests:**
- unit tests on the engine with two- and three-era fixtures;
- integration tests through the real hooks;
- the writer's run-10 world as an e2e fixture: at chapter 21 (742 AL), Isidor and Mother Calloway are not on the map, and the Brief lists no one from another era.

### Part 2: writing a braid without friction

- **A Page on All timelines.** Write the braided book in reading order, one Page.
  - A `# Chapter` typed there needs a timeline. **Decision 1** below.
  - Everything else works as on a timeline's Page.
  - Run 10's writer switched tabs every chapter, 21 times, and reached the Page through scripts.
- **Move a chapter anywhere in the book.**
  - Numbering is the book's since #621, but a chapter can still only move among its own timeline's chapters, and an existing chapter's number cannot be changed.
  - On All timelines, Alt+↑↓ and drag would move a chapter past any other. The numbers between change, as they do now within a timeline.
  - This replaces the run-10 workaround of placeholder chapters.
- **Timelines in an order the writer sets.**
  - Add a Dexie version with a `position` on timelines. Tabs follow it, drag reorders them, and new timelines go last.
  - Also: the Manuscript reopens on the tab last written in, and New Timeline asks for a name instead of making "Timeline 4" on a stray click.
- **Dates, not day counts, on All timelines.** The calendar is set, so "Day 113491" becomes "12 Yield, 310 AL".
- **Replace all replaces all.**
  - Today one press went from 518 matches to 352, then 292, with nothing said.
  - It should be one write and one undo, finishing before the dialog says it is done.

### Part 3: spoilers the app can see

- **Spoiler words.**
  - When a fact is given a reader-reveal scene, ask for the words that would give it away. Offer the names of the people, places and items the fact concerns as starting suggestions.
  - The leak check matches those words, whole word and case-insensitive, as it matches tags now.
- **Say when the check is blind.** Facts with a reveal and no spoiler words are listed on the Continuity screen ("13 facts can't be checked for early reveals"), not passed over in silence.
- **Era-aware leaks.**
  - A fact belongs to the timeline of its reveal scene. A match in an *other* era's earlier chapter is reported as "a later era gives it away", which is the failure the judges named.
  - The check can stay word-based and still catch run 10's case: "Ilse Varga" and "Opener" in chapter 11, against a reveal in chapter 19.
- **A spoiler pass in Read.**
  - Reading the book from the start, a side list shows what the reader has been told so far, by era, and what is still to come.
  - Words belonging to facts still to come are underlined in the text being read.
  - This is the deliberate re-read Control A did by hand ("wake her gentle" → "wake them gentle").

### Part 4: numbers and time

- **One scene-date service.**
  - Every "when is this scene" question goes through one function: the timeline's start, `When:` pins, travel days, eras and leap years.
  - The checker, the Brief and the calendar disagree today (issue 5).
- **Checks that are certain or silent.** Only high-precision patterns, each gated on measurement before shipping:
  - **Stated ages:** a named character with an age in the same sentence ("Hal Oduya, sixty-four"; "Ama, seven") or in dialogue attributed to them. Compared against `birthDate` and the scene's date.
  - **Stated gaps between scenes:** "Three weeks later", "The next morning", "Nine days later" at the start of a scene. Compared against the dated gap from the previous scene in the same timeline.
- **The gate.**
  - Run each check over the 47 library books and the four writer-run books. Count its findings, and check every one in a sample of 30 by hand.
  - Ship a check only if at least 9 in 10 of its findings are real.
  - The verified error lists from the experiment are the recall test: on *The Cold Choir* the age check must find Hal.

### Part 5: an audit with AI, kept local-first (optional)

The errors the app misses were found by AI auditors with verbatim quotes. Kathala already hands prompts to an outside model and reads the reply back (`ChapterAIDialog`).

- **An audit prompt** is copied out. It holds:
  - the book;
  - each chapter's era and date;
  - the fact schedule;
  - birth dates;
  - an instruction to list contradictions in numbers and time, and early reveals, each with exact quotes from both sides.
- **The reply is pasted back.**
  - Every quote is checked against the book mechanically, as the experiment's `quotes.py` did. A finding whose quotes aren't in the text is dropped before anyone sees it.
  - What survives appears on the Continuity screen as findings, marked as from the audit, with a link to each quote.
- **Nothing leaves the device unless the writer pastes it.** **Decision 3.**

### Part 6: measure again, fairly

After Parts 1–3, run the comparison again:
- the same instructions for both sides;
- no bug-reporting duty for the app writer;
- **three books a side**, not one;
- the same evaluation: pre-registered rule, two verified audits per book, every pair judged in both orders.

**The question:** did the app book move from worst to within the controls' range, or above it? Runs are long (40–50 minutes per book) and hit usage limits, so they are spaced out and resumed.

## Decisions (made 2026-10-15)

1. **A chapter typed on the All-timelines Page takes the timeline of the chapter above it.** The writer can change it from a chip on the heading, or with a key.
2. **Things and places carry across eras by default, by in-world time,** always labelled as carried. The writer can stop an item from carrying over.
3. **The AI audit (Part 5) is built,** kept local-first: nothing leaves the device unless the writer pastes it.

## Not in this plan

- **Ages that pause in cold sleep.** A wish from run 10; it needs a "not ageing" state, and nothing else depends on it.
- **Regex in Find & replace, and an EPUB option printing each chapter's era.** Small, and they can ride with Part 2 if wanted.
- **A pacing curve on All timelines with the eras overlaid.** Wanted by the writer. It fits Part 2, but nothing in the evidence says it changes a book, so it waits until after Part 6.
