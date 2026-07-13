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

---

## Table of contents

1. [Core concept: the time cursor](#core-concept-the-time-cursor)
2. [Getting started — the world selector](#getting-started--the-world-selector)
3. [Import a manuscript](#import-a-manuscript)
4. [Generate a world from AI](#generate-a-world-from-ai)
5. [Start a sequel](#start-a-sequel)
6. [The world dashboard](#the-world-dashboard)
7. [Timeline & events](#timeline--events)
8. [Chapter detail](#chapter-detail)
9. [Manuscript](#manuscript)
10. [Characters](#characters)
11. [Cast Balance](#cast-balance)
12. [Plot Threads](#plot-threads)
13. [Maps](#maps)
14. [Items](#items)
15. [Relationships](#relationships)
16. [Character Arc grid](#character-arc-grid)
17. [Lore](#lore)
18. [Factions](#factions)
19. [Knowledge](#knowledge)
20. [Search](#search)
21. [Writer's Brief](#writers-brief)
22. [Continuity Checker](#continuity-checker)
23. [World settings & export](#world-settings--export)
24. [Help](#help)

---

## Core concept: the time cursor

Everything in PlotWeave is read *relative to a chapter*. The chapter selector in
the top bar — labelled **All chapters** by default — is a **time cursor**. Move
it to a chapter and the whole app answers the question *"what is true at this
point in the story?"*: where each character is, what they're carrying, who's
alive, which locations are destroyed, and how relationships stand.

State is never guessed across chapters. Each fact is an explicit **snapshot**
record tied to a chapter, so a character's location in Chapter 9 is something you
set, not something the app infers. When you create a new chapter, it inherits the
previous chapter's snapshots so you only edit what actually changed.

You'll see the time cursor (the pill next to the world name) on nearly every
screen in this guide.

---

## Getting started — the world selector

The first screen lists your worlds. From here you can **create a new world**,
**generate one from AI**, or **import** an existing `.pwk` file (PlotWeave's
export format). If your export was split into data + images, select both the
`.pwk` and its `.pwb` images file together.

![Empty world selector](images/01-home-empty.png)

Once you have worlds, each appears as a card with its name, last-edited date, and
description. Click a card to open it; the ⋯ menu on each card exports or deletes
that world.

![World selector with worlds](images/02-home-worlds.png)

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

Each parsed scene becomes an event with its prose attached, so the imported draft
flows straight into the Manuscript view and reads back as one continuous document.
(Import handles Markdown and plain text today; `.docx` is planned.)

---

## Generate a world from AI

If your story lives in your head or in a synopsis rather than a finished draft,
**Generate World from AI** builds the whole structure — characters, factions,
relationships, chapters, events, and who-knows-what — from a story document, using
any AI assistant (ChatGPT, Claude, Gemini…).

![Generate world from AI](images/23-generate-ai.png)

1. **Copy the prompt** from the dialog and paste it into your AI assistant,
   followed by your story text.
2. The assistant replies with a compact JSON **story spec**.
3. **Paste that JSON** back into the box in the dialog. A live preview shows what
   it found — character, chapter, event, and faction counts.
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
changes the original. Book one's chapters, events, and scene prose are *not*
copied — book two is a fresh narrative that begins where the last one left off.

---

## The world dashboard

Opening a world lands you on its dashboard — a bird's-eye view of the whole
project. Stat tiles summarise the timeline, cast, maps, relationships, items,
snapshot coverage, and continuity status. Below them are recent events, scene
status, and analytics panels (Cast Balance and Plot Threads, covered later).

![World dashboard](images/03-dashboard.png)

The tiles are links — click **Timeline**, **Characters**, **Maps**, or any other
tile to jump straight to that area.

---

## Timeline & events

The Timeline is the spine of your story: a list of chapters, each holding an
ordered set of **events** (scenes/beats). A **pacing curve** across the top plots
dramatic tension chapter by chapter once you rate scenes, so you can see the
shape of your story at a glance.

![Timeline view](images/04-timeline.png)

- **Narrative vs. Chronological** — toggle between the reading order and the
  in-world order (useful when you use flashbacks or in-world dates).
- **Add Chapter**, **New Timeline** (for alternate/parallel timelines), and
  **Generate with AI** all live in the header.
- Each chapter row has **Set Active** (move the time cursor here) and an
  **open** button for its detail page.
- The chapter bar at the bottom of the screen also lets you **play the story**
  and **Compare chapters** — a diff of exactly what changed between any two points
  (who moved, gained or lost items, died, or shifted relationships).

### Chapter detail

Opening a chapter shows its events in order, each with the characters involved,
location, tags, and draft/written status. The right side holds a live
**Character States** panel (where everyone is at this chapter) and a freeform
**Writer's Notes** field that auto-saves.

![Chapter detail](images/05-chapter-detail.png)

**Generate / Update Chapter with AI.** From a chapter you can hand your scene
text to an AI assistant (via a copy-paste prompt, like the world generator) and
have it fill in the events, character states, and a dramatic-**tension** rating
for each event — the ratings feed the pacing curve on the Timeline. *Generate*
drafts a new chapter; *Update* re-derives an existing one from its prose.

---

## Manuscript

The **Manuscript** view stitches every scene's prose into one continuous
document, in reading order, so you can read and export your book without leaving
PlotWeave. Write a scene's prose on its event, and it appears here automatically.

![Manuscript view](images/24-manuscript.png)

- **Draft vs. Reading** — Draft shows per-scene and per-chapter word counts, scene
  labels, and links back to each event; Reading hides the scaffolding for a clean
  read-through of only the written scenes.
- **Word goals** — set a target for the whole manuscript (in the header) and a
  per-chapter goal (in Draft mode); a progress bar tracks words against each.
  Per-chapter goals are saved with the chapter.
- **Export** — download or copy the manuscript as Markdown, HTML, or plain text.

Empty scenes are flagged with a "write this scene" link, so the manuscript
doubles as a checklist of what's left to draft.

---

## Characters

The Characters roster is your cast list, with portraits and a search box. The
count badge tracks how many characters you're following.

![Character roster](images/06-characters.png)

### Generate characters with AI

Building a large cast by hand is slow. **Generate with AI** (next to *Add
Character*) does it for you with any AI assistant. It works the same way as
[Generate a world from AI](#generate-a-world-from-ai), but scoped to one
section and added to the **world you're already in** — no new world is created:

1. Click **Generate with AI** and **Copy prompt**.
2. Paste it into ChatGPT, Claude, Gemini, or similar, then describe your story
   (or just list the characters you want) after the last line.
3. Paste the JSON it returns into the box. A preview tells you how many
   characters will be added.
4. Click **Add characters**. Any name that already exists in this world is
   skipped, so you can run it again to top up your cast without creating
   duplicates.

![Generate characters with AI](images/26-generate-characters.png)

> **Images: upload or link.** For a character's portrait — and likewise for item
> images and maps — you can either **upload** a file or **link an image URL**
> (the ⬆ upload and 🔗 link controls sit on the image). Linked images aren't
> stored in your browser, so they need an internet connection to display and can
> break if the source goes away; uploads are self-contained.

Opening a character gives you a tabbed profile:

- **Overview** — biography and portrait.
- **Current State** — location, inventory, alive status, and travel mode *at the
  current time cursor*.
- **History** — how their state changed chapter by chapter.
- **Appearances** — every event they're in.
- **Relationships**, **Lore**, and **Factions** — their connections and
  affiliations.

![Character detail](images/07-character-detail.png)

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
*Pursuit of the Nazgûl*), give each a colour, and tag events with the threads
they advance. The dashboard widget then draws a **cadence strip** per thread
across your chapters and flags trouble:

- **"goes quiet for N chapters"** — a thread that disappears mid-story.
- **"dangling"** — a thread that was raised and then never resolved.

![Plot Threads](images/21-plot-threads.png)

Tag a thread onto an event from the event's card; create threads inline with the
**+ New thread** button.

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

The left sidebar lists map layers and locations; the right-hand tools toggle
characters, trails, labels, journeys, and locations. To place a character
(selected from an event in the timeline bar), drag them onto the map — or, on
touch devices, tap the crosshair on their card and then tap a location. **AI
Moves** and **Export** round out the toolbar.

Press **play** in the chapter bar and the map becomes a playback stage: as the
story advances event by event, character pins glide between locations along their
routes, so you can watch your cast move through the world.

---

## Items

Track the objects that matter — weapons, artefacts, documents, consumables — with
thumbnails, categories, and descriptions. Like characters, items have per-chapter
**placements** (who holds an item, or where it is, at any point in the story).

![Items](images/09-items.png)

Like the cast, you can **Generate with AI** from the Items screen: copy the
prompt, describe your story, and paste back the JSON to add a batch of items to
the current world. It follows the same flow as
[generating characters](#generate-characters-with-ai) — names already present are
skipped, so re-running never duplicates.

---

## Relationships

The Relationships graph visualises how your cast connects. Each edge is a
labelled, colour-coded relationship (allies, rivals, family, lovers…), and the
graph is fully pannable/zoomable with a minimap.

![Relationships graph](images/10-relationships.png)

**Generate with AI** (top-left of the graph) adds relationships in bulk: copy
the prompt, describe your story, and paste the JSON back. Each relationship's two
endpoints reference characters by name — only pairs where **both** already exist
are added (unknown names are ignored), and a pair that already has a
relationship is skipped, so you can re-run safely.

Relationships are snapshot-aware too — they can change over the course of the
story (from *rivals* to *reconciled*), and the change is tied to the event where
it happens.

---

## Character Arc grid

The Arc view is a spreadsheet of your whole cast against every chapter. Each cell
shows a character's **status** (alive/dead), **location**, and a note at that
chapter, with a sparkline of their trajectory. Switch the columns between
**Characters**, **Chapters**, and **Events**, and export the grid as **PNG**.

![Character Arc grid](images/11-arc.png)

It's the fastest way to audit continuity across the entire book at once.

---

## Lore

Lore is your world's reference wiki — history, rules, and mythology that don't
change with time. Organise pages into **categories** (Artefacts, Peoples,
Places…), tag them, and optionally reveal a page only from a given event onward.

![Lore](images/12-lore.png)

---

## Factions

Factions are the organisations your characters belong to — kingdoms, guilds,
cults, fellowships. Each faction has a colour, description, and **members** (with
roles and optional start/end events), plus **faction-to-faction stances**
(allied, hostile, and so on).

![Factions](images/13-factions.png)

**Generate with AI** works here too: copy the prompt, describe your story, and
paste the JSON back to add factions to the current world. It follows the same
flow as [generating characters](#generate-characters-with-ai). Faction
**members** reference characters by name — only names that already exist in the
world are linked (unknown names are ignored, and no characters are created), so
generate your cast first.

---

## Knowledge

The Knowledge tracker manages **who knows what, and when they learn it** — the
backbone of mysteries and dramatic irony. Record a **fact** (a secret or key
piece of information), mark when the **reader** learns it, and log **reveals** to
individual characters at specific events. PlotWeave even **suggests facts from
your story** (for example, "Gandalf the Grey is dead · Ch. 17").

![Knowledge](images/14-knowledge.png)

Paired with the Continuity Checker, this catches a character acting on
information they shouldn't have yet.

---

## Search

Press **Ctrl/⌘+K** anywhere to open the command-style search palette. It searches
across characters, items, locations, chapters, and more, grouped by type, and
navigates you straight to any result with the keyboard.

![Search palette](images/16-search.png)

---

## Writer's Brief

The **Writer's Brief** (the scroll icon in the top bar) is a focused, at-a-glance
panel for the event under the time cursor. Select an event and the brief shows
the chapter synopsis, the active event's details (including in-world day), the
other events in that chapter, and a per-character state readout — including
**"carried forward"** badges where a character's state was inherited rather than
freshly set.

![Writer's Brief](images/17-writers-brief.png)

It's designed to sit open beside your manuscript while you draft.

---

## Continuity Checker

The **Continuity Checker** (the shield icon) scans your whole world for
contradictions and surfaces them grouped by category, with an error/warning
count. Typical catches:

- A character who is **alive after dying** in an earlier chapter.
- A **dead character** appearing in a later scene (with a one-click "mark as
  flashback" if intentional).
- A character who **appears before their first snapshot**, or is at a
  **destroyed location**.

![Continuity Checker](images/18-continuity.png)

Each finding links straight to the offending event so you can fix it in context.
The stale-snapshot sensitivity is configurable in Settings.

---

## World settings & export

Per-world settings let you rename the world, set a **cover image**, pick a
**theme** (Default, Fantasy, Sci-Fi, Cyberpunk, Horror, Western, Action, Noir,
Romance), define **travel modes** with speeds for map distance calculations, and
set the **continuity stale-snapshot threshold**.

The **cover image** appears on the world's card in the selector and in the
dashboard header. **Upload** an image file or **link** one by URL (the link
icon), and **Remove** it at any time — the same as portraits elsewhere in the
app.

![World settings](images/15-settings.png)

**Export** options:

- **Export as HTML** — a read-only, shareable snapshot of the world that anyone
  can open in a browser.
- From the world card menu, export the full world as a **`.pwk`** file (data),
  optionally split with a **`.pwb`** images file. These are the files you import
  back on the world selector — the app's portable, offline save format.

---

## Help

The **Help** panel (the ? icon, top-right) is available on every screen with
in-app explanations of each concept — the time cursor, snapshots, timelines,
maps, playback, and the rest.

![Help panel](images/19-help.png)

---

*PlotWeave keeps all your data on your own device. Export regularly to back up or
move between machines.*
