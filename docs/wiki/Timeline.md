# Manuscript: chapters & events

The Manuscript is the spine of your story: a list of chapters, each holding an ordered set of **events** (scenes or beats), and the book they make. It is **Manuscript** in the navigation (**Book** in [reading mode](Reading-Mode)). It was called the Timeline until the Timeline and the Manuscript became one screen, and an old `/timeline` link opens the same place.

A **pacing curve** across the top plots dramatic tension chapter by chapter once you rate scenes, so you can see the shape of your story at a glance.

---

## Concepts

| Term | Definition |
|---|---|
| **Timeline** | A named sequence of chapters — "Main Story", "Flashbacks" |
| **Chapter** | A structural unit grouping related events |
| **Event** | The unit of story time; all state is recorded per event |

---

## The page

**The Manuscript is one page.** The [binder](#the-binder) runs down the left, and beside it is the **book** — every chapter, with the orders, filters and actions below. There is no separate chapter screen: opening a chapter opens it in the book, with its panel beside the list (see [Opening a chapter](#opening-a-chapter)). **Whole book** at the top of the binder, or the ✕ on the panel, closes it.

- **Narrative vs. Chronological** — toggle between reading order and in-world order (useful with flashbacks or in-world dates).
- **Cards, Page and Read** — Cards is the book as scene cards; **Page** is the same book as one document to write in (see [Writing on one page](#writing-on-one-page)); **Read** is the book set for reading (see [Reading the book](#reading-the-book)).
- **Add Chapter**, **New Timeline**, and **Generate with AI** live in the header.
- **Every scene is a card.** Closed, it shows its title, status, tension, cast and setting; open it and it is the whole scene — the draft, the description, the cast, the setting — edited in place. **View from here** inside it moves the time cursor to that exact moment. Opening a card leaves the cursor where it is, so reading down the list does not keep changing every other screen.
- Each chapter row, and each scene card outside the open chapter, has an **open** button that opens its chapter.
- **Select events** with their checkboxes; **Shift+click** selects a range. The bulk toolbar moves the selection to another chapter, adds a tag, or deletes it.
- Once you have [plot threads](Plot-Threads), a **filter row of thread pills** appears above the chapters in Narrative view.

---

## Chapters

Create one with **Add Chapter**: a number, a title and an optional synopsis. The number is suggested — the next free one — and can be anything: 0 makes a prologue, and a number already taken puts the new chapter there and moves the chapters from it up by one, until a gap. The dialog says which before you add it, and one Undo takes it all back. Chapters already made are moved in the [binder](#the-binder) — Alt+↑ ↓, or drag — and take the same numbers in their new order, so a gap or a prologue's 0 stays put.

**A new chapter starts wherever the last one left off.** Nothing is copied into it: the state of every character, item and place is read back from the most recent scene before it, so a change you record earlier in the book reaches every chapter after it without anything to keep in step.

---

## Events

Open a chapter and click **Add Scene** at the foot of its list: a line appears where the scene will sit, for its title only. Enter makes it and puts you in its draft; the line's own **Add Scene** button makes it and leaves it closed; Escape makes nothing. Everything else is set on the card. Expanding an event card gives you:

| Field | Purpose |
|---|---|
| **Title** and **Description** | The scene |
| **Status** | Idea / Outline / Draft / Revised / Final |
| **POV character** | Whose perspective it's written from |
| **Location** | The location marker where it happens |
| **Involved / mentioned characters** | Who is present, who is referenced |
| **Involved items** | Objects featured |
| **Plot threads** and **motifs** | Which subplots and symbols it advances |
| **Structure beat** | Its slot on the [Structure Board](Structure-Board) |
| **Tension** | Feeds the pacing curve |
| **Travel days** | How many in-world days it covers |
| **In-world time** | Pin the event to a specific day, overriding the travel clock |
| **Is flashback** | Excludes it from travel and staleness continuity checks |
| **Tags** | Freeform labels |

Scene prose is written on the event too, or straight through on [Page](#writing-on-one-page), and reads as a book on [Read](#reading-the-book).

### The scene header

    [#The Kitchen @@Wren Halloway @@Sal'ka]

The first line of a scene can say where it happens and who is there, all at once. It is the only way to record that a character is present **without their name appearing in the prose**.

**It is never part of the book.** The line is rendered from the scene's own records rather than stored, so it costs no words, reaches no export, and appears in no search result. Change the cast in the panel, the Setting chip, or with `@@` while writing, and the line already says so — one copy of the fact, and this is a view of it.

The line is tinted, so you can see where it ends and your book begins. It is shown in Focus mode too, in the chrome above the page.

Editing the line edits the records, a moment after you move off it: remove a name and that character leaves the scene. **Deleting the whole line changes nothing** — clearing your screen is not emptying your cast, and it reappears where it was. **A bracketed line naming nobody and nowhere is prose**, so a note to yourself at the top of a draft stays a note.

The picker works inside the brackets and keeps the sigils when it fills a name in, and it will create somebody from in there — in a header there is nothing else naming a person could mean, so a single `@` reads the same as two.

A name your world cannot answer — a letter out of place, or the comma most people put between names before they learn the line uses spaces — **leaves the scene exactly as it was**, and says so in amber. Nobody leaves the room over a typo, and what you typed stays on the line, so the repair is one letter.

### Naming records while you write

| You type | What it records |
|---|---|
| `@Name` | The character is **mentioned** — the name occurs in this scene |
| `@@Name` | The character is **present** — they join the scene's cast |
| `@Item` | The item is in this scene |
| `@Place` | The scene's location, if it hasn't got one |

The sigils never reach your manuscript: pick a row and the name goes into the prose — **the name you were typing, not the one on the record**. A character filed as *Wren Halloway* with the alias *Wren* gives you **Wren** when you type `@Wren`, because an alias is you saying what you call her. Type toward the full name and you get the full name.

Typing `@@` **in the prose** for somebody who does not exist yet **says so** rather than going quiet, and points at the single `@` that would create them. (Inside the scene header it simply creates them, since there is no other reading.) Presence replaces a mention rather than joining it, by either route — a character cannot be both present and merely referenced.

Two deliberate limits on `@@` in the prose. It **offers people only**, because presence is about people and an item or place "being present" is what a single `@` already means. And out there it **never offers to create anybody**: asserting that somebody is in the room is a claim about a person who exists, and a new character is still one `@` away.

**Nothing reads your prose to decide any of this.** Fiction is full of *"she was not there"* and *"he imagined her at the gate"* — the keystroke is the assertion, never the sentence. The [Continuity Checker](Continuity-Checker) separately notices names in the prose that aren't accounted for, and offers to record them, which is an observation you answer rather than a decision it makes.

### Moving between scenes by key

In a scene's draft, **Ctrl+Alt+↓ / ↑** (⌘⌥ on a Mac) goes to the next or previous scene — saving this one and folding it away, crossing into the next chapter when this was its last scene — with the caret in the new scene's prose: at its start going on, at its end going back. **Ctrl+Enter** (⌘Enter) starts a new scene after this one: type its title where it will sit, press Enter, and you are writing in it; Escape goes back. **Ctrl+Shift+Enter** (⌘⇧Enter) splits the scene at the caret: the rest becomes a new scene after it, in the same room with the same people. The time cursor follows. While reading, the arrows go only through what you have reached, and Ctrl+Enter and Ctrl+Shift+Enter make nothing.

**Join with next scene…** in a scene's ⋯ menu folds the next scene in the chapter into this one — its prose on the end, its cast in this one, its recorded states moved here (the later kept where both recorded one) and anything pointing at it pointed here. It asks first. One Undo parts them again, as one Undo puts a split back.

Scenes move earlier or later with the ↑ ↓ on their cards, or by dragging them in the [binder](#the-binder).

---

## Writing on one page

**Page**, beside Cards in the header, shows the whole timeline as one document: each chapter a `#` heading, each scene a `##` heading, and the scene's prose under it — the same prose and titles as the cards, not a copy. Write anywhere; what you type is saved to its scene a second after you stop, or when you click away. Edit a heading to retitle its chapter or scene.

- The [binder](#the-binder) moves the page: a scene puts the caret at the start of its prose, a chapter brings its heading to the top.
- And the page moves the chapter and the time cursor: write, click or step into another chapter and it becomes the open one, its panel beside the page; go into another scene and the time cursor goes there, and the panel marks that scene's Character States **now** and scrolls them into view. The caret stays where you put it, and a cursor moved elsewhere from the top bar stays there until you go into another scene.
- **Enter** on a heading goes to the prose under it; on a chapter heading, to its first scene.
- **Ctrl+F** (⌘F) searches the whole book. The page only draws what is on screen, so the browser's own find cannot see the rest.
- **Split a scene by typing `## ` and a title on a line of its own.** When you leave the line, the prose below it becomes a new scene with that title — the same act as **Split** on a card. Nothing happens while you are still typing the line.
- **Start a chapter by typing `# ` and a title on a line of its own.** When you leave the line, a chapter begins there, after the one it was typed in, taking the scenes after it; typed inside a scene, the rest of that scene goes on as the new chapter's first scene, under the same title.
- **Under a chapter heading, `## ` and a title gives it a scene** — how a new chapter gets its first. Only headings can be typed there; Enter on the title of a chapter with no scenes makes the line.
- **Join by deleting a heading's whole line**: a scene to the scene before (the same act as **Join with next scene** on a card), a chapter to the chapter before — its scenes to the end of that one, its synopsis, notes and word goal added to that one's.
- **Ctrl+Z takes back typing since the last chapter or scene made or joined, and then that itself** (Ctrl+Shift+Z puts it back). You can type on straight away. The top bar's Undo takes these back too.
- Part of a heading — its `#` marks, a line break in its title — is refused, and so are joining the first chapter or a chapter's first scene, and two headings at once; the line above the page says why.
- A line of prose that already started with `#` stays prose until you edit it.
- A change made elsewhere — another tab, or the top bar's Undo — shows on the page, and anything typed there and not yet saved is kept.
- Page is offered on one timeline in narrative order, and not on *All timelines*, in Chronological order, or in reading mode.
- The scene keys work on the page: **Ctrl+Alt+↓ / ↑** goes to the next or previous scene, **Ctrl+Enter** opens the line for a new scene after this one with the `## ` typed for you, and **Ctrl+Shift+Enter** opens it at the caret, to split. A line they open and you leave untitled goes again.
- **Focus**, above the page, opens [Focus mode](Manuscript#focus-mode) on the scene the caret is in; what you write there is on the page when you come back.
- **`@` and `@@` work on the page** as in a scene card's draft: pick a character, item or place and the name goes into the prose, recorded against the scene you typed it in. Enter completes a name that exists; only Tab or a click makes a new one.
- **The header line** (`[#The Kitchen @@Wren]`) is the first line under each scene's title, tinted, drawn from the scene's records and never saved as prose. Edit it and leave the line and the scene takes what it says; type one as a scene's first line to give it one; delete it and the scene is left as it was and the line comes back. A name the world has not got leaves the cast alone and is named above the page. Nothing can be typed above it, and joining a scene takes its line with its heading.

---

## Reading the book

**Read**, beside Cards and Page, sets the timeline's prose as a book — see [The book](Manuscript) — with **In this scene** in the margin.

- **Export**, **Find & replace** and the book's **word goal** are in the header on Page and Read — the same goal whichever of the two sets it. Cards does not carry them.
- The open chapter's panel has the chapter's **word goal** and its progress.
- The [binder](#the-binder) brings a chapter or scene to the top of the book.
- **In reading mode, Read is the book you are reading**: your place moves with you as you read on. Cards stays beside it; Page and the author's tools do not. A world with no prose offers no Read.
- **The layout is remembered** for each world, so stepping out and coming back lands you in the book again. Until you choose one it opens on Cards — or, for a reader of a book with text, on Read.

---

## On a phone

- **The header is one row**: the binder, **Cards / Page / Read**, the open chapter, **Focus** on Page, and **⋯ Book tools**, which opens the rest under it — the timeline's name, the order, the word count and goal, Find & replace, Export, New Timeline, Generate with AI and Add Chapter.
- **On Page and Read the open chapter's panel is a sheet**, opened from its button in the header (*Ch. 3*) and put away with its ✕, which leaves the chapter open. It is never put above the book, where the first tap into the prose would push that prose off the screen. On Cards it sits under the chapter's row.
- **The binder slides in** from the button at the start of the row, and goes again once you pick a chapter or scene.
- **Buttons are a finger wide** on a touch screen — 44 pixels or more in the header, and Focus.
- **A scene card gives its title a line of its own**, with the badges under it.

---

## Opening a chapter

A chapter opens in the book: its row opens out to show its scene cards and comes to the top of the list, and the time cursor moves to its first scene (unless it is already inside the chapter, and never while reading). Beside the list — or under the chapter's row on a narrow screen, and on a phone's Page and Read a sheet opened from the header — is **the chapter's panel**:

- The chapter's **title** and **synopsis**, edited in place.
- A live **Character States** section — each scene's cast and the state each is in.
- A **Relationship States** summary, at the end of the chapter.
- A freeform **Writer's Notes** field that auto-saves.

The address names the open chapter, so a link or bookmark opens the book at it. The ✕ on the panel closes it.

### The binder

The **binder** is the left edge of the Manuscript: every chapter in this timeline, with the one you are in opened to show its scenes. Click a scene to go there — its chapter opens, its card opens and comes to the top, and the time cursor moves to it, so the Character States follow the scene you are writing. Click a chapter to open it, or to scroll back to it if it is already open.

| Key | In the binder |
|---|---|
| ↑ ↓ | Move between rows |
| → ← | Open or close a chapter; ← from a scene steps up to its chapter |
| Space | Go to that scene or chapter |
| Enter | **A new scene on the line below** — the first in a chapter, or the next after a scene. Type the title in place and press Enter; Escape throws it away |
| Delete | Remove the scene, with Undo — the notice names what went |
| Alt+↑ ↓ | Move the chapter or scene one place; a scene crosses into the next chapter at an edge. Press again to keep going |

**Drag a row** to move it further: a chapter before or after another, a scene between two scenes, or a scene onto a chapter's row to put it at the end of that chapter. One Undo puts a move back.

**New scene** and **New chapter** under the list do the same with a mouse; a new chapter's number is filled in with the next free one and can be changed, with the same rule as *Add Chapter*. A title started and then clicked away from is kept. A new scene is only a title — say where it happens and who is in it with [the scene header](#the-scene-header).

Chapters are not deleted from the binder, since a chapter takes every scene in it; that stays on its row in the book. With more than one timeline the binder says which it is listing — the one whose tab is picked, which opening a chapter switches to that chapter's own.

The **binder** button hides and shows it and remembers the choice. On a phone there is no room for a column, so the button slides the binder in over the book instead; choosing a chapter or scene puts it away again. See [On a phone](#on-a-phone).

While reading, the binder lists only what you have reached, and going to a scene does not move your place in the book.

### Generate / Update Chapter with AI

Hand your scene text to an AI assistant and have it fill in the events, character states, and a dramatic-**tension** rating for each event — the ratings feed the pacing curve.

- **Generate** drafts a new chapter.
- **Update** re-derives an existing one from its prose.

See [Generating with AI](AI-Generation).

---

## The chapter bar

The bar across the bottom of every screen is your time cursor.

| Element | Function |
|---|---|
| Chapter segments | Click one to jump to its first event |
| Event ticks | Click one to set that event as the cursor |
| Active event panel | The chapter number, title, and event title, with prev/next arrows |
| **Play** | Start [Story Playback](Story-Playback) on the map |
| **Compare** | Open the [Chapter Diff](Chapter-Diff) |
| **✕** | Clear the cursor back to *All chapters* |

Moving the cursor to a scene that names a location **pans the map** to it. It does not open that location's panel — that only happens when you pick a place deliberately.

---

## Multiple timelines

Creating another timeline adds a tab at the top of the Manuscript. Characters, items, maps, lore, and factions are shared across every timeline; snapshots are per event.

**When to use one:** parallel storylines, a flashback storyline set years earlier, an alternate-history branch, or a frame narrative.

### Timeline relationships

Describe how two timelines connect:

| Type | Meaning |
|---|---|
| **Frame Narrative** | An outer timeline tells or contains the inner story |
| **Historical Echo** | The same places or patterns recur in different eras |
| **Embedded Fiction** | A story, play, prophecy, or document inside the world is another timeline |
| **Alternate** | The timelines branch from similar conditions toward different outcomes |

Choose an **Outer / Source** and **Inner / Target** timeline, then add optional character, location, or document **anchors**.

Frame narratives can also use **sync points**: pair an event in the inner story with one in the outer story so playback keeps the framing moment aligned.

---

## The bottom bar in a multi-timeline world

**Frame narratives** get a special two-track bar — outer and inner, stacked. Click either track to make it active; playback follows that track while keeping the linked one available for context, and a **ghost cursor line** marks the corresponding moment on the other track.

**Every other multi-timeline world** uses a single-height bar with a **scope selector** on its left:

| Scope | Behaviour |
|---|---|
| One timeline | Scrub that timeline on its own |
| **All · Chapter order** | Merge every timeline, following chapter numbers across all of them |
| **All · Chronological** | Merge every timeline, ordered by the in-world day each scene happens |

Each chapter run is tinted with its timeline's colour, and the active event's panel names the storyline it belongs to. **The scope is remembered between sessions.**

*Chapter order* suits a book numbered straight through (book III = ch. 1–11, book IV = ch. 12–21), which then reads in order from chapter 1.

### Play across timelines

**Play** works in every scope, always on the map.

On a single timeline it's the usual animated run. In a **merged view** it plays through the whole sequence and **the map follows each event's own timeline** — as the cursor crosses from one storyline into another, the map switches to that timeline's cast and animates their movement. Chronological order braids the storylines, so the map alternates between them as their scenes interleave.

---

## The All-timelines tab

Each timeline numbers its chapters on its own and keeps its own in-world clock, so switching between tabs never shows how the storylines actually interleave.

The **All timelines** tab appears alongside your timeline tabs once you have more than one. It merges every timeline into a single sequence with the same two orders as the bottom bar — and **the toggle here and the bottom bar's scope selector are one setting**, so changing either moves both, and your choice is remembered.

Each row is tagged with a coloured dot, its timeline name, and its chapter, so you can read the true order of events across parallel POVs or braided plots. Click any row to move the time cursor there.

For multi-era stories, give each timeline a **start day** in [World Settings](World-Settings) so chronological merging places both eras where they actually fall.

---

## Common problems

**Events are out of order.**
Events sort by their order within a chapter, then by chapter number. Drag events to reorder them.

**A flashback triggers continuity warnings.**
Check the **Is flashback** box on the event. Flashbacks are excluded from travel-distance and staleness checks.

**Deleting a chapter removed more than expected.**
Deleting a chapter removes its events and all snapshots recorded at them. [Undo](Undo-and-Redo) restores the whole action; [export](Export-and-Import) before large deletions.

---

## Related pages

- [Core Concepts](Core-Concepts) — the cursor and inheritance
- [Structure Board](Structure-Board) · [The book](Manuscript)
- [Chapter Diff](Chapter-Diff) · [Story Playback](Story-Playback) · [Calendar & Ages](Calendar)
