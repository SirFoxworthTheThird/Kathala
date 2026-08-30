# Reader run — 2026-08-17

Built at `8d07afd`, served from `dist/` via `vite preview`. Driven with a
**persistent** Chromium profile so that "close it and come back next evening"
was a real close, not a page reload.

## What I set out to read

*The Woman in White* — 62 chapters, 18 characters, letters and half-sisters and
an inn, which is the shape of book that makes you lose track. I chose it partly
because §22's *Still not reviewed* names "a second book" as the open gap: every
reading-mode measurement in this document so far comes from *Philosopher's
Stone*.

I opened the Library, searched "woman in white", downloaded it, landed at
chapter 1, and stepped to chapter 7 — where my paperback is. I then asked the
questions I actually had (*who is Anne again, who knows about the asylum, where
is Limmeridge*), read on to chapter 8, shut the browser, came back, and read at
390/360/320px. I then repeated the sharpest checks on *Philosopher's Stone* at
chapter 4 to see whether what I'd found was one book's problem or the app's.

It is the app's.

---

## What interrupted me

### F-1 — The chapter page ignores my place in the book entirely, and lets me type in it **[SPOILER — cursor at Ch.7 of 62, *The Woman in White*; and Ch.4 of 17, *Philosopher's Stone*]**

**What I did.** From the Timeline (a normal reading-mode nav item), I tapped the
open icon on a chapter row. Cursor pill still read `Ch.7 · Walter VII: Mr
Fairlie's Drawings` the whole time.

**What I expected.** Either the chapter I'd reached, or a note telling me I
hadn't got there yet.

**What happened.** Chapter 15's full contents. Character States naming **Vincent
Gilmore** — one of the 13 people the Characters page, two taps away, says are
*"not yet met by chapter 7"* and hidden — where he is, and what he is there to
do: *"Arrives as the family solicitor, prepared to inspect the proposed marriage
settlement."* Beside it, Marian's line: *"Transfers attention from Walter's
departure to Laura's approaching legal danger."*

Then I typed into the **Writer's Notes** box on the right and tabbed away:

```
DB chapters[15].notes ==> "READER TYPED THIS WHILE READING MODE WAS ON"
```

`readingMode` on the world record was `true` at the time. That is a reader
silently editing someone else's book — the exact defect §29/RM-1 closed on the
map, in a panel nobody looked at.

**Evidence.** I walked every chapter past the cursor and matched the text
against the app's own list of unmet names:

| Book | Cursor | Chapters ahead | Leaked |
|---|---|---|---|
| The Woman in White | Ch.7 | 55 | **52** |
| Philosopher's Stone | Ch.4 | 13 | **13** |

*Philosopher's Stone* ch.17 — "The Man with Two Faces" — shows **Quirinus
Quirrell and Lord Voldemort** in the same scene list, at chapter 4, before
Diagon Alley. Its notes box took my text too.

The clincher is that the app **already knows** this is unsafe and says so on the
previous screen. `ChapterRow` computes `synopsisHidden = gate.active &&
chapter.number > gate.chapterNumber`, and it works:

```
CURSOR: Ch.4 · The Keeper of the Keys
timeline LIST contains the ch.17 synopsis? false   <- even after expanding the row
DETAIL page contains the ch.17 synopsis?  true
```

The withheld sentence is *"Harry confronts Quirrell and Voldemort, then learns
why he was able to obtain the Stone."* Hidden on the list. Printed under the
title on the detail page, one tap later.

**Mechanism.** `ChapterDetailView.tsx` touches the gate in exactly two places —
hiding *Add Event* and declining to move the cursor. There is no `chapter.number
> gate.chapterNumber` check anywhere, and the notes `<textarea>` has no gate at
all. The names come from `useChapterEventSnapshots`, which is ungated — while
its immediate neighbour in the same file is not.

**Why nobody caught it.** `e2e/spoilerGuarantee.spec.ts` says it *"walks every
world-scoped route, so a screen added later is covered without anyone
remembering to add it here."* It does not. `ROUTES` is twelve hardcoded index
segments and contains **no detail route at all**. The comment is a claim the
code has never honoured. This is RD-2's shape one level up: the guard cannot see
the class it exists to catch.

**Three ordinary ways a reader gets here**, all confirmed: the open icon on a
Timeline row; a chapter result in the search palette; and tapping any entry on
the Calendar.

**Cost.** The worst thing the app can do. On *Philosopher's Stone* it is two
taps from a reader's normal position to Voldemort's name.

---

### F-2 — Chapter titles are exempt from the gate, and for some books the titles *are* the plot **[SPOILER — cursor at Ch.7 of 62, *The Woman in White*]**

**What I did.** Tapped Timeline — the second item in the reading-mode nav, and
the screen the cursor pill itself links to — and scrolled.

**What happened.** All 62 chapter titles, including:

```
Ch. 38 — The Tombstone at Limmeridge
Ch. 40 — Third Epoch — Walter I: Laura at Her Own Grave
Ch. 59 — Fosco: The Confession
Ch. 60 — Conclusion I: Laura's Identity Restored
Ch. 61 — Conclusion II: Fosco's Death in Paris
```

That is the novel's entire central deception and its unravelling, on the screen
a reader visits to see where they are. Cross-referencing the app's own unmet
list, **9 of the 13 characters it says are hidden are named in those titles**,
most with their fate attached.

It reaches the search palette too. I typed "anne" to remind myself who she was —
the single most natural thing a reader does — and got the answer I wanted plus
five chapters I hadn't read, among them `Ch. 46 — Walter VII: Anne's Parentage`.

**I want to be careful about the line here.** That these particular titles are
editorial rather than printed is a content fact, and the content is not on
trial. **The experience is the finding**, and it is this: the app states, in the
first paragraph of the screen the Library lands me on, *"13 characters, 17
places and 9 items you have not met stay hidden until you reach them"* — and
then, on the next screen in the nav, names nine of those thirteen and what
becomes of them. A reader has no way to tell which of the two statements to
believe, and the one they'd naturally trust is the one that's wrong.

**Mechanism.** `ChapterRow` renders `chapter.title` unconditionally, on the
documented rationale that titles are printed on the reader's own contents page.
That rationale is sound and is exactly right for *Philosopher's Stone*. It is
false for *The Woman in White*, whose chapters are numbered I–XXXVIII within
named narratives and carry no titles at all, and for *Jane Eyre* (`38 Reader, I
Married Him`). Most of the catalogue is fine. **There is nothing in the data
model that distinguishes a printed title from an authored one**, and nothing on
screen that lets a reader know which kind they're looking at.

And the guarantee cannot notice, because `e2e/helpers/unmet.ts` subtracts every
chapter title from the text under test on the stated grounds that they are
"printed on the contents page of the physical copy". For a book whose titles are
summaries, the spec is checking the leak against itself.

**Cost.** High, and it compounds F-1: the one cheap way to set your position
("View from here", F-4) is on this screen, so a reader who does the right thing
scrolls past the ending to do it.

---

### F-3 — One tap on the Calendar silently threw away my place in the book

**What I did.** Set my position to chapter 8. Opened Calendar. Tapped the entry
for **"Walter III: Pesca's Proposal"** — an earlier scene, to remind myself what
it was. Nothing about the chip suggests it does anything but show me that scene.

**What happened.**

```
reader at:  Ch.8 · Walter VIII  | stored: woman-in-white-event-walter-8
tap "Walter III: Pesca's Proposal"
cursor now: Ch.3 · Walter III   | stored: woman-in-white-event-walter-3
Undo control present? 0
```

The saved position in `localStorage` was overwritten. There is no undo — reading
mode removes it, correctly, for everything else. To get back I have to remember
I was on chapter 8 and set it again, and the shelf will now tell me *"Chapter 3
of 62"* next week.

**Mechanism.** `CalendarView.openEvent` does `setActiveEventId(ev.id)` then
navigates. It is not alone — the same "show me this" → "and move your bookmark"
pairing exists at `HistoryTab.tsx:229`, `AppearancesTab.tsx:66`,
`CharacterFilmStrip.tsx:103`, `LocationDetailPanel.tsx:222`,
`CharacterArcView.tsx:937`, `SearchPalette.tsx:224` and
`WorldDashboardView.tsx:515`, all on reading-reachable screens. *I reproduced it
on the Calendar only; the other seven are read from the code and are marked as
such below.*

**Cost.** High. This is promise #1 — the reader has to be able to say where they
are and have it kept. For a writer, moving the time cursor to inspect a moment
is the whole idiom and costs nothing; for a reader it is the one piece of state
they own, and seven controls reassign it as a side effect of looking at
something.

---

### F-4 — Saying where I am: cheap if you find it, expensive if you don't

Measured, not guessed.

| Route | Cost | Where it lives |
|---|---|---|
| `>` stepper in the top bar | **6 taps** ch.1→ch.7 (*Woman in White*, 1 event/chapter); **9 taps** ch.1→ch.4 (*Philosopher's Stone*, ~3 events/chapter) | always visible |
| **"View from here"** on a Timeline row | **2 taps** + scrolling (16 such buttons in a 17-chapter book) | Timeline only |

So the answer to "is it easy enough to do repeatedly" is **yes, once you know
about "View from here"** — one tap sets the cursor to that chapter, confirmed
(`Ch.4 → Ch.11` in one click). The problem is discovery and naming:

- The stepper is the only control that is *always* on screen, and it steps by
  **moment**, not chapter. On a multi-event book that is ~3 taps per chapter —
  roughly 50 taps to walk *Philosopher's Stone*.
- The dashboard's reading notice — the screen the Library lands you on, added by
  RD-3 — contains exactly one affordance, and it is **"Turn it off in
  settings."** It tells me where I am and what's hidden, and the only thing it
  offers me to do about it is switch the feature off. Nothing points at "View
  from here".
- "View from here" reads like a view control, not a bookmark. The reader's
  mental act is *"I've read up to here"*.

**Cost.** Medium — a friction tax on the thing readers do most, and it pushes
people toward the one control that is labelled as an escape hatch.

---

### F-5 — On a phone, the notice explaining reading mode is one word wide

**Measured** (width of the explanatory paragraph's text column, and the line
count it wraps to):

| Viewport | Text column | Lines | "Turn it off in settings" |
|---|---|---|---|
| 430px | 120px | 13 | 188px |
| **390px** | **80px** | **20** | 188px |
| **360px** | **50px** | **29** | 188px |
| **320px** | **10px** | **32** | 188px |

At 320px — a width the app claims to support — the heading **"Reading mode is
on" is drawn underneath the button**, which prints "Turn it off in settings"
straight across it, and the body text is a one-word ribbon 32 lines tall that
pushes every dashboard tile far below the fold.

**Mechanism.** `WorldDashboardView.tsx:403` — `flex flex-wrap` with a `min-w-0
flex-1` text column and a `shrink-0` link. The link never gives up a pixel and
never wraps, because the text beside it is willing to collapse to nothing first.

**Why §23 didn't see it.** §23 swept phone widths by measuring
`documentElement.scrollWidth` against `clientWidth`. I measured the same thing
and got **390:390, 360:360, 320:320** — no overflow, on every width. The page is
not too wide; one column inside it is too narrow. That is a different
measurement, and it's worth adding to the sweep.

**Cost.** Medium. People read in bed. This is the screen whose entire job is to
tell them what mode they're in.

---

### F-6 — The Calendar tells the reader to drag scenes around, and the write behind it has no gate

**What I confirmed.** The header on `/calendar` in reading mode reads *"Events
by in-world date. **Drag an event to a day to pin it there.**"* Seven event chips
in `main` carry `draggable`. `CalendarView.tsx` **imports no reading gate at
all**, and its drop handler writes `updateEvent(id, { inWorldTime: … })`.

**What I could not confirm.** I could not make the write happen. `page.dragTo`
does nothing (HTML5 DnD ignores synthetic mouse moves), and dispatching
`dragstart`/`dragover`/`drop` by hand fails on a React detail: `dropOnDay`
early-returns on `if (!id …)` where `id` is `dragId` state, which my synthetic
`dragstart` sets asynchronously and which is therefore still `null` when `drop`
fires in the same tick. Three attempts, no change to `events.inWorldTime`.

So: **the invitation and the affordance are confirmed and are ungated; the
mutation is inferred from the code and not reproduced.** The invitation alone is
a finding under promise #4 — the guide's *What reading mode puts away* says the
map "no longer offers to add a location, label, route or region", and this
screen is still asking a reader to rearrange the author's chronology.

**Cost.** Medium if the drop writes (it is the §29/RM-2 shape, third instance);
low-medium if something else stops it, because the copy is still wrong.

---

### F-7 — I could not tell whether the map was empty, gated, or broken

**What I did.** Dashboard tile said `1 · Maps · maps you have reached · 2
markers`, so I tapped it — the reader question was *where is Limmeridge relative
to London*.

**What happened.** A blank rectangle with a broken-image glyph in the corner and
two grey pills reading "3 characters" and "2 characters", joined by a faint
line. Limmeridge's own label sits underneath one of the pills.

**What I found.** The world's five map layers carry **no `imageBlobId` and no
`imageUrl`** — they are maps with no picture. Separately, the location markers'
images are hot-linked to `upload.wikimedia.org`.

**The experience is the finding, not the missing image.** There is no message
anywhere saying this book's map has no picture. The three candidate explanations
available to a reader — *reading mode is hiding it*, *it failed to load*, *there
was never one* — are indistinguishable, and two of them are the app's fault.

**Caveat, stated plainly:** I could not test a genuinely offline load — outbound
HTTPS here goes through a proxy, so I cannot separate "blocked by my sandbox"
from "would fail on a train". The `src` attributes are remote, which is the part
I am asserting.

**Cost.** Low-medium.

---

## What I only suspect

Kept separate on purpose.

1. **The other seven cursor-stealing controls (F-3).** Read from the code,
   reproduced only on the Calendar. *Settles it:* tap a row on each and read
   `localStorage['plotweave-ui'].state.activeEventId` before and after.

2. **Whether the Calendar drop actually writes (F-6).** *Settles it:* a
   Playwright test using CDP `Input.dispatchDragEvent`, or a unit test calling
   `dropOnDay` with `dragId` seeded.

3. **§30's alphabetisation quietly moved which book the spoiler guarantee
   measures.** `spoilerGuarantee.spec.ts` clicks `Download` `.first()`. With the
   catalogue now filed A–Z past the article, the first entry is **Around the
   World in Eighty Days**; before the sort it was *Philosopher's Stone*. Nothing
   is broken, but the spec's subject changed as a side effect of a UI change,
   and no one chose it. *Settles it:* name the fixture book explicitly.

4. **Whether F-1's blast radius extends to other detail routes.** I swept
   chapter, character, item and lore detail for *The Woman in White* at Ch.7 and
   found only chapter detail leaking. But I only swept detail pages for entities
   the reader *has* met. *Settles it:* extend the guarantee spec's `ROUTES` to
   enumerate detail routes from the store.

## A small correction, not a finding

§22 describes reading mode as having *"its own warm sepia theme, a serif face."*
It does not. The theme is a per-book world theme carried in the `.pwk` — *The
Woman in White* is `theme-noir` and arrives near-black with a mono face;
*Philosopher's Stone* is `theme-fantasy`, which is the warm one §22 saw. Reading
mode has no visual signature of its own, which means RD-3's notice is carrying
all of the "you are in reading mode" weight by itself — worth knowing given F-5
shatters that notice on a phone.

## What worked

Honestly, and it should not be undone:

- **The Library.** Search found my book in **4.1s** from a cold start: one tap
  to open, type "woman in white". Alphabetical filing and the search are both
  real improvements and I used them without thinking.
- **Arriving.** Download landed me in the world at **chapter 1**, not "all
  chapters". That single decision is what makes the thing safe to open at all.
- **Coming back the next evening is excellent.** Fresh browser process, front
  door, and the shelf has a **`READING`** section with the card reading
  **"Chapter 7 of 62"** and a progress bar. **One tap, 2.1s**, and I was back in
  at exactly `Ch.7 · Walter VII`. This is the best-executed part of the feature
  and it is the part a reader touches most.
- **Search answered "who is Anne again" in 3.5 seconds** — faster than flicking
  back through 200 pages, which is the entire point of the app.
- **The Knowledge screen is the best answer in here.** At chapter 7: *"Anne
  escaped from a private asylum — known by 1 / 5."* That is exactly the *who else
  knows about this* question, answered at my position, in one screen.
- **The gate holds on every index route I checked.** Characters 5 of 18 with an
  honest note; map layers 3 of 5; plot threads gated; items 1; the calendar
  stops dead at my chapter.
- **The phone layout itself is sound.** `scrollWidth == clientWidth` at 390, 360
  and 320. F-5 is one flex row, not a broken screen.

So the answer to "is what remains useful" is **yes** — Characters, Knowledge,
Search and the shelf did the job I wanted. The failures above are not the gate
hiding too much. Every one of them is the gate not being consulted at all on a
screen someone forgot about, and in two cases the app confidently telling me it
was protecting me while the next tap did the opposite.

**Ranked by what it costs the reader:** F-1, F-2, F-3, F-4, F-5, F-6, F-7.
