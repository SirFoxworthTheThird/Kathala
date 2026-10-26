# Toward a powerful app: a plan

**Status:** decided 2026-10-26 (see *Decisions*), to be built in order.

## Where it comes from

- **Writer runs 1–11, the run-10 comparison, and the first Part 6 attempt** (`run-10-part-6-attempt-1.md`).
- **The run-10 comparison:**
  - The app book lost all four blind judgements and scored worst on "no spoilers".
  - Its verified error rate fell between the two plain-file books'.
  - Those errors were mostly numbers and time, not who-is-where.
- **Part 6's two finished app books:**
  - They reached control length.
  - The early-reveal check caught a real spoiler.
  - A paste bug lost about 30 headers, since fixed (337c9a4).

**The goal:** the app should make measurably better books than plain notes do, on the measures already pre-registered. Every part below says which finding it answers and how it will be measured.

## What the bugs say

Most of what the runs found and we fixed falls into two families. Patching each one has worked, one at a time, but the families keep producing new members.

**1. A fact is stored twice.**
- A `CharacterSnapshot` holds a person's *whole* state at a scene, and every write copies the rest of their last state into it.
- So a later record is a frozen copy of everything said earlier, and an earlier correction stops at it. That is behind:
  - W-3, a correction undone at the next record;
  - W-8, a burnt leaf carried for 14 scenes;
  - W-2's place drift;
  - run 7's stale holder;
  - F2's "carry it forward?" toast.
- We now patch the header path with a walk over the stale copies (`staleCopies.ts`). The Current State panel still drifts.
- Measured reach: `inventoryItemIds` appears 98 times in 32 files, and `upsertSnapshot` has 20 callers in 10 files.

**2. Work is owed while the page waits for something slow.**
- W-1 lost a first scene. Run 9's and Part 6's paste bugs lost headers.
- Each time, something was held in page memory, or written in a provisional form, while a slow step finished. A closed page then lost it.
- A header read takes 0.16–0.39s per scene in a small world (paste probe, 337c9a4), and it reloads the whole world each time, so it is slower in a large one.

## The plan

Seven parts. Each is one or more PRs, in the order given; the order is a decision (D-4).

### Part A: closing the page loses nothing (reliability)

**Answers:** family 2.

- **A1. A close-anywhere harness.** An e2e helper that runs a writing action and reloads the page at a random moment during it, many times over. The actions are:
  - paste of chapters with headers;
  - split and join;
  - header edit;
  - item hand-off;
  - Find & replace.

  After each reload it checks four invariants:
  - no prose is lost or doubled;
  - no header text is in any prose;
  - every header is either applied or remembered;
  - the journal agrees with the store.
- **A2. Fix what it finds.** The rule it enforces: anything owed is in durable storage *before* the first `await` that could outlive the page. The paste fix (337c9a4) applied that rule to one path; A1 finds the rest.

**Measure:** the harness at 200 reloads per action, with zero invariant failures. Each fix is mutation-tested, as now.

**Size:** medium. No schema change.

### Part B: one fact, stored once (refactor)

**Answers:** family 1. This is the largest part, and the one that removes the most bugs for good.

- **B1. Item custody as events.**
  - A new table, `custody`, holds one row per statement about an item at a scene: given to a person, put at a place, or a condition set.
  - Who holds what at a scene, and what a person carries, are resolved at read time from the last statement about each item at or before the scene, in its era, under the existing `stateEngine` rules.
  - `CharacterSnapshot.inventoryItemIds` stops being written.
  - **Migration (Dexie v61):** custody rows are derived from the existing records by reading each person's records in order and keeping only the *changes*. That is the same walk `staleCopies` does, run once. Old `.pwk` files are converted the same way on import.
- **B2. A person's state as sparse statements.**
  - Location, alive, travel mode and notes become per-field. A record holds only the fields said at that scene, and each field is resolved on its own.
  - A record that says "Anna is at the Quay" no longer also restates that she is alive, on foot and holding nothing.
  - This removes W-2's place drift and the F2 carry-forward toast at the root. "Carry it forward" becomes the default meaning of a statement rather than an offer.
- **B3. One resolver, one write path.**
  - Every one of the 32 files reads through `stateAt(sceneId)` (people, items, places), built on `stateEngine`.
  - Every write goes through `state.say(sceneId, statement)`, which journals.
  - A source rule, in the manner of `snapshotWriteScenes.test.ts`, forbids writing the old fields.
- **Afterwards:** `staleCopies.ts` and the item half of `carryForward.ts` are deleted, and `CLAUDE.md`'s bounded exception goes with them.

**Measure:**
- **Equivalence:** for every book in the library and all eleven writer-run `.pwk`s, the resolved state at every scene is the same before and after migration. The only differences allowed are scenes where the old records disagreed with themselves (the stale copies). Those are listed and checked by hand, as Part 1b's library diff probe was.
- The run-11 W-3 and W-8 repros, through the panel as well as the header.

**Size:** large. A schema migration, 32 readers, `.pwk` import/export and merge (`mergeFields.ts`). It ships behind the equivalence probe, over two or three PRs: B1, then B2, then B3's cleanup.

### Part C: speed at novel scale

**Answers:** family 2's slow steps, and run 10's overhead.

- **One world model in memory,** kept current from the operation journal as writes land, instead of `loadStory` and a dozen table reads per header. B3's resolver reads from it.
- **Measure first, then set the bar:** time a header read, a paste of a 5-scene chapter, and a checker run on the largest library book, before and after. The aim is a header read under 30 ms on a 100-scene book. If it is already near that after B, C shrinks.

**Size:** medium. It is best done with or just after B3, since both touch every read.

### Part D: bookkeeping by confirmation

**Answers:**
- run 10's 302 actions;
- Part 6 A1's repairs by hand;
- the header's weight: sigils that writers learn but do not enjoy.

- **D1. Header suggestions from the prose.** The app already finds names in a scene's prose that are not in its cast. A scene whose prose names the Quay and Bruno and says "she handed him the ledger" gets a suggested header line beneath it: `#The Quay @@Bruno ^The Ledger:@Bruno?`. One key accepts it, one dismisses it.
  - It starts with:
    - people and places named;
    - hand-off verbs with an item named;
    - deaths stated outright.

    Each is tried on the library's books, and its precision is reported before it is shown to writers.
- **D2. Nothing to type that the app can infer.** A scene's date from "two days later"; a new scene inheriting its place and cast when its first paragraph does not move anyone. Each is offered as a suggestion, never written silently.

**Measure:**
- **Precision and recall** on held-out library chapters, against their curated headers.
- **In the next writer run:** actions spent on the app rather than the book, against run 10's 302.

**Size:** medium. Precision decides whether it ships.

### Part E: the reader's knowledge, while writing

**Answers:** the run-10 spoiler gap, the judges' worst score.

- **E1. A live early-reveal warning on the Page.** Typing a fact's spoiler words before the scene where the reader learns it underlines them as you type, saying "the reader learns this in Ch. 19". The check is the one Part 3 already has, run on the scene being written.
- **E2. A reader's-knowledge view** for a braided book. At any point in reading order, it shows what the reader knows, and which era told them. The fact schedule drawn against the chapter order makes "era 3 tells it eight chapters early" visible at a glance.

**Measure:**
- Run 10's book, with Part 3's spoiler words added, flags the judges' cases (Ilse named as the Opener in chapters 11–12).
- In the next comparison, the app books' "no spoilers" score.

**Size:** small to medium. It builds on Part 3.

### Part F: numbers and time, as you write

**Answers:** the run-10 finding that numbers and time were most of the verified errors in all three books.

- **F1. Stated ages.** "I'm sixty-four", "she was twenty-two that year". These are statements in the prose, checked against each other and against the dates the book has. Part 4's birth-date check is not enough: 1 of 50 library books has birth dates, but most books state ages.
- **F2. Counts and durations**, beyond Part 4's stated gaps: "eleven taken" against "you took three"; "nine days" against the dates.
- **F3. The AI audit, chapter by chapter,** while writing. It is offered at the end of each chapter, against the book so far, with quotes checked as Part 5 checks them. Whether it stays paste-only is D-2.

**Measure:** run 10's verified errors as the test set. How many each check finds, and how many false alarms it gives on the library.

**Size:** medium. F1 and F2 are gated on measurement, as Part 4 was.

### Part G: measure again, durably

**Answers:** "does the app help?", still unanswered.

- **Part 6 rerun,** under its pre-registration (9a65f19), after A, B and D at least.
- **Committed as it goes:**
  - the prompts, the audit and judge prompts, and `quotes.py` before the first writer starts;
  - each `book.md` and `.pwk` as it arrives;
  - the sealed mapping once the letters are shuffled.

**Size:** large in time (several usage-limit cycles), small in code.

## Not in this plan

- `.docx` paragraph styles and manuscript format (run 11's wish). Worth doing, small, and independent; it can ride with any part.
- Collaboration or sync. Local-first stays; the journal already makes it possible later.
- New entity types. The evidence says the existing ones are not the bottleneck.

## Decisions (made 2026-10-26)

- **D-1. Part B goes all the way:** item custody as events (B1) *and* a person's state as per-field statements (B2). This includes the Dexie migration, gated by the equivalence probe over the library and every writer-run world.
- **D-2. The AI audit may also run with the writer's own API key,** entered by them, so a chapter's audit is one click. Paste-only stays available. Nothing leaves the device unless a key is entered or the writer pastes it out.
- **D-3. Header suggestions appear automatically** under a scene whose prose names people, places or a hand-off, and one key accepts them. They ship only if their measured precision on the library is high; the bar is set from the measurement, before release.
- **D-4. The order is A → B → C → D → E → F → G.**
