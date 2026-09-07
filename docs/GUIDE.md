# PlotWeave — User Guide

**PlotWeave** is a local-first story bible for fiction writers. It tracks your
characters, timeline, maps, items, relationships, lore, and continuity as your
story evolves, stitches your scene prose into a manuscript, can build a whole
world from a draft or an AI assistant, and can carry a series forward into a
sequel — all stored privately in your browser (IndexedDB), with no account and
no backend. You can run it in the browser or as a desktop app.

This guide walks through every part of the app. All screenshots use the bundled
example world, *Middle Earth* (a Lord of the Rings sample you can import to
explore).

### What leaves your device

Your story never does. Worlds, scenes, images and every edit live in your
browser's own storage, and nothing is uploaded, synced or backed up anywhere —
which is also why exporting is worth doing.

**The app itself loads nothing from anywhere but itself.** No fonts, no scripts,
no stylesheets — so opening it offline behaves exactly as opening it online
does, and it paints without waiting on anyone. (It used to fetch a webfont from
Google Fonts on every page load, for a typeface it never actually used.) The
desktop build and the browser build behave the same way, with one exception
noted below: the library's own artwork.

**Pictures are the exception, and they are ordinary web requests that carry
nothing about your work.** A picture in PlotWeave is either a file you uploaded
— which lives in your browser's storage like everything else — or a **link** to
one somewhere on the web. A linked picture is fetched from wherever it lives,
each time it is shown, by your browser. Two things are linked:

**You can take a copy.** World settings → **Pictures** says how many of this
world's pictures are links and how many sites they come from, and offers to save
them into this browser. Afterwards they behave like an uploaded file: they work
offline, they travel in a `.pwk`/`.pwb` export, and they do not stop working if
the site takes them down. It is offered rather than done for you — linking is
what keeps a library download a few hundred kilobytes instead of tens of
megabytes, and the choice belongs to whoever is about to get on a plane.

Not every site allows it. A picture is *shown* by your browser without needing
permission, but *copying* one needs the site to allow it, and plenty do not.
Those are named in the summary afterwards, stay as links, and go on appearing
when you are online. Bear in mind, too, that linking to somebody's picture and
copying it into a file you then export are different acts, and only you know
what you are allowed to reuse.

- **Library cover images**, when you open the Library and scroll to a card.
- **The library's own artwork, in the desktop app only.** The browser build
  serves these from the same place it serves the app, so they are not a request
  to anyone else. The desktop app cannot: it has no site to serve them from, and
  carrying them inside the installer meant a download of well over a gigabyte
  for 33 books you may never open. So it fetches them from jsDelivr, a public
  mirror of this project's own files, pinned to the version you installed. The
  pictures are the same files either way.
- **Pictures inside the library worlds themselves.** These are linked rather
  than bundled: character portraits, location and item pictures, map images,
  faction and world covers. Across the shipped library that is just under
  1,700 images from around sixty different sites — Wikimedia Commons and
  Project Gutenberg for well over half of them, and a long tail of others. So
  opening a downloaded book contacts those sites for as long as the pictures are
  still there. A link that has since gone dead never breaks the screen: a map
  says so in [a bar above it](#maps) and keeps drawing your locations, routes
  and regions, and every other picture falls back to its icon.

**Anything you link yourself is your own responsibility.** Wherever the app
offers **link by URL** — a map image, a location or item picture, a portrait, a
cover — PlotWeave stores the address you gave it and fetches it when the picture
is shown. It does not check, host, cache or vouch for what is at the other end.
Whether you may use that image, whether the site is happy to serve it to you,
and what that site sees when your browser asks for it are between you and them.
If you would rather nothing left your device at all, **upload** the file instead
of linking it — an uploaded picture is stored locally and is never fetched.

---

## Table of contents

1. [Core concept: the time cursor](#core-concept-the-time-cursor)
2. [Getting started — the world selector](#getting-started--the-world-selector)
3. [The library](#the-library)
4. [Import a manuscript](#import-a-manuscript)
5. [Generate a world from AI](#generate-a-world-from-ai)
6. [Start a sequel](#start-a-sequel)
7. [The world dashboard](#the-world-dashboard)
8. [Timeline & scenes](#timeline--scenes)
9. [Chapter detail](#chapter-detail)
10. [Corkboard](#corkboard)
11. [Manuscript](#manuscript)
12. [Characters](#characters)
13. [Cast Balance](#cast-balance)
14. [Plot Threads](#plot-threads)
15. [Motifs & Themes](#motifs--themes)
16. [Structure board](#structure-board)
17. [Maps](#maps)
18. [Items](#items)
19. [Relationships](#relationships)
20. [Character Arc grid](#character-arc-grid)
21. [Lore](#lore)
22. [Factions](#factions)
23. [Knowledge](#knowledge)
24. [Search](#search)
25. [Undo, redo & recent changes](#undo-redo--recent-changes)
26. [Writer's Brief](#writers-brief)
27. [Calendar & character ages](#calendar--character-ages)
28. [Continuity Checker](#continuity-checker)
29. [World settings & export](#world-settings--export)
30. [Help](#help)
31. [Keyboard, screen readers and touch](#keyboard-screen-readers-and-touch)

---

## Core concept: the time cursor

Everything in PlotWeave is read *relative to a scene*. Scenes are the true units
of story time; chapters group those scenes for structure and reading order. The
pill next to the world name — labelled **All chapters** until you choose a moment
— and the scene bar along the bottom are two views of the same **time cursor**.
Use either one to move scene by scene. The whole app then answers *"what is true
at this exact moment?"*: where each character is, what they're carrying, who's
alive, which locations are destroyed, and how relationships stand.

State changes are stored as explicit **snapshots** tied to scenes. When an entity
has no snapshot at the selected scene, PlotWeave carries forward its most recent
state from earlier in that timeline. This is a delta model: record only what
changes rather than entering every character, item, location, and relationship
again at every scene. New chapters are seeded from the end of the preceding
chapter on the same timeline.

Changing the cursor never edits the story; it only changes the moment you're
viewing. You'll see the cursor on nearly every screen in this guide.

On a phone the pill keeps the **chapter number** and drops what it can afford to
— the scene title, and the clock icon beside it — because the number is the part
that still reads at that size. The full label is in the pill's tooltip, and on
the timeline it opens. The **X** that jumps back to *All chapters* appears from
390px up; below that, step back with the arrow or use the timeline.

The bar is there wherever the cursor means something — the Timeline, the
Corkboard, the Structure board, the Arc grid, the Calendar, the Lore roster, the
Maps and the Manuscript. It's left off the world dashboard and Settings, which
have no single moment in them, and off the lore page editor, which is a
full-height writing surface.

When you want the height back — on a map, or while writing — the **chevron at
the end of the bar's controls** rolls it up into a thin strip. The strip still
says which chapter and scene the cursor is on; click anywhere along it to bring
the bar back. It stays rolled up until you open it again, across screens and
between sessions.

![The chapter bar rolled up to a strip](images/62-bar-rolled-up.png)

---

## Getting started — the world selector

The first screen lists your worlds. The ways in are grouped by what you already
have:

- **Start something new** — **New World** for a blank story bible, or **Generate
  World from AI** to build one from a description.
- **Bring something in** — the **Library** of worlds built from published books,
  **Import World** for an existing `.pwk` file, or **Import Manuscript** to build
  a world from a draft.

Most books keep their maps and cover art on the web rather than inside the file,
so the card says **Pictures load from the web** — the book itself works offline,
and its maps will not draw without a connection. A few say **Embedded images**
instead: those carry their pictures with them, they come down with the book
rather than as a second download, and the size on the **Download** button is the
whole of what will be fetched — which for those is megabytes rather than
kilobytes. (For a world whose pictures are links, you can take a copy afterwards
from **World settings → Pictures**.)

**Import World** asks which files to choose before opening the picker: a `.pwk`
export on its own, or — if you exported with split files — the `.pwk` and its
`.pwb` images file together.

Importing a world you already have **replaces it**, which is what you want when
you are restoring a backup and emphatically not what you want when you pick the
wrong file. So it asks first, naming the world it would overwrite: *Replace your
copy of "Highbarrow"?* Backing out changes nothing. Only the world in the file is
affected either way — your other worlds are untouched.

With nothing on the shelf yet, the page names the two routes most people want
first — **New World** to start from scratch, and the **Library** to open a world
built from a published book — and points at the groups along the top, rather
than repeating buttons that are already on screen.

![Empty world selector](images/01-home-empty.png)

Once you have worlds, each appears as a card with its name, date, and
description. Click a card to open it; the ⋯ menu on each card exports or deletes
that world.

Books you are reading are kept on their own shelf. As soon as one world is in
[reading mode](#reading-alongside-a-book), the selector splits into **Your
worlds** — the ones you are writing, where the *Start from scratch* tile lives
(it opens the same dialog as **New World** at the top of the screen) — and
**Reading** below it, so a shelf of downloaded books never buries your own work.
Turning reading mode off in a world's settings moves it back up to *Your
worlds*, since at that point you are editing it rather than reading it. With
nothing in reading mode there is only one list and no headings at all.

**Once a book has your place in it, its shelf comes first.** Downloaded and
never opened, it stays below — but the moment a book knows which chapter you are
on, it is what you came back for, and on a phone that is the difference between
your book being on screen and being a scroll away. Your drafts are still there,
directly beneath.

Each card carries the world's name, a date, its description, and how much is in
it — chapters and cast — so you can tell two drafts apart without opening either.

**The date says which kind it is.** A world you have worked in reads *Edited 26
Aug 2026*; one nothing has happened to since you made it reads *Created*. That
is not a guess: PlotWeave keeps a journal of every edit you make (the same one
[undo](#undo-redo--recent-changes) reads), so "last worked on" is a fact it
holds rather than something inferred. Where the journal has nothing to say — an
imported world, or a library book, both of which start a fresh history — the
card says *Created* rather than printing a date it cannot stand behind.

**The world you last worked in is listed first**, which is the same date the
card prints, so the order explains itself. This matters for library books: a
downloaded world keeps the date written into the file it came from — every
shipped book is dated in the past — and has no edit history of its own, so a
book you fetched this morning sits by its own age rather than at the top, and
anything you have actually written in leads.

![World selector with worlds](images/02-home-worlds.png)

### Set up a blank world

When you create a blank world, PlotWeave opens a four-step setup guide. It helps
you create the first timeline and scene, add a main character, place that
character at the opening moment, and then continue to the Timeline. Each optional
step has **Skip** so you can leave the guide and build the world in any order.

**The guide keeps its place.** Close the tab or reload the page part-way through
and it comes back on the step you were on, with what the earlier steps made
still there. And once you have finished it or skipped it, it stays gone — it
won't reappear on that world.

The four steps are named across the top — *Begin your story*, *Add a character*,
*Place them in the story*, *Done* — so you can see what the guide will ask before
you agree to any of it. On a phone only the step you are on is named; the numbers
and ticks still show where you are. Step 1's button reads **Create and continue**:
it makes what you have just named and moves the guide on.

Step 1 asks for two names — the **timeline**, meaning the stretch of time your
story runs over, and the **first scene**, the moment it opens on — and says what
it will build from them: the timeline, a *Chapter 1* inside it, and that scene
inside the chapter. All three can be renamed later — the scene from its own
card, the chapter from **Rename chapter** in its ⋯ menu on the Timeline, and the
timeline from its tab (which appears once a world has more than one). PlotWeave then moves the
[time cursor](#core-concept-the-time-cursor) to that scene, so when the guide
hands the app back, everything that answers "what is true right now?" already has
an answer.

Once you are past step 1, each step carries **← Back a step** beside its Skip
link, so you can look at what you have done without leaving the guide. Going
back does not undo anything: a step you have already completed shows what it
made — *your story opens on The wreck* — with a **Continue**, rather than
offering the form a second time and building it twice.

While the guide is on screen it takes the middle of it, and the navigation rail
steps back so the next thing to do is the clearest thing to see. The rail is
dimmed, not disabled: hover it and it returns to full strength, and every screen
on it is one click away throughout. Wandering off to look around is a perfectly
good way to start — the guide is an offer, not a gate.

![Blank-world setup](images/38-onboarding.png)

---

## The library

**Library** on the world selector lists worlds built from published
books and downloads them straight into your browser. Nothing is uploaded and no
account is needed — a downloaded world is an ordinary world you own outright,
which you can edit, export, or delete like any other.

The catalogue is **listed alphabetically**, filed past a leading *The* or *A* as
a shelf would — most of these titles begin with one, so *The Woman in White*
sits under W rather than in a run of fifteen books under T. **Search** narrows it
by title or by author, so "dumas" finds both his, and accents are ignored:
"bronte" finds Brontë. **Escape** closes the Library, and closes the replace
confirm first if that is showing.

Each entry shows its cast, chapter and scene counts, and the download size. Map
images and portraits are a separate, much larger download, so they sit behind
their own button rather than coming along by default — useful if you're on a
phone.

Books whose cover is a linked image show it on the card. **These are the only
pictures in PlotWeave that are not on your own machine.** The cover is fetched
from wherever it is hosted — currently 26 of the 33 entries, from a mix of
Wikimedia Commons, Project Gutenberg, and a few commercial sites — so opening
the Library asks those hosts for an image, and they see your IP address and that
you opened it. Nothing about your worlds is sent, and nothing is uploaded; it is
an ordinary image request, of the kind any web page makes. Cards load lazily, so
only the ones you scroll to are fetched, and a card whose cover cannot be loaded
simply goes without one rather than showing a broken frame. Books whose artwork lives inside the image bundle stay
text-only here: opening the catalogue is not the same as asking for a book, and
pulling tens of megabytes down to decorate a card you may scroll past would make
it so.

### Reading alongside a book

Library worlds arrive in **reading mode**, which is what makes them safe to open
while you are still part-way through the book. A book you have just downloaded
opens at its first moment rather than fully revealed, so nothing is given away
before you have read a word.

**PlotWeave remembers your place in each book.** Close one, read another, come
back a week later — the cursor is where you left it, and the world card on the
shelf says *"Chapter 5 of 17"* with a progress bar so you can see at a glance
how far into each you are. If you deliberately choose **All chapters**, that is
remembered too: coming back shows you the whole book again rather than quietly
re-hiding it, and the progress bar disappears, because seeing everything is not
a place in the story.

Set the chapter cursor to where you have read up to, and PlotWeave hides
characters, items and places the story has not introduced yet — everywhere, not
just on one screen. The Characters page in chapter one shows the handful of
people you have actually met, with a note saying how many are still to come, so
a short list reads as deliberate rather than broken. Move the cursor forward and
they appear, in the order the book introduces them.

The same cut-off applies across the app: the timeline stops at your place and
keeps later chapter summaries back, lore pages wait until you have met what they
are about, and a knowledge fact stays hidden until the point the reader is meant
to learn it. A character's page shows where they stand now rather than every
chapter still to come, and the map list holds back the maps for places you have
not been to yet. Subplots and motifs are named for where they end up — *The
Philosopher's Stone Mystery* gives away a book on its own — so they wait for
the first scene that takes them up. **Search** answers on the same terms — it will not find a
character you have not met.

Chapter *titles* stay visible throughout — they are printed on your own book's
contents page, so hiding them would gain nothing. One thing the cut-off cannot
do is edit prose: if a place you *have* reached is described in a sentence that
names one you have not, that sentence is shown as written.

The rest follows the same rule PlotWeave always follows: everything is shown
relative to the cursor, so you can ask *where is everyone, who knows what, who
has met whom* without being told anything that happens later. Summary figures
that would give the game away — the alive/dead split on the dashboard, for
instance — are simply not shown while reading.

Selecting **All chapters** reveals everything. That is a deliberate choice you
make, not the default — and while reading, PlotWeave asks before doing it, since
the control is a small ✕ beside the cursor and one stray click would hand you
the whole book. Stepping the cursor back never asks: it only ever un-reveals.

### What reading mode puts away

Reading mode also clears out everything that only makes sense to the person
writing the book, so what is left reads as a companion rather than a workspace
you have wandered into.

The writing screens — Manuscript, Structure and the Corkboard — step aside, and
their addresses close with them: typing one in takes you back to the dashboard
rather than into a screen the book is not yours to edit from. Undo, redo, Recent
changes, the Writer's Brief and the Continuity Checker leave the top bar (and
Ctrl+Z along with them), and the dashboard drops its continuity card and its
snapshot-coverage figure. No
screen offers to add, generate or delete anything: no **Add Character**, no
**New Page**, no **Generate with AI**, no delete buttons on cards, rows or map
layers. The Calendar stops inviting you to drag a scene onto a different day,
and the map's character panel shows what is recorded rather than offering to
change it.

**Telling it how far you have got** is two taps: open the Timeline and press
**Read to here** on the chapter you have reached. The reading notice on the
dashboard links straight to it. The previous/next steppers in the top bar work
too, but they move a scene at a time, so they are for nudging along rather than
for jumping.

**Your place in the book is yours to move.** While reading, only the controls
that say they move it do: the previous/next moment steppers, **Read to
here** on a chapter row (a writer sees the same control as *View from here*,
because for them it moves a viewfinder rather than a bookmark), and **play**,
which is the same thing on a timer — it walks your place forward a scene at a
time and reveals each one as it arrives, in every bar scope including a merged
view of several timelines. Looking at something — a scene on the Calendar, a
search result, a stop on a character's journey, a row in their history — shows
it to you without quietly relocating your bookmark. Where a control's only job
was moving the cursor, it becomes a label rather than a button, so nothing on
screen looks pressable and does nothing.

**The workbench steps aside too.** The Timeline's pacing curve and its
plot-thread filter are the author's instruments — the curve plots ratings you
cannot see or set, and a thread's name is the author's shorthand for an arc,
which on a subplot you are seven chapters into is a summary of where it goes. So
neither is offered while reading, and the chapter list starts at the top of the
screen, which matters most on a phone. A character's tabs work the same way: one
with nothing behind it is not offered, because *none* is an answer to a writer
and a dead end to a reader.

**A chapter's one-line summary is shown on a phone**, wrapped onto its own line
under the title rather than dropped for want of room. It is the answer to "what
happened in chapter 3 again?", which is the question the screen exists for.

**The words change with you.** A character page leads with the description
rather than with the colour PlotWeave draws them in, and the search box offers
to search *this book, as far as you have read* rather than "your world and the
prose you wrote" — which matters, because a word from three chapters ahead
really does return nothing, and the honest reason is not "no results".

**Help knows which of the two you are.** While reading it opens with **Reading a
book** — where your place is kept, how to move it, what the ✕ beside it does, and
what is being held back — and leaves out the sections describing screens reading
mode has taken away.

**Showing the whole book asks first.** The ✕ beside your place — in the top bar,
and in the chapter bar along the bottom — drops back to the full world, every
character, place and subplot the story has not introduced yet. While reading
that undoes the thing reading mode is for, so both of them ask before doing it,
and both offer to step the cursor instead. While writing, where "all chapters"
is just the default view, it stays a single click.

**The chapter bar shows numbers, not titles, for what you have not read.** Along
the bottom of the screen a chapter you have reached carries its title, and one
you have not carries only its number; the scenes inside it are named by their
position — *"Chapter 9, moment 1 — not yet reached"* — rather than by what
happens in them. A chapter title is often the event itself, and dimming one you
can still read is not hiding it.

**Skipping ahead asks first.** Moving your place on into the next chapter, or
back to any chapter, happens the moment you click. Jumping two or more chapters
forward asks — it will show you everyone and everywhere the story introduces in
between. Coming back hides them again; what it cannot do is unshow them.

**A chapter you have not reached yet does not open.** On the timeline its row
does not expand — the scene list inside would name what happens in it — and its
summary stays hidden, as it always has. The chapter's own title stays visible,
because that is printed on your book's contents page.

Opening it directly says so and offers the way back, rather than showing you the
scenes, the character states and the summary of a chapter you are still ten
evenings away from — and the same
holds for a character, an item or a lore page you have not met, however you
arrive at it. A chapter you *have* reached opens fully, and the author's notes
on it are shown as writing rather than as a box to type in.

The map is read-only in the same way, including the parts you change by hand
rather than by button: location pins and character pins cannot be dragged to
new positions, characters cannot be dragged onto the map from the sidebar or
placed with the crosshair, and right-clicking the canvas no longer offers to add
a location, label, route or region.

Opening a character or a place on the map **shows** what is recorded at the
current moment — alive or dead, where they are, what they carry, the journey
they made and the author's notes on it — and offers no way to change any of it.
The empty boxes go with the rest: a note nobody wrote is simply absent rather
than an invitation to write one.

You can still pan, zoom, drill into sub-maps, follow journeys and export the map
as a PNG — everything that reads it.

The dashboard becomes a way in rather than a progress report. Recent Scenes,
Scene Status, Writing Progress, Cast Balance, Plot Threads and Motifs all
measure the manuscript rather than the story, so they go, and the tiles stop
talking about *your* cast and *your* catalogue — they count what you have met
so far. It also says outright that reading mode is on, where you have read up
to, and what that is currently keeping back — *12 characters, 4 places and 2
items you have not met* — with a link to the setting that turns it off. It is
the screen the Library lands you on, so it is the one that should not leave you
guessing what changed.

![The dashboard in reading mode](images/61-reading-mode-dashboard.png)

Detail screens show the same information without the editing furniture. A
character's page is read straight through — their description, where they
stand, what they carry, their goals, relationships and factions — with no Edit
button and no form fields. Lore pages render as articles. A knowledge fact shows
what it is and who knows it, without the controls that set when the reader is
let in on it. On the map you can still measure distances and export the picture;
you cannot move a marker, relabel it, or replace the image.

**Settings** keeps only what a reader can decide — the theme, and whether to
carry on reading this way. Travel speeds, the continuity threshold, word target
and deadline, the calendar's own definition, folder sync and the HTML export
all describe the draft rather than the story, so they wait. (The HTML export
would write out the whole world regardless of your chapter cursor, so offering
it here would hand you the ending in a file.)

To edit a world anyway, turn reading mode off in **Settings**. Everything comes
back exactly as it was.

The library worlds carry **no text from the books**. They are structural
references only: characters, chapters, scenes, places, relationships and lore.
They are unofficial and fan-made, and are not affiliated with or endorsed by the
authors or publishers.

Chapters are named as the book names them, including where the book uses only
numbers or its own divisions — *Chapter IV*, *Letter II*, *First Period — The
Loss of the Diamond: Chapter 1*. Two books number their chapters without naming
them and would be hard to navigate that way: *Jane Eyre* and *The Odyssey*.
Those carry descriptive names written for the example, and each says so on its
own **Lore** page, so you can tell an author's title from ours.

### Reading mode on your own world

Reading mode is a per-world setting, so it works on anything — not just library
worlds. Turn it on in **Settings** before handing a world to a beta reader and
they can follow along without the ending being spoiled by the cast list.

> **Note:** downloading a world you already have **replaces** your copy and
> discards any changes you made in it, so PlotWeave asks first. Use it
> deliberately when you want the original back.

---

## Import a manuscript

Already have a draft? **Import Manuscript** (on the world selector) turns it into a
new world in one step, so you don't have to re-enter every chapter by hand. It's
the mirror image of the manuscript *export* — bring a draft in, and everything
else (word counts, continuity, pacing, the reading view) works on it immediately.

Choose a `.md` or `.txt` file, or just paste your text. PlotWeave parses it with
a few predictable rules:

- **Chapters** — a Markdown `#`/`##` heading, or a line that starts with
  *Chapter*, *Prologue*, *Epilogue*, or *Part*, begins a new chapter. A `Chapter 7:
  The Reckoning` heading keeps *The Reckoning* as the title.
- **Book title** — if the file opens with a single `#` heading (your title) followed
  by a chapter, that heading becomes the world's name rather than a chapter.
- **Scenes** — a line of only symbols — `* * *`, `***`, `---`, a lone `#` — splits a
  chapter into scenes. Paragraph breaks inside a scene are preserved. Prose before
  the first heading becomes an untitled opening chapter.

A live **preview** shows exactly how it will land — chapter, scene, and word
counts, plus the chapter list — before anything is created. The world name is
prefilled from a detected title (edit it if you like), and **Import** drops you
straight into the new world.

![Import a manuscript](images/22-import-manuscript.png)

Each parsed scene becomes a scene with its prose attached, so the imported draft
flows straight into the Manuscript view and reads back as one continuous document.
(Import handles Markdown and plain text today; `.docx` is planned.)

---

## Generate a world from AI

If your story lives in your head or in a synopsis rather than a finished draft,
**Generate World from AI** builds the whole structure — characters, factions,
relationships, chapters, scenes, and who-knows-what — from a story document, using
any AI assistant (ChatGPT, Claude, Gemini…).

![Generate world from AI](images/23-generate-ai.png)

1. **Copy the prompt** from the dialog and paste it into your AI assistant,
   followed by your story text.
2. The assistant replies with a compact JSON **story spec**.
3. **Paste that JSON** back into the box in the dialog. A live preview shows what
   it found — character, chapter, scene, and faction counts. A ```` ``` ```` code
   fence around the answer is stripped for you, so paste it exactly as given.
4. Click **Import world** and you land in the finished world.

The prompt deliberately asks for a *compact* spec — entities are referenced by
**name** rather than long ids, and a character's state is recorded only when it
**changes** (they appear, move, gain or lose an item, or die). That keeps the
AI's output small, so even a full novel fits in one response without getting cut
off — PlotWeave expands the compact spec back into the full model on import, so
nothing is lost.

> **Tip:** you don't need a polished manuscript. A detailed synopsis, an outline,
> or a wiki-style summary all work — the more detail you give, the richer the
> generated world.

---

## Start a sequel

Writing a series? **Start a sequel** builds book two (or three…) from an existing
world, so you don't rebuild your cast and setting from scratch. Find it on a world
card's menu (the ▾ next to Export) on the world selector.

![Start a sequel](images/25-start-sequel.png)

A wizard lets you choose exactly what carries over — everything is selected by
default, and you tick off what doesn't return:

- **Characters, factions, items, and maps** — pick which come along. Each is
  copied with a fresh identity into the new book (portraits and map images
  included).
- **Relationships continue** — a carried-over relationship starts book two in the
  state it *ended* book one (its final label, sentiment, and strength), and each
  character arrives at their book-one ending status (alive or dead).
- **“Previously…” lore** — optionally turn book one's chapters into a recap: one
  lore page per chapter, grouped in a *Previously — {book one}* category. Your
  existing world-building lore can carry forward too.
- **Seed an opening chapter** — optionally start book two with an opening chapter
  in which every returning character is already placed at their book-one ending
  location and inventory, so continuity is wired from page one.

The sequel is a **copy**: it's a fully independent world, so editing it never
changes the original. Book one's chapters, scenes, and scene prose are *not*
copied — book two is a fresh narrative that begins where the last one left off.

---

## The world dashboard

Opening a world lands you on its dashboard — a bird's-eye view of the whole
project. Stat tiles summarise the timeline, cast, maps, relationships, items,
snapshot coverage, and continuity status. The cast tile's **alive and dead
split is as of the moment you are on**, like everything else in PlotWeave — move
the cursor back before a death and the count moves with you. Below them are recent scenes, scene
status, writing progress, and analytics panels (Cast Balance, Plot Threads, and
Motifs & Themes, covered later). Worlds with linked timelines also show a
**Timeline Links** summary.

**Recently edited** lists the five scenes you changed last, each with how long
ago — so the order reads from the rows rather than from the columns they fall
into. The **Snapshot coverage** tile shows how much of the story has state
recorded against it, and opens the [Character Arc grid](#character-arc-grid),
which is where you fill the gaps in.


![World dashboard](images/03-dashboard.png)

The tiles are links — click **Timeline**, **Characters**, **Maps**, or any other
tile to jump straight to that area.

### Getting around

Every screen in a world shares a **left navigation rail**. By default it's a slim
strip of icons to keep your workspace wide; **hover** it to slide out the full
labels, or click the **pin** at the bottom to keep it expanded. The everyday
screens (Dashboard, Timeline, Manuscript, Characters, Maps) sit above a **More**
divider, with the rest below.

![Navigation rail](images/37-navigation.png)

On a phone the rail is replaced by a **☰ menu** in the top bar. The top bar
itself keeps the world name, the [time cursor](#core-concept-the-time-cursor),
search (**Ctrl/⌘ K**), and the Writer's Brief, Continuity, and Help tools.

**An empty section tells you what to do about it.** Wherever a list or panel has
nothing in it yet, it says what belongs there and offers the way to put it there
— the control itself if the thing can be made from where you are, or a button to
the screen that makes it if it cannot. A character with no scenes, for instance,
offers **Open Timeline**, because a character joins a scene from the scene. The
exception is when the control is already sitting right beside the empty list: a
*+ Add character…* picker under an empty cast says both that it is empty and what
to do, so nothing repeats it.

**A greyed-out button tells you why.** Where an action needs more than one thing
before it can run — *Save route* wants a name *and* two points, the relationship
dialog wants two different characters *and* a label — a short line beside it says
what is still missing, all of it: *"Needs a name and two points."* It narrows as
you fill things in and disappears the moment the action is free, so it is never
standing text you have to read twice.

### Writing progress

As you write scene prose (in the Manuscript view), PlotWeave keeps a lightweight
per-day log of the words you add or cut. The **Writing Progress** panel on the
dashboard turns that into an at-a-glance readout:

- **Total words** across the whole manuscript.
- **Words today** — the net change since midnight (green when you've added).
- **Day streak** — consecutive days you've written; a blank day today doesn't
  break a run you're still in the middle of.
- A **daily session goal** — set a per-day word goal and a ring fills as you
  hit it today.
- A **burndown bar** against your book **word target** (set it under
  *Manuscript* in [World settings](#world-settings--export)), showing percent
  complete and words to go.
- A **14-day strip** of daily output so you can see your recent momentum.

![Writing Progress](images/44-writing-goals.png)

### Deadline & projection

Give the book a **deadline** (also under *Manuscript* in World settings) and the
panel adds a forecast: the **words/day** you'd need to finish on time, and — from
your recent pace — a **projected finish date** with an **on track** / **behind
pace** badge. It's an honest read on whether your current rhythm will get you
there.

The log, target, and deadline all travel with the world through export/import, so
your streak and history survive a backup or a move to another device.

---

## Timeline & scenes

The Timeline is the spine of your story: a list of chapters, each holding an
ordered set of **scenes** (scenes/beats). A **pacing curve** across the top plots
dramatic tension chapter by chapter once you rate scenes, so you can see the
shape of your story at a glance. Until you have rated something there is no
curve to draw, so the panel is a single line telling you where the ratings live
rather than an empty grid; the plot appears with the first rating. It is drawn
at a fixed width per scene and its panel is only as wide as the curve needs, so
an early draft gets a small chart rather than a small chart in a very large
frame; on a long book the panel takes the full width and the curve scrolls
inside it.

![Timeline view](images/04-timeline.png)

- **Narrative vs. Chronological** — toggle between the reading order and the
  in-world order (useful when you use flashbacks or in-world dates).
- **Add Chapter**, **New Timeline** (for alternate/parallel timelines), and
  **Generate with AI** all live in the header.
- Click a scene to move the time cursor to that exact moment. Each chapter row
  also has an **open** button for its detail page, and chapters can be dragged to
  reorder the narrative.
- **The ↑ ↓ arrows on a scene move it, including out of its chapter.** At the
  top of a chapter, ↑ moves the scene to the end of the one before; at the
  bottom, ↓ moves it to the start of the one after, and the button says so
  before you press it. Only the very first and very last scenes in the book have
  nowhere to go. This does the same thing as dragging a card on the
  [Corkboard](#corkboard), so either route is fine — the arrows just don't need
  a mouse.
- **View from here** on a chapter row moves the time cursor to that chapter's
  first moment; it reads **Viewing** while the cursor is inside the chapter, and
  pressing it again goes back to *All chapters*.
- **Every chapter row says how much chapter there is** — *3 scenes · 1,240
  words* — without opening it. A chapter you have outlined but not yet written
  shows only its scene count, and an empty one says *No scenes*. Beside the
  counts, a status pill rolls the chapter's scenes up to the **least advanced**
  of them: four Final scenes and one Idea reads *Idea*, because the chapter is
  not finished until all of it is. Hover the pill and it tells you which of the
  two it means — *Every scene is Final*, or *Least advanced of 5 scenes: Idea*.
- **A scene's ⋯ menu also moves it.** *Move to chapter…* sends the scene to
  another chapter of the same timeline, picking from a filterable list — the
  same act as dragging it on the [Corkboard](#corkboard), for when you are
  already looking at the scene. The chapter it is in is not offered, since that
  is not a move.
- **Deleting is always one step in.** A chapter row, a scene card, a character's
  header and a lore card each carry a **⋯** menu, and delete lives inside it,
  set apart and in red. Nothing destructive sits in the row beside the everyday
  controls, so there is no trash icon to catch a stray click on the way to
  *open* or *move earlier*. The menu opens by click or by pressing **↓** on it,
  and **Escape** closes it and puts focus back.
- Select scenes with their checkboxes; **Shift+click** selects a range. The bulk
  toolbar can move the selection to another chapter, add a tag, or delete it.
- The chapter bar at the bottom of the screen also lets you **play the story**
  and **Compare chapters** — a diff of exactly what changed between any two points
  (who moved, gained or lost items, died, or shifted relationships). It appears
  as soon as there are two chapters to compare, and opens with both sides
  already chosen. What it reads is the **state recorded at each chapter's last
  scene** — not the prose: two chapters full of writing but with no character
  states set will tell you there is nothing recorded to compare, rather than
  that they are the same. A changed **status note** is shown in full, the old
  version above the new one, since a note is the one thing in that list long
  enough to need the room.

![A chapter row's menu](images/58-row-menu.png)

### Multiple timelines and timeline relationships

Creating another timeline adds a tab at the top of the Timeline page. Beside
each timeline's name is what it holds — *2 chapters*, or *2 chapters · Ch.
12–13* where its chapters do not begin at one, which is common in an imported
world or a book kept in two halves. Without the span, a timeline labelled *10
chapters* opening at Ch. 12 reads as eleven chapters gone missing.

Use **Timeline Relationships** to describe how two timelines connect:

- **Frame Narrative** — an outer timeline tells or contains the inner story.
- **Historical Echo** — the same places or patterns recur in different eras.
- **Embedded Fiction** — a story, play, prophecy, or document inside the world
  constitutes another timeline.
- **Alternate** — the timelines branch from similar conditions toward different
  outcomes.

Choose an **Outer / Source** and **Inner / Target** timeline, then add optional
character, location, or document anchors. Frame narratives can also use **sync
points**: pair a scene in the inner story with one in the outer story so playback
keeps the framing moment aligned.

![Timeline relationships](images/39-timeline-relationships.png)

**Frame narratives** get a special bottom cursor: two stacked tracks (outer and
inner). Click either track to make it active; playback follows that track while
keeping the linked one available for context. The outer track is the thinner of
the two, but it is not the poorer one: both read *number · chapter title*, and
both give the full title on hover where it has to be shortened.

Each track has its own **play** button, named for the track it moves — *Play The
Attic*, *Play The Tale* — so the two are not the same control twice. The inner
track is the story; the outer one frames it.

**Sync points** keep the frame in step with the tale. Whenever the cursor lands
on an inner moment that is paired with one in the outer story — by playing, by
clicking the scrubber, or with the previous/next arrows — PlotWeave moves the
outer moment to match, so the [map](#maps) can show the outer timeline's cast as
**ghost pins** beside the inner one. Between pairings the frame moment *holds*:
the teller stays where they were until the story reaches the next moment that
moves them, rather than the frame's cast blinking out on every unpaired scene.
Before the first pairing there is no frame moment in force.

The pairing works in that direction only, which is what it is for: the frame's
cast is drawn beside the tale while you are reading the tale.

**Paired moments are marked on the bar.** Both ends of a sync point carry a
small dot above their tick, and hovering one says *paired with a moment on the
other track* — so you can see which moments are linked without opening the
relationship editor to read the list.

Every **other multi-timeline world** uses a single-height bottom bar with a
**scope selector** on its left. Choose one timeline to scrub it on its own, or
pick **All · Chapter order** / **All · Chronological** to merge every timeline
into one strip — each chapter run tinted with its timeline's colour, and the
active scene's panel showing which storyline it belongs to. The scope is
remembered between sessions.

**Chapter order** follows chapter numbers across all timelines, so a book
numbered straight through (e.g. book III = ch. 1–11, book IV = ch. 12–21) reads
in order from chapter 1. **Chronological** order instead follows the in-world day
each scene happens.

**Play** works in every scope, always on the map. On a single timeline it's the
usual animated run (characters move along their trails). In a merged view it
plays through the whole sequence and the **map follows each scene's own
timeline** — as the cursor crosses from one storyline into another, the map
switches to that timeline's cast and animates their movement. Chronological order
braids the storylines, so the map alternates between them as their scenes
interleave.

![The multi-timeline bottom bar scope selector](images/49-timeline-bar-scope.png)

#### All timelines — the real sequence across storylines

Each timeline numbers its chapters on its own and keeps its own in-world clock,
so switching between tabs never shows how the storylines actually interleave.
The **All timelines** tab (it appears alongside your timeline tabs once you have
more than one) merges every timeline into a single sequence, with the same two
orders as the bottom bar: **Chapter order** (reading order, following chapter
numbers across all timelines) or **Chronological** (every scene ordered by the
in-world day it happens; each timeline's clock starts at day 0, or at the
**start day** you give it in [World settings](#world-settings--export) for
multi-era stories). The toggle
here and the bottom bar's scope selector are one setting — change either and
both follow, and your choice is remembered between sessions. Each row is tagged
with a coloured dot, its timeline name, and its chapter, so you can read the
true order of scenes across parallel POVs or braided plots at a glance. Click
any row to move the time cursor to that moment.

![All timelines combined view](images/47-all-timelines.png)

### Chapter detail

Opening a chapter **puts you in it** — the time cursor moves to that chapter's
first scene, so the Writer's Brief, the character states and everything else
per-moment have something to answer about straight away. If your cursor is
already on a scene inside that chapter, it stays where you put it; and while
[reading](#reading-alongside-a-book) nothing moves at all, since there the cursor
is your own place in the book.

**The chapter's title and synopsis are both edited in place**, at the top of the
screen — click either line and type. Renaming used to live only on the chapter's
row back on the Timeline, which in a long book meant going back and finding the
row; both are here now, and a blank title is refused rather than written.

The synopsis is the one-liner you set when the chapter was made, and it is no
longer set-once: a chapter created by the first-run guide, which never asks for
one, can be given a synopsis here like any other. Both fields auto-save as you
type, one undo step per burst. The synopsis is worth keeping current: it prints in the [Manuscript](#manuscript) in draft mode, in the
[Writer's Brief](#writers-brief), on the chapter row in the timeline, and it is
searchable. While reading, it is shown rather than editable.

An expanded scene card leads with the **scene draft** — the prose itself — and
puts the one-line **Description** below it. An empty description is a control
rather than a note: click it and the card opens for editing with the field ready.

**Type `@` while writing** to name a character, an item or a place. Pick one and
its plain name goes into the prose — no `@tokens` in your manuscript — and it is
recorded against the scene: a character joins the scene's *mentions*, an item
joins its items, and a place becomes the scene's location if it hasn't got one
already. Every row says which kind of thing it is, since a world can hold a
person and a place of the same name.

If nothing answers what you've typed, the last rows offer to **make it**:
*new character*, *new item*, *new place*. The record is created and attached in
one step, so a name you invent mid-sentence doesn't cost you the sentence. A new
place needs somewhere to be a pin, so that row appears only once your world has
a map — [places go on maps and sub-maps that already exist](#maps), and nowhere
else. The prompt inside the empty box says which kinds are on offer, so it never
names a place in a world that cannot hold one. Where there is a map, the pin
lands in the middle of it, ready to be dragged where it belongs; if the scene
already has a place, the new pin goes on that place's map rather than the
world's first.

**Enter completes a name; it never invents one.** With the picker open, Enter
takes a row for something that **already exists** — that only types the name you
were already writing. To *create* a character, item or place from the picker,
press **Tab** or click the row: making a record changes your world, and Enter
means "new paragraph" in every prose editor there is. So writing *"…knew every
stone of @Wenmere"* and pressing Enter starts your next paragraph and leaves the
`@Wenmere` you typed as ordinary text, rather than quietly adding a character
called Wenmere to your cast. **Escape** puts the picker away and leaves
everything alone.

**Names with spaces work.** Keep typing past the space and the picker follows
you — *Ysolde Vane*, *Barrow-wight*, *O'Brien* — so the record you make carries
the whole name rather than the first word of it. It knows where a name ends the
way you do: a capitalised word carries on the name, and the first ordinary word
puts the picker away and gives you back the sentence. So `@Ysolde Vane` is
offered as a person to create, while `@Ysolde waited` is just something you
wrote. A lowercase particle is fine when it belongs to someone who already
exists — typing `@Renée de` still finds *Renée de Saint-Méran*.

**A blank line starts a new paragraph — a single Enter does not.** One newline
keeps you in the same paragraph, which is what lets you paste prose from a text
file or a PDF, hard-wrapped at whatever column it came in at, without it
becoming one paragraph per line. The line under the box counts them as you type,
so you can see which you have: press Enter once and it still says *1 paragraph*,
press it twice and it says *2*. The [Manuscript](#manuscript) and every export
read your prose the same way.

The draft **auto-saves as you write**: a second's pause writes it, and it is
written again when you collapse the card or leave the chapter. The line under
the box says which of the two states you are in — *Saving draft…* while there is
something not yet written, *Draft auto-saved* once there is not — so you can close the
tab on a paused sentence without losing it. Saving repeatedly does not fill
**History** with near-identical versions; those are grouped into one entry per
writing session.

PlotWeave also reads the draft for **names you have written but not recorded**.
Anyone in the cast whose name appears in the prose, and who is not already on
the scene, is offered as a chip under the box — click it to add them. The match
is on the name as written: the full name, and the first word of it, as whole
words and case-sensitively, so the verb *will* never stands in for a character
called *Will*.

Three rules shape what counts as a match.

- **What you wrote in *Also known as* is used first.** If a character's aliases
  say the prose calls Barliman Butterbur *Butterbur*, that is what is looked
  for. Nothing overrides it.
- **A form of address is never treated as the name.** *Mrs Bennet* is looked for
  as **Bennet**, *Dr Henry Jekyll* as **Henry Jekyll**, **Henry** or **Jekyll** —
  otherwise one "Mrs." in a paragraph would offer every Mrs in the book at once.
  A name beginning with *The* — *The Sorting Hat* — is looked for whole, minus
  the article.
- **A name two characters share identifies neither.** *Sarn* finds Teodor Sarn
  while he is the only Sarn; add a second and the surname stops being offered
  for either of them, though both full names still match. The same goes for a
  shared first name — two Johns, and *John* on its own means nobody.

That last rule depends on the rest of your cast, so adding a character can
quieten a nudge elsewhere. If a short name really does mean one particular
person, say so in their **Also known as** — a stated alias is never dropped.

**Edit title & description** opens the card for editing — the title, the
description, and the cast, items, location and tags below them, all committed
together by **Save** (or the ✓ in the header). In the title field, **Enter**
saves and **Escape** backs out, the same two keys that rename a chapter. Moving
to another field does *not* save, because one Save writes the whole card; a
blank title is refused, so pressing Enter over a selected title cannot wipe it.


Opening a chapter shows its scenes in order, each with the characters involved,
location, tags, and draft/written status. The right side holds a live
**Character States** panel, a **Relationship States** summary, and a freeform
**Writer's Notes** field that auto-saves.

**Character States is about the scene.** Each scene lists its own cast and the
state recorded for each of them — and a cast member with nothing recorded yet is
shown as *in the scene, no state recorded*, rather than left out. Everyone else
in the world is folded into a single line at the bottom (*"36 other characters
not in this chapter"*) which you can open when you want it. A chapter with nobody
in it says so instead of showing a blank column.

**And it takes the answer.** Click a *no state recorded* row and a short form
opens in place: **alive or deceased**, **where they are**, and a **note** for
this moment. It arrives filled in from where that character was last recorded —
saying so, so you can tell it apart from something already written here — which
makes confirming that somebody hasn't moved a single click. Saving pins it to
that scene and nothing else.

Those are the three questions worth asking while you're reading down a scene's
cast. Everything else about a character at a moment — what they're carrying, how
they travelled, whether they came back from the dead — lives on **Current
State**, which the form links to as **Full editor**. What the short form doesn't
ask about, it leaves exactly as it was.

![Chapter detail](images/05-chapter-detail.png)

**A scene card shows what it holds.** A scene can carry a dozen things —
location, tags, characters, mentions, plot threads, motifs, items, POV, elapsed
time, flashback, story beat, dramatic tension — and most scenes carry two or
three. Expanding a card shows the sections it is actually using; the rest
collapse into a single **Add** row of chips at the bottom, each named for the
section it opens. Nothing is buried in a menu and there is no mode to switch:
click **+ Tags** and the Tags section appears, and stays. A scene you created a
minute ago shows a description, its prose and the chip row, rather than the whole
ontology at once. Choosing **Edit** opens every section, since that is what you
asked for.

**Generate / Update Chapter with AI.** From a chapter you can hand your scene
text to an AI assistant (via a copy-paste prompt, like the world generator) and
have it fill in the scenes, character states, and a dramatic-**tension** rating
for each scene — the ratings feed the pacing curve on the Timeline. *Generate*
drafts a new chapter; *Update* re-derives an existing one from its prose.

---

## Corkboard

The **Corkboard** is an index-card view of your whole story — the classic way to
see structure at a glance and shuffle it. Each chapter is a column; each scene
is a card showing its title, synopsis, POV character, and **status**
(Idea → Outline → Draft → Revised → Final).

![Corkboard](images/32-corkboard.png)

- **Drag a card** to reorder scenes within a chapter, or drop it into another
  chapter's column to move it there — the timeline order updates to match.
- **Change a scene's status** right on the card with the status pill.
- **Each card carries its length** once there is prose in it, so long and short
  scenes are comparable down a column at a glance. A scene that is still only an
  outline shows nothing rather than *0 words*.
- **Each column header totals its chapter** — *4 scenes · 3,100 words* — which
  is the one thing a column cannot show you once its cards scroll.
- **The header says how big the board is** — *17 chapters · 74 scenes* — and a
  chevron at each edge moves you about a screenful through it. Each appears only
  when there is board in that direction, so the right-hand one going away means
  you have reached the last chapter.
- **Click a card's title** to jump to that scene in the chapter detail with the
  time cursor set to it.
- The card for the scene the **time cursor** is on is outlined, so moving along
  the bar at the bottom walks the board with you.

It's the same scenes as the Timeline, shown as a board — reorder here or there
and both stay in sync.

---

## Manuscript

The **Manuscript** view stitches every scene's prose into one continuous
document, in reading order, so you can read and export your book without leaving
PlotWeave. Write a scene's prose on its scene, and it appears here automatically —
the box on the scene grows to fit what you write, so a long scene isn't read
through a five-line window.

![Manuscript view](images/24-manuscript.png)

- **Draft vs. Reading** — Draft shows per-scene and per-chapter word counts, scene
  labels, and links back to each scene; Reading hides the scaffolding for a clean
  read-through of only the written scenes.
- **Word goals** — set a target for the whole manuscript (in the header) and a
  per-chapter goal (in Draft mode); a progress bar tracks words against each. A
  goal you haven't set reads **none**, and the bar only appears once there is a
  target to measure against.
  Per-chapter goals are saved with the chapter.
- **Export** — download or copy the manuscript as Markdown, HTML, or plain text,
  or **compile a finished book file**: **Word (.docx)** or **EPUB**. The book
  formats build a title page (with an optional author), start each chapter on its
  own heading, and separate scenes — EPUB also gets a linked table of contents.
  Both are generated right in the browser, so nothing leaves your device. The
  file is named after **your world** — the book — so exporting *The Ninth Bell*
  gives you `the-ninth-bell.md`. If the world has more than one timeline, the
  timeline's name is added, so the exports don't overwrite each other.

Empty scenes are flagged with a "write this scene" link, so the manuscript
doubles as a checklist of what's left to draft.

### Find & replace

The **Find & replace** button (in the Manuscript header) searches across *every
scene's prose* at once — for renaming a term or fixing a recurring tic without
opening each scene. Type a phrase to see every scene that contains it, with a
match count and a highlighted preview.

![Find & replace](images/36-find-replace.png)

- **Case sensitive** and **whole word** toggles refine the match.
- **Replace** one scene at a time, or **Replace all** across the manuscript.
- **Character-rename aware** — when your search exactly matches a character's
  name, PlotWeave offers to rename that character too (its name *and* aliases),
  so the cast list stays in sync with the prose.

Every scene changed by a replace is saved as a new version, so you can undo it
from that scene's [history](#scene-history).

### Scene history

Every scene keeps a **revision history**. As you revise a scene's prose,
PlotWeave automatically saves earlier drafts (grouped so a burst of edits becomes
one snapshot, and capped to the most recent 20). A **History** link appears above
the scene draft once there are saved versions.

![Scene history](images/34-scene-history.png)

Open it to browse past versions with their timestamp and word count, **diff** any
version against the current prose (added words in green, removed in red), and
**restore** one. Restoring is non-destructive — the current draft is saved as a
new version first, so you can always undo it. The full history travels with the
world through export/import.

### Focus mode

Beside the scene draft's heading, the **Focus** button opens a full-screen,
distraction-free writing surface for that scene — no chrome, just your prose in a centered column. The
caret stays vertically centered as you type (typewriter scrolling), a live
**word count** and **words this session** sit in the slim header, and if you've
set a [daily goal](#writing-progress) a thin bar at the bottom fills toward it.

![Focus mode](images/46-focus-mode.png)

It autosaves as you write (so scene history and the writing log keep working);
press **Esc** or click the ✕ to drop back to the scene.

---

## Characters

The Characters roster is your cast list, with portraits and a search box. The
count badge tracks how many characters you're following.

**Adding several at once.** *Add Character* takes a name and a description and
leaves you on the roster, so the list builds up in front of you. Use **Add
another character** to save and keep the dialog open with the cursor back in the
name field — typing a whole cast never needs the mouse. Items work identically
(*Add another item*); the two used to disagree, and the detail page is one click
from any card either way.

Open a character and the header carries who they are — portrait, name, and
**Also known as** if they have other names. Below it, eight tabs, and each one
that holds a list says how many things are in it, so you can see at a glance
that a character has three relationships and no goals without opening either.
A count of **0** is drawn rather than left off: *none* is an answer.

**Overview** holds the rest of the character's own record — **Born**, their
**Colour** on the map and the Arc grid, and the biography. A birth date is shown
whether or not the world has a [calendar](#calendar--character-ages); with one
it reads as a date, without one it falls back to the raw year, month and day.
Fields you haven't filled in simply aren't listed.

![A character's tabs and Overview](images/59-character-tabs.png)

### Viewing pictures full size

Portraits are kept at up to 2048px but shown small — 48px in a character's
header, smaller still on a card. Click the portrait on a character's page to
open it full size. Press **Esc**, click the space around it, or use the ✕ to
put it away; clicking the picture itself doesn't close it, so you can lean in
without losing your place.

![A portrait opened full size](images/54-image-lightbox.png)

The same works for an item's image on its detail page, for a world's cover on
the dashboard and in [World settings](#world-settings--export), and on a
[map](#maps) for both the portrait at the top of the character panel and the
picture on a location's panel. Pictures inside cards and lists are left alone —
there, a click still takes you to whatever the card is for.

### Generate characters with AI

Building a large cast by hand is slow. **Generate with AI** (next to *Add
Character*) does it for you with any AI assistant. It works the same way as
[Generate a world from AI](#generate-a-world-from-ai), but scoped to one
section and added to the **world you're already in** — no new world is created:

1. Click **Generate with AI** and **Copy prompt**.
2. Paste it into ChatGPT, Claude, Gemini, or similar, then describe your story
   (or just list the characters you want) after the last line.
3. Paste the JSON it returns into the box. A preview tells you how many
   characters it will import. If the assistant wrapped its answer in a
   ```` ``` ```` code fence, paste it anyway — the fence is stripped for you.
4. Click **Add characters**. New names are created; a name that **already
   exists is updated in place** — the fields the AI supplies overwrite the
   current values, while anything it leaves out is untouched. So you can run it
   again to top up your cast *and* to flesh out characters you already made,
   without ever creating duplicates. The result banner reports how many were
   added, updated, and left unchanged.

![Generate characters with AI](images/26-generate-characters.png)

> **Images: upload or link.** For a character's portrait — and likewise for item
> images and maps — you can either **upload** a file or **link an image URL**.
> On a character, both live in the **⋯** menu on the corner of the portrait;
> elsewhere the ⬆ upload and 🔗 link controls sit on the image itself. Linked
> images aren't stored in your browser, so they need an internet connection to
> display and can break if the source goes away; uploads are self-contained.

Opening a character gives you a tabbed profile:

- **Overview** — biography, aliases, portrait, map/Arc colour, and an optional
  birth date when the world has a calendar.
- **Current State** — location, inventory notes, alive status, and travel mode
  *at the current scene*.
- **History** — how their state changed scene by scene, including carried-forward
  states.
- **Appearances** — every scene they're in.
- **Goals** — their inner life (see below).
- **Relationships**, **Lore**, and **Factions** — their connections and
  affiliations.

![Character detail](images/07-character-detail.png)

**Recorded state is not an entrance.** *Current State* and a scene's **cast** are
two different records, and both are worth keeping. A saved state says *where this
character is* at that point in the story — which is just as useful for the ones
who are somewhere else, and is what lets the map and the Writer's Brief answer
"where is everyone right now". The cast says *this character is in this scene*.

So a character can have a full **History** and **Appearances 0**: you have said
where they are, but never that they are in the room. Current State says which of
the two this scene has them in — *"Corvin Adze is not in this scene's cast"* —
and offers **Add to this scene's cast** when they aren't in it. Adding them there
is what puts the scene in their Appearances, on the map's scene cast, and in the
chapter's Character States panel.

![Current State says which ledger the scene has them in](images/65-scene-standing.png)

**Editing an earlier scene, and how far it reaches.** State is recorded *per
scene*: what you save at one scene holds until the next scene that records
something of its own. So going back on a second draft to say *"actually she has
had this since chapter one"* reaches forward only as far as the next scene with
its own record — which is usually what you want, because that record is your own
earlier decision about that scene.

When it stops somewhere, PlotWeave says so rather than letting you assume it went
all the way: after saving you'll see a line like *"Corvin Ashe's inventory is
recorded again at Ch. 2 · The seal breaks, without this change"*, with **Carry it
forward**. Taking it applies the change to the later scenes that were only
inheriting the old value, and **stops at the first scene where you had already
decided something different** — that one is left exactly as you wrote it. It is
one step for undo, so you can take it back in one go.

**Taking a record back.** Because a record is an assertion about one scene, a
record you didn't mean to make is not harmless — an empty one says *nobody knows
where they are*, and every later scene reads that back through it until the next
record of its own. So Current State says which of the two this scene has:
*"carried forward from an earlier scene"*, or *"recorded at this scene"* with a
**Remove record** beside it. The **History** tab has the same control on every
row, since that tab is the list of records.

Removing one asks first, and the question names the consequence rather than the
row: *"Ossian Marl's state at this scene will go back to being carried forward
from Ch. 1 · The pour. 2 later scenes currently read from this record and will
follow."* Records at later scenes of their own are untouched — this withdraws
one assertion, it does not cascade. Undo takes it back.

**Naming an item you already have.** Inventory offers *Add existing item…*
above *New item name…*. Typing a name the world already has into the second one
no longer makes a second item with the same name: the panel tells you the name
exists and the **+** adds the item you had. If they are already holding it, it
says so and there is nothing to add. Two records with one name would be two
different objects to the item hand-off and to the continuity checker, which is
why this one is worth being careful about; a genuine second object of the same
name can still be made from the Items screen.

### Goals & motivations

The **Goals** tab tracks the inner life behind a character's scenes, along the
four classic axes:

- **Want** — the conscious objective they're chasing.
- **Need** — what they actually require, often at odds with the want.
- **Fear** — what they're avoiding.
- **Flaw** — the trait that keeps getting in their way.

Each goal can be **scoped in time** — *From* a scene *until* another — so a want
they pick up in chapter three and abandon in chapter nine is recorded as exactly
that. Leave either end open for a drive they carry from the start, or to the end.
Goals that aren't held at the current time cursor stay listed but dimmed and
marked *inactive here*, so the whole arc is visible while you edit.

![Character goals](images/51-character-goals.png)

Goals surface where you're writing, not just where you set them:

- The **[Writer's Brief](#writers-brief)** lists each present character's active
  goals alongside their location and inventory, so the moment's motivations are
  in front of you.
- The **[Character Arc grid](#character-arc-grid)** has a **Goals** overlay that
  prints them under each character's name, and every row's name carries them as
  a tooltip.

---

## Cast Balance

Found on the dashboard, **Cast Balance** answers *"who is actually carrying this
book?"* Each character gets a word-weighted **screen-time** bar (measured from
your scene prose), a **presence strip** showing which chapters they appear in,
and automatic flags when someone important **drops out for a long stretch** or
goes quiet late in the story.

![Cast Balance](images/20-cast-balance.png)

This makes it easy to spot a protagonist who vanishes for ten chapters or a
side character who's quietly taken over.

---

## Plot Threads

**Plot Threads** track subplots. Define named threads (e.g. *The Ring's Journey*,
*Pursuit of the Nazgûl*), give each a colour, and tag scenes with the threads
they advance. The dashboard widget then draws a **cadence strip** per thread
across your chapters and flags trouble:

- **"goes quiet for N chapters"** — a thread that disappears for a long stretch
  *of its own life*: at least five chapters, and more than a third of the span
  it runs across. Both halves matter. A subplot with a beat every few chapters
  is breathing, not neglected, however long the book — and three quiet chapters
  of a five-chapter thread is not a stretch.
- **"dangling"** — a thread that was raised and then never resolved.

**Say where a subplot lands.** A thread that stops advancing before the end
isn't necessarily a mistake — plenty of subplots resolve in the middle of a
book. Tell PlotWeave where one lands and it stops calling it dangling: the row
reads **resolves Ch. N**, and **reopen** beside it takes that back if you change
your mind. This is a fact about your book, not a way of hiding the warning —
which is why a resolved thread that still goes quiet for ten chapters in the
middle is *still* reported for that. It answers what it answers.

![Plot Threads](images/21-plot-threads.png)

Tag a thread onto a scene from the scene's card; create threads inline with the
**+ New thread** button.

**Or attach scenes from the thread itself.** Each thread row carries a small
link icon — **Attach scenes to this thread** — which opens the world's scenes
grouped by chapter, in the order the timeline reads them. Tick the ones the
thread runs through and save. Re-opening shows what is already attached, so you
can add or remove scenes later without starting again. The same control sits on
every motif row.

### Filtering the timeline to one thread

Once you have threads, the **Timeline** page (in Narrative view) shows a filter
row of thread pills above the chapters. Click a thread to focus the timeline on
that subplot: only chapters that advance it are listed, each expanded to show
just the scenes tagged with it, so you can read a subplot end-to-end without the
surrounding story. Click **All threads** to clear the filter.

The row stops at six pills so it cannot grow into the chapters below it; any
beyond that fold behind **+N more**, which unfolds the lot. Whichever thread you
are filtering by stays on the row either way, so the strip always shows what it
is filtering by.

![Filtering the timeline by plot thread](images/48-thread-filter.png)

### A lane per thread in the Arc grid

The [Character Arc grid](#character-arc-grid) has a **Threads** row type: one
lane per thread across your chapters (or scenes), each cell naming the scene
that carries it. Where a lane goes blank, the subplot is off-stage — the fastest
way to see a thread's rhythm across the whole book.

![A lane per plot thread in the Arc grid](images/50-arc-thread-lane.png)

### Threads in the Continuity Checker

The same cadence analysis is reported as findings under **Plot threads** in the
[Continuity Checker](#continuity-checker), so they're actionable rather than
just visible:

- **left dangling** — raised, then quiet for the last three chapters or more.
- **goes quiet mid-story** — a silence of five chapters or more that is also
  more than a third of the thread's own span.
- **has no scenes** — a thread that exists but was never tagged onto a scene.

Each finding links to the chapter where the thread was last (or first) seen, and
can be suppressed with a note like any other continuity issue.

**A dangling thread can be answered rather than suppressed.** The finding offers
**Resolves at Ch. N — "scene title"**, naming the scene it will record: the last
one that advances that thread, which is usually where it lands. Take the offer
and the subplot is marked as resolving there, and the finding goes because it
has been answered. If it really lands somewhere else, say so on the thread's own
row instead. There is deliberately no "fix all" for this one — where a subplot
ends is a decision per subplot, not a batch.

---

## Motifs & Themes

**Motifs & Themes** works exactly like Plot Threads, but for symbolism rather
than plot — recurring images, symbols, and themes such as *mirrors*, *the colour
red*, or *exile*. Define named motifs on the dashboard, give each a colour, and
tag the scenes that carry them — either from the scene card, or from the motif's
own row with **Attach scenes to this motif**, exactly as for plot threads.

![Motifs & Themes](images/33-motifs.png)

The dashboard draws a **cadence strip** per motif across your chapters so you can
see its rhythm at a glance, and flags where a motif loses momentum:

- **"vanishes for N chapters"** — a motif that drops out of the middle of the book.
- **"fades out"** — a motif introduced early and then never seen again.

Use it to check that a theme you care about is woven through the whole story,
not just raised once and forgotten.

---

## Structure board

The **Structure** board checks your story against a **beat sheet**. Pick a
template — **Three-Act**, **Save the Cat**, or **Hero's Journey** — and each of
its beats appears as a slot, in order and tinted by act.

![Structure board](images/45-structure.png)

- **Assign a scene** to a beat from its "+ Assign a scene…" picker; the slot then
  shows that scene (click it to jump to the scene in the timeline). The picker
  holds every scene in the book, so it has a **filter box** at the top: type a
  word from the title — or a chapter number and a word, in either order — and
  the list narrows to it.
- A **X / N beats placed** counter tells you how much of the structure is filled,
  so **gaps** — a missing midpoint, no clear climax — stand out.
- A beat is flagged **out of order** when its scene falls earlier in the story
  than a later beat's scene, catching a structure that's been shuffled.
- The beat holding the scene the **time cursor** is on is outlined, so you can
  tell where you are in the shape of the book while you read along the bar.

### How the book divides

Knowing a beat is placed isn't the same as knowing how much of the book it
covers. Above the slots, a band shows **how your chapters actually divide
between the three acts**, with each act's width its share of the book:

![Act proportion on the structure board](images/55-structure-proportion.png)

- An act begins at the chapter of the first beat you placed in it, so the
  division is read off your own tagging — nothing is assumed.
- The dashed lines mark the conventional **25 / 50 / 25** shape. It's a
  comparison, not a rule; nothing warns you for departing from it. A twelve-
  chapter Act 2 inside a twenty-two chapter book shows up immediately as a band
  far wider than the space between the dashes.
- Each row also carries a **dot on a track**, marking where that beat falls
  along the book. Read down the list they form a profile: two dots pinned to the
  right edge mean a climax and a resolution crammed into the same last chapter.
- Until you've placed a beat in Act 2 *and* one in Act 3, there's no division to
  draw and the board says so rather than guessing.

Switching templates keeps your tags — a scene tagged with a Three-Act beat simply
won't fill a Save-the-Cat slot until you assign it there, so you can commit to one
framework at a time. (You can also set a scene's beat from its card on the
Timeline.)

---

## Maps

PlotWeave renders custom, hand-drawn fantasy maps (pixel-coordinate images, not
geographic tiles). Upload a map image or **link one by URL** in the upload
dialog, place **location markers**, group them into **layers** and **sub-maps**
(drill into a city from the world map), draw **regions** and **routes**, and set
a **map scale** to unlock distance measurement. (A *linked* map may not be
included in *Export map as PNG*, since browsers restrict drawing cross-origin
images to a canvas — uploaded maps always export.)

![Maps](images/08-maps.png)

**A location lives on a map.** Places are pins, so you can add them to maps and
sub-maps that already exist and nowhere else — there is no separate list of
places kept apart from the geography. That is why, in a world with no map yet,
a scene has no **Setting** to fill in, a character's **Current
Location** has nothing to offer, and the scene editor's `@` picker offers a new
character or a new item but not a new place. Add a map first (or generate a tree
of locations with AI, which builds one for you and lays them out on it), and all
three appear.

The map's own controls **float over the canvas** rather than sitting in header
rows above it, so the map itself runs from the top of the view to the chapter
bar. Which layer is open — and its scale — reads from the breadcrumb at the top
of the window (*PlotWeave / your world / Middle Earth · 1 km = 2 px*), leaving
the canvas corners free. Top-left holds the **Show** chips —
toggles for characters, trails, labels, journeys, and locations (the chevrons
narrow those to particular characters or location types). Top-right holds the
two commands you reach for while working a map, **+ Location** and **Label**,
plus a **⋯** menu for everything you set up once or use occasionally: map
scale, add level, replace image, export as PNG, and the AI tools. Zoom sits in
the bottom-right corner of the canvas.

![Map tools menu](images/52-map-tools-menu.png)

The left sidebar lists map layers and locations. In the **Map Layers** tree
you can **drag a map onto another** to nest it inside (re-parent it), or drop it
on the *"top level"* zone to un-nest — handy for fixing a sub-map that landed in
the wrong place. This works for any map at any depth; on a touch device,
**press and hold** a map to pick it up first, so a normal swipe still scrolls the
list. To place a character
(selected from a scene in the timeline bar), drag them onto the map — or, on
touch devices, tap the crosshair on their card and then tap a location. Either
way you can aim at a place somebody is **already standing in**: while you are
placing, the location pins come to the front so the people on them don't get in
your way.

When several characters stand in the same place, their pin shows a count;
clicking it lists them, and picking a name opens that character's panel and
journey strip — the same thing clicking a single pin does. Anyone who is really
on a **sub-map** reached through
that pin is named with the map they are on — *Frodo Baggins · in Bag End* — and
a long list scrolls inside the popup rather than running off the top of the map.

The six sections — Map Layers, Characters, Locations, Items, Routes, Regions —
behave as a **panel stack**: their headers stay put and each list scrolls inside
its own section, so opening a long one never pushes the others off the top. Open
as many as you like; every section stays one click away. Any name too long for
its row is available in full by hovering it, and with a moment selected every
character and item row states where it stands — a place name, or *Not placed*,
so a blank line never has to be guessed at.

**The rows are real controls.** Map layers, characters, locations, items, routes
and regions can each be reached with **Tab** and opened with **Enter**, so the
route and region panels — and everything else the sidebar opens — can be worked
without a mouse. On a Map Layers row the **name** is the control that opens that
map; the rest of the row is still the surface you drag to nest one map inside
another, so both work and neither costs the other. (Re-parenting itself is still
a drag: there is no keyboard equivalent for it yet.) The
small delete beside a route or region still appears only when you hover the row
or tab onto it, and while it is invisible it cannot be tapped, so a tap on what
looks like a blank stretch of row will never delete anything.

With a moment selected, the Characters list splits into **On the map** and
**Not placed**, so the people in the scene you're looking at read as a short
list rather than a handful of rows scattered through the whole cast. Nobody is
hidden — the rest are just below, ready to be placed.

**If a map opens without its picture**, the screen says so — *"This map's image
isn't here"* — and everything else about the map is intact: its locations,
routes and regions are all still there. This happens to worlds taken from the
**Library** whose image file did not arrive — either because it was downloaded
before the pictures came with the book, or because that part of the download
failed. Fetch the world again from the Library, or add a picture of your own
from that screen.

**If a map's picture is linked from the web** rather than stored in the world,
a bar above the map says *"This map's picture could not be loaded"* when that
address doesn't answer — most often because you're offline. The map itself
keeps working: your locations, routes and regions are still drawn in their
places, just without the picture behind them, and the sidebar still lists them
all. Worlds from the **Library** link their pictures this way, so their maps
need a connection the first time you open them. Adding a picture of your own
stores it in the world, which keeps it working offline.

### Setting a map's scale

**Set map scale** (in the map tools menu) asks you to click two points and say
how far apart they are. As you type, it tells you what that would make the whole
map across — if your artwork carries its own printed scale bar, that total is the
number to check it against, and it is what catches an order-of-magnitude slip
that "100 km between two points" would not.

A layer with no scale simply has no distances — that is a supported state, and a
better one than a number nobody can back. Two of the bundled Fellowship maps sit
that way on purpose: Rivendell carries no printed bar at all, and the Edoras
plate's bar is labelled in a script we could not read.

**Measure** takes over the canvas while it is armed: clicks place the two points
and nothing else, so a region or marker underneath will not open its panel over
the spot you were aiming at.

### Working with the map canvas

- **Right-click** the canvas for quick actions: add a location or annotation, or
  begin a route or region at that point. The **Label** tool does the same from the
  toolbar; select an annotation to change its text, size, colour, or delete it.
- While you're placing or drawing — a location, a label, a route or region's
  vertices, a scale calibration — the floating controls fade and stop taking
  clicks, so the whole canvas underneath them stays reachable. Press
  **Escape** to back out of any of these modes.
- Routes can be roads, rivers, trails, sea routes, borders, or custom paths. Open
  a route to edit its name, type and notes; its panel also counts the waypoints,
  separating named locations from free points. The shape itself is drawn on the
  canvas rather than edited in the panel.
- Regions have a fill colour, opacity, notes, and a scene-based condition. They
  can belong to a faction and can link directly to a sub-map. Open a region and
  its panel carries **At this moment** — whether the place is *active, occupied,
  contested, abandoned, destroyed* or *unknown* at the scene on your cursor,
  with a note for that moment beside it. The region's own **Notes** above are
  separate and do not change with the story; the moment's do. Pick a scene on
  the bar below first — with the cursor on *All chapters* there is no moment for
  a condition to be about, and the panel says so. The Continuity Checker reads
  this: a character travelling through a destroyed or abandoned region is one of
  the things it catches. A region writes its
  name across the middle of the area it covers, so a **location pin of the same
  name standing inside it** shows as a dot rather than a labelled pill — the name
  is already there, and saying it twice only put two labels on top of each other.
  The pin keeps everything else: its position, its click, and its ring if it
  leads to a sub-map.
- **The four detail panels work the same way.** Location, character, route and
  region all open on the right edge, and each names *the thing* in its header —
  the place, the person, the road — with what kind of thing it is beneath, and
  the chapter you are on where that matters. Where a panel can delete what it is
  showing, that control sits alone at the foot of the panel in the quietest
  weight there is: it is the last thing on the panel, never the loudest. The
  character panel has no delete on purpose — a character outlives every marker
  they stand on, so their panel links to the character screen instead.
- A location's detail panel stores its description, scene-based condition and
  notes, owning faction, characters and items present, an optional linked
  sub-map, and a **picture** of the place. It opens when you pick a place —
  from the sidebar, from search, or by clicking its pin. Moving the time cursor
  along the chapter bar only *pans* the map to wherever that scene happens, so
  reading through a chapter never buries the map under a panel you didn't ask
  for. If the scene happens somewhere on a **sub-map** — inside a building or a
  town you drill into — the map goes there rather than sliding the outer map to
  a spot that isn't on it, and reading mode reveals that sub-map when you reach
  the scene set on it, the same way it reveals the place itself.
- The picture sits at the top of the panel, and is a different thing from the
  other two visuals a location has: the pin's icon says *what kind* of place it
  is, a linked sub-map is a map *of* it you drill into, and the picture is what
  it looks like. **Upload** one or **link** it by URL with the buttons in its
  corner, ✕ to take it away, and click it to open it
  [full size](#viewing-pictures-full-size). The pin itself stays an icon, so a
  city still reads as a city at a glance.
- The **Show** chips can display the selected scene's movement, complete
  character journeys, character labels, locations, and sub-map links. Select one
  character to focus the display.
- **Measure** only appears in the toolbar once the map has a scale — until then
  it sits greyed out in the **⋯** menu, next to the *Set map scale* entry that
  unlocks it.

Click a character pin to open their **journey strip**, a chronological list of
every place they visited. Selecting a stop moves the global cursor to that scene.
It also opens their panel on the right, where the portrait at the top opens
[full size](#viewing-pictures-full-size) like any other.

The two are separate: the strip lies across the bottom of the map and the panel
stands at the right, and on a laptop you may not want both at once. Closing the
strip with its **✕** leaves the panel open, and the panel's **Hide journey /
Show journey** brings it back. Once you have put the strip away it stays away —
clicking the next character opens their panel alone — until you ask for it
again. Closing the panel is what deselects the character and clears both.

![Map editing tools](images/40-map-tools.png)

**Replace image** (in the **⋯** menu) swaps the picture behind the current map without losing any
of its content — handy for upgrading a sketch to a finished map or dropping in a
higher-resolution version. Upload (or link) the new image, and keep *Reposition
existing locations…* checked so every marker, route and region is scaled to the
new image's size and stays in the same relative spot (uncheck it for a same-size
redraw). The map's scale calibration is adjusted to match.

![Replace map image](images/28-replace-map-image.png)

**Levels (floors).** Some places are one footprint stacked into several floors —
a castle with dungeons, a ground floor, upper floors and towers. Choose **Add
level** from the **⋯** menu to give the current map a floor above it: upload that floor's image and
name it (e.g. *First floor*). The map becomes a level group, and a **floor
switcher** appears on the right edge — floors stacked bottom-to-top, the current
one highlighted. Tap a floor to jump to it; your pan and zoom are held so a
stairwell or tower lines up between floors. Each floor is a full map with **its
own locations**, routes and regions, so a marker on the First floor stays on the
First floor. Add more floors with the **+** on the switcher, **rename** a floor
(double-click it, or the pencil), or remove one with its trash icon — deleting
the ground floor re-points the place's pin to the next floor so it stays
reachable. Levels differ from sub-maps: sub-maps are places you *drill into*
(Grounds → Castle), while floors are levels of the same place you *flip between* —
and the two compose, so a castle reached from the grounds can itself have floors.

Characters move between floors just by being at a location on a different floor
in the next chapter — no special "stairs" needed. On the parent map a character
on **any** floor shows at the building's pin, and during **playback** the map
follows them: as the story reaches a chapter where a character has crossed to
another floor, it switches to that floor and lands their pin at the right spot.

![Map levels](images/29-map-levels.png)

Press **play** in the chapter bar and the map becomes a playback stage: as the
story advances scene by scene, character pins glide between locations along their
routes, so you can watch your cast move through the world. The story-notes overlay
shows the current chapter, synopsis, and relevant character status notes. For a
frame narrative, the map can display outer-timeline characters as **ghost pins**;
a historical-echo relationship marks shared places with echo rings.

### Starting a map without a picture

A place in PlotWeave is a **pin on a map**, so a scene can only be given a
setting once the world has one — and a location is only ever added to a map or
sub-map that already exists. If you have no picture of your world, **Start a
blank map** on the empty Maps screen makes one anyway: a plain grid you can drop
pins on straight away. It behaves like any other map — sub-maps, floors, routes,
regions and playback all work on it — and you can give it a real image later with
**Replace image** in the map toolbar.

With a map in the world, naming a place in your prose starts working too: typing
`@Ferrow Crossing` in a scene draft offers **new place**, which puts a pin at the
centre of the map for you to drag where it belongs.

### Generate locations with AI

Have a world in mind but no places recorded yet? **Generate with AI** (on the
empty Maps screen, and as **AI Locations** in the map toolbar’s **⋯** menu)
builds a whole **tree of places** for you — where a blank map gives you somewhere
to put pins, this fills it.
Copy the prompt, describe your world, and paste back a nested JSON tree
(continent → kingdom → city → district). PlotWeave creates a blank **Locations**
map and drops each place on it as a pin; a place with children becomes a pin that
**drills into a sub-map** holding them, as deep as your tree goes — no map image
required. A multi-storey place (a castle, tower or keep) can use **`levels`**
instead of `children`: the AI lists its floors, each with its own locations, and
PlotWeave builds them as a [level group](#maps) with a floor switcher — so *Great
Hall* on the ground floor and *Library* on the first floor land on the right
floors automatically.

![Generate locations with AI](images/27-generate-locations.png)

Re-running extends the same Locations map: new places are added, and existing
ones are **matched by name across the whole world** — updated in place and never
duplicated, even if the AI puts a place under a different parent than before. A
place's position in the tree is fixed the first time it's created; new children
still attach under it. So you can build the world out in passes. To help with that, the
prompt **lists the places you already have** (as an indented tree, floors shown
as `[bracketed]` headers) and tells the AI to extend them rather than repeat them
— reuse a place's exact name to nest new children under it, or add floors to a
leveled place by reusing its floor names. You can always upload a real map image later and move the pins
onto it.

---

## Items

Track the objects that matter — weapons, artefacts, documents, consumables — with
thumbnails, categories, and descriptions. Like characters, items have per-scene
**placements** (who holds an item, or where it is, at any point in the story).
An item's picture opens full size the same way a portrait does — see
[Viewing pictures full size](#viewing-pictures-full-size).

With a moment selected, each card also says where that item is — *carried by
Kestrel · Weathertop*, or just the place if nobody is holding it — and shows its
**condition** as a coloured dot. On *All chapters* there is no moment to answer
about, so the line is left off rather than guessed at.


![Items](images/09-items.png)

**Deleting one.** *Delete item* removes the item, its placements and its
per-scene states, and also takes it out of every character's inventory and every
scene's item list — so nothing is left pointing at a record that is gone. Undo
brings the whole lot back.

**Putting one down.** Placing an item at a location takes it out of whoever is
carrying it at that moment — including a character whose last inventory record
is chapters back, which is the ordinary case. Their earlier record stands
untouched; what is written is a new record at the scene you are on, so the
custody chain reads as a hand-off rather than a rewrite of history.

**Where it has been.** Open an item and, under **Whereabouts**, it lists its
chain of custody in story order — one row per change, naming the scene, who was
carrying it and where: *Ch. 1 · The letter arrives — carried by Mira Vasse · The
Reed House*, then *Ch. 2 · The seal breaks — carried by Corvin Ashe · Ferrow
Crossing*. A run of scenes where nothing about the item moved is one row rather
than forty, and putting it down shows as *left at* somewhere. It reads the same
records you already keep — a character's inventory, and any explicit placement —
so nothing extra needs filling in. While reading, the list stops where you have.

**Things there is more than one of.** An item is normally one particular object,
and the [Continuity Checker](#continuity-checker) treats it that way — if two
characters hold it at the same moment, that is a contradiction worth flagging.
Some items are a *kind* of thing instead: lembas, a uniform, arrows, a cloak
every member of the party carries. Open the item, choose **Edit**, and tick
**There is more than one of these**; the checker then stops asking how it can be
in two places at once. Leave it unticked for anything unique — the One Ring
should still raise its hand if it turns up in two pockets.

Like the cast, you can **Generate with AI** from the Items screen: copy the
prompt, describe your story, and paste back the JSON to add a batch of items to
the current world. It follows the same flow as
[generating characters](#generate-characters-with-ai) — new items are created and
items with a matching name are updated in place, so re-running never duplicates.

An item's detail page also lists every lore page linked to it. In a world with
multiple timelines, **Cross-Timeline Appearances** records where an artefact
originates, the timeline in which it is later found or encountered, and optional
encounter notes.

![Cross-timeline item](images/41-item-cross-timeline.png)

---

## Relationships

The Relationships graph visualises how your cast connects. Each edge is a
labelled, colour-coded relationship (allies, rivals, family, lovers…), and the
graph is fully pannable/zoomable with a minimap.

Create a relationship with the form or drag from one character node to another.
Relationships may be bidirectional or directed, can begin at a chosen scene, and
carry a label, strength, sentiment, and description. Selecting an edge opens its
editor and an **Evolution** history of every scene-based change. The faction
overlay colours character nodes by their active memberships.

![Relationships graph](images/10-relationships.png)

### Keeping a large cast readable

Characters are placed by **who knows whom**: linked characters are pulled
together, everyone is pushed apart, and the result settles into groups. People
with no relationships at all are gathered into a block below the graph, where
their distance from it says only "unconnected" rather than pretending to mean
something. The arrangement is worked out fresh each time from the same
relationships, so it doesn't shift between visits.

![Focusing the relationship graph on one character](images/56-relationship-focus.png)

**While reading, the graph opens close enough to read.** Fitting a whole cast on
screen is what a writer wants — the shape is the answer — but for a reader with
one question ("how is this person connected to that one?") a graph fitted so far
out that the names are illegible is no answer at all. In reading mode it opens
at the zoom the labels need, showing part of the graph rather than all of it;
pan to reach the rest.

Three controls keep a big cast under control:

- **Tidy up** re-runs the arrangement and discards any cards you dragged by hand.
  Use it after adding a batch of relationships, or when the graph has got away
  from you.
- **Focus on one character** draws only that character's corner of the graph —
  *who they know*, or *and who those know* for a second hop. A counter shows how
  many of the cast are on screen. Pick **Everyone** to go back.
- **Edge labels fade out** when you zoom far enough out that they'd be unreadable
  anyway — a large cast fits on screen only at that kind of zoom, and the labels
  pile into a mat that hides the graph beneath. The lines and their sentiment
  colours stay, clicking one still opens the relationship, and a note in the
  corner tells you to zoom in rather than leaving you to think there are none.

Dragging a card still pins it where you put it, and that position is remembered
until you tidy up.

The **minimap** in the corner draws each character in the colour the graph gives
them — their faction's while that overlay is on — with the part of the graph
you are looking at outlined on it. Drag inside it to pan, or scroll on it to
zoom, so on a cast large enough to need a minimap you can steer from it rather
than only read it.

**Generate with AI** (top-left of the graph) adds relationships in bulk: copy
the prompt, describe your story, and paste the JSON back. Each relationship's two
endpoints reference characters by name — only pairs where **both** already exist
are imported (unknown names are ignored). A new pair is created; a pair that
already has a relationship is updated in place, so you can re-run safely.

Because relationships are **snapshot-aware**, the prompt also captures how a bond
*evolves*: each relationship can carry a list of **changes**, and each change
names an **existing scene** where the state shifts (*allies → rivals →
reconciled*). Those become per-scene snapshots, so as you move the time cursor
the graph shows the relationship as it stood then. Add your timeline scenes
first, since a change whose scene doesn't exist yet is skipped.

Relationships are snapshot-aware too — they can change over the course of the
story (from *rivals* to *reconciled*), and the change is tied to the scene where
it happens.

---

## Character Arc grid

The Arc view is a spreadsheet of your whole cast across story time. Choose
**Characters**, **Factions**, or **Threads** for the rows, and **Chapters** or
**Scenes** for the columns. Character cells show status, location, notes,
inherited state, and an inventory sparkline; faction cells show who belongs at
that moment; thread cells name the scene (or count the beats) that carries each
[plot thread](#plot-threads), so a subplot's rhythm — and its silences — read
straight down the row.

In a multi-timeline world, use **All** or a timeline pill to focus the columns.
The search box filters character rows, while the **Factions**, **Status**, and
**POV** overlays add membership, scene-status, and point-of-view colour cues.
Click a column to move the time cursor, expand a notes cell for its full text, or
export the complete grid as **PNG**.

**Rows lead with who is actually in the book.** The default order is **Most
seen** — how many scenes a character is the POV of, is involved in, or is named
in, counted once per scene however many of those apply — with **A–Z** beside it
for when you already know whose row you want. If some of your cast have no
recorded state at all, a button offers to **hide** them and says how many: on a
long grid that is usually the difference between a screen of story and a screen
of blanks. Pressing it again brings them back.

**A carried-forward cell looks carried forward.** Where a chapter records no
change, the grid shows the state inherited from earlier — dimmed, and marked with
a small clock — so a run of eleven unchanged chapters reads as one decision
holding rather than eleven decisions taken.

**Click a cell to record what is missing.** The grid stays a readout — you don't
type into it — but every cell is a way *to* the place you'd type. Clicking a cell
puts the time cursor on that scene and opens that character's **Current State**,
so filling a gap the grid just showed you is one click instead of a trip through
three screens. Cells with status notes still expand in place when you click them,
as before. The same is true of the **Character States** panel in chapter detail:
a cast member reading *"no state recorded — record it"* is a button that takes
you there.

**Columns take the room they have.** A book with a handful of chapters spreads
its columns across the screen rather than crowding into a narrow strip with the
window empty beside it; a long book keeps them compact and scrolls, which is
what you want when there are a hundred of them. Either way a column never gets
narrower than it used to be.

![Character Arc grid](images/11-arc.png)

**From the keyboard.** The grid is a single stop in the tab order — a cast of
forty-five across twenty chapters is over six hundred cells, and giving each its
own stop would mean six hundred presses to cross the screen. Tab into it once,
then move with the keys a spreadsheet already taught you:

| Key | Moves |
| --- | --- |
| Arrows | one cell |
| Home / End | start or end of the row |
| Ctrl+Home / Ctrl+End | first or last cell of the grid |
| PageUp / PageDown | ten rows |
| Enter or Space | does what clicking the cell does — set the time cursor from a column header, open a notes cell |

Movement stops at the edges rather than wrapping, so scanning one character's
row never drops you into another's without saying so.

It's the fastest way to audit continuity across the entire book at once.

---

## Lore

Lore is your world's reference wiki — history, rules, and mythology that don't
change with time. Organise pages into **categories** (Artefacts, Peoples,
Places…), tag them, and optionally reveal a page only from a given scene onward.

A page held back with **Revealed at** carries a badge naming the chapter it
opens in — *From ch. 2* — so a page the reader meets late is not mistaken for
one that was there from the start. Each card also says when it was last touched
— *Edited 2d ago*, and a named month once that stops being useful.


![Lore](images/12-lore.png)

**Generate with AI** builds out your wiki in bulk: copy the prompt, describe your
world, and paste the JSON back. Pages are filed into **categories** by name
(created automatically); a page with a matching title is updated in place rather
than duplicated — same flow as
[generating characters](#generate-characters-with-ai).

Each page has a Markdown editor with an **Edit / Preview** toggle. **Link
entities** associates the page with characters, items, or locations; the page
then appears in those entities' Lore sections and in Writer's Brief when it is
relevant. Use **Revealed at** to choose the first scene at which the page becomes
visible, and turn on the revealed-only filter in the Lore index to hide future
knowledge at the current cursor.

![Lore editor and entity links](images/42-lore-editor.png)

---

## Factions

Factions are the organisations your characters belong to — kingdoms, guilds,
cults, fellowships. Each faction has a colour, description, and **members** (with
roles and optional start/end scenes), plus **faction-to-faction stances**
(allied, hostile, and so on).

Each card shows the faction's colour, its member count, and how many other
factions it is **allied** with or **hostile** to — so the political shape of the
world reads off the roster rather than out of each faction in turn. A search box
sits in the header, as on every other roster.

A faction can also carry a **cover image** — a banner, a crest, a plate of its
leaders. Open the faction and use **Upload** or **Link** at the top of its
panel, the same two ways a place or a character gets a picture; **Remove** takes
it away again. Where a faction has one, the roster card shows it in place of the
colour dot, ringed in that faction's colour so the identity mark survives. A
faction without one keeps the dot, so a world that uses no cover images looks
exactly as it did.

This is the right home for artwork that belongs to a group rather than to any
one member — the three kings of Lion Camel Ridge in *Journey to the West* are
one painting, not three portraits, so the picture is the faction's. While
[reading](#reading-alongside-a-book) the cover is shown and its controls are not, and a
faction with no cover shows a reader nothing rather than an empty slot.


![Factions](images/13-factions.png)

**Generate with AI** works here too: copy the prompt, describe your story, and
paste the JSON back. New factions are created and factions with a matching name
are updated in place (their members are merged in, never dropped). Faction
**members** reference characters by name — only names that already exist in the
world are linked (unknown names are ignored, and no characters are created), so
generate your cast first.

Regions and location markers can name an **owning faction**. Those assignments
appear under **Territories** on the faction detail panel. Turn on the Factions
overlay in the Relationships graph or Character Arc to colour characters by
their active membership at the selected scene.

---

## Knowledge

The Knowledge tracker manages **who knows what, and when they learn it** — the
backbone of mysteries and dramatic irony. Record a **fact** (a secret or key
piece of information), mark when the **reader** learns it, and log **reveals** to
individual characters at specific scenes. PlotWeave even **suggests facts from
your story** (for example, "Gandalf the Grey is dead · Ch. 17").

After one character learns a fact, **Might also know** looks for other characters
who shared a later scene with a knower. Accept a suggestion to add the likely
reveal, or leave it untracked when the information was not actually shared.

A fact's **Known by** list reads in story order — chapter 1, then 2, then 3 —
so it answers *who found out, and in what sequence*, rather than listing the
same three people in whatever order they were recorded. Anyone who does not
know it yet at the current cursor is marked, not hidden.

The roster can be **ordered** as well as searched: *When it gets out* puts the
facts in the order the story lets them slip, *How widely known* leads with the
ones that have spread furthest at the current cursor, and *Name* and *Order
added* are there too. A fact nobody knows yet sorts to the end rather than the
front — not knowing it is not the same as it coming first.

![Knowledge](images/14-knowledge.png)

**Generate with AI** adds facts in bulk: copy the prompt, describe your story,
and paste the JSON back. A fact's `origin`, `readerLearnsAt`, and each reveal
reference **existing scenes by title** and **existing characters by name** — so
add your timeline and cast first. Anything that doesn't match is simply left
unlinked (the fact is still created). A fact with a matching title is updated in
place (its reveals merged in), so re-running never duplicates.

Paired with the Continuity Checker, this catches a character acting on
information they shouldn't have yet.

---

## Search

Press **Ctrl/⌘+K** anywhere to open the command-style search palette. Close it
with **Esc**, by clicking outside it, or by going anywhere — it does not follow
you off the page. When it is opened over another panel, Esc closes the palette
and leaves what was underneath alone. It searches
characters, factions, items, locations, chapters, scenes, timelines,
relationships, routes, regions, lore pages, and knowledge facts, grouped by
type. A chapter is also findable **by its number** — `74`, `ch 74` or
`chapter 74` all go straight to it, which in a long book beats scrolling the
chapter bar. Use the arrow keys and **Enter** to navigate; opening a scene also sets
the time cursor, and opening a location focuses its map marker.

**It searches the prose you wrote, too.** A scene matches on a word in its
draft as well as on its title or synopsis, and the preview under the result
shows the line the word was found in rather than the opening of the scene — so
"where did I write that" is one shortcut away.

**Whole words**, beside the search box, narrows matching to complete words.
Off — the default — `tin` also finds *casting* and `Bel` also finds *Bellhouse*,
which is what you want when you are hunting a half-remembered line. On, it finds
only the word itself, which is what you want when your names are short and
invented. It behaves exactly like the switch of the same name in
[Find & replace](#find--replace), and the preview and the highlight follow it,
so a result always shows you the match it was found by. PlotWeave remembers the
setting. To change what you find rather
than just go to it, use **Find & replace** on the Manuscript screen, which
works across every scene at once.

While reading, search stays inside the book you have read: a scene you have not
reached is not searched, and knowledge facts — which are the whole of who knows
what, and when — are not searched at all.

![Search palette](images/16-search.png)

---

## Undo, redo & recent changes

PlotWeave records every edit you make as you make it, so a mistake is a step
backwards rather than a rebuild.

**Undo** is the left arrow in the top bar, and **Ctrl/⌘+Z** anywhere outside a
text box. Inside a text box, Ctrl/⌘+Z is your browser's own undo, working letter
by letter — PlotWeave deliberately stays out of the way there.

**Redo** is the right arrow, **Ctrl/⌘+Shift+Z**, or **Ctrl+Y**. It puts back
whatever you just undid, and you can walk forward through several undos in turn.
As in any editor, making a *new* edit clears the redo: putting the old change
back at that point would land it on a story that has since moved on.

Press it repeatedly to walk back through your recent edits. Each press takes
back one *action*, which is not always one record:

- **Deleting a character** brings back their relationships, goals, faction
  memberships, and per-chapter state along with them.
- **Reordering two scenes** puts both back, never half the swap.
- **Deleting a multi-scene selection** restores the whole selection at once.
- **A burst of typing** in chapter notes or a lore page counts as one edit, not
  one per pause — so undo takes back what you just wrote rather than a fragment
  of a sentence.

When you delete something, a message appears at the bottom of the screen naming
what went, with **Undo** beside it. It's the fastest way back, and on a phone
it's right under your thumb.

**Recent changes** (the clock icon in the top bar, or in the menu on a phone)
lists your recent edits, newest first, with the time each happened. Each entry
names the record and what it touched — *Edited chapter “The Bell Tower” —
notes*, *Edited scene “The gate opens” — tension and title* — so you can tell
one edit from the next, and recognise your own work, without opening anything.
Records that carry no name of their own are named by what they join: a knowledge
reveal reads *Added knowledge reveal “Perrin Vaux — Cathe Vaux thinned the tin”*,
a faction membership names the character and the faction, and a character's state
at a scene is named by the character.
The name is the record's current one, so renaming something updates the history
entries that mention it. Only the newest can be undone, and the panel says so
once there's more than one entry: history is a stack, so taking one from the
middle would leave the later edits resting on a state that never existed.

![Recent changes](images/53-recent-changes.png)

Redo is as careful as undo about acting in whole steps: redoing a deleted
character removes their relationships and goals again, and redoing a reorder
moves both scenes.

> **Note:** importing a world, generating one from AI, or importing a manuscript
> starts a fresh history. Those are single large acts rather than hundreds of
> small ones, so undo is empty straight afterwards and the button is greyed out.
> Your work is safe — it just can't be stepped back through. Export before a big
> import if you want a way back.

---

## Writer's Brief

The **Writer's Brief** (the scroll icon in the top bar) is a focused, at-a-glance
panel for the scene under the time cursor. Select a scene and the brief shows
the chapter synopsis, the active scene's details (including the in-world date —
or day number if you haven't set up a calendar), the other scenes in that
chapter, and a per-character state readout — including **"carried forward"**
badges where a character's state was inherited rather than freshly set.

If the scene has a **Setting** — the place it happens, set on the scene itself
when you add it or from its card afterwards — the brief names it above the
description. That is the scene's own location — where it
happens — as distinct from where each character is recorded as being, which is
what the per-character readout underneath shows. The two can disagree, and
seeing both is how you notice.

**The brief walks the book on its own.** Its header carries **previous** and
**next moment** buttons, and every scene it lists is clickable, so you can read
straight through a run of scenes — across chapter boundaries — without closing
the panel and reopening it at each step. The buttons go quiet at the two ends of
the book. When a
world calendar and a character's birth date are both set, each present character
also shows their **age** at that point in the story.

Each character present also carries a badge for the factions they belong to. A
separate **Factions in scene** section groups the cast into sides and names each
side's members — and it appears only when that grouping says something the
badges do not: when two or more factions are present, or when one faction covers
only some of the people in the scene. With a single faction that everyone
present belongs to there is nothing left to group, so the section stays away
rather than naming the same alliance a second time.

The brief also collects active relationships, item placements, and relevant lore.
Lore linked to a present character appears automatically; a page revealed at the
active scene is marked **NEW** and links directly to its editor.

![Writer's Brief](images/17-writers-brief.png)

If the cursor is on **All chapters**, the brief has no moment to describe — so
instead of waiting for one it lists every scene in the world, grouped by chapter
in reading order. Click one and the brief fills in around it; the bottom bar's
cursor moves with it, because they are the same cursor. In a world with no
scenes at all there is nothing to list, and the panel offers **Open Timeline**
instead.

![The brief's scene picker](images/57-brief-scene-picker.png)

It's designed to sit open beside your manuscript while you draft.

---

## Calendar & character ages

By default PlotWeave measures story time in **in-world days** — day 0 is the
start of a timeline, and each scene's *travel days* push the clock forward. Turn
those day numbers into real dates by giving your world a **calendar** in World
settings.

Click **Enable calendar** to start from a standard 12-month, 365-day year, then
tailor it. The same button is on the **Calendar** screen itself when the world
has no calendar yet, so the first visit there can start one rather than sending
you off to find the setting.

**If your world's year isn't Earth's**, the buttons beside it start you from a
different shape instead — *Four seasons* of 91 days, or *Twelve months of
thirty* with five festival days outside them. They set the day counts, which is
the tedious part; the names are yours to change afterwards. They're offered only
before your world has a calendar, so applying one can't overwrite months you've
already written.

![Starting a calendar](images/63-calendar-presets.png)

- **Start year** — the year that in-world day 0 falls in.
- **Year suffix** — an era label shown after the year, e.g. *AC* or *TA*.
- **Months** — folded away until you press **Months**, since a dozen rows of
  boxes is a lot of settings page to scroll past when you only came to check
  the year. Open it to rename them, set each month's length in days, and add or
  remove months; a fantasy calendar can have any number of months of any
  length. The line beside the heading tells you how long the year is and how
  many months make it without opening anything.

- **Days outside the months** — tick *outside the months* on an entry and it
  stops being a month: a one-day entry reads as its bare name, so the Shire
  Reckoning's *Midyear's Day* is a date on its own rather than "1 Midyear's
  Day". Use the **+** on any row to put one in the middle of the year, where
  intercalary days usually fall, rather than only at the end. A longer run keeps
  its numbering, which is what *2 Lithe* means.

What a year cannot yet do is change shape from one year to the next, so leap
days — the Shire's Overlithe, or a real February — have no rule behind them. A
calendar that needs one will be right in every ordinary year and a day out in
the leap ones.

![Calendar editor](images/30-calendar.png)

With a calendar set, in-world dates appear wherever the day clock is shown: the
active scene's date in the Writer's Brief, and the chip on each scene card in a
chapter, which reads *5 Thawmonth, 998 AC* instead of *Day 4*. Without a
calendar that chip stays a day count, and hovering it says what it counts
from — days since the story's first scene.

**Character ages.** Give a character an optional **birth date** on the Overview
tab of their profile (the month/day/year pickers use your calendar's months).
PlotWeave then computes and shows the character's **age** at the scene under the
time cursor in the Writer's Brief — counting birthdays passed, so it stays
correct even with irregular month lengths. A character born after the current
moment simply shows no age.

The calendar and every birth date travel with the world through **export /
import**, so shared or backed-up worlds keep their dates intact.

### Calendar view

Once a calendar is set, the **Calendar** view (in the nav) lays your scenes onto
month grids by their in-world date, so you can see the shape of your story in
time. Each month that your story touches gets a grid; scenes appear as chips on
their day, and flashbacks are marked with a small clock icon.

![Calendar view](images/35-calendar-view.png)

A day outside the months gets a row of its own, one cell wide, headed by its
name and carrying no day number — because the name *is* the date.

- **Click** a scene chip to jump to it in the timeline.
- **Drag** a chip to another day to **pin** its in-world date — this sets the
  scene's explicit in-world time, overriding the travel-day clock for that scene
  (handy for flashbacks/flash-forwards, or to nail a scene to a specific date).

**Scenes with no timing set are marked.** A scene that says nothing about how
much time has passed doesn't move the clock, so it sits on the same day as the
scene before it — which is right, but early on it means most of your story
stacks onto the first day of the year. Those chips are drawn with a dashed
amber outline, and a line at the top of the screen counts them: *"3 scenes have
no timing yet."* Set **Elapsed Time** on the scene, or drag its chip onto a day
here, and the mark goes.

A scene is not counted as untimed when it is the **first on its timeline**
(there is no earlier scene for it to follow), when its elapsed time is
deliberately **0** (the same day is an answer), or when it carries a pinned
date. An unpinned **flashback** is always counted, because the day it shows is
the surrounding scene's, not its own.

---

## Continuity Checker

The **Continuity Checker** (the shield icon) scans your whole world for
contradictions and surfaces them grouped by category, with a count of errors,
warnings and observations.

**Errors and warnings are contradictions in your record. Observations are
opinions about craft**, and they are ranked below both, drawn without the
warning triangle, and counted separately — because they are the ones where "yes,
I meant that" is the usual answer. A long run of one point of view, a subplot
that goes quiet, a character who leaves a faction with nobody replacing them:
all of these are ordinary things a novel does. They are still reported, because
on your book one of them may be exactly what you wanted to know — but they never
sit above *"this object is in two places at once"*.

**And where an observation has an answer, the app takes the answer rather than a
dismissal.** Say where a subplot resolves, or that a character leaves a faction
for good, and the finding goes because it has been *answered* — the same way
ticking **"They came back in this scene"** settles a revival. What you record is
a fact about your book, so the map, the cadence strips and the faction views know
it too; a "hide this" button would tell them nothing. Each of these answers only
what it answers: a resolved subplot that still goes quiet for ten chapters in the
middle is still reported for that.

Typical catches:

- A character who is **alive again after dying** in an earlier chapter —
  reported once, where they come back, not on every scene afterwards. If they
  were revived, say so: with the time cursor on the scene where it happens, set
  their status to Alive on the **Current State** tab and tick **"They came back
  in this scene"**. The finding goes, and the revival is recorded in the world
  rather than dismissed.
- A **long run of one point of view** — five scenes or more in one head, in a
  book that usually changes viewpoint more often than that. Both halves matter:
  a novel told entirely from one character is never reported, because its runs
  *are* its habit, and neither is a stretch of three or four in a book that
  alternates every scene. A book with no point-of-view characters at all — a
  narrator — is left alone entirely.
- A character who **leaves a faction with nothing following it**. Often that is
  the point — they walk away from the family and join nobody — so the finding
  offers *"X leaves for good"*, which records it on the membership. You can also
  tick **"They leave for good"** on the membership itself, under **Factions** on
  the character. Someone who *dies* as they leave is never reported here: the
  dead join nothing, and the checker knows it.
- A **dead character** appearing in a later scene (with a one-click "mark as
  flashback" if intentional). The scene where you *record* the death is not one
  of these — that scene is where they die, so they are alive walking into it.
- A character who **appears before their first snapshot**, or is at a
  **destroyed location**. The first of those offers **Record initial state
  here** — one click writes the missing starting state (alive, nowhere in
  particular, carrying nothing) at the scene they first appear in, and the
  finding clears. You can then edit that record like any other.
- A character who **can't reach a location in time** — when a move covers more
  map distance than their travel mode can cross in the in-world days available
  (using the map scale, the mode's speed, and any road/river/trail along the
  way). The finding offers a one-click **"Allow N more days"** that lengthens the
  scene so the journey becomes possible.
- A character who **travels through a destroyed or abandoned region**.
- A character who belongs to **two hostile factions at the same time** —
  memberships carry a start and an end, so "at the same time" is an overlap and
  not a guess. Reported once per pair of sides rather than once per scene. A
  double agent is a real thing, so it is a warning.
- An **item carried by a character who is dead**. The scene where the death is
  recorded is not one of these — dying with your sword in your hand is not a
  continuity error.
- A character **named in the prose but not in the cast** of that scene. This is
  the one you meet most while drafting, and it offers **Record as mentioned** —
  which says only what the check observed: the name is in the text. That clears
  the warning without claiming the character is in the room, and there is a
  **Record every name as mentioned** button to clear a drafting session's worth
  at once. If they really are in the scene, add them to the **cast** on the
  scene card instead; that is the larger claim, and the rest of the app reads
  it — the map places them, the Brief lists them, and the Character States panel
  will ask you what state they are in.
- A scene with **no point of view**, but only in a book that otherwise names
  one. The check asks what your own habit is — enough scenes with a POV to be a
  pattern, and few enough without to read as omissions — and stays silent
  otherwise, so a book that never uses the field is never nagged about it.
- A scene whose **POV names no character** — the point-of-view field is still
  pointing at somebody who has since been deleted. It offers **Clear the POV**,
  and because this is usually one deleted character repeated across many scenes,
  the group carries **Clear every unknown POV** as well. Nothing is discarded:
  the field already referred to a record that is not there.
- A character **in a scene set somewhere they are not**. The scene carries a
  place and every character carries theirs, and when the two disagree the
  finding offers **Move to <place>** — one click records them at the place the
  scene already names. It stays quiet in the two cases where a disagreement is
  not one: a journey recorded at that scene means they walked in, and a
  character with no location recorded yet is not disagreeing with anything.
- A character **in a scene dated before they were born** — for worlds that set
  both a [calendar](#calendar--character-ages) and a birth date. Undated
  flashbacks are left alone, since their day is borrowed from the scene beside
  them; a flashback that states its own in-world time is checked like any scene.
- A **relationship with a state recorded after it ended**, the counterpart to
  the one that starts too early. Only the last ending counts — relationships
  break and mend, and a writer who records the mend has said what happened.
- A **fact the reader never learns** — recorded knowledge that no point-of-view
  scene ever carries and that has no explicit reader reveal set, so it shapes
  nothing a reader can feel. Withholding on purpose is ordinary in a mystery, so
  it is a warning; set a reader reveal to say the withholding is deliberate.
- A **destroyed item whole again**. Set its condition to **repaired** on the
  scene where it was mended and the finding goes — the same bargain as a
  revival. Ordinary repair is not reported at all: *damaged → intact* and
  *lost → found* are not returns from a terminal state.
- An item that is used before it was acquired, an impossible item handoff, a
  relationship or faction membership that starts at an invalid moment, or a POV
  character who should not be available at that scene.

A **Places & time** section holds the two findings that are about the world
rather than about anybody in it:

- A **destroyed place standing again** — the counterpart of a character coming
  back, for locations. Towns do get rebuilt, so set the location's status to
  **rebuilt** on the scene where it happens and the finding goes. It reports the
  first return only; a place that comes back and is razed again has a history,
  not a fault.
- A **chapter with no scenes** — a heading with nothing under it, which the
  manuscript skips, the pacing curve has no point for, and the time cursor steps
  straight past.
- A **scene set before the one in front of it**. Giving a scene an explicit
  in-world time overrides the clock derived from travel days, so a pin can put a
  scene earlier than the scene preceding it. Mark it a flashback — which is what
  the pin is mostly for — or correct the date.

### Saying a thing came back

**Revived**, **repaired** and **rebuilt** are states you set, not warnings you
dismiss. All three work the same way: record the return on the scene where it
happens and the Continuity Checker has nothing left to report, because you have
said what happened rather than told it to be quiet.

That matters beyond the checker. A suppressed warning is invisible — nothing
anywhere in PlotWeave says a character was revived. A state is part of the
world: it travels in your export, it shows on the map and in the Writer's Brief,
and it survives edits that would orphan a suppression. Suppression is still
there for the genuinely one-off finding you want to keep and ignore.

A return does not wear off. In the delta model a sword stays **repaired** until
some later scene says otherwise, exactly as **found** already works — a repaired
sword is not a never-broken one.

![Continuity Checker](images/18-continuity.png)

**Within a category, findings are grouped by what went wrong.** A category that
holds more than one kind of fault names each run and counts it — *Alive after
dying 1* above *Dead character in a scene 3* — so one repeated mistake cannot
bury the one that matters. Errors come first whatever their count, which is the
case worth reaching: a single error sitting among fifty warnings used to be
wherever its check happened to run. A category with a single kind in it is listed
plainly, since a heading there would only repeat the category name.

**A run of the same fixable fault can be cleared in one go.** Where two or more
findings share a kind and each offers the same one-click fix, the group carries
a batch button above it — **Record initial state for all N**, for the case where
eight characters walk into one scene and none of them has a starting state yet,
**Move everyone to the scene N**, for an ensemble arriving somewhere together,
or **Clear every unknown POV N**, for a deleted character still named as the
point of view of half a book. Anything you have suppressed is left out, and the
count on the button tells you how many it will touch. Only fixes that mean the
same thing for every row get a batch button: the travel-days fix picks a
different number for each scene, so it stays one at a time.

Each finding links straight to the offending scene so you can fix it in context.
The travel checks rely on a **map scale** (set one on the map) and **travel
modes** with speeds (in World settings). The stale-snapshot sensitivity is
configurable in Settings. If a finding is intentional, **suppress** it and add an
optional reason. The checker can show suppressed findings later so you can review
or restore them.

---

## World settings & export

Per-world settings let you rename the world, set a **cover image**, pick a
**theme**, define **travel modes** with speeds for map distance calculations, set
the **continuity stale-snapshot threshold**, set a book-level **word target** and
**deadline** (for the dashboard's [Writing Progress](#the-world-dashboard)
burndown and finish projection), and configure an in-world
**[calendar](#calendar--character-ages)** for story dates and character ages.

The world's **name** and **description** are edited by clicking what they say:
the row is the control, and an empty description reads *Describe your world…*
rather than announcing that there isn't one.

There are eleven sections in all, so the screen opens with a row of chips —
one per section — that stays put as you scroll and jumps you straight to the
one you came for. It lists only the sections actually on screen: reading mode
puts most of them away, and the chips go with them.

**Every section folds.** Click its heading to close it and click again to open
it; **Collapse all**, at the end of the chip row, turns the whole screen into a
list of headings you can pick from, and becomes **Expand all** once it has.
Sections start open, and what you fold away is remembered on this device — a
chip still jumps to a section you've closed, opening it on the way.

![World settings with every section folded](images/64-settings-collapsed.png)

![World settings, with its section index](images/60-settings-index.png)

Worlds with more than one timeline also get a **Timelines** section: give each
timeline a **start day** for its clock. By default every timeline starts at
day 0 — right for parallel storylines, but a frame narrative's past or an
earlier era belongs at a different point on the world clock. Setting, say,
day 10,000 on the "present" timeline makes chronological merges (the
All-timelines view and the bottom bar) and the calendar place both eras where
they actually fall. A scene's pinned in-world day stays relative to its own
timeline's clock.

**Theme** is two settings in one section, because there are two things to
decide. **App theme** is the one PlotWeave itself wears — on the world list, and
in every world that has not asked for something else. Below it, the seventeen cards
set *this* world's theme, and the first of them, **Inherit app theme**, hands the
decision back to the setting above. So a Gothic novel can be Horror and a space
opera Sci-Fi while everything else stays with whatever you chose for the app.
The seventeen are Dark Slate, Fantasy, Sci-Fi, Cyberpunk, Dystopian, Horror,
Gothic, Mystery, Mythic, Adventure, Historical, Western, Action, Noir, Romance,
Cosy and Paper; each changes
colours, fonts, textures and the timeline bar's pulse together. **Gothic** is
candle and cold stone where Horror is blood and bone; **Mystery** is gaslight,
fog and foolscap where Noir is a monochrome 1940s; **Mythic** is bronze, marble
and the wine-dark sea; **Adventure** is charts, brass and canvas, for the
sea-stories and swashbucklers that do not want Western's dust; **Dystopian** is
ash, concrete and rust, which is neither Cyberpunk's neon nor Sci-Fi's clean
telemetry; **Historical** is ink, parchment and candle, for the period novel
that is not an adventure; and **Cosy** is moss, cream and a lamp in the window
— the one theme here that is not moody, and the only one with rounded corners.

**If you would rather write on a light desk, pick Paper.** It is the one light
theme: cream, ink and daylight, with the pacing curve, the status pills and your
cast darkened to read on a pale page rather than a dark one. Set it as the app
theme and everything wears it, or set it on a single world and leave the rest as
they are. The other sixteen are dark by design — Paper is a light *theme*, not a
switch that turns the other sixteen inside out, and PlotWeave does not follow
your system's light/dark setting on its own.

Each theme also has a **tempo**: the dot marking your place on the timeline bar
pulses at a speed that suits it — Action races, Noir barely stirs, Cosy is
unhurried. If your system asks for reduced motion, it stops in every theme. Themes colour the space around your
cards and panels but never draw over it: what sits behind the app is soft
gradient, and nothing is ruled across the screen.

A theme reaches further than the frame. The **pacing curve**, the **scene
status** pills and your **cast colours** are all drawn from it, so Noir's
tension ramp is muted greys rather than a rainbow and Cosy's runs moss to
honey; the status pills read as a progression from Idea to Final rather than
five unrelated colours. Characters keep a colour of their own — the hue still
comes from the character, so nobody changes identity when you change theme, and
no theme is allowed to wash the cast into one shade. Most themes also set the
face your **manuscript** is written in: Noir gives you a typewriter, Historical
a book face. Themes whose lettering is a screen sans leave your prose in a
serif, because prose set in a UI font is a worse read whatever the mood.

The **cover image** appears on the world's card in the selector and in the
dashboard header. **Upload** an image file or **link** one by URL (the link
icon), and **Remove** it at any time — the same as portraits elsewhere in the
app. Click the cover to
[open it full size](#viewing-pictures-full-size).

![World settings](images/15-settings.png)

**Export** options:

- **Export as HTML** — a read-only, shareable snapshot of the world that anyone
  can open in a browser.
- From the world card menu, export the full world as a **`.pwk`** file (data),
  optionally split with a **`.pwb`** images file. These are the files you import
  back on the world selector — the app's portable, offline save format.

### Database health

Deleting a parent record can occasionally leave an old snapshot, membership, or
sub-map reference behind—especially after importing older files. **Scan for
orphans** reports those unreachable records by table, and **Clean up** removes
only the records whose parent no longer exists.

### Folder and cloud sync

On Chrome, Edge, and the desktop app, choose a **sync folder** to bind the world
to a `.pwk` file in any local folder—including one managed by Google Drive,
OneDrive, Dropbox, or another file-sync service. **Save** writes the current
world; **Load** previews the file before applying it.

- **Smart merge** combines the two copies field by field, which is useful when
  the same world was edited on two devices. Lists are combined rather than
  replaced: if you added one character to a scene's cast and someone else added
  another, the scene ends up with both. Tags, aliases, inventories and plot
  threads work the same way, and the order you each had is kept.

  Reordering survives too. Moving a card writes only that card's position, so
  two people rearranging different scenes both get their way, and both devices
  end up with the same sequence.

  Single values — a name, a description, a status — cannot be combined, because
  the file records what each copy *says*, not what each person *changed*. Where
  both copies changed one, PlotWeave shows you the two versions side by side
  before anything is applied, and you choose: **Most recent**, **Keep mine**, or
  **Use theirs**.

  Anything you deleted stays deleted — deletions travel with the file rather
  than reappearing because the other copy still had them. If you deleted
  something on one device and then edited it on the other, the edit wins and the
  record is kept.
- **Replace all** overwrites the local world with the selected file.
- **Change folder** moves the binding. **Disconnect** removes the binding without
  deleting the file already stored in that folder.

The panel shows where the folder stands relative to this device:

| State | Meaning |
| --- | --- |
| **Up to date** | The folder holds the same version as this device. |
| **Unsaved changes** | You have edits the folder hasn't received yet. |
| **Newer copy in folder** | Another device saved to this folder — **Load** to catch up. |
| **Both changed** | You edited here *and* another device saved — see below. |

The same status appears **next to the world name in the top bar**, so you can
tell at a glance whether your work is reaching the folder without opening
Settings.

Because the bound folder is usually shared between your machines, PlotWeave
never overwrites the folder's copy behind your back. When another device has
saved since you last did, and you have your own unsaved changes, auto-save
writes to a **conflict copy** beside it — `My World (conflict copy 2026-07-29
0315).pwk` — rather than either destroying their version or leaving yours
unsaved. Both versions survive, and you can sort it out whenever you like:
**Load** compares the folder's copy against yours, and **Save over** replaces it
with this device's.

If PlotWeave has lost permission to the folder (browsers drop it between
sessions), the indicator says **Reconnect folder** — auto-save does nothing
until you re-grant access from World Settings.

![Database health and folder sync](images/43-settings-sync.png)

---

## Help

The **Help** panel (the ? icon, top-right) is available on every screen with
in-app explanations of each concept — the time cursor, snapshots, timelines,
maps, playback, and the rest.

The Help panel also lists keyboard shortcuts: **Ctrl/⌘+K** opens search,
**Shift+click** selects a scene range, arrow keys and **Enter** navigate search
or continuity results, and **Esc** closes panels or cancels inline edits.

![Help panel](images/19-help.png)

---

## Keyboard, screen readers and touch

Every field and control is named, so a screen reader announces *Days since the
previous scene* rather than an unlabelled number box, and voice control has
something to say. That includes the ones drawn as icons alone — the scene
steppers on the chapter bar, the add button beside a travel mode, the rename and
delete beside a lore category.

A field's name belongs to the field, so **clicking a label puts the cursor in
the box beside it** — on Current State, in the Add Location dialog, anywhere a
name sits above a control. Where a name sits above something that isn't a single
control — the Alive/Deceased pair, a list of what someone is carrying — it names
the group instead, so a screen reader is never promised a control that isn't
there.

**Controls that appear on hover cannot be clicked while they are hidden.** The
small delete on a world card, a plot thread, a lore category, a saved scene
version, a map route or region shows itself when you hover the row or move focus
onto it, and until then it takes no clicks at all — so a click on an apparently
blank stretch of a row can never delete anything.

**On a phone or tablet it works differently.** With no hover to wait for, these
controls are simply drawn all the time — so nothing is hidden, nothing is
lurking, and what you can see you can tap. Every one of them asks before it
acts, which is what takes the place of the hover on a device that has none.

Selecting scenes for a bulk action needs no hover on any device: the checkboxes
are always there on touch, and on a phone each one answers to a tap anywhere in
the margin beside its scene, not only to the small box itself.

---

*PlotWeave keeps all your data on your own device. Export regularly to back up or
move between machines.*
