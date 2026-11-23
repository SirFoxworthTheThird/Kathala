# Story time against telling order (issue #703)

**Asked:** a view that lays the story out by when things happen in the world, against the order the book tells them,
with a lane per character, thread or point of view. It shows where the telling jumps back, and who is in two places on
one day. The measurements and decisions are in `story-time-plan.md`, D-1 to D-9.

**Code:**
- `src/lib/storyTime.ts` (pure):
  - each scene at its day in telling order, with its jump back and whether it is undated;
  - the lanes;
  - places on one day;
  - the axis with its empty time cut;
  - blocks stacked in a lane;
  - each lane's path.
- `src/lib/continuity/computeIssues.ts`: the check `same-day-elsewhere`, *Back on a day somewhere else*, using the same
  `placesOnOneDay`.
- `src/features/arc/StoryTimeView.tsx`: the view.
- `src/features/arc/TimeSwitch.tsx`: the *Telling order / Story time* switch.
- `CharacterArcView.tsx`: the Arc screen chooses between the grid and story time, and keeps the lane kind in the
  address.

## What it does

- **The switch** (D-3).
  - *Telling order / Story time* sits beside the Arc's title, and also on its *No snapshots yet* page, since story time
    needs only scenes.
  - The mode is kept in the address (`?time=story`), and so is the lane kind (`?lanes=`). *Threads* carries from one
    mode to the other.
  - Factions and fields are lanes only in the grid, and become characters in story time.
- **Lanes** (D-7).
  - *Characters* gives each person a lane with the scenes they are on stage in. *Threads* gives a lane per thread, and
    *POV* a lane per point of view.
  - The eight lanes with the most scenes are shown first. *Lanes* lists them all, with a search box and a tick for
    each.
- **One clock** (D-4). A scene's day is `computeInWorldDays`, run with the same inputs as the Calendar's. A unit test
  holds the two together on three books.
- **Telling order on top** (D-6).
  - Each block carries its place in the book.
  - A jump back is ringed, marked ↶, and says how far.
  - *Path* draws each lane's steps through its scenes in telling order, and dashes a step back in time.
- **Two places on one day** (D-1).
  - A blue dot marks *in more than one place that day*.
  - A red ring marks *back on this day somewhere else*. The Continuity Checker reports that case as a warning that
    names both places and both scenes.
- **Undated scenes** are placed where the telling puts them, drawn dashed, and counted in the summary line.
- **The axis** (D-5).
  - Zoom runs from days to years, and empty stretches are cut and labelled with their length.
  - The view opens at days unless the book would be more than 12,000 pixels wide (below).
- **The keyboard** (D-8).
  - The blocks are one tab stop in telling order, moved through with the arrows, Home and End.
  - Each block is announced with its number, title, day, lane, what marks it, and where the person is.
  - Enter opens the scene, and so does a click.
- **Reading mode** (D-9). The scenes are the reading gate's, and so are the people and threads. Nothing past the
  reader's place has a block or a lane.
- **No writes** (D-2).

## Found on the way

- **The checker already reported jumps back that aren't flashbacks** (`time-backwards`, *Scene set before the one in
  front of it*). So the new check is only the return to a day elsewhere. The view marks every jump back, flashbacks
  included, since a flashback jumps back on purpose and the view is there to show it.
- **The opening zoom was first set to fit 2,400 pixels.** On *Dracula* that opened at weeks, with Seward's September
  stacked 20 blocks high. Lanes stack at a coarse zoom, so height is the cost to watch, not width. Measured on
  *Dracula*:

  | zoom | width | height |
  | --- | ---: | ---: |
  | days | 3,769 | 1,204 |
  | weeks | 1,382 | 2,686 |
  | months | 577 | 3,960 |
  | years | 289 | 7,054 |

  *Little Women* is 19,656 pixels wide at days and 10,817 at weeks. The limit is now 12,000, so *Dracula* and *The Two
  Towers* open at days and *Little Women* at weeks.
- **Tick labels ran into one another.** A label is now drawn only where the last one has ended, and not beside a cut.
- **A block scrolled under the lane names was drawn over them.** The screenshot found it: Mina's 41 sat on her own name.
  The names now sit above the blocks and the path, and the axis has a corner over its ticks. The e2e checks which is on
  top, scrolled and not.
- **The probe and the check disagreed, 20 against 24.**
  - The check takes whole days, as the Calendar does. *Paradise Lost*'s days 2.5 and 2.7 are one day.
  - It reads a person's place from the app's state, era by era.
  - The plan records both counts.

## Measured

- **The checker over the Library** (`npm run census`): 24 *Back on a day somewhere else* in 12 books, 0.8% of all
  findings. No book has more than 5 (*The Two Towers*).

## Tests

- `src/lib/__tests__/storyTime.test.ts`, 33:
  - **the Calendar's days:** for every scene of *Jekyll and Hyde*, *Neuromancer* and *Harry Potter* (the repository's
    fixtures), the day and the undated set are equal to `buildCalendarMonths`', and *Jekyll and Hyde*'s jumps back are
    where its telling goes back;
  - **telling and jumps:**
    - numbered across chapters;
    - a jump with its size;
    - whole days only;
    - the undated stepped over;
    - an undated scene placed and said;
    - timelines on one axis by their offsets;
  - **lanes:** characters, threads and POV; most scenes first; one scene once; no lane for anyone not named;
  - **places on one day:**
    - coming back elsewhere;
    - a move through the day;
    - coming back to the same place;
    - compared with the last place, not the first;
    - another person's scene is not leaving the day;
    - undated scenes left out, paired with the same scene dated;
    - whole days;
  - **the checker:** the warning's wording, and nothing when the return finds them where they were left;
  - **the axis:** the cut and its edge, by pixels at the zoom; a day between two scenes; ticks; the opening zoom; a gap's
    length in words;
  - **blocks and paths:** a stack in telling order; no overlap at a coarse zoom; the path's steps back; a step from an
    undated scene.
- `e2e/storyTime.spec.ts`, 2, on *Dracula*:
  - **a writer:**
    - the switch in the address;
    - the summary;
    - Lucy's letter 52 days back;
    - Mina and Van Helsing back on 4 November, and not the scene before;
    - the path and its steps back;
    - one tab stop with Home, End and the arrows;
    - the lane names over a block scrolled under them;
    - zoom;
    - a lane taken off and back;
    - threads carried to the grid;
    - a block opening its scene with the cursor on it;
    - the checker's warning;
    - a scene made undated, counted and said;
  - **a reader:** at the 13th scene, 13 scenes and no Seward; at the 14th, both.

## Mutants

Run in a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed.
