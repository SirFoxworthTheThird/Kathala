# Writing sprints, and a streak that counts revision days (issue #706)

**Asked:**
- A sprint: write for a set time and see the words added and cut in it, with each sprint recorded.
- The streak counting a day of revision, not only a day of net new words.
- The guide to document both.

The measurements and decisions are in `sprints-plan.md`, D-1 to D-7.

**Code:**
- `src/lib/wordChange.ts` (pure): the words a save added and cut, counted by bag (D-4), and a restructuring's change from
  its net.
- `src/lib/sprints.ts` (pure):
  - a sprint's planned end, moved on by its pauses;
  - what is left, and the countdown;
  - whether a save counts (D-5);
  - overdue;
  - the minutes it ran;
  - the lengths offered and a typed length;
  - today's sprints and the last 30 days.
- `src/lib/writingProgress.ts`: `wroteOnDay`, the streak's rule (D-2), and `changeOnDay`, a day's words added and cut.
- `src/types/manuscript.ts` and `src/db/database.ts`:
  - `added` and `cut` on `WritingLog`;
  - `WritingSprint`;
  - Dexie v71, a `sprints` table.
- `src/db/hooks/useWritingLog.ts`: `logWritingProgress` takes a change. In the same transaction as the day's log, it
  adds that change to the running sprint, if a save counts for it, with the scenes saved.
- `src/db/hooks/useSprints.ts`:
  - start (one open at a time in a world), pause, resume and stop;
  - finish, at the planned end;
  - closing those overdue.
- Every save counts its change:
  - `setSceneText`;
  - `useSceneStructure.ts`: a split, a join and a chapter join count by their net, and Find & replace sums each scene's
    change.
- `src/lib/exportImport.ts`: finished sprints in a `.pwk`, validated, written on import, merged by id (D-3).
  `deleteWorld` deletes them.
- `src/lib/saveNow.ts`: `saveEverythingNow`, an event that the Page, Focus mode and a scene's text box answer by saving
  what they hold, awaited before a sprint ends, pauses or stops.
- `src/features/sprints/`:
  - `SprintControl`, the button, the chooser, and the countdown with pause, resume and stop, on the Page's toolbar and
    in Focus mode's header;
  - `SprintWatcher`, mounted once in the app shell: it ends a sprint at its time and toasts what it was, and closes a
    sprint whose page closed;
  - `sprintSettings`, the length and the sound remembered per device, and the tone;
  - `useNow`.
- `src/features/worlds/WritingProgress.tsx`:
  - the day's words added and cut;
  - the streak's rule in its title;
  - the Sprints section, with today's list and the last 30 days.
- `scripts/sprint-probe.ts`: the measure, run on four writers' runs' scene histories.

## What it does

- **The streak** (D-2).
  - A day counts if words were added or cut that day.
  - A day logged before this has only its net, and counts by a net above zero, as before.
  - A blank today still doesn't break a run.
- **The day's figures.** *words today* is still the net. Beside it are the words added and cut. A word rewritten is one
  added and one cut; a word moved is neither.
- **A sprint** (D-5 to D-7).
  - **Starting.** **Sprint** on the Page or in Focus mode: 15, 25 or 45 minutes, or a number typed, up to 180. The
    length last chosen is offered next time on this device.
  - **Counting.** Every save in the world from its start to its planned end counts, with 2 seconds' grace, except while
    paused.
  - **Pausing.** A pause moves the end on by its length, and the countdown stands still.
  - **Saving first.** Before a sprint ends, pauses or stops, the editors save what they hold, so the last words typed
    are in it.
  - **The end.** A toast on whatever screen is open: *Sprint done: 412 words added, 38 cut in 25 minutes.* A tone goes
    with it if *Sound at the end* is on. It is off until turned on (D-1).
  - **A reload.** The sprint goes on where it was, and a paused one stays paused.
  - **A closed page.** The sprint is ended at its planned end when the world next opens, with the words saved before
    the close, and a toast says so.
  - **One at a time in a world.**
- **The dashboard.** Writing Progress lists today's sprints, each with its minutes and words added and cut, and the
  last 30 days: how many, the minutes, and the words added and cut.
- **A `.pwk`** carries finished sprints, never one still running, and an import or a merge keeps a sprint open on this
  device (D-3).

## Found on the way

- **The 14 days' strip on the dashboard had been drawing nothing.**
  - Each bar's height was a percentage of a column with no height of its own, so every bar was 0 pixels.
  - The old `44-writing-goals.png` shows an empty strip.
  - The column is now full height. The first spec checks that today's bar, the most written, is over 90% of the strip,
    and that a day with nothing is under 10%. With the fix taken out, the bar is 0 pixels and the spec fails.
- **Toasts sat under Focus mode.** The toaster was at `z-[3000]` and Focus mode at `z-[4000]`, so a sprint ending in
  Focus mode said nothing visible. The toaster is now at `z-[4001]`.
- **The issue proposed sprints stay on the device; they travel** (D-3).
  - The journal stays behind because it is the device's replay history. A sprint is the writer's day, like the writing
    log, which travels.
  - The guide promises the streak and history survive a move.
- **A bag of words, not a diff** (D-4).
  - The probe found a word diff too slow for a save: 7 of 340 pairs were over 4 million cells.
  - Counting by bag was within 0.18% of the diff.
  - Taking off the words shared at the start and the end was a step for the diff's sake. The bag needs no such step,
    since those words pair off anyway, so the code does not take it.
- **A split that moves words logs nothing.** A net-0 restructuring writes no log row, so the scene split off is not in
  the sprint's scenes. The integration test first expected it there and was corrected. A join, which deletes the
  second scene, takes the split-off scene out again.
- **Playwright's clock, for the last-second case.**
  - `fastForward` fires the editor's save at the time it jumps to, after the grace, so a save that the app makes on
    time looked late.
  - The spec holds the clock half a second before the end while typing, then runs it on a tenth of a second past the
    end, so what the timers start runs at that time. With the Page's save-now taken out, that spec counts 3 words
    instead of 5.
  - For pause and stop, the clock is held so the editor's own save never comes, and stepped a hundredth of a second at
    a time after each click until the click's work shows.
- **A streak mutant hung the unit run.** With a day of nothing counted (`net >= 0`), every empty day counts, so the
  streak walks back without end. The runner now stops a unit run after 4 minutes and counts it as killed.

## Tests

- `src/lib/__tests__/wordChange.test.ts`, 9:
  - typed at the end, taken off the end;
  - a word rewritten, a sentence cut from the middle, a word moved;
  - from and to nothing, space alone, repeated words;
  - added less cut always the net;
  - a restructuring by its net.
- `src/lib/__tests__/sprints.test.ts`, 12:
  - the end moved on by pauses;
  - what is left, the countdown;
  - the counting window and its grace, paused, ended, after a pause;
  - overdue;
  - the minutes ran, with pauses left out;
  - the lengths offered and typed;
  - today's sprints and the 30 days' totals;
  - a stopped sprint's minutes.
- `src/lib/__tests__/writingProgress.test.ts`, extended: the streak by added or cut, old rows by their net, a blank
  today; a day's change.
- `src/db/hooks/__tests__/sprints.test.ts`, 12, on fake-indexeddb with `Date.now` stood in:
  - **counting:** a sprint's figures equal the log's change across typing, a rewrite, a cut, a split, a join and a
    replacement, with the scenes saved;
  - **the window:** after the grace and within it, a pause;
  - **lifecycle:** one open at a time, per world; stopped; done at its planned end; closed when overdue; a paused one
    not closed;
  - **the streak:** a day that only cut 800 words keeps it;
  - **files:** finished sprints travel, an open one stays and is kept through an import; merge; a world deleted.
- `e2e/sprints.spec.ts`, 5, on Playwright's clock:
  - **the Page:** a pause excluded, a rewrite as one added and one cut, the toast, no tone, the dashboard's list and 30
    days, and the strip's bars;
  - **Focus mode:** a typed length with the sound on, through a reload, the words of the last second, two tones;
  - **a closed page:** ended when the app opens again, with its toast and the dashboard line;
  - **Focus mode's last second** on its own;
  - **pause and stop save first,** with the clock held, and the length typed offered again after a reload, the default
    offered before.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed. Three failed the gate on the first pass
by leaving a binding unused (`plannedEnd`, `eventIds`, `keepMinutes`). Each was rewritten to keep it referenced and run
again.

- **32 against the unit tests:** 31 killed, 1 equivalent.
  - **The streak:** a day that only cut breaks it; a blank today breaks it. *A day of nothing counts* hung the run
    (above), which is a kill.
  - **The window:** no grace; counted before the start, while paused, after the end.
  - **Times:** pauses left out of the end; overdue with no grace; the pause forgotten on resume and on stop; *done*
    ended when written, not at its planned end; two sprints at once; an ended sprint changed after.
  - **The log:** the sprint not counted; its scenes not kept; added not kept; added and cut not on a new day's row.
  - **What a save counts:** a restructuring counted gross; Find & replace by its net; a save by its net; a repeated word
    matched once for all.
  - **Files:** a running sprint sent; the open sprint replaced by an import; not merged; a deleted world's sprints kept.
  - **History and lengths:** a running sprint in the history; 31 days; no minute for a short sprint; the countdown
    rounded down; a typed length over the most.
  - **Equivalent: *overdue* without its paused check.**
    - While a sprint is paused, its planned end moves on with the clock by the current pause. A pause begins at the
      latest within the grace, so the planned end and its grace are never behind the clock while paused.
    - `finishSprint` also refuses a paused sprint.
    - The integration test that a paused sprint is not closed passes either way.
- **11 against `e2e/sprints.spec.ts`:** 11 killed.
  - The Page's save at the end, and Focus mode's.
  - The watcher: no notice, sound always, sound never, a closed sprint left open, not ended at its time.
  - The control: pause not saving first and stop not saving first, killed by the fifth test, which was written for them.
    Run again by hand, the stop mutant fails on the sprint's word count. The length not kept.
  - The strip drawn empty.
  - Three of these were expected to survive the first four tests: pause and stop are reached there only after the
    editor has saved, and nothing read the remembered length. The fifth test holds the clock so only a pause or a stop
    can save, and reads the length back after a reload.

## Checks at the commit shipped

- `npm run lint` and `tsc -b`: clean.
- `npx vitest run`: 4,175 tests in 367 files, all passing.
