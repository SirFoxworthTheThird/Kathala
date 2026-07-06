# PlotWeave — User Guide

**PlotWeave** is a local-first story bible for fiction writers. It tracks your
characters, timeline, maps, items, relationships, lore, and continuity as your
story evolves — all stored privately in your browser (IndexedDB), with no
account and no backend. You can run it in the browser or as a desktop app.

This guide walks through every part of the app. All screenshots use the bundled
example world, *Middle Earth* (a Lord of the Rings sample you can import to
explore).

---

## Table of contents

1. [Core concept: the time cursor](#core-concept-the-time-cursor)
2. [Getting started — the world selector](#getting-started--the-world-selector)
3. [The world dashboard](#the-world-dashboard)
4. [Timeline & events](#timeline--events)
5. [Chapter detail](#chapter-detail)
6. [Characters](#characters)
7. [Cast Balance](#cast-balance)
8. [Plot Threads](#plot-threads)
9. [Maps](#maps)
10. [Items](#items)
11. [Relationships](#relationships)
12. [Character Arc grid](#character-arc-grid)
13. [Lore](#lore)
14. [Factions](#factions)
15. [Knowledge](#knowledge)
16. [Search](#search)
17. [Writer's Brief](#writers-brief)
18. [Continuity Checker](#continuity-checker)
19. [World settings & export](#world-settings--export)
20. [Help](#help)

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

### Chapter detail

Opening a chapter shows its events in order, each with the characters involved,
location, tags, and draft/written status. The right side holds a live
**Character States** panel (where everyone is at this chapter) and a freeform
**Writer's Notes** field that auto-saves.

![Chapter detail](images/05-chapter-detail.png)

---

## Characters

The Characters roster is your cast list, with portraits and a search box. The
count badge tracks how many characters you're following.

![Character roster](images/06-characters.png)

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
geographic tiles). Place **location markers**, group them into **layers** and
**sub-maps** (drill into a city from the world map), draw **regions** and
**routes**, and set a **map scale** to unlock distance measurement.

![Maps](images/08-maps.png)

The left sidebar lists map layers and locations; the right-hand tools toggle
characters, trails, labels, journeys, and locations. Drag a character (selected
from an event in the timeline bar) onto the map to place them. **AI Moves** and
**Export** round out the toolbar.

---

## Items

Track the objects that matter — weapons, artefacts, documents, consumables — with
thumbnails, categories, and descriptions. Like characters, items have per-chapter
**placements** (who holds an item, or where it is, at any point in the story).

![Items](images/09-items.png)

---

## Relationships

The Relationships graph visualises how your cast connects. Each edge is a
labelled, colour-coded relationship (allies, rivals, family, lovers…), and the
graph is fully pannable/zoomable with a minimap.

![Relationships graph](images/10-relationships.png)

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

Per-world settings let you rename the world, pick a **theme** (Default, Fantasy,
Sci-Fi, Cyberpunk, Horror, Western, Action, Noir, Romance), define **travel
modes** with speeds for map distance calculations, and set the **continuity
stale-snapshot threshold**.

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
