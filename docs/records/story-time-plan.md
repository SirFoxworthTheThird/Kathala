# Story time against telling order: the plan (issue #703)

**Asked:** a view that lays the story out in story time, when things happen in the world, against telling order, when
the book tells them, with a lane per character, thread or point of view. It shows where the telling jumps back, and
where one person is in two places on the same day.

## Measured

On the 58 Library books (`/home/user/kathala-library/library/*.pwk`), with probes in the scratchpad. A scene's day is
worked out the way `computeInWorldDays` works it out.

- **Every scene has timing.**
  - All 6,056 scenes are pinned (`inWorldTime`) or have `travelDays`.
  - The only undated scenes are 5 flashbacks with no date of their own, all in *The Fellowship of the Ring*. The clock
    gives a flashback the day around it, which is not when it happens.
  - So undated scenes are rare in the Library, but a new book starts with all of its scenes undated. The Calendar
    already shows such scenes dashed and counts them (HB-5, `provisionallyDatedEvents`).
- **Flashbacks are common.**
  - 26 books mark 682 flashbacks. *Little Women* has 154, and each of the two editions of *Os Lusíadas* has 122.
  - All but those 5 are pinned, so in the Library a flashback is almost always at its own date.
- **The telling jumps back often.** A jump back is a scene set earlier than the dated scene told just before it.
  - 30 books jump back, 136 times in all, and at most 24 times in one book (*Os Lusíadas*).
  - A jump back runs from one day (*Pride and Prejudice*) to 12 billion days (*The Time Machine*'s far future).
- **Spans are wide, and mostly empty.**
  - A book covers anything from a single day (*Alice*) to 912,501 days (*Inferno*, whose timelines span ages).
  - Most of that time holds no scene at all. *The Wise Man's Fear* has 140 gaps of more than a month between dated days.
  - A plain linear axis would be either unreadable at the zoom that shows a whole book, or miles wide at the zoom that
    shows a day.
- **Scenes stack on a day.** One person can be in up to 21 scenes on one day (*Paradise Lost*), and 13 in *The Name of
  the Wind* and *The Fellowship of the Ring*.
- **"Two places on one day" is mostly a day's travel.**
  - Taking a person's place at each scene from their state, 784 person-days across the Library have someone in a scene
    in two different places.
  - In 764 of those, the person simply moves through the day: London, then the station, then the train. That is
    ordinary travel. Where the map has a scale, the existing travel-distance check (`travel-dist`) already asks whether
    the move was possible.
  - In 20, in 10 books, the telling leaves the person's day for another day and later comes back to it, and on the way
    back they are somewhere else from where they were when the telling left. That is the braided case the issue asks
    about:
    - Mina and Van Helsing on day 307 of *Dracula*;
    - *The Two Towers* 5 times;
    - *The Time Machine* 4 times;
    - *Jekyll and Hyde* 3 times;
    - no book more than 5.
  - Reporting all 784 to the Continuity Checker would bury these 20. Checking the move itself would only repeat
    `travel-dist`.
- **The Continuity Checker has no check for this.**
  - `scene-cast-elsewhere` compares a scene's place with the place its cast's states give at that one scene.
  - `travel-dist` checks the speed between consecutive records.
  - Nothing compares a person's places across one in-world day.
- **The test fixtures have what the Calendar test needs.** `src/test/fixtures/worlds/` holds:
  - *Jekyll and Hyde*: 17 flashbacks, 3 jumps back;
  - *Neuromancer*: 5 flashbacks;
  - *Zenda* and *Harry Potter*.

  All four have a calendar and every scene timed, so a unit test can hold the view's days to the Calendar's on three
  real books without the Library being checked out.

## Decisions

- **D-1: the Continuity Checker gets a new check, *Back on a day somewhere else* (`same-day-elsewhere`), a warning.**
  - It fires where the telling leaves a person's day and comes back to it with them in a different place from where
    the telling left them.
  - The view marks every day on which a lane's person is in more than one place:
    - a move through the day lightly, as *moved during the day*;
    - a return strongly, as the checker does.
  - Undated scenes, and flashbacks with no date of their own, take no part: their day is where the clock happened to
    be, not when they happen.
  - Measured: 20 across the Library, in 10 books, and no book more than 5.
- **D-2: no editing by dragging,** as the issue says. The view reads dates and writes nothing, for a writer as for a
  reader. A block opens its scene, where the date is set.
- **D-3: a mode of the Arc screen, *Telling order / Story time*.**
  - The switch sits in the Arc toolbar, and the lane kind (*Characters*, *Threads*, *POV*) carries over between the two
    modes.
  - The story-time view is its own component (`StoryTimeView`), because the Arc grid is a table of chapter or scene
    columns, while this view has a continuous axis with zoom.
  - The mode goes in the address (`?time=story`), so a link or a reload keeps it.
- **D-4: one clock.**
  - A scene's day is `computeInWorldDays`, called with the same scenes, chapters, timelines and `pinsSetClock` as the
    Calendar.
  - The unit test compares, for every scene of three fixture books, the view's day with the day `buildCalendarMonths`
    gives.
  - An undated scene (`provisionallyDatedEvents`) is placed at the day that clock gives it, which is where the telling
    puts it, and is drawn dashed and counted, as on the Calendar. A flashback with no date is undated.
- **D-5: the axis cuts out empty time.**
  - Zoom is days, weeks, months or years: 48 pixels a day, a week, a month or a year.
  - A gap between two days that hold scenes is cut where it would be wider than 160 pixels at that zoom. It is drawn as
    a 48-pixel break labelled with its length, such as *3 years*.
  - The opening zoom is the finest at which the whole book fits in 2,400 pixels, else years.
  - Blocks on one day, or close enough to touch, stack in the lane in telling order. A lane grows to its tallest stack.
- **D-6: telling order on top.**
  - Each block carries its place in the book, 1 to *n* over the scenes shown. A reader sees scenes only up to their
    place.
  - A scene that jumps back is ringed and says how far, such as *↶ 52 days*.
  - **Path** draws each lane's line from one scene to the next in telling order. A segment that goes back in time is
    drawn in the warning colour.
- **D-7: lanes.**
  - A character's lane is the scenes they are in on stage (`involvedCharacterIds`).
  - A thread's lane is the scenes on the thread (`threadIds`).
  - A POV lane is the scenes told from someone's point of view (`povCharacterId`).
  - The first eight lanes by number of scenes are shown. A *Lanes* list chooses others and finds them by name.
  - A scene in several lanes is a block in each.
- **D-8: keyboard and screen readers.**
  - The blocks are one tab stop, a list in telling order, moved through with the arrow keys, Home and End.
  - Each block is announced with its number, title, day, lane, and *flashback*, *jumps back 52 days*, *undated* or
    *elsewhere the same day* where they apply. Enter opens the scene.
- **D-9: reading mode.**
  - The scenes are the reading gate's (`useWorldEvents`) and the lanes are its people and threads, so nothing past the
    reader's place appears.
  - Days are worked out from the gated scenes. Gating removes only scenes after the reader's place, so a day already
    reached does not change.

## Parts

1. **Logic** (`src/lib/storyTime.ts`, pure):
   - the lanes;
   - the axis, with its gaps cut and its ticks;
   - each block's position and stack row;
   - telling numbers;
   - jumps back;
   - places on one day, with *moved* and *back*;
   - undated scenes.

   The check (`same-day-elsewhere`) goes in `computeIssues` and uses the same function. Unit tests cover each, and the
   Calendar test runs on three fixtures.
2. **View** (`src/features/arc/StoryTimeView.tsx`) and the Arc switch:
   - zoom;
   - the lane kind and the lane list;
   - the path;
   - opening a scene;
   - the keyboard;
   - the reading gate.
3. **Checks:**
   - an e2e on *Dracula*: its jump back 52 days, Mina's day 307, and clicking through to a scene, with reading mode
     stopping at the reader's place;
   - mutants;
   - the GUIDE with a screenshot;
   - a record;
   - the full suites;
   - a PR.
