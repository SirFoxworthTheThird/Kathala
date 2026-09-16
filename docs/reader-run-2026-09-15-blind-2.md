# Reader run — 2026-09-15 (blind, second pass)

A reading run, not a review of the books. I opened PlotWeave as somebody two
hundred pages into a fat novel with too many names in it, and wrote down every
point at which the app stopped being a companion and became something I had to
operate.

I did not read `docs/ux-review.md`, `docs/GUIDE.md`, any previous
`reader-run-*.md` / `writer-run-*.md`, or the git history. Source was read only
to explain symptoms I had already hit, which is noted inline each time.

---

## What I set out to read, and how far I got

**Primary book: *The Count of Monte Cristo* (Dumas) — 117 chapters, 41
characters.** The app's own pitch is the large-cast long novel, so I picked the
largest thing on the shelf. I am notionally at **chapter 7 of the paperback**
("The Examination"), the point at which the cast has just doubled and a second
household — the Saint-Mérans — has walked on.

**Second book: *The Life and Adventures of Robinson Crusoe* — 20 chapters, 24
characters**, taken to chapter 5. Deliberately a different shape: first person,
tiny cast, long stretches with nobody in them.

Method:

- `VITE_E2E=1 npm run build`, served from `dist/` by `vite preview` on :4173.
- Real Chromium driven by Playwright with a **persistent profile**, wiped once
  at the start so the first-open was genuinely a first open. Every "come back
  the next evening" step was a new browser process against that profile, not a
  reload.
- Desktop 1280×900 and phone 390×844, plus spot checks at 320×720.
- Screenshots taken and looked at, not just asserted on.

Everything below that says *reproduced* was done at least twice.

Two environment caveats I have **not** counted as findings, per the brief:
artwork is not staged into `dist/` and the library site is unreachable, so every
picture is a placeholder; and the map image is therefore absent.

---

## The short version

The core loop is genuinely good. Download a book (3.4 s), and it opens itself at
chapter 1 with reading mode already on and a banner that says in plain English
what it is hiding. Close the browser, come back, and the shelf shows *The Count
of Monte Cristo — Chapter 7 of 117* with a progress bar; one tap and I am back
where I was. The **Read** screen is the best thing in the app: the whole novel,
with typography controls, scrolled to my exact scene, with a panel naming who is
in the room and where the room is. On a phone that panel is **one tap and 1.3
seconds** from mid-paragraph. Looking somebody up took **two taps and 4.6
seconds**, which really is faster than flicking back through a paperback.

And then the same app told me, at chapter 7, that Villefort's wife commits
inheritance murders until his private sentence destroys both wife and child.

The gate is built on exactly one idea — *hide records the reader has not met* —
and it executes that idea well. It has no opinion at all about the **text inside
the records it does show**, and that is where a reader actually reads. The
result is that the strictest screens and the leakiest screens are two taps
apart.

---

## What interrupted me — findings, most costly first

### R1 — The Relationships tab prints the whole of a character's future, next to the word "Unknown". **SPOILER. Reproduced.**

**Cursor:** Ch.7 · *Innocence Seems to Satisfy the Prosecutor* (second scene of
chapter 7). Verified on screen — the cursor pill in every screenshot reads
`Ch.7 · Innocence Seems to ...`. At that cursor the app had revealed **10** of
41 characters and was itself saying *"31 characters not yet met by chapter 7 are
hidden"*.

**What I did:** Characters → *Gérard de Villefort* → **Relationships** tab.
Three taps from the dashboard.

**What I expected:** the one relationship I have read — Villefort and his
prisoner — and nothing else.

**What happened:** five relationships. Four of them have the counterpart's name
correctly redacted to **"Unknown"** — and then print the relationship's
description in full underneath:

> **Unknown** · Father And Abandoned Son
> *The infant Villefort buried survives as Benedetto and later turns the truth of paternity into public indictment.*
>
> **Unknown** · Husband And Wife
> *The prosecutor's refusal to expose domestic guilt lets Héloïse's inheritance murders continue until his private sentence destroys both wife and child.*
>
> **Unknown** · Royalist Son And Bonapartist Father
> *Their political opposition becomes a domestic contest in which the immobilized father repeatedly defeats the powerful son.*
>
> **Unknown** · Father And Endangered Daughter
> *Villefort values family obedience and reputation more readily than Valentine's consent or safety.*

and, for the one counterpart I have met:

> **Edmond Dantès / Count of Monte Cristo** · Prisoner And Prosecutor · *from Ch. 7*
> *Villefort knowingly buries Dantès to protect his career; **the Count returns the prosecutor to judgment by his own past**.*

That is Benedetto, Héloïse, Valentine, the live burial, the poisonings and the
ending of the Villefort strand — chapters 60–117 — delivered on a screen reached
in three taps, at chapter 7, by an app whose Library card promises *"the app
will only tell you what is true by then."*

The detail that makes this the sharpest version of the problem: **the gate
visibly ran.** It knew those four people were unmet — that is why it wrote
"Unknown" — and then it printed the sentence that names them.

**Evidence:** `shots/16-villefort-relationships.png` (cursor pill legible in the
same frame).

**Mechanism** (looked up after the fact): `useCharacterRelationships` in
`src/db/hooks/useRelationships.ts` is a plain Dexie filter with no reading gate
on it at all. The redaction comes from `RelationshipsTab.tsx:210`,
`{other?.name ?? 'Unknown'}` — the *name lookup* goes through the gated
character list and misses, so the fallback fires. The record is never filtered.
By contrast the dashboard tile ("Relationships — between characters you have
met") and the Relations graph *are* gated, so at the same cursor the dashboard
says 6 and Villefort's own tab shows relationships with four people the
dashboard refuses to count.

**Reproduced in a second book.** *Robinson Crusoe*, cursor Ch.5 · *The Journal
Begins*, Crusoe's Relationships tab: four "Unknown" rows reading *"Each offers
the other deliverance: Crusoe helps recover the ship and the captain carries him
home"* (the ending), *"A relationship begun under unequal authority grows
through labour, teaching, trust, and mutual rescue"* (Friday), *"The rescued
Spaniard joins the island household…"*, and Xury's *"though Crusoe **later**
accepts Xury's sale into conditional service."* So this is the shape of the
feature, not one book's data.

**Cost:** total. This is the screen a confused reader goes to — *how do these two
know each other?* — and it is the screen that ends the book for them. Everything
else in this report is smaller than this.

---

### R2 — Every free-text field is ungated, so the spoiler is wherever the reader looks. **SPOILER. Reproduced.**

R1 is the worst instance of a general rule: the gate decides *whether a record is
shown*, never *what the record says*. `src/lib/spoilers.ts` says so in its own
header — *"gating is about first appearance"* — which is a coherent design and
an under-promise relative to the copy the reader is given.

At cursor **Ch.7**, in four taps or fewer:

- **The dashboard**, first thing on opening the book, every time:
  *"…a Marseille sailor **erased by conspiracy and remade by imprisonment,
  education, and treasure. Returning as the Count of Monte Cristo, he enters the
  lives of his betrayers and their children**…"*
- **Character Overview** — the one-line answer to "who is this again":
  - Edmond Dantès: *"A young sailor **unjustly imprisoned** who remakes himself
    into a learned, immensely wealthy **architect of recompense and revenge**."*
  - Mercédès: *"Edmond's Catalan betrothed, **later Countess de Morcerf**…"*
  - Baron Danglars: *"The Pharaon's calculating supercargo, **later a banker**…"*
  - Pierre Morrel: *"…and **later receives anonymous rescue from ruin**."*
  - Louis Dantès: *"…**unable to survive his son's disappearance**."*
  - Renée: *"Villefort's **first** wife and **Valentine's** mother…"*
  - That is 6 of the 10 characters I had met.
- **Relations graph** edge labels: *victim and financial avenger*, *rivals,
  betrayer, and avenger*, *lost betrothed and enduring witness*, *loyal employer
  and **secret benefactor***.
- **The search palette**, which renders the same descriptions as result
  snippets.

**Evidence:** `shots/14-villefort.png`, `shots/29-relgraph.png`,
`shots/p02-dashboard.png`, `shots/13-characters.png`.

**Cost:** high and unavoidable — these are the primary answers to the primary
question. A reader cannot avoid them by being careful.

---

### R3 — Names carry their end-of-book identity, at every cursor. **SPOILER. Reproduced, with the book's own text as the check.**

**Cursor:** Ch.7 as above. **What is displayed:** `Baron Danglars`,
`Mercédès de Morcerf`, `Fernand Mondego / Count de Morcerf`,
`Edmond Dantès / Count of Monte Cristo` — on the character list, in the map
sidebar, on the relationship graph, in search results, and in the **Read view's
"in this scene" panel**, i.e. directly under the paragraph I am reading.

**The check:** I searched the novel text the app itself ships (`sceneTexts` in
`the-count-of-monte-cristo.pwk`, mapped to chapter numbers).

| string | first occurrence in the book's own text |
|---|---|
| `Morcerf` | chapter **27** |
| `Baron Danglars` | chapter **27** |

It appears in no chapter title before **104** (*Danglars' Signature*) and no
scene title before **53** (*Haydée Sees Morcerf at the Opera*).

So at chapter 7 the app tells a first-time reader that the poor Catalan
fisherman becomes a Count, and that Mercédès takes his name — which is the
outcome of the entire first act, and the thing chapters 8–34 exist to make you
wait for.

**Why this is an experience finding and not a content one:** the fix is not
"write better names." It is that the gate has no concept of a display name being
true only after a point in the book, and no screen gives the reader any signal
that the label they are reading is from later. The reader's only defence would
be to know the book already, which defeats the product.

Scope: only *Monte Cristo* uses the `A / B` slash form (3 characters), but the
"title baked into the name" pattern (`Baron Danglars`, `Mercédès de Morcerf`) is
invisible to any automated check, so I cannot say how widespread it is. See the
Suspicions section.

---

### R4 — Whole sections of the book's apparatus are permanently unreachable while reading, and the app reports them as "not written yet". **Reproduced, and measured across the library.**

**What I did:** Lore, at cursor Ch.7 of *Monte Cristo*.

**What I expected:** at worst, a few pages held back with a "from ch. N" note —
which is exactly what the Lore view is built to show.

**What happened:** `Lore 0`. Every category reads `0`. The empty state says:

> **No lore pages yet**
> Document your world's history, rules, and mythology — things that don't change with time.

Two problems at once. First, a reader cannot tell *hidden* from *absent* —
compare the Characters screen, which says plainly *"31 characters not yet met by
chapter 7 are hidden."* Second, the empty state is **writer copy inviting me to
write the book's lore**, in a mode whose own banner says *"Editing is put away
while you read."*

Then the harder half. Three of the ten pages are hidden **at every cursor, for
ever**:

| page | blocked by |
|---|---|
| Text and Illustration Edition | linked to the **world** id |
| Marseille and Mediterranean Commerce | linked to a **map layer** |
| Credit and Reputation | linked to a **faction** |

**Proved empirically, not inferred:** in a throwaway profile I downloaded the
book again and moved the cursor to **Ch.117 · *Maximilien Chooses Death*** — the
last scene of the novel, everything read. Lore then showed **7 of 10** pages and
**"Sources and Edition 0"**. The edition/provenance page — the one the Library
card explicitly points at (*"illustration provenance are documented in Lore"*)
— cannot be opened by anyone using reading mode, ever.

**Mechanism:** `useLorePages` requires `gate.hasReached(visibleFromEventId) &&
gate.linksRevealed(linkedEntityIds)`. `linksRevealed` requires *every* linked id
to be revealed, and `isRevealed` (`src/lib/spoilers.ts:155`) returns **false**
for any id it has never seen. The gate only ever records first appearances for
characters, items, location markers, regions, threads and motifs — never for
worlds, map layers or factions. So a link to one of those is a permanent block.
Note that the sibling function fails the *other* way and says so in its own
comment: *"An unplaceable event cannot be compared, so it does not hold anything
back — the same choice made for entities that never appear."* The two halves of
the same gate disagree, and the half that fails closed silently deletes content.

**Measured across the shipped library** (44 worlds, reading `linkedEntityIds`
against the same appearance rules the gate uses):

- **49 lore pages in 11 worlds** are blocked solely by a link to a world, map
  layer or faction — structurally unreachable.
- **Robinson Crusoe: 5 of 5.** Its entire Lore section is permanently empty.
- A further ~54 pages are blocked by links to characters/places that never
  appear in any scene, which may be data rather than code.

**Confirmed live in the second book:** *Robinson Crusoe*, cursor Ch.5, Lore
reads `0` with the same "No lore pages yet" copy. `shots/25-crusoe-lore.png`.

**And the app promises otherwise, in its own help.** *Help → Reading a book*
says: *"What is hidden is counted for you on the dashboard, so you can tell the
difference between a world with nothing in it and a world holding things
back."* The dashboard counts characters, places and items. It does not count
lore — and Lore is precisely the screen where a reader cannot tell.

**Cost:** this is the first place I felt I had to turn reading mode off — which
the brief calls out as a finding in itself. There is no other route to the
edition note.

---

### R5 — Scrolling the Read view moves your place forward, silently and irreversibly. **Reproduced ×3.**

**What I did:** Read view, cursor Ch.7. Scrolled down the prose.

**What happened:**

| action | cursor before | cursor after |
|---|---|---|
| scroll +30,000 px | Ch.7 · Innocence Seems to Satisfy the Prosecutor | **Ch.11 · Napoleon Advances** |
| scroll +15,000 px (10 × 1,500 px, 250 ms apart) | Ch.11 | **Ch.13 · The Regimes Change Around the Prisoner** |
| scroll **−60,000 px**, back past where I started, then wait 3 s | Ch.13 | **Ch.13** — unchanged |

Arriving at Ch.11 revealed two characters I had not met and moved Dantès's
location to *Château d'If*, a chapter-8 fact. Nothing asked me, and nothing told
me afterwards.

The asymmetry is the finding. Making the *same* forward move on the Timeline
throws a red modal — *"Read ahead to chapter 7? … Moving there shows everything
the story introduces in between — people, places and connections you have not
met yet."* Making it by scrolling costs one flick of a thumb and no dialog. The
destructive direction is guarded on the screen where you would do it
deliberately and unguarded on the screen where you would do it by accident.

**Mechanism, and a fair reading of it:** `src/lib/readingPosition.ts` documents
the high-water rule deliberately — *"Never go backwards … the reader would watch
the book they have read shrink behind them."* That rationale is sound for
somebody reading **in** the app, where scrolling forward *is* reading forward.
The cost lands entirely on my persona: the reader whose book is on paper and who
opens the Read view only to check a passage. For them, "scroll up to find the
bit about the letter" is free and "scroll down past it" is permanent.

**And the app promises otherwise, in its own help.** *Help → Reading a book*:
*"Looking at something does not move it: opening a scene, a search result or a
character's history shows it to you and leaves your place alone."* Scrolling is
not literally "opening", so this is not a flat contradiction — but a reader who
has just been told that looking around is free is exactly the reader who will
scroll down the Read view to find a half-remembered paragraph.

Recovering my place cost: Timeline → scroll to the row → *Read to here* (no
dialog going backwards, correctly).

---

### R6 — Accented names defeat search, and the app answers "No results". **Reproduced. Measured.**

**What I did:** typed names into the global palette (Ctrl+K) and into the
Characters screen's own search box, at cursor Ch.7, for the **10 characters the
app had already shown me**.

| typed | result |
|---|---|
| `Dantes` | **no matches** |
| `Mercedes` | **no matches** |
| `Gerard` | **no matches** |
| `Renee` | **no matches** |
| `Saint-Meran` | **no matches** |
| `Reserve` (for *La Réserve*) | no location result |
| `Danglars`, `Villefort`, `Morrel`, `Morcerf`, `Caderousse`, `Mondego`, `Louis` | found |
| `Mercédès`, `Réserve`, `Merc` | found |

Five of twelve obvious queries fail, **including the protagonist**. There is no
diacritic folding; `Merc` works because it is a substring match.

Two things make this cost more than it looks:

1. On a phone, typing `é` is a long-press and a second tap. Nobody does that
   mid-chapter.
2. The failure message is `No results for "Renee"` — which is exactly what the
   app would say about somebody I had not met yet. So a reader cannot tell "the
   app is hiding this person from you" from "you spelled it wrong", on the one
   screen whose entire job is disambiguation. Renée de Saint-Méran was sitting
   in the character list six inches away.

---

### R7 — Setting your position for the first time is framed as a dangerous act. **Reproduced.**

The very first thing a reader must do — say where they are — is this:

1. Tap the book on the shelf.
2. Tap **Set where you have read to** (dashboard banner).
3. Land on the Timeline. Scroll to chapter 7.
4. Tap **Read to here**.
5. A red modal: **"Read ahead to chapter 7?"** — *"You are on chapter 1. Moving
   there shows everything the story introduces in between — people, places and
   connections you have not met yet. Coming back hides them again."* Buttons:
   *Cancel* / **Read ahead** (red, destructive styling).

Four taps, one scroll, and a warning that I am about to spoil myself — for the
action of telling the app the truth. I have not read ahead. I am 40,000 words
*further on* than the app currently believes, and it is scolding me for
correcting it.

`shots/11-after-read-to-here.png`.

The modal is right for a reader at chapter 40 who taps chapter 90. It is wrong
for the one moment every reader passes through: the first time, straight after
download, when the app's chapter-1 default is not a position they chose. The
app knows this is the first placement — the world was created seconds ago and
has never been moved.

**Cost:** small in seconds, large in tone. It is the first interaction, and it
teaches the reader that the app's model of them is the authority and theirs is
the deviation.

---

### R8 — Characters can be dragged around the relationship graph while reading, and it sticks. **Reproduced across a browser restart.**

Relations view, reading mode on, cursor Ch.7. I pressed on the *Gaspard
Caderousse* node and dragged 200 px right and 150 px down. It moved. I reloaded
the document: it was still there. The graph also offers **Tidy up** and
ReactFlow's interactivity padlock in reading mode.

**Mechanism:** `RelationshipGraphView.tsx:664` — `onNodeDragStop` writes
`localStorage['wb-rel-pos-<worldId>']`. The "new relationship" button beside it
*is* wrapped in `!gate.active`, so reading mode was considered here; dragging
just was not included.

**Why I am ranking this low but reporting it:** it is device-local layout, not
the author's text, so it is much milder than the map-panel case. But it is the
same shape — the reader is invited to rearrange the book — and there is no undo
that a reader would find, because reading mode has trained them that nothing on
screen changes anything.

---

### R9 — Writer scaffolding shows through in reading mode. **Reproduced.**

Small, cumulative, all at cursor Ch.7:

- **Character cards** carry a chip reading **"carried forward"** under the
  location — 8 of the 10 cards. It means "this state was authored in an earlier
  scene" (`src/components/InheritedBadge.tsx`). A reader reads it as a fact
  about the person and cannot resolve it.
- **Chapter detail** (Timeline → open chapter 5) ends with **"Writer's Notes —
  No notes on this chapter"** and **"Relationship States — No relationship
  states recorded"**: two empty sections addressed to somebody who is not here.
  Each scene also shows a **"Final"** draft badge, a **"2/5"** counter and a
  **`#chapter-5`** tag.
- The shelf's own header still reads *"A story bible for fiction writers"*,
  directly above a section labelled **READING** holding two novels.
- **Turning reading mode off takes one click with no confirmation** — verified
  twice, `dialog count 0` both times — while moving the cursor one chapter
  forward, and tapping *View all chapters*, both raise confirms. The app guards
  the small doors and leaves the big one unlatched. (When it does open, the
  dashboard immediately lists every plot thread with the chapter it ends in:
  *"Benedetto's Identity — last advanced Ch. 110"*, *"The Villefort Poisonings —
  last advanced Ch. 111"*.)

---

## What I only suspect

Kept separate because I could not close them.

- **S1 — Map marker labels collide.** On the Marseille map at Ch.7, the "6
  characters / La Réserve" cluster badge sits on top of *The Catalans* and hides
  its name. I cannot separate this from the sandbox: with no map image, Leaflet
  fits to marker bounds at a zoom it would not otherwise pick.
  *Settles it:* the same screen with the artwork present.

- **S2 — How widespread R3 is.** Only *Monte Cristo* uses the `A / B` name form,
  which is greppable. "Later title silently baked into the name" —
  `Baron Danglars`, `Mercédès de Morcerf` — is not.
  *Settles it:* for each character, check whether every token of the display name
  occurs in the book text at or before that character's first appearance
  chapter. I wrote the first half of that check (the text-vs-chapter index) and
  it works; I did not have time to run it across 44 worlds and eyeball the
  false positives.

- **S3 — The ~54 lore pages blocked by links to characters and places that never
  appear in any scene.** Structurally this is the same failure as R4, but the
  cause may be that those entities genuinely have no appearances in the data, in
  which case it is closer to content. I did not open each one.

- **S4 — The Read view holds the entire book in the DOM at once** (1,056,701 px
  of scroll height at chapter 7; the source comments confirm it is deliberate).
  I saw no jank at 1280×900 or 390×844 on this machine, but I did not test a low
  end phone, and the whole of chapter 117 is one browser find away.
  *Settles it:* a throttled-CPU profile of the scroll handler on a 117-chapter
  book.

---

## What I measured and found false

These cost me time and are worth writing down so nobody re-files them.

- **"The Contents menu lets you jump ahead and spoils you."** Wrong, twice over.
  The Contents menu in the Read view at Ch.7 lists **exactly chapters 1–7** and
  nothing further — correctly gated, `shots/46-contents.png`. My first run
  appeared to show a jump to Ch.14; what actually happened is that my locator
  matched prose further down the page (the whole book is in the DOM), scrolled
  there, and **R5** stamped the cursor. The Contents menu is innocent; the
  scroll is the culprit.

- **"Turning reading mode off removes the way to turn it back on."** Wrong. The
  READING MODE section in Settings is a collapsible; an earlier click of mine had
  collapsed it, and it rendered as a bare header with nothing under it. Expanding
  it shows *"Turn on reading mode"* and it works. Only the *absence of a confirm*
  on the way out survives as a finding (R9).

- **"Help is the writer's manual with nothing for readers in it."** Wrong, and
  badly wrong — my capture was taken in a script that had just toggled reading
  mode **off** two steps earlier, so I read the writer's index. With reading mode
  on, Help opens on **"Reading a book"** as its first topic, and the writer-only
  sections (Snapshots, Corkboard, Timeline & chapter AI, Continuity checker,
  Writer's Brief, Database health, Folder sync, World settings, Map AI tools) are
  gone from the index. The topic itself is one of the best-written things in the
  app — it explains the cursor, the ✕, the counted-hidden idea, and singles out
  Knowledge as the screen worth knowing about. Two of its promises are not quite
  kept (see R4 and R5), which is only worth saying because the rest of it is
  accurate.

- **"The shelf reorders itself, putting Start-from-scratch above the book."**
  Wrong — an artifact of reading `innerText` order rather than layout. READING
  renders above YOUR WORLDS consistently. `shots/44-landing-order.png`.

- **Reading mode does not leave edit affordances lying about.** I swept every
  route — dashboard, timeline, characters, maps, items, relations, factions,
  knowledge, lore, arc, calendar, manuscript, settings — enumerating every
  button and link. There is **no** create/edit/delete control anywhere except
  the graph drag in R8 and the Settings toggle. The left nav even renames
  *Manuscript* to *Read* and drops Corkboard and Structure. This part of the
  promise is kept, and kept well.

- **The gate itself is not leaky for records.** Every hidden-record check I made
  came back correct: characters (31 hidden at ch.7, 29 at ch.11), items,
  locations, factions, knowledge facts, chapter summaries (ch.8+ show word
  counts only), character History (Villefort shows ch.6 and ch.7 and nothing
  else), the map sidebar, and the graph. I could not find a record that appeared
  before its first scene. The leaks in this report are all *inside* records that
  were correctly shown.

---

## What worked, honestly

Ranked by how much I would miss it.

1. **The Read view.** The full text, at my scene, with `5% of the book ·
   Chapter 7 of 117 · about 14 min left in it`, a serif measure that is
   comfortable at both 1280 px and 390 px, and size/family/leading controls that
   are actually there when you want them. The **"IN THIS SCENE"** panel — *HERE:
   Edmond Dantès, Gérard de Villefort / PLACE: Palais de Justice / THINGS:
   Bonapartist Letter* — is one tap and 1.3 s away on a phone. This is the
   feature.
2. **Knowledge.** *"The letter is addressed to Noirtier — known by 2 / 10"*,
   and opening it lists exactly who knows and the scene in which each learned
   it. Correct at my cursor, two taps, and a straight answer to "who else knows
   about this?" that a paperback simply cannot give. Nothing else in the app is
   this well aimed at a reader.
3. **Coming back.** New browser process, `localhost:4173`, and the shelf shows
   both books with their own places — *Chapter 7 of 117*, *Chapter 5 of 20* —
   each with a progress bar. One tap and the cursor pill is already right. 8 s
   from cold launch to being back in the book.
4. **The chapter detail view.** Scene by scene, who was present, and a line of
   state for each of them (*"Mercédès — sees celebration turn into terror without
   learning who accused her betrothed"*). Better than re-skimming the chapter.
5. **Honest empty states where somebody wrote one.** *"This map's picture could
   not be loaded — it is kept on the web rather than in the book, so it needs a
   connection. **Everything marked on the map is still here.**"* That sentence
   is exactly right, and it is the model the Lore screen (R4) needs.
6. **The confirms that exist.** *"Show the whole book?"* and *"Read ahead to
   chapter N?"* are both well written and well placed — the problem is only that
   they are missing from R5 and R9, not that they are wrong.
7. **320 px holds.** No horizontal overflow on any screen I checked, cards stay
   legible, the cursor pill degrades to `Ch.7`.
8. **Downloads are fast and land you in the right place**: 3.4 s and 8.0 s for
   the two books, straight into the dashboard with reading mode on, cursor at
   chapter 1, and a banner that names the numbers it is hiding.

---

## Verdict — is this a good application for reading a book?

**Not yet, and specifically not for the reader it is aimed at: the one meeting
these characters for the first time.** I would not hand it to somebody halfway
through *Monte Cristo* today. Three taps from the dashboard, at chapter 7, it
told me how Villefort's marriage ends and who Benedetto turns out to be. The
whole value proposition is that you can look something up without paying for it,
and here you pay the largest possible price for the most ordinary possible
question.

The reason I am not writing it off is that the failure is narrow and the
foundation is sound. The record-level gate is *correct* — I attacked it across
two books and a dozen screens and could not make it show me a record early. The
position model is right: one place per book, remembered across a real browser
restart, one tap to resume. The Read view and the Knowledge screen are better
than anything a paperback and a bookmark can do. What is missing is that nobody
extended the idea from *records* to *the sentences inside records*, and the
copy — *"the app will only tell you what is true by then"* — promises the second
while the code (honestly, in its own comments) only implements the first.

**Who I would recommend it to today, without hesitation:**

- **Re-readers.** Somebody on their second pass through *The Three Musketeers*
  who wants to keep the Bonacieux family straight loses nothing to R1–R3,
  because they already know, and gains the Knowledge screen, the chapter detail
  and the map.
- **Book groups and students** working a text they have finished — for whom
  reading mode can simply be off, which is the writer product and appears to be
  in good shape.
- **Readers of the short, small-cast books** — *The Call of the Wild*, *Jekyll
  and Hyde*, *Alice* — where there are fewer relationship descriptions to trip
  over and the confusion the app exists to fix is milder anyway. Which is to say:
  the case where it is safest is the case where it is least needed.

**What would have to be true for me to recommend it to a first-time reader of a
long novel:**

1. **Relationship records gate like every other record** (R1) — filtered in the
   hook, not redacted in the label. This one change removes the worst leak in
   the app and the code for it already exists three files away.
2. **Free text is either gated or marked** (R2, R3). Either descriptions get a
   reveal point like lore pages already have, or — cheaper and nearly as good —
   reading mode shows only the part of a description that is safe, and says so:
   *"more once you have read further."* A reader will accept less. They will not
   accept being lied to about what they are being protected from.
3. **Lore stops failing closed and stops lying about it** (R4). `isRevealed`
   returning `false` for an id it has never heard of is one line, and it
   disagrees with the comment on the function right next to it. And the empty
   state must say *"N pages not yet reached"*, the way the Characters screen
   already does, instead of inviting the reader to write the book.
4. **Forward drift in the Read view is either confirmed or reversible** (R5).
   A one-tap *"Back to chapter 7"* undo in the progress bar would be enough; the
   app already knows where I was.

Those four are all small next to the thing they would unlock. Fix them and the
answer becomes yes for almost everybody — because the parts that are hard to
build, the position model and the reading surface, are already right.
