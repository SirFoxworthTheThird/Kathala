# Writing sprints, and a streak that counts revision days: the plan (issue #706)

**Asked:**
- A sprint: write for a set time and see the words added and cut in it, each sprint recorded.
- The streak counting a day of revision, not only a day of net new words.
- The guide to document both.

## Measured

- **The log keeps one figure a day.** `WritingLog.words` is the day's net, added to by `logWritingProgress` on every
  save (`setSceneText`, new count less old) and once per restructuring (`useSceneStructure.ts`, S8: words moved between
  scenes add to nothing). Nothing records when in the day a word was written, so a sprint's words cannot be read back
  from the log afterwards. They have to be counted as they are written.
- **The streak** (`computeStreak`) counts a day whose net is above zero. The guide's *Writing progress* section names
  the streak in one line and doesn't give its rule.
- **What the net hides.** The probe is `scripts/sprint-probe.ts`, run over the scene histories of the writers' runs
  (*The Salt Ledger* and runs A1, A2 and A3: 340 versions of a scene against the next). It compares each version with
  the next.
  - **248 of 340 (72.9%) had a net at or below zero with words changed.** 125 of those only cut. A day made of such
    saves breaks the streak today, however much work it was.
  - **Added and cut** were counted two ways, both after taking off the words the two texts share at the start and the
    end (which leaves a diff's answer as it was):
    - a word diff (the longest common run): 1,679 ms over the 340, the largest middle 7,514 words (7 pairs over
      4 million cells, too large to run on a save);
    - counting the words in the middle that each side lacks, in any order: 23 ms.
  - The two disagree on 20 pairs, by 356 words of 201,793 changed (0.18%), the count giving less where words were
    reordered. Both give `added − cut` equal to the net on every pair, which the probe asserts.
- **Saves.** The Page, Focus mode and a scene's text box save 1 second after the last keystroke (`AUTOSAVE_MS`), and
  again on `pagehide`. A writer typing steadily through the end of a sprint has not saved its last words when the time
  runs out.
- **Notices.** The app has toasts (`pushToast`), shown on every screen.

## Decisions

- **D-1: sound at the end is off by default.** A setting in the sprint menu turns it on, per device. The sound is a
  short tone made in the page (no file).
- **D-2: a day counts for the streak if words were added or cut that day.**
  - The log keeps `added` and `cut` beside `words`.
  - A day logged before then has `words` only and counts as before, by a net above zero.
  - A blank today still doesn't break a run.
- **D-3: sprints travel in a `.pwk`, as the writing log does,** and merge by id.
  - The issue proposed that they stay on the device, like the operation journal. But the journal stays behind because
    it is the device's own replay history, while a sprint is the same kind of record as the log, the writer's day.
  - The guide promises that "your streak and history survive a backup or a move to another device", and that should
    hold for sprints too.
  - Only finished sprints are written to a file, so a sprint never arrives running on another device.
- **D-4: what a save counts as added and cut** (`src/lib/wordChange.ts`).
  - The words the old and new text share at the start and end are taken off. Of the middle, *added* is the words the
    old text lacks and *cut* the words the new text lacks, in any order (measured above).
  - A restructuring counts its net, as the day does since S8: a split or join that moves words counts nothing, and
    words it takes out are cut.
- **D-5: what a sprint counts.**
  - Every save in the world while the sprint is running and not paused, from when it starts until its planned end,
    with 2 seconds' grace. The counting is done in the same transaction as the day's log.
  - The scenes are the ones saved.
  - Before a sprint ends, pauses or stops, the open editors are told to save what they hold, so the last words typed
    count.
- **D-6: a sprint survives a reload.**
  - It is a record, not a timer. The countdown is worked out from its start, its length and its pauses, so it carries
    on after a reload.
  - A paused sprint is still paused after a reload.
  - A sprint whose page closed is ended at its planned end when the app next opens, with the words saved before the
    close, and the writer is told.
- **D-7: where it is.**
  - A **Sprint** control on the Page's toolbar and in Focus mode's header: 15, 25 or 45 minutes, or a number of
    minutes chosen, remembered per device.
  - While a sprint runs, the same place shows the countdown with pause, resume and stop.
  - The end is a toast on whatever screen is open: *Sprint done: 412 added, 38 cut in 25 minutes.*
  - The dashboard's Writing Progress lists today's sprints, and the last 30 days: how many, the minutes, and the words
    added and cut.
  - One sprint at a time in a world.

## Parts

1. **Data and logic:**
   - `wordChange` (pure);
   - the streak rule;
   - sprint times and the summary (pure);
   - Dexie v71 (`sprints`; `added` and `cut` on the log);
   - `logWritingProgress` taking added and cut and counting the running sprint;
   - sprint CRUD;
   - `.pwk` export, import and merge;
   - deleting a world;
   - unit and integration tests (typing, a cut, a split, a join).
2. **UI:**
   - the sprint control (Page, Focus mode);
   - the editors saving at the end;
   - the watcher in the app shell;
   - the toast and the sound;
   - the dashboard's history.
3. **Checks:**
   - an e2e on Playwright's clock;
   - mutants (the streak rule, the window's edges, restructurings counted net);
   - the GUIDE's *Writing progress* section and a screenshot;
   - a record;
   - the full suites;
   - a PR.
