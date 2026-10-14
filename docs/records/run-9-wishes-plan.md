# What writer run 9 wished for — a plan

**Status:** all five built (a date for a pin; `:before`; `:dead elsewhere`;
chapter headings; weekdays).
**Decided 2026-10-13:** every recommendation below was taken — `:before` typed
in a later scene is accepted and filed at the first, with a note; the off-stage
suffix is `:dead elsewhere`, and the scene mentions them; new books keep
"Ch. 1 — Title"; days outside the months are outside the week; the leap rule is
a later PR of its own. Decisions the author owns are marked **Decide** and
listed together at the end.

Writer run 9 wrote *Short Weight*, a crime novel set in a contemporary fantasy
world, inside the app: 35,333 words, 9 chapters, 27 scenes. Its bugs are fixed
(#614). Two of its seven wishes were bugs and are done there: pasted headers are
applied, and the map shows the dead apart. This plans the other five, which are
things the app does not do rather than things it does wrong.

Every number below was measured on 2026-10-13. The sources are `development` at
2fea528, the run's own `.pwk`, and the 47 books in the reading library. None is
an estimate.

---

## 1. A date for a pinned scene

**What happened.** The book has an Earth calendar running 8 October to 30
November 2025. A scene's **pin to an exact in-world day** is still a bare day
number (`TimeField` in `SceneFields.tsx`, an `<input type="number">`). To pin a
scene to 16 October, the writer would have had to work out that it is day 288.

The writer did not pin any scene. The `.pwk` has **0** pinned events out of 27.
They set the start date in World Settings instead (the timeline's `dayOffset`
is 280, which is 8 October) and used days-since for every scene after it. **26**
of 27 scenes have `travelDays` set. So the bare number did not just slow the pin
down; the writer worked around it entirely.

**What is already there.** `InWorldDatePicker` picks a month, a day and a year
on the world's calendar. Character birth dates and "The story begins on" already
use it. Dragging a scene on the Calendar already pins it by date.

**Plan.**
- **With a calendar**, the pin is the date picker. It writes
  `dateToDayNumber(...)`, and the field shows the date the scene is on now,
  pinned or not, so the picker starts there rather than at the start year.
- **Without a calendar**, the number stays, as it is today.
- **A pin with a time of day** (10.25, say: the clock uses fractions to order
  scenes within a day, `computeInWorldDays`) keeps its fraction when the date is
  changed. Picking 17 October for a scene pinned at 288.25 gives 289.25.
- **Clear** takes the pin off, as emptying the number does today.

**Tests.** A unit test that the fraction survives a date change. An e2e test:
- the pin is set by date, and the record holds the day number;
- the same scene in a world with no calendar shows the number field.

---

## 2. "Known before the story" from the header

**What happened.** The writer recorded **8** reveals as known before the story
(`KnowledgeReveal.beforeStory`), all through the Knowledge screen. The header's
Facts line can say who learns a fact *at this scene* (`?Fact:@Name`), and that
the reader does (`?Fact:reader`). It cannot say that somebody knew it all
along.

**Where it lives.** A before-the-story reveal is filed at the first scene, and is
deliberately not drawn on that scene's header (`sceneFacts` filters it out), so
that editing the header cannot take it off.

**Plan.**
- **`?Fact:@Name:before`** records the reveal as known before the story. It is
  filed at the first scene, wherever it is typed.
- **It is drawn on the first scene's header**, as `:before`, and only there.
  Taking it off that header takes the reveal off, the same way taking off any
  Facts token does. This replaces the rule that hid these reveals; the reason
  for that rule (editing the header could take them off without the writer
  meaning to) no longer holds once the token is drawn where it can be seen.
- **Typed in a later scene's header**, it is recorded, and that header's line no
  longer shows it. The note above the page says so: *"Known before the story:
  shown on the first scene, Flat 114."*

**Decide.** Should `:before` typed in a later scene's header be accepted, filed
at the first scene, with the note? Or refused, with a note pointing to the first
scene? I recommend accepting it: what the writer means is clear, and refusing
it costs a trip to another scene for nothing.

**Tests.** Unit tests for the parse and draw round trip:
- `:before` on the first scene;
- `:before` in a later scene, recorded at the first;
- a plain `?Fact:@Name` in the first scene is still learned there, not before.

An e2e test for the note.

---

## 3. A death off stage, from the header

**What happened.** Jordan Kelly dies in Chapter 8, away from every scene; the
book learns of it afterwards. The header can say `@@Name:dead`, but that puts
Jordan *in the scene* and records the death at the scene's place. The writer
recorded the death through Current State instead. In the `.pwk`, **1** of the
book's **4** deaths is like this: Jordan's record has no scene with Jordan in
its cast.

**Why `@Name:dead` cannot mean it.** Inside the header a single `@` already
means *present*, the same as `@@`. It was made so on purpose, because
`[#Court @Sella]` once dropped Sella (`parseSceneHeader`). Giving the single
sigil a different meaning would undo that fix.

**Plan.** A suffix, as `:phone` was for presence by phone:
- **`@@Name:dead elsewhere`**, on the Characters line, records the death at this
  scene. Like `:called` and `:is`, the suffix is more than one word.
- **Not in the cast.** They are added to the scene's *mentioned* list, since the
  scene is where the book tells of it.
- **The record** is not alive, at their last recorded place, carried forward. It
  is not at the scene's place.
- **Drawn back** as `@@Name:dead elsewhere`.
- **Everything already reading deaths** follows from the record: the Brief, the
  map's Dead group, Knowledge in the room. (Continuity has nothing to say at
  this scene either way: a death recorded at a scene does not make the person
  dead *in* it, and a record at the scene is the writer's word on where they
  are. So keeping them out of the cast changes nothing there.)

**Decide.**
- **The suffix.** I recommend `:dead elsewhere`: it reads as a sentence and sits
  beside `:dead`. The alternative is a single word, `:offstage`, which is shorter
  but less clear about what happened.
- **Mentioned or not.** I recommend mentioned: the scene is where the reader
  hears of it. The alternative leaves them in no list at all, so Appearances does
  not show the scene.

**Tests.** Unit tests for:
- the parse and draw round trip;
- `planHeader`: the cast, mentioned list and fate it produces;
- the record: its place and `isAlive`.

An e2e test, typed on the Page: the death is recorded at the last place, not at
the scene's. Paired with a plain `:dead`, which is recorded at the scene's
place.

---

## 4. A choice of chapter heading in the EPUB and Word

**What happened.** Every export headed every chapter as `Ch. 1 — Flat 114`
(`chapterHeading` in `manuscriptExport.ts`; the same form in
`manuscriptCompile.ts`). The writer wanted the headings a printed novel uses.

**What the library says.** Of the library's **1,755** chapters, **302** (in
**10** of the **47** books) already have a title starting with *Chapter*,
*Book*, *Part* or *Letter*. *Pride and Prejudice* is one: 61 of its 61 chapters
are titled like that. So today's export prints `Ch. 1 — Chapter I` for those.
For them the right style is the title alone.

**Plan.** A **Chapter headings** choice in the export dialog, remembered per book
(a new optional field on `World`, so it travels in the `.pwk`). The styles:

| Style | Example |
|---|---|
| As now | `Ch. 1 — Flat 114` |
| Chapter in words, title under it | `Chapter One` / `Flat 114` |
| Chapter in figures, title under it | `Chapter 1` / `Flat 114` |
| Number, title under it | `1` / `Flat 114` |
| Title only | `Flat 114` |
| Chapter in words only | `Chapter One` |

- **Where it applies:** EPUB, Word, HTML and plain text.
- **Markdown keeps `# Ch. 1 — Title`**, because the import reads that form back
  (`manuscriptImport.ts`). A different heading would break the round trip.
- **The EPUB contents** use the same style, on one line: `Chapter One: Flat 114`.
- **Numbers in words** are written out by a small function, to 999. The
  library's highest chapter number is 153, in *The Wise Man's Fear*.

**Decide.** Should a new book's default stay as now, or be *Chapter in words,
title under it*? I recommend keeping today's default, so that no existing
export changes without being asked for.

**Tests.**
- Unit tests for each style in `compileDocx`, `compileEpub` and the HTML compile.
- A test that Markdown is unchanged.
- A test for the number words.
- An e2e test that the choice is remembered across exports.

---

## 5. Weekdays on the calendar

**What happened.** The book is set in October and November 2025. The Calendar
draws every month as seven columns, but day 1 always starts in the first column,
and the columns have no names. So the grid looks like a week and isn't one: 1
October 2025 was a Wednesday, and it is drawn as the first day of a week. The
writer wanted the columns headed Monday to Sunday, with each date under its own
weekday.

**What the calendar can do today.** `WorldCalendar` has months and a start
year, and nothing about weeks. Every year is the same length: the guide says
outright that leap days "have no rule behind them".

**Plan.**
- **A week on the calendar:** `week?: { days: string[]; first: number }`.
  - `days` are the weekday names.
  - `first` is the weekday of day 0 of the clock.
  - The weekday of any day is `(first + day) mod days.length`.
  - Absent means no weeks, as today, so no existing calendar changes.
- **The Earth preset fills it in:** Monday to Sunday, with `first` worked out
  from the start year.
- **The Calendar editor** gets a **Week** section: the number of days and their
  names, and which weekday the story's first day falls on. A fantasy calendar
  can have a ten-day week.
- **The month grid** heads its columns with the weekday names, and starts day 1
  under its own weekday. A month with no week keeps today's grid.
- **The date picker** (§1) and the scene panel's date say the weekday:
  *Wednesday, 8 October 2025*. Other dates in the app are left as they are, so
  this change does not reach every screen that shows a date.

**Decide.**
- **Days outside the months.** Should they be outside the week too? (The
  Shire's Midyear's Day has no weekday.) I recommend outside, which is what the
  calendars that have them do. The alternative counts them as ordinary days.
- **Leap years.** A weekday makes the missing leap rule visible: from 29
  February 2028 on, a 2025 Earth calendar's weekdays would be one day out. Run
  9's book never crosses a February, so it is not affected. I recommend a
  separate, later PR that gives Earth calendars the Gregorian leap rule. That
  rule changes how every date is worked out, so it should not ride along with
  the weekday columns.

**Tests.** Unit tests for:
- the weekday rule, including a negative day before day 0;
- `first` from a start year (1 January 2025 is a Wednesday);
- days outside the months.

An e2e test: the October 2025 grid has Wednesday over the 1st, and a calendar
with no week keeps today's grid.

---

## Also open, and not planned here

- **Lore → New Page** makes an *Untitled* page straight away, and leaving it
  blank leaves it in the list. Deleting it automatically when you leave would put
  a step in Undo that the writer did not take. Making the page only once
  something is typed into it changes the route the page opens on. Not planned
  until it is asked for.
- **The `classList` error on uploading a sub-map** has been reported twice and
  reproduced neither time. The next writer run will record each error's stack,
  not just its message.

## Order and decisions

| # | Feature | PRs | Decide first |
|---|---|---|---|
| 1 | A date for a pin | 1 | — |
| 2 | Known before the story, from the header | 1 | Accept `:before` typed in a later scene? |
| 3 | A death off stage, from the header | 1 | `:dead elsewhere` or `:offstage`; mentioned or not |
| 4 | Chapter headings in the export | 1 | New books' default |
| 5 | Weekdays | 1, and the leap rule later | Days outside the months; leap years now or later |

1 comes first because it is small and every later date feature uses its picker.
2 and 3 are header grammar, so they share their tests' setup. 4 touches every
export but nothing else. 5 is the only one that changes the shape of the
calendar, so it goes last.
