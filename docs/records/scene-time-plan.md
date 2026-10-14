# When a scene happens, from its header — a plan

**Status:** planned, not built.
**Asked 2026-10-14:** can the scene header say a date, or how many days have
passed? And how would that work in a book with its own calendar, *The Lord of
the Rings* or *Star Wars*, rather than an Earth one?

The answer today is no: the header has five lines (Place, Characters, Items,
Facts, Relationships) and none of them is time. Time is set in the scene's
details, in two fields. This plans a sixth line, `When:`, that reads and writes
those two fields in whatever calendar the book has. It also plans the one thing
that calendar cannot yet do for the second of those books: years that count
down to a turning point.

Every number below was measured on 2026-10-14. The sources are the branch at
dfad034, the 47 books in the reading library, and writer run 9's `.pwk`.

---

## What a scene's time is now

Two fields on the scene (`WorldEvent`):

- **`travelDays`** — days since the previous scene. The clock adds them up in
  reading order, per timeline (`computeInWorldDays`).
- **`inWorldTime`** — a pin. The scene is on that day of *its timeline's* clock,
  whatever the scenes before it add up to. The timeline's start day
  (`dayOffset`) is added to it: a pin of 8 on a timeline starting at day 280 is
  day 288.

  That last point was got wrong once already. The date picker in #616 wrote the
  calendar day itself and ignored the offset, so in run 9's book (offset 280)
  picking 16 October put the scene 280 days later. It was fixed in dfad034
  before #616 merged. The Calendar's drag-to-pin had it right all along. The
  header must do the same.

**How they are used.**

| | Scenes | Days since set | Pinned |
|---|---|---|---|
| Writer run 9 (*Short Weight*) | 27 | 26 | 0 |
| The library, 47 books | 3,657 | 3,657 | 3,438, in 43 books |

The library's books are built by hand from editorial chronologies, so nearly
every scene is pinned; a writer working forwards through a draft pins nothing
and counts days. The header has to serve the second, and must not get in the
way of the first.

**Calendars.**
- 43 of the library's 47 books have one. None of the four without one is
  wrong to lack it: *The Fellowship of the Ring*, *The Two Towers*, *The Name
  of the Wind* and *The Wise Man's Fear*.
- None of the 43 uses days outside the months; nothing in the library yet
  exercises the shape Shire Reckoning needs, though the app supports it
  (`CalendarMonth.intercalary`, and "Midyear's Day, 1418" printed bare).
- 27 of the 43 use the year suffix as an editorial note — "(editorial
  chronology)", "(editorial reconstruction)" — not as an era. Anything that
  reads the suffix must not assume it is one.
- One timeline in the library has a start offset: *The Odyssey*'s, 3,240 days.

---

## Part 1 — the `When:` line

### What it says

```
[
  Place: #Bag End
  Characters: @@Frodo Baggins @@Samwise Gamgee
  When: 23 Halimath 1418
]
```

Days since the previous scene:

| Written | Means |
|---|---|
| `When: +3 days` | three days after the previous scene |
| `When: +1 day`, `When: +3d` | the same, other spellings |
| `When: same day` | `travelDays: 0`: zero is a statement, not an absence (`provisionallyDatedEvents`) |
| `When: +2 weeks` | 14 days, or two of the book's own weeks where it has one — **Decide** |

A pin:

| Written | Means |
|---|---|
| `When: 23 Halimath 1418` | that date on the book's calendar |
| `When: Halimath 23, 1418` | the same; the app draws dates both ways round, so it reads both |
| `When: Midyear's Day 1418` | a day outside the months, by its name |
| `When: Highday 23 Halimath 1418` | with its weekday, which is checked |
| `When: 23 Halimath` | no year — **Decide** |
| `When: day 412` | a day of the clock; the only pin a book without a calendar has |

**Names come from the book.** Month names, the names of days outside the
months, weekday names and the year suffix are matched against the book's own
calendar, ignoring case. "Halimath" is a month in a book that has it, and
"September" is not; in an Earth book it is the other way round. Nothing is
built in except the words `day`, `days`, `same day`, `weeks`, and the digits.

**What is written.** A date becomes a pin: the date's day on the calendar, less
the scene's timeline's start day, keeping any time of day the pin already had
(`pinOnDate`). `+N days` becomes `travelDays`.

### What it draws

- A pinned scene draws its date, in the form the app writes dates elsewhere
  (`formatInWorldDate`), so the header and the card agree.
- Otherwise, a scene with days since set draws `+N days`, or `same day`.
- A scene with neither draws no line, like every other kind the scene has none
  of.
- **A pinned scene with days since set as well** draws only the date: the pin is
  what the clock uses. The days since are kept, unused, as they are today.

### What editing it does

The same rule as every other line: what is taken off is taken back.

- **A date written over `+3 days`:** pins the scene. Days since is left alone,
  since a pin overrides it and taking the pin off later should give back the
  count the writer had.
- **`+3 days` written over a date:** takes the pin off and sets days since.
- **The line deleted:** clears whichever it drew.
- **A date the calendar cannot read** — a misspelt month, a weekday that does
  not match, a day past the month's end — is said above the page, as an unknown
  name is, and **nothing is written**. The scene keeps the time it had.

### Where it fits the grammar

Every other line is read by its sigils: `#`, `@@`, `^`, `?`, `~`. The label is
decoration, taken off before the tokens are read (`unlabelled`), and a line is
part of a header only when what follows the label starts with a sigil
(`headerLike`). A date has no sigil. So the `When:` line is the first line read
by its label:
- `headerLike` accepts a line labelled `When:`.
- That line is kept out of the sigil pass. Otherwise `When: day #4` would put
  the scene in a place called "4".
- It is only in the block form. The one-line `[#Bag End @@Frodo]` has no labels
  to hang it on.

The cost is a second kind of line in a grammar that had one. The alternative is
a time sigil (`%3 days`, `%23 Halimath 1418`), which a writer would have to
learn and would never guess. **Decide.**

### Everywhere a header is read

- On the Page and on a scene card, where headers are written today.
- In a pasted header under a `## ` heading (`applyPastedHeaders`, run 9's fix), so
  a draft pasted in with its dates keeps them.
- In the cheat sheet, and in the guide's header section.

### Tests

- **Unit:**
  - Parsing and drawing, both ways round, for an Earth calendar and a Shire one
    (twelve months of thirty, five days outside them, a seven-day week).
  - Midyear's Day by name.
  - A weekday that does not match.
  - The offset: a timeline starting at 280.
  - The time of day kept on a re-pin.
  - `When: day #4` writes no place.
- **e2e:**
  - Typing `When: 16 October 2025` on the Page pins the scene, and the Calendar
    shows it on that day.
  - `+3 days` written over the date unpins it.
  - A misspelt month says so and writes nothing.
  - A pasted scene carries its date.

---

## Part 2 — years that count down

### What happens

The calendar has one way to number years: `startYear`, counting up, with an
optional suffix after the number. Years are signed integers inside
(`dayNumberToDate`), and the Calendar already orders years before the epoch
(`calendarView.ts`). So 20 BBY *can* be stored; it cannot be *said*. A story
moving forwards from 20 BBY is shown as 20, 21, 22 BBY, the wrong way.

The same gap is BC and AD, and Tolkien's Ages, where the Third Age starts its
count again.

### Plan

- **`WorldCalendar.eras?`**, a list in order. Each era has:
  - a label (`BBY`);
  - the year it starts, inside — absent for the first, which runs back without
    end;
  - which way it counts;
  - the number of its first year.
- **Absent means today's behaviour**: the year, then the suffix. None of the 43
  calendars in the library changes, including the 27 whose suffix is a note.

| Book | Eras |
|---|---|
| *Star Wars* | BBY counting down, then ABY counting up from 0 |
| Earth, BC/AD | BC counting down from 1, then AD counting up from 1 — no year 0, which is what "the number of its first year" is for |
| *The Lord of the Rings* | Second Age, then Third Age counting up again from 1 |

**One function each way** carries it everywhere:
- `yearLabel(cal, year)` turns a year inside into its number and label.
- `yearFromLabel(cal, number, label)` turns a number and label back into a year.

Where years are shown or typed today:
- `formatInWorldDate`.
- The Calendar's month headings and cell labels.
- The date picker's year box, which gains the era beside it.
- The Calendar editor's start year.

A character's birth date with no calendar is a bare number and is not touched.

**In the header**, `When: 4 Harvest 19 BBY` reads through `yearFromLabel`.

**The editor** gets an **Eras** section beside the Week section. It offers BC/AD
ready-made, and an era of the writer's own.

**Weekdays:** they count from the clock, not the year's number, so eras change
nothing about them. The Earth week's first day is worked out from the year
inside, which is astronomical (1 BC is year 0), the same as
`gregorianFirstWeekday` already takes.

### Tests

- **Unit:**
  - Each table row both ways round.
  - BC/AD across the missing year 0.
  - Ordering across an era change.
  - A calendar with only a suffix is unchanged.
- **e2e:**
  - The Calendar heading reads "19 BBY", then "18 BBY", a year later.
  - The picker's era select.
  - `When:` with an era.

---

## Order and decisions

| # | Part | PRs | Decide first |
|---|---|---|---|
| 1 | The `When:` line | 1 | A label-read line or a time sigil; `weeks`; a date with no year |
| 2 | Eras | 1 | — |

Part 1 comes first and stands alone: dates in every calendar the app can
already describe, which is all of the library's and Shire Reckoning's. Part 2
then teaches it eras. The leap rule (#616's plan) is separate and still later;
Shire Reckoning's Overlithe waits for it.

**Recommendations.**

1. **The line is read by its label, `When:`.** A writer types a date the way
   dates are written. A sigil would be one more thing to learn, for the line
   that least needs one.
2. **`+N weeks` is accepted**, as the book's week length where it has one, and
   seven where it has none.
3. **A date with no year is the first such date on or after the previous
   scene's day.** A date that goes back in time is a flashback or a mistake,
   and either way the writer should say the year.

**Not planned here.**
- **Two calendars in one book** — Shire Reckoning beside Steward's Reckoning.
  The book keeps one, the one the story is told in.
- **A time of day in the header** (`23 Halimath 1418, evening`). The clock
  orders scenes within a day by fractions, and a re-pin keeps them; nothing yet
  asks to write one.
