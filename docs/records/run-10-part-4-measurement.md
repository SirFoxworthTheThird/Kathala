# Run 10 plan, Part 4: what was measured, and what shipped

**Date:** 2026-10-18. **Plan:** `docs/records/run-10-plan.md`, Part 4 ("numbers and time").

The plan gates each new check on measurement:
- Run it over the 47 library books and the writer-run books.
- Check every finding in a sample of 30 by hand.
- Ship it only if at least 9 in 10 are real.
- Use the experiment's verified error lists as the recall test.

## The corpus

50 books:
- the 47 library books (`kathala-library/library/*.pwk`);
- two writer-run worlds kept in this repo (`writer-run-2026-09-25-header.pwk`, `-sigils.pwk`);
- *The Cold Choir*, run 10's app book (`e2e/fixtures/cold-choir.pwk`).

The run-10 control books exist only as Markdown, with no dates or records, so no record-based check can run on them.

| | books |
|---|---|
| with prose | 43 |
| with a calendar | 44 |
| with dated scenes | 48 |
| with any character's birth date | **1** (*The Cold Choir*: 8 of its 19 characters) |

## One date per scene

The plan cites issue 5: the checker, the Brief and the calendar disagreed about scene dates.
- Every route now gets a scene's day from `computeInWorldDays`, with the timelines and the book's rule for pins.
- On *The Cold Choir*, the checker and Brief, the state engine, the `When:` line and the calendar grid agree on all 44 scenes.
- `src/lib/__tests__/sceneDates.test.ts` holds them to that on this book, and holds every caller to passing the timelines and the rule.

## Stated gaps between scenes: shipped

A scene's first sentence that says how long it has been (*The next morning*, *Three days later*, *A fortnight later*) is compared with the dated gap from the scene before it on the same timeline (`src/lib/statedGaps.ts`, checker kind `gap-stated`).

**First rule: any mismatch beyond a tolerance.**
- 48 stated gaps between dated scenes; 13 flagged.
- By hand, several were not certain:
  - A scene is dated where it begins, and "the next morning" counts from where the scene before it *ended*.
  - Library scenes are chapter-sized ("Four Days in Hiding"), so a dated gap *longer* than stated can be consistent: *The Secret Garden*, Ch. 6; *Twenty Thousand Leagues*, Ch. 14.
  - "A year after Louis XVIII. …" counts from an event, not from the scene before.

**The rule shipped:**
- Report only a dated gap *shorter* than stated.
- Accept "after" only where it ends the phrase or looks back ("after this", "after the scene").

**Result through the checker itself, over all 50 books: 2 findings, both real (2 of 2).**
- *Strange Case of Dr Jekyll and Mr Hyde*, Ch. 3: opens "A fortnight later", dated 3 days after Ch. 2.
- *The Count of Monte Cristo*, Ch. 96: opens "Three days after the scene we have just described", dated 1 day after Ch. 95.

Both are mistakes in the library's dates; the novels' words are right. They are left for the library repository.

**Recall:** none of the experiment's verified time errors is a gap stated at a scene's opening between dated scenes. Those were mid-scene ("three weeks since the forty-sixth"; Ruth's "twelve hours", in control A) or in books with no records. So the check finds none of them. It passes the precision gate and is cheap; what it catches is the narrow case it was built for.

## Stated ages: not shipped

The plan's check compares an age stated in the prose ("Hal Oduya, sixty-four") with the character's birth date at the scene's date. It cannot pass the gate.

- **Precision cannot be measured.** One book in 50 records any birth date.
- **Recall fails by design.** The plan's recall test is "on *The Cold Choir* the age check must find Hal". Hal has no birth date in the book.
  - His error is also not of this shape. "I was twenty-two … It was the Bicentennial" is an age at a past event, not at the scene. Finding it needs the Bicentennial's date, which nothing records.
  - A check comparing two ages a character states in dated scenes would not find him either: he states his present age once ("I'm sixty-four").

By the plan's own rule it does not ship.
