# Part C: speed at novel scale

`next-plan.md`, Part C, after B3. The plan said to measure first and then set the bar: time a header read, a paste of a 5-scene chapter, and a checker run on the largest library book, before and after. The aim was a header read under 30 ms on a 100-scene book. It also said that if B had already brought that close, C would shrink.

## How it is measured

`e2e/scalePerf.spec.ts` installs two Library books and prints one `SCALE …` line for each:

- **Pride and Prejudice:** 98 scenes, the plan's 100-scene book.
- **Little Women:** 641 scenes and 2,058 person records, the largest book in the Library.

It times three things:

- **A header read.** `planHeaderFromStore` plans a scene's header line against the store, as the Page does for each line it applies. It is run three times at each of five scenes spread across the book, through the `__pwperf.headerRead` seam (present in dev and in `VITE_E2E` builds only). The app records each read as the `kathala:header-read` performance measure.
- **A checker run.** `computeContinuityIssues` over the world once it has loaded, recorded as the `kathala:checker` measure.
- **A paste of five scenes onto the Page,** each with a heading and a cast line. The clock runs from the paste until all five scenes exist with their cast recorded.

The spec checks that each step happened, not how long it took. This container is not a writer's machine, and a time limit pinned to it would fail for reasons that have nothing to do with the code (the same reason as `arcScenesPerf`). The numbers below come from that spec, run in this container.

## Before

| | Pride and Prejudice | Little Women |
|---|---|---|
| Header read (median) | 24 ms | 103 ms |
| Checker run | 102 ms | 710 ms |
| 5-scene paste | 4.9 s | 17.9 s |

The 100-scene book was already under the bar after B. The cost was in the paste on the long book, so that is where C went. Each fix below comes from a CPU profile of the Little Women paste, taken on a production build with source maps and mapped back to source. All the times quoted are from that profile; the profile made the paste slower than in the table, at 21.5 s in all.

## What it found

- **The continuity checker ran while closed.** It was always mounted and drew nothing while closed. Even so, every table it reads was a live query, so it re-ran every rule on every write. That was 11.5 s of the 21.5 s paste, for a panel nobody had opened.
  - It is now mounted only while it is open (`ContinuityChecker`).
  - One thing changes for the writer: the "show suppressed" toggle no longer stays on after the panel is closed. Audit findings are stored in the database and were never held by the panel.
- **The chapter panel read the whole world once for every scene row.** Each scene asked `useBestSnapshots` for the cast as last known by then, which read the whole world, whole and with custody, once per row: 1.7 s on Little Women's last chapter.
  - `ChapterPanel` now reads each scene's state once for the chapter and passes it to the rows. Only the place is shown there, which custody does not touch.
- **The Page's headers walked every record for every scene.** `sceneFates` and `sceneItems` were handed all the world's records for each scene: 0.8 s.
  - `recordsPerScene` (`src/lib/sceneHeader.ts`) now hands each scene only the records it reads: those of the people recorded there, with each person's other records for the one before.
- **A header read waited on a dozen reads one after another.** The profile shows a header read is mostly waiting, with about 10 ms of CPU per read. The rest is IndexedDB.
  - `planHeaderFromStore` (`src/db/hooks/headerPlan.ts`) now issues every read at once, in one read transaction.

## After

From `scalePerf` alone (one worker), at the commit shipped:

| | Pride and Prejudice | Little Women |
|---|---|---|
| Header read (median) | 15 ms | 98 ms |
| Checker run | 102 ms | 837 ms |
| 5-scene paste | 2.8 s | 6.3 s |

- **The header read meets the bar** on the 100-scene book: 15 ms against 30.
  - The fifteen reads range from 14 to 367 ms on Pride and Prejudice and from 80 to 821 ms on Little Women. The median is the figure to read.
- **The paste on the long book is nearly three times faster** than before (17.9 s to 6.3 s), and the paste on Pride and Prejudice 1.7 times faster (4.9 s to 2.8 s).
  - The paste made 20 header reads, at a median of 105 ms on Little Women and 17 ms on Pride and Prejudice: about 2.1 s and 0.3 s of the totals.
- **The checker run itself is no faster**, and nothing in C set out to make it faster. Little Women's checker run measured 698, 710, 763 and 837 ms across the runs here, before and after alike. What changed is that it no longer runs while closed.

Inside the full suite, with four spec files running at once, the same spec measured slower:

- **Pride and Prejudice:** a header read of 25 ms, a 4.7 s paste.
- **Little Women:** a header read of 151 ms, an 11.7 s paste.

A time limit asserted in the spec would have failed for that reason alone.

## What C did not build

The plan's first point was **one world model in memory**, kept current as writes land, in place of `loadStory` and a dozen table reads per header. It was not built.

- **The bar was already met.** The 100-scene book reads a header in 15 ms.
- **Little Women is still above it,** and a cache would not fix the case that costs the most. On that book three reads dominate, timed one table at a time inside a header read: the scenes (641 rows, 37 ms), the chapters (47 rows, 28 ms) and the person records (2,058 rows, 31 ms); every other table took 1–2 ms. Applying a header writes its scene's cast, and where it places them the person records too, so the next header read would miss any cache of the story.
- **A cache would help repeated reads with no writes between them.** It would also add a second copy of the store that has to stay in step with every write path and with other tabs. That is a correctness risk this codebase has paid for before (B1 and B2 were both about copies).

If a writer's long book shows the header read in use, as opposed to the paste, the measures above will show it. The cache is the next step from there.

## Tests

- **`e2e/checkerClosed.spec.ts`:** the checker runs no rules while closed, across writes. It runs once opened, and stops again once closed. A mutant that mounts it always turns the spec red: 5 runs while closed.
- **`e2e/chapterCarry.spec.ts`:** someone placed at a chapter's second scene is shown there "from an earlier scene" at the third, and has nothing recorded at the first.
  - A mutant that gives every row the chapter's first scene turns it red.
  - The three specs that already covered the "from an earlier scene" wording (`recordStateInline`, `stateCorrection`, `writerRun9`) all passed under that mutant: each placed the person in an earlier chapter, which every scene of the chapter can see.
- **`src/lib/__tests__/recordsPerScene.test.ts`:** each scene is handed the records of the people recorded there and no one else's, and the fates it draws match those drawn from the whole list.
  - A mutant that drops each person's earlier records turns both tests red.
  - The fates test passed that mutant on its first version. It now includes someone who was already dead, whose fate only the earlier record decides.
