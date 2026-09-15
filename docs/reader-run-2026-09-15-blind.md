<!--
  Recovered from the session transcript after the fact. This run reported back in
  conversation and was never written down, unlike the August runs beside it — by
  the time R7 and R9 came up for work, all that survived was a one-line note, and
  R9 was nearly dropped as unrecoverable. Blind runs get written to docs/ now.
-->

# Reading *The Count of Monte Cristo* in PlotWeave

Built with `VITE_E2E=1 npm run build`, served `dist/` at `:4173`, drove real Chromium with a **persistent profile** so "put it down and come back" was a real browser restart, not a reload. All scratch scripts and screenshots live in `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/`. Nothing in the repo was touched (`git status --porcelain` empty); no spec was added to `e2e/`. Preview server stopped at the end.

Book chosen for the persona (long, huge cast, letters, inns): **The Count of Monte Cristo** — 117 chapters, 149 scenes, 41 characters. Second book: **Alice's Adventures in Wonderland** (12 chapters, prose, sepia theme). Third: **Harry Potter and the Philosopher's Stone** (structural-only, no prose) to see what the Read screen does without text.

---

## 1. What I did, in order

1. Opened the app cold → world list. Downloaded Monte Cristo from the Library (search "Monte Cristo" → `Download (3.3 MB)`). **543 ms** from click to landing in the world, reading mode on, cursor at `Ch.1 · Marseille Appears Beyond the Islands`.
2. Read chapter 1 on the **Read** screen. Prose arrived at **2,712 ms** after clicking Read.
3. Said where I was: dashboard → *Set where you have read to* → Timeline → *Read to here* on Ch. 7. **2 taps**, ch.7 visible without scrolling at 1280px.
4. Asked reader questions: opened all ten met characters, used Ctrl+K on five names, opened Maps, Lore, Knowledge, Items, Relations, Arc, Calendar, Factions.
5. Read on by scrolling; watched the cursor and the progress readout follow.
6. Closed the browser process. Reopened at `/` the "next evening".
7. Repeated on Alice and on Philosopher's Stone; read at 1280, 390, 360 and 320px.

---

## 2. What got in the way — ranked by what it costs a reader

### R1 — One tap on my own bookmark handed me the whole book, with no confirmation. **(highest)**
**Reproduced twice, once on a brand-new download.**

On the Timeline, the chapter you are currently on shows a button reading **"Reading here"**, `title="This is where you have read up to"`. Clicking it clears the cursor to **All chapters**.

Fresh download, cursor `Ch.1`, first row on screen:
```
"Reading here" count: 1 | row: Ch. 1 — Marseilles—The Arrival …
dialogs: 0 | cursor now: All chapters
```
Second run from `Ch.4 · The Denunciation Is Written`: 0 dialogs, roster went **6 met → 41**, immediately printing *Abbé Faria, Albert de Morcerf, Ali Pasha of Yanina, Benedetto / Andrea Cavalcanti, Eugénie Danglars, Haydée, Héloïse de Villefort…* (screenshot `41-roster-after.png`).

Expected: the same confirm the other two routes give. The header ✕ asks *"Show the whole book? … Step the cursor instead to keep reading spoiler-free."* The chapter-bar tick asks *"Read ahead to chapter 30? …"*. This one asks nothing, and it is the button labelled as the reader's own bookmark.

Mechanism — `src/features/timeline/ChapterRow.tsx`:
```tsx
onClick={() => setActiveEventId(isActive ? null : (sortedEvents[0]?.id ?? null))}
```
`asksBeforeJumping` (`src/lib/readingAhead.ts`) is imported by `ChapterTimelineBar.tsx` only. The writer's toggle semantics ("pressing it again goes back to *All chapters*", GUIDE ~line 793) carried into reading mode under a label that says something else.

**I think a closed finding was closed too narrowly.** `docs/ux-review.md` X-15 fixed exactly this reveal on the ✕ path, and `docs/GUIDE.md` (~line 354) now states: *"while reading, PlotWeave asks before doing it, since the control is a small ✕ beside the cursor and one stray click would hand you the whole book."* There is a second control, on a different screen, that does the same thing and does not ask. Cost: everything the gate exists to protect, in one tap, and the reading is not undone by putting the cursor back.

---

### R2 — "Read to here" on a far-ahead chapter jumps with no confirm, unlike the identical action on the chapter bar.
From `Ch.3 · The Betrothed Reunite`, one click on chapter 38's *Read to here* (visible mid-screen after a single scroll):
```
dialogs: 0
cursor after one click: Ch.38 · The Count Cancels the Ransom
roster: Characters 23 … 18 characters not yet met by chapter 38 are hidden.
        Abbé Faria  deceased … Albert de Morcerf … Ali …
```
Same file, same missing guard. There are **116 of these buttons** on the screen the dashboard's primary reading action points at, and the chapter-bar tick 30 rows away *does* ask. Targets are 28px tall and 67px apart at 1280px, 128px apart at 390px, so this is a mis-tap risk rather than a certainty — but the inconsistency itself is the confusing part.

---

### R3 — **SPOILER.** The companion's own character entries state things from later in the book, including naming a character the same screen is hiding.
**Cursor when observed: `Ch.7 · Innocence Seems to Satisfy the Prosecutor`, i.e. chapter 7, "The Examination".** What the app had revealed by then: 10 characters, and the roster's own notice — *"Reading mode — 31 characters not yet met by chapter 7 are hidden."*

I opened all ten and read the Overview each shows. **Seven of ten** state something after chapter 7. Verbatim from the UI:

- **Louis Dantès** — "Edmond's proud and impoverished father, **unable to survive his son's disappearance**." (screenshot `17-louis.png`)
- **Mercédès de Morcerf** — "Edmond's Catalan betrothed, **later Countess de Morcerf**…" — and that is also the name on the roster card, at the point in the book where she has just refused Fernand.
- **Marquise de Saint-Méran** — "**Valentine's** royalist grandmother, determined to arrange her granddaughter's marriage **before death**."
- **Renée de Saint-Méran** — "Villefort's first wife and **Valentine's** mother…"
- **Baron Danglars** — "…**later a banker** whose envy and greed help begin the conspiracy."
- **Pierre Morrel** — "…and **later receives anonymous rescue from ruin**."
- **Fernand Mondego / Count de Morcerf** — the roster name itself, plus "**rises through military betrayal into the peerage**."

The cleanest proof, which needs no opinion about the book: **Valentine de Villefort is gated off at chapter 7.** She is not on the roster, and Ctrl+K "Valentine" returns *no character* — only two chapter titles. Yet two entries the gate **does** show name her.

I have to say this explicitly per your rules: **the only route to this runs through content** — the strings live in the `.pwk`. What I am reporting is the experience: the banner promises "39 characters … stay hidden until you reach them", and the page it sends you to tells me a character dies five chapters early and names someone it is hiding. `docs/GUIDE.md` (~line 344) documents an exemption for *prose* — "if a place you *have* reached is described in a sentence that names one you have not, that sentence is shown as written" — and a character description field is not the novel's prose, it is the companion's own copy. The same page also promises "A character's page shows where they stand now rather than every chapter still to come," which is the opposite of what a reader gets (see R4).

Measured: keyword scan of the `.pwk` finds 5 of 41 descriptions with explicit forward language; reading the ten reachable ones by eye at chapter 7 finds 7.

---

### R4 — "Current State" — the tab that answers "where is she now / is she alive" — is a dead control while reading.
Character page → click **Current State** → nothing happens; Overview stays selected.
```
after clicking Current State: [["Overview","true"],["Current State","false"],["History2","false"], …]
after clicking History:       [["Overview","false"],["Current State","false"],["History2","true"], …]
```
Reproduced twice on Mercédès (Monte Cristo) and twice on The Duchess (Alice). History and Appearances work.

Mechanism — `src/features/characters/CharacterDetailView.tsx`: `tabCounts` has no `state` key, so `hasTab('state')` is `(undefined ?? 0) > 0 === false` whenever `gate.active`, and `const activeTab = hasTab(tab) ? tab : 'overview'` snaps back. The trigger is rendered unconditionally. The comment two screens up says the opposite of what the code does: *"Overview and Current State always are [offered]: they answer 'who is this again', which is the whole reason the page is open."*

Cost is double: a visibly broken control, and the character page is reduced to one whole-book sentence — which is exactly the sentence R3 is about. A reader asking *"was this the one who died?"* has to fall back to the roster's `deceased` badge or the History tab.

---

### R5 — Editing controls on the chapter rows while reading; rename lands in the database.
Every one of the 117 chapter rows carries a `…` menu (`aria-label="More actions for chapter 7"`) whose only two items are **Rename chapter** and **Delete chapter**. I renamed chapter 2 and read it straight back out of IndexedDB:
```
CH2 NOW: Ch. 2 — I ACCIDENTALLY RETYPED DUMAS
DB chapters number=2 titles: [ 'I ACCIDENTALLY RETYPED DUMAS' ]
```
It was still there in later sessions. I opened the delete confirm ("All scenes in this chapter will be permanently deleted") and did **not** confirm it.

`ChapterRow.tsx` gates six other things on `!gate.active`; the `<Menu>` is not one of them. This is the same shape as §29 RM-1/RM-2 and contradicts `docs/GUIDE.md`'s *"No screen offers to add, generate or delete anything: … no delete buttons on cards, rows or map layers."*

---

### R6 — Raw italic markers in the prose, on every page.
The Read screen prints `_Pharaon_`, `_Pardieu!_`, `_Peste!_`, `_Chi ha compagno ha padrone_` with the underscores visible. Counted **526** such spans in the rendered `<p>` DOM of Monte Cristo's Read screen (2,598,924 characters of prose). Alice has `_very_`.

Not book-specific: **30 of the 41 shipped `.pwk` files** carry underscore-emphasis in their scene text — *Os Maias* 1,388, *Twenty Thousand Leagues* 626, *Monte Cristo* 525, *Pride and Prejudice* 502, *Dracula* 475, *The Moonstone* 458.

Renderer: `splitParagraphs(s.text)` then `<p>{p}</p>` in `ManuscriptView.tsx:456`. No inline formatting anywhere in the path. Whether the right fix is rendering emphasis or cleaning the files, what a reader sees is Gutenberg markup in the middle of a sentence, several times a page, for the whole book. Not in `docs/ux-review.md`.

---

### R7 — A play button on the reading screen walks your bookmark forward.
Bottom-left of the **Read** screen (and every other reading screen) sits `aria-label="Play story on the map"`, next to a speed cycler and a ✕. Pressed on the Read screen at Ch.1: the cursor advanced one scene in ~10 s, no dialog, and no map anywhere on screen. `docs/GUIDE.md` documents this as intended ("**play**, which is the same thing on a timer — it walks your place forward a scene at a time and reveals each one as it arrives"), so I rank it low: it is the name and the placement, not hidden behaviour. A reader on the Read screen has no reason to think that button is theirs, or that it moves their place.

---

### R8 — Phone: line-spacing controls vanish, progress readout leaves a dangling separator.
At 390, 360 and 320px, `getByRole('button', { name: 'Snug' }).count() === 0` — `Snug / Relaxed / Airy` are not rendered at all (`hidden items-center gap-1 sm:flex` in `ReadingTypeControls.tsx`). Size and face survive. Spacing is the setting that matters most on a narrow column, and the readers who need it are the ones on a phone.

Same three widths, the progress line reads:
```
"5% of the book · Chapter 6 of 117 ·"
```
The trailing `·` has nothing after it; at 320px the row wraps and strands **two** separators, one hanging alone at the right edge (`26-read-320.png`). `ReadingProgress.tsx:101-107` hides the "about N min left in it" span with `hidden sm:inline` but leaves the `·` beside it visible.

---

### R9 — Smaller things that made me stop reading for a second
- Every roster card carries a **"carried forward"** badge. I still do not know what it is telling me.
- The **Appearances** tab says: *"Type @ in a scene's draft to refer to Mercédès de Morcerf without putting them in the room."* An authoring instruction, on a reading screen, for a book I cannot edit. (`CharacterDetailView.tsx`'s comment says this was fixed by hiding *empty* tabs; it survives on tabs with content.)
- Map sidebar shows **ROUTES 0** and **REGIONS 0** as rows with chevrons — two dead ends per visit.
- The world-list card says **"Created Aug 9, 2026"** and **"41 characters"** for a book where I have met 10; the reading shelf right beside it correctly says "Chapter 7 of 117".
- The app greets a reader with *"A story bible for fiction writers"* and **Library** third of five buttons.
- The entire book is in the DOM at once (2.6M characters of `<p>` for Monte Cristo). The last commit measured and reasoned about this deliberately; I mention it only because it is what the phone is holding.

---

## 3. What I only suspect (not reproduced — treat as guesses)

- **The chapter bar on the dashboard.** It was there in my very first session immediately after download (`04-arrived.png`) and absent in ~10 later attempts on the same profile, cold and warm, with and without a trailing slash. It is present on every other route. Likely a mid-navigation render rather than a bug. Would be settled by instrumenting when `ChapterTimelineBar` mounts during the post-import navigation.
- **Scroll-driven reveal.** The gate is a high-water mark advanced by scroll position. 180,000 px of wheel took me from ch.15 to ch.34 in 7.6 s with no guard of any kind. I did **not** test a touch fling or a scrollbar drag, and a real reader's flick is far shorter than my wheel burst, so I cannot say a normal gesture over-reveals. Would be settled by measuring chapters-advanced-per-fling on a touch device, and by checking what a scrollbar drag does across a 1,918-screen book.
- **Search returning future chapter titles.** At ch.7, "Haydée" → *Ch. 49 — Haydée, Ch. 77 — Haydée*; "Danglars" → *Ch. 104 — Danglars' Signature*. Chapter titles are benign by the project's own documented rule (they are on the paperback's contents page), and chapter **summaries** were correctly withheld for those rows while shown for reached ones — careful work. Flagging only because searching a half-remembered name points you forward, which felt different from reading a contents page.

---

## 4. What worked — and should not be broken by any of the above

- **The Library.** Search by title/author, honest sizes on the button, per-book counts, a blurb, a rights notice per entry, and "Pictures load from the web" stated up front. 3.3 MB downloaded, imported and opened in **543 ms**, landing at chapter 1 rather than "all chapters".
- **Saying where I am is genuinely two taps.** Dashboard's *Set where you have read to* → *Read to here* on the row. Ch.7 was on screen without scrolling.
- **Coming back the next evening is the best thing in the app.** A fresh browser process at `/` showed a **READING** shelf with a progress bar and *"Chapter 7 of 117"*. Two taps and ~8 s later I was on the exact paragraph I had left ("No sooner had Villefort left the salon…").
- **The Read screen's orientation readout** — *"42% of the book · Chapter 47 of 117 · about 18 min left in it"* — is the right answer to the question a thick paperback answers by feel. **Contents** lists only chapters already read; clicking one scrolls without touching the gate; **Back to your place** appears and stands down correctly.
- **The gate held everywhere I pushed it, except through R3's descriptions.** The Arc grid is all `—` past the cursor; a future chapter opens to *"You have not reached this chapter yet… nothing from it is shown before then"* with the cursor unmoved; chapter-bar ticks read *"Chapter 30, moment 1 — not yet reached"*; a far jump there is guarded by a plain-English confirm.
- **Books with no text have no Read screen**, and the Library says so before you download.
- **The map's offline message** — *"This map's picture could not be loaded — it is kept on the web rather than in the book, so it needs a connection. Everything marked on the map is still here."* — is the best copy in the app. (The image failure itself is my container's network restriction, not a finding.)
- **Settings for a reader** is three sections and warns that re-downloading discards local changes.
- **"Who is Danglars again?"** took 2 taps and about 4 seconds. That is faster than flicking back two hundred pages, which is the whole point.
