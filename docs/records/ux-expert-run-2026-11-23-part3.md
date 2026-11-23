# UX expert run, 2026-11-23, part 3 of 3

The reviewer is the `ux-review` agent. The manual is `docs/GUIDE.md`, from *Maps* to the end (*Keyboard,
screen readers and touch*). The app was the production build that was already being served at
`http://localhost:4173`, with the Library staged (58 books in `dist/library/index.json`). I did no build
and did not start or stop any server. Every launch of Chromium (`/opt/pw-browsers/chromium`) had its own
profile.

**How the worlds were made.** Library books were installed through the `__pwlibrary` seam. The seam
installs **without images** (`withImages: false`). To review the writer's screens I switched
`readingMode` off through `__pwdb`. Blank worlds were made through the real *New World* flow. For *The
Fellowship of the Ring* I supplied a generated picture for the root map (`Middle Earth`) under its
existing blob id, so that one map had a picture and its sub-maps did not. That is the state the guide
describes as *"a world from the Library whose image file did not arrive"*.

**Scripts and screenshots.** Everything is in
`/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/ux3/`. The scripts
are `*.cjs` and the screenshots are under `shots/`. Below, `shots/x.png` is short for that directory.

**Interruption.** The run was cut off once by a usage limit. The server restarted on the same build, and
I re-made the worlds for everything after that point.

**Themes.** "Dark mode" here means the default theme. The app's only light theme is **Paper**, which I set
as the world theme (`theme-paper`). An early Paper sweep wrote the wrong value (`paper`) and so showed the
default theme. It was redone with the right value, and only the redone sweep is used.

---

## What I covered

Phone means `iPhone 13` emulation: 390×664, touch, `pointer: coarse`. "360" and "320" mean the same device
at those widths. Keyboard means I tabbed and used keys on the screen. SR means I read Playwright's
`ariaSnapshot()`. Paper means I took screenshots in the Paper theme, at 1280 and 390.

| Section | Laptop | Phone | Keyboard | SR snapshot | Paper | Notes |
|---|---|---|---|---|---|---|
| Maps (sidebar, panels, ⋯ menu, places with no map) | ✓ Dracula, FotR, blank | ✓ 390; no overflow at 360/320 | ✓ sidebar rows, ⋯ menu, panels | ✓ | ✓ screenshot only | Playback and floors not driven. Dragging a layer to re-parent it not tried. |
| Setting a map's scale | partly: only the ⋯ menu and *Clear scale* | — | ✓ menu | ✓ | — | The two-point calibration dialog was not driven. |
| Working with the map canvas | ✓ panels, character pin, journey strip | screenshot only | ✓ Escape on all four panels | ✓ | ✓ | Right-click menu and drawing routes/regions not driven. |
| Starting a map without a picture | ✓ | ✓ | — | ✓ | — | |
| Generate locations with AI (no key) | ✓ | — | ✓ tab walk | ✓ | — | Only an invalid paste was tried. A valid tree was not imported. |
| Items | ✓ Dracula, FotR | ✓ touch targets, 390/360/320 | partly: inline edit, Escape | ✓ | ✓ | No item in the Library has a *gap* row, and I did not make one. |
| Custom fields | ✓ FotR (template, values over time, roster filter) | sweep only | partly | ✓ | — | Search *Race: Human* and Arc *Fields* view not checked. |
| Research | ✓ link, clipping, attach, delete | ✓ | partly | ✓ | — | File upload (image/PDF) and the mood board on the Page not driven. |
| Relationships, Keeping a large cast readable | ✓ Dracula | ✓ | ✓ tab count, Enter | ✓ | ✓ measured | Generate with AI not driven. |
| Family tree | ✓ Wuthering Heights, family built by hand | sweep only (empty state) | partly | ✓ | — | Succession not driven. |
| Character Arc grid | ✓ | ✓ 320 | ✓ arrows, Ctrl+End, Enter | ✓ | sweep | PNG export not tried. |
| Story time | ✓ Dracula | — | — | ✓ | — | |
| Lore | ✓ editor, reveal, link | ✓ 320 | partly | ✓ | sweep | Category rename/delete only measured on touch. |
| Factions | ✓ roster, panel | ✓ panel | partly: Escape | ✓ | sweep | Cover upload not driven. |
| Knowledge | ✓ fact panel, reader's schedule | ✓ 390/360/320 header | — | ✓ | sweep | *Might also know* accept and spoiler words not driven. |
| Search | ✓ Monte Cristo, Dracula | — | ✓ Escape by focus | ✓ | — | |
| Undo, redo & recent changes | ✓ | — | ✓ Ctrl+Z / Ctrl+Y | ✓ | — | |
| Writer's Brief | ✓ Dracula Ch. 12 | — | ✓ Escape | ✓ | — | The *All chapters* picker was not opened. |
| Calendar & character ages, Calendar view | ✓ blank (enable), Dracula | ✓ 390 | chips: SR only | ✓ | sweep | Calendar editor (eras, leap rules) **not covered**. |
| Continuity Checker, Saying a thing came back | ✓ Dracula | — | ✓ Escape | ✓ | — | No batch fix or *revived* answer was applied. |
| Audit with AI (no key) | ✓ | — | — | ✓ | — | |
| World settings & export | ✓ chips, Theme, HTML export | ✓ sticky index | — | ✓ | ✓ | |
| Database health | ✓ scan on a healthy world | — | — | ✓ | — | No world with orphans was available. |
| Folder and cloud sync | panel only | — | — | ✓ | — | The folder picker cannot be driven headless, so it is **not covered**. |
| Help | ✓ | ✓ | ✓ focus | ✓ | — | |
| Keyboard, screen readers and touch | checked through every section above | ✓ | ✓ | ✓ | — | |

**Totals.** 25 rows (counting *Starting a map without a picture* and *Generate locations with AI*
separately).

| Check | Done | Partly | Not done |
|---|---|---|---|
| Laptop | 23 | 2 | 0 |
| Phone | 13 | — | 12 |
| Keyboard | 15 (partly included) | | 10 |
| SR snapshot | 25 | — | 0 |
| Paper | 11 (screenshot or measured) | | |

**Two areas were not covered**: the calendar editor and folder sync with a real folder.

---

## Findings

They are ranked by what they cost the person using the app.

### UX-3-1: A map whose picture is missing replaces the whole Maps screen, and you cannot leave it

**Who it costs:** everyone, readers most.

**Screen:** Maps. Guide: *Maps*, "If a map opens without its picture".

**What I did.** I used *Fellowship* with the root map's picture present and every sub-map's picture
absent, at 1280 in the default theme, in writer mode. I opened Maps, then clicked **Shire** in Map Layers.

**What I expected.** The guide says "everything else about the map is intact: its locations, routes and
regions are all still there". F-7 settled the same question for a map whose linked picture cannot be
loaded: keep the sidebar and the canvas, and add a banner.

**What happened.** The screen became a single empty state: *"This map's image isn't here"* and **Add map
image**. The Map Layers tree, the Characters/Locations/Routes/Regions sections and the canvas were all
gone. The copy on that screen says the locations "are all present", but nothing gives a way to them.

There is also no way back:

- The breadcrumb in the top bar is plain text.
- Browser **Back** leaves Maps for the dashboard.
- Coming back to Maps reopens the Shire.
- Stepping the time cursor forward moved the screen to **Hobbiton**, another sub-map with no picture.

Only a scene set on the root map, a search hit on it, or a reload gets out. In reading mode the empty
state also loses its action, so a reader is left with a paragraph.

A related state: a root map with `imageId: null` gets the same whole-screen treatment, headed *"Sub-map
image not set"* even though it is not a sub-map.

**Evidence.**

- `shots/maps3-laptop-root.png`: the root map, working.
- `shots/maps3-laptop-shire-missing.png`: the Shire.
- `maps3b.cjs`: re-entry shows the Shire again; stepping the cursor gives `Hobbiton / Image not downloaded`.
- `shots/maps7-location-panel.png` (Moria) and `shots/maps8-character-open.png` (Hobbiton, reached by
  clicking a character row): the same trap reached from other rows.

**Mechanism.** `src/features/maps/MapExplorerView.tsx:710`: `if (imageState === 'not-downloaded') return
(…EmptyState…)` returns before the sidebar is rendered. This is the shape F-7 recorded fixing for the
*unreachable* state ("the notice … took the map sidebar away with it"). This state did not get the same
fix.

### UX-3-2: Faction members have no names in the faction panel

**Who it costs:** everyone.

**Screen:** Factions, detail panel. Guide: *Factions*.

**What I did.** On Dracula I opened **The Hunters of Dracula** at 1280 and at 390.

**What I expected.** A list of the six members, by name, with their roles.

**What happened.** At 1280, 5 of 6 member names render **0px wide**. Jonathan Harker gets 38px of the
92px it needs, which shows as "Jon…". The rows show only the role and the dates, for example *"Archivist
and tracker · The Empty Coffin → ongoing"*. From the third row on, the expand and remove buttons are
pushed past the panel's right edge. At 390 the names get 27–67px.

**Evidence.** `shots/fk1-laptop-faction-panel.png`, `shots/fk3-phone-members.png`. Measured with
`fk3.cjs`, as rendered width against `scrollWidth`:

| Member | 1280 | 390 |
|---|---|---|
| Jonathan Harker | 38/92 | 109/109 |
| Mina | 0/157 | 67/157 |
| Seward | 0/90 | 27/90 |
| Van Helsing | 0/180 | 38/180 |
| Arthur Holmwood | 0/104 | 48/104 |
| Quincey P. Morris | 0/102 | 42/102 |

**Mechanism.** `src/features/factions/FactionsView.tsx:59-66`. The name is `flex-1 truncate`. The
role/dates span beside it is `shrink-0` and never truncates, so on any real data the name loses.

### UX-3-3: Knowledge's header goes off the screen on a phone

**Who it costs:** phone users.

**Screen:** Knowledge roster. Guide: *Knowledge*.

**What I did.** I opened Knowledge at 390, 360 and 320.

**What happened.**

- The `<h1>` "Knowledge" measures **0px wide**. The **Reader's schedule** button sits on top of it:
  `elementFromPoint` on the title returns that button.
- **New Fact** runs from x=306 to **x=396** at every width. At 390 that is 6px off screen, at 360 it is
  36px, and at 320 only 14px of it is still visible.
- The page reports no horizontal scroll, because the header clips the overflow. There is no way to
  scroll to the button.

Other rosters in this part do not do this: Lore folds its actions to icons on a phone, and Items and
Factions have two actions each.

**Evidence.** `shots/sweep-Dracula-writer-phone-default-knowledge.png`,
`shots/sweep-Dracula-writer-p320-default-knowledge.png`, and the measurements in `kn2.cjs`.

**Mechanism.** `src/components/PageHeader.tsx:74` puts the actions in a `flex shrink-0` box that never
wraps. `KnowledgeView.tsx:213-224` passes three labelled buttons. The "creating" state is wider still: a
`w-56` input plus **Create** and ✕.

### UX-3-4: On the Maps screen, Help opens underneath the map

**Who it costs:** everyone on Maps, on a laptop and a phone.

**Screen:** Help. Guide: *Help*, "available on every screen".

**What I did.** On Maps (Dracula) I opened Help at 1280 and at 390.

**What happened.** The map's floating toolbar (Location, Label, ⋯), the location pills, the map outline
and the zoom buttons all draw on top of the Help panel. Its rows read "re" for *Lore* and "dge" for
*Knowledge*. A click on a Help row where the toolbar overlaps goes to the map: `elementFromPoint(1180,
124)` returns the map's **Label** button. The Brief, Recent changes and the Checker all draw over the map
correctly (`zmap.cjs`). Only Help does not.

**Evidence.** `shots/help1-laptop.png`, `shots/help1-phone.png`, `shots/zmap-Help.png`.

**Mechanism.** `src/features/help/HelpPanel.tsx:104` uses `z-40`. Leaflet's panes are around 400 and the
map's floating controls are around 1000. The Brief uses `z-[3000]` and Recent changes `z-[2500]`.

### UX-3-5: An ✕ that looks like "close menu" deletes the map's scale, with no confirm and no undo

**Who it costs:** anyone who calibrated a map.

**Screen:** Maps, ⋯ **Map tools**. Guide: *Setting a map's scale*.

**What I did.** On *Middle Earth* (scale 1 km = 1 px), at 1280, I opened ⋯ and clicked the ✕ at the
menu's top-right corner.

**What happened.**

- The ✕ is **12×12px**, at the top-right of the popup, beside the "SCALE" label. Its only name is the
  title *Clear scale*.
- One click set the scale to `null`. The breadcrumb lost "· 1 km = 1 px" and **Measure** left the toolbar.
- No toast appeared. The Undo button read **"Nothing to undo"**, and Ctrl+Z left the scale at `null`.
- Separately, **Escape does not close this menu**, whether it was opened by mouse or by keyboard
  (`aria-expanded` stayed `true`). Clicking outside closes it. Opening it does not move focus into it.

**Evidence.** `maps5.cjs` output, `shots/maps2-laptop-moremenu.png`, `shots/maps5-after-clear-scale.png`.

**Mechanism.** `src/features/maps/MapToolbar.tsx:178-187` draws the X. `MapExplorerView.tsx:1094` wires
it to `updateMapLayer(layer.id, { scalePixelsPerUnit: null, … })`, a direct write outside the operation
journal. The menu is a hand-rolled `div` with no key handler.

### UX-3-6: In the Paper theme the Relationships toolbar disappears into a dark canvas

**Who it costs:** Paper users, and every non-default theme less severely.

**Screen:** Relationships. Guide: *World settings & export*, Theme.

**What I did.** I set Dracula's theme to Paper and opened Relationships at 1280.

**What happened.** The graph canvas stays navy `rgb(12,19,34)` while the rest of the app is cream. The
outline buttons **Generate with AI** and **Tidy up** take Paper's ink colour `rgb(44,38,33)`, which gives
**1.24:1** against the canvas (computed from the colours, not judged by eye). The React Flow zoom buttons
are bright white whatever the theme. In the other themes the canvas is navy instead of the theme's own
background: Dracula's red-black Gothic theme shows a blue graph.

**Evidence.** `shots/rel2-paper-toolbar.png`,
`shots/sweep-Dracula-writer-laptop-paper-relationships.png`, and the `rel2.cjs` output.

**Mechanism.** `src/features/relationships/RelationshipGraphView.tsx:625,651` set
`style={{ background: 'hsl(222,47%,9%)' }}`, and line 731 sets the `Controls` colours inline.

### UX-3-7: Escape does not close most panels in this part, though Help says it does

**Who it costs:** keyboard users.

**Screen:** Maps, Factions, Search, Items. Guide: *Help* ("Esc closes panels or cancels inline edits")
and the Help panel's own shortcut row "Esc · Close panel or dialog".

**What I did.** For each panel I checked it was open, put focus inside it (on its close button), pressed
Escape, and checked again. Every case below is "open: 1, after Escape: 1" (`maps8.cjs`, `maps9.cjs`,
`fk2.cjs`, `srch2.cjs`, `items5.cjs`).

**Still open after Escape:**

- the map's **location**, **route**, **region** and **character** panels;
- the **faction** panel;
- the map's **⋯ Map tools** menu;
- the item page's inline **Edit** form;
- the **search palette**, once focus has left its text box. After clicking **Whole words**, or tabbing
  to a result, two Escapes in a row leave it open.

**These do close on Escape:** dialogs, the Brief, the Checker, Recent changes, Help, and the palette
while the caret is in its box.

**Mechanism.**

- `MapExplorerView.tsx:126-147` handles Escape only for canvas-click modes. The panels have no handler.
- `SearchPalette.tsx:390-398` attaches `onKeyDown` to the `<input>` only (line 441).

### UX-3-8: Unnamed controls, and controls named by database ids

**Who it costs:** screen-reader and voice-control users.

**Guide:** *Keyboard, screen readers and touch*: "Every field and control is named". These are the
counter-examples I measured with `ariaSnapshot()`.

**Maps** (FotR root map at Ch. 1; `scratch/maps4-aria.txt`):

- About **21 location markers** drawn as dots are `button` with **no name**.
- The map picture is an `img` with no alt.
- A region polygon is the first Tab stop inside the canvas, and it has no name.
- **6** Map Layers expand/collapse chevrons have no name.
- **2** Show-chip chevrons (character filter and location types) have no name.

**Faction panel:** **25 of 31** buttons have no name, no title and no text. They are the colour swatches,
the tag removers, and each member's expand and remove.

**Relationships and Family tree:** every edge is a focusable button named, for example, *"Edge from
dracula-char-jonathan to dracula-char-mina"* or *"Edge from wuthering-heights-char-earnshaw to
wuthering-heights-char-catherine"*. These are internal ids read out loud.

**Family tree nodes:** each is a `role="button"` that contains three more buttons (*Open*, *Edit … family*,
*Fold …*). Nested interactive controls are not reliably reachable.

**Mechanism.**

- `LeafletMapCanvas.tsx:1283`: `<Marker>` is given no `title`/`alt`, so a pill-less dot has no text.
- `MapSidebar.tsx:194-199` and `MapFilterBar.tsx:93-99`: the chevron `<button>`s have no `aria-label`.
- `FactionsView.tsx:69-81`: the member buttons have no name.
- React Flow's default `ariaLabel` for edges and nodes is used, with no override.

### UX-3-9: The relationship graph adds 40 invisible, inert Tab stops before its own toolbar

**Who it costs:** keyboard users.

**Screen:** Relationships. Backlog **X-7a** decided the graph would get no keyboard navigation.

**What I did.** On Dracula at Ch. 20 I counted the focusable elements in `main` that come before **New
Relationship** in DOM order. Then I tabbed onto a node, pressed Enter, focused an edge and pressed Enter.

**What happened.**

- **40** focusable graph elements (15 edges and 25 nodes) come before the toolbar.
- Nodes show **no focus indicator**: outline `none`, no box-shadow (`shots/rel6-node-focus.png`).
- **Enter does nothing** on a node, and Enter or Space does nothing on an edge.
- A mouse click on the same edge does open the relationship panel (`shots/rel4-edge-panel.png`).

X-7a's reasoning ("relationships have an accessible home on each character's Relationships tab") still
holds. But React Flow's defaults left the graph in the tab order anyway, so the "no keyboard nav"
decision costs a keyboard user 40 dead presses on every visit.

**Mechanism.** React Flow nodes and edges are focusable by default (`tabindex="0"` measured on an edge),
and no `nodesFocusable={false}` / `edgesFocusable={false}` is passed.

### UX-3-10: Pickers that name the field without its value, or the value without its field

**Who it costs:** screen-reader and voice users.

`CLAUDE.md` makes this rule for selects: a select's name carries both its field and what it is showing.
These break it, in both directions.

**Field name only, value never read out** (a static `aria-label` on a `SelectTrigger`):

- Research's **"Attached to"** filter, which shows *Attached to anything*.
- Knowledge's **"Order facts by"**, which shows *Order added*.
- The New Relationship dialog's **"Character A"** and **"Character B"**. After picking Mr Swales, the
  snapshot reads `button "Character A": Mr Swales`, so the name stays "Character A".
- Set scale's **"Unit"** (`SetScaleDialog.tsx:81`). Seen in source; the dialog was not driven.

Sources: `ResearchView.tsx:66`, `KnowledgeView.tsx:235`, `RelationshipGraphView.tsx:363,371`.

**Value only, field never named:**

- Lore editor: **"Ch. 18 · Van Helsing States the Case"** (the *Revealed at* control), **"1 linked"**
  (Link entities) and **"Vampire Lore"** (category).
- Lore editor: the title box is named **"Untitled"** even when filled. It is read as "Untitled, Vampire
  Powers and Limits".
- Knowledge fact panel: **"Ch.15 — The Empty Coffin"** and **"Ch.13 — After the Death"**. Their labels,
  *Reader learns at* and *Becomes true at*, are plain paragraphs.
- Knowledge fact panel: the fact's title box has no name.
- Knowledge fact panel: *Might also know* has five identical **"+ learned it"** buttons that do not say
  whose row they are on.

**Evidence.** `res1.cjs`, `rel3.cjs`, `lore1.cjs` and `kn1.cjs` outputs.

### UX-3-11: Whereabouts names one holder for an item there is more than one of

**Who it costs:** everyone.

**Screen:** Item page. Guide: *Items*, "Things there is more than one of".

**What I did.** On FotR I opened **Elven Cloak**. It is collective (`isCollective: true`) and has six
custody rows at *Outfitting the Fellowship*, for Gimli, Legolas, Merry, Pippin, Sam and Frodo.

**What happened.** The roster card at Ch. 21 correctly reads *"carried by Gimli, Legolas, Meriadoc
Brandybuck, Peregrin Took, Samwise Gamgee, Frodo Baggins"*. The item's own **Whereabouts** has one row:
*"Ch. 20 Outfitting the Fellowship — carried by Gimli · Lothlórien Forest"*. The page that exists to
answer "where has it been" tells a different story from the roster.

**Evidence.** `items4.cjs`, `shots/items3-laptop-fotr-detail.png`.

**Mechanism.** `src/lib/itemCustody.ts:82` (`itemCustodyChain`) never reads `isCollective`. By contrast,
`itemWhereabouts.ts:54` has a collective branch.

### UX-3-12: Research's "Attach to…" is an unfilterable list of 186 entries

**Who it costs:** everyone with a real book.

**Screen:** Research. Guide: *Research*, "Attach to… on its card puts it on a scene, a place, a
character or an item".

**What I did.** On Dracula I added a link and opened **Attach to…** on its card.

**What happened.**

- The dropdown is 174×254px and holds **186 options** with no filter: 84 scenes, then 60 places, then
  25 characters, then 17 items.
- Each option is two lines ("Scene: Ch. 1 — Eastward by Rail").
- To attach a source to Mina you scroll past 144 entries.
- Typing "Whit" did not move to a match. Every option begins "Scene:" or "Place:", so typeahead cannot
  help.
- Lore's **Revealed at** list for the same scenes opens with a *Filter scenes…* box, and the guide
  explains why it does.

**Evidence.** `shots/res2-attach-open.png`, `res2.cjs`.

### UX-3-13: Settings' section index hides the heading it jumps to, and fills a quarter of a phone

**Who it costs:** everyone; worst on a phone.

**Screen:** World settings. Guide: *World settings & export*, "a row of chips … jumps you straight to the
one you came for".

**What I did.** I clicked chips in the *Settings sections* index and measured each section `h2` against
the sticky index's bottom edge (`set1.cjs`).

**What happened.**

- **Laptop:** *Custom fields* lands with its heading at 114–134px, under a sticky bar that ends at 153px.
  *Calendar* and *Theme* do the same.
- **Phone (390):** the sticky index is **169px tall**, from 48 to 217px, on a 664px screen. That is 25%
  of the screen, all the time. *Custom fields*, *Calendar*, *DB Health* and *Theme* all land behind it.

**Evidence.** `shots/set1-phone-after-chips.png`, `shots/cf3-laptop-add-field.png` (the heading is cut
by the bar).

**Mechanism.** `src/features/worlds/SettingsSection.tsx:81` sets `scroll-mt-16` (64px). The bar in
`SettingsIndex.tsx:77` is about 105px tall on a laptop and 169px on a phone.

### UX-3-14: Help does not take focus, and is not a dialog or a landmark

**Who it costs:** keyboard and screen-reader users.

**Screen:** Help.

**What I did.** I opened Help with its button, then pressed Tab four times.

**What happened.** Focus stayed on the Help button. The four Tabs went to *Dashboard, Manuscript,
Characters, Maps* in the nav rail. The panel's container has no `role`, `aria-modal` or label; the nearest
ancestor with any of these is `BODY`. A keyboard user has to tab through the whole page to reach the help
they asked for. Compare the Brief and the Checker, which move focus into themselves.

**Evidence.** `help1.cjs`.

### UX-3-15: The Close ✕ of every shared dialog has no visible focus

**Who it costs:** keyboard users, in every dialog.

**What I did.** I tabbed to **Close** in *Generate Locations with AI*.

**What happened.** `:focus-visible` matches, and the computed style is `outline: none`, `box-shadow:
none`. Nothing is drawn (`shots/dlg-close-focus.png`).

**Mechanism.** `src/components/ui/dialog.tsx:169` has `… focus:outline-none` and no `focus-visible:ring`
to replace it. Every dialog built on `Dialog` has this.

### UX-3-16: Recent changes and the Undo label name fields that did not change

**Who it costs:** everyone.

**Screen:** Recent changes. Guide: *Undo, redo & recent changes*, "Each entry names the record and what
it touched".

**What I did.** On Quincey's Bowie Knife I changed only the **name** and saved. Separately, I changed only
a faction's **description**.

**What happened.**

- The item entry reads *"Edited item 'Bowie Knife' — **description, icon type** and 3 more"*. Neither
  description nor icon type changed. The fields that really changed were `name` plus
  `isCollective`/`staysInEra` going from `undefined` to `false`.
- The faction entry reads *"— **color**, description and 1 more"*.

The one thing the person did is hidden inside "3 more", behind fields they did not touch.

**Evidence.** `undo1.cjs`, `undo2.cjs`. The record was compared before and after.

**Mechanism.** The edit forms write every field. The journal reports the fields that were *written*, not
the fields that *differ*.

### UX-3-17: The Arc's "Clear filter" does not clear the filter

**Who it costs:** everyone on the Arc grid.

**Screen:** Character Arc. The guide does not mention this control.

**What happened.** **Clear filter** sits on the row under the *Filter characters…* box. It shows even
when the box is empty and nothing is filtered. Clicking it moves the **global time cursor** to *All
chapters*, which changes every screen. On a phone at 320 it wraps to two lines (*Clear / filter*).

**Mechanism.** `src/features/arc/CharacterArcView.tsx:992-1006`. It is rendered whenever `activeEventId`
is set, and calls `requestClear`.

### UX-3-18: A map cannot be deleted from the keyboard, and on touch only by accident

**Who it costs:** keyboard and touch users.

**Screen:** Maps, Map Layers. Guide: *Keyboard, screen readers and touch* (hover controls "show
themselves when you hover the row **or move focus onto it**" and are "drawn all the time" on a phone).

**What happened.**

- The trash beside a layer is rendered only while `hovered` is true, and that is set by
  `onMouseEnter`/`onMouseLeave` (`MapSidebar.tsx:189-237`).
- Focusing a layer's name and pressing Tab goes straight to *Characters 25*. **No keyboard path deletes
  a map.**
- On the phone drawer, zero *Delete map* buttons were drawn until a row had been tapped. A tap also
  opens that map.
- Layer rows are **24px** tall and the chevrons **12×12** on a coarse pointer. The *Not on a map* rows
  beside them do get `pointer-coarse:min-h-11`.

**Evidence.** `layerdel.cjs`, `touch-dracula.txt`.

### UX-3-19: The relationship graph fits under its own toolbar, and Focus does not re-fit

**Who it costs:** everyone; worst on a phone.

**Screen:** Relationships. Guide: *Keeping a large cast readable*.

**What happened.**

- **Toolbar over nodes.** The fitted view puts the top node under the floating toolbar and the "Zoom in
  to read…" pill. That is one node on a laptop (`shots/rel3-laptop-graph.png`) and three on a 390 phone,
  where the toolbar takes three rows (`shots/sweep-Dracula-writer-phone-default-relationships.png`).
- **Focus does not re-fit.** **Focus on one character → Lucy Westenra** leaves her six-person corner at
  the same tiny zoom and the same coordinates (Lucy's node stayed at about 672,292). The labels stay
  unreadable, and the pill still says to zoom in (`shots/rel3-laptop-focus.png`).
- **A note about labels that do not exist.** At Ch. 1 no relationship is active and **0 edges** are drawn,
  yet the pill says *"Zoom in to read the relationship labels"*. The guide says the note exists so you are
  not left "to think there are none". Here there really are none, and the note says otherwise.

### UX-3-20: The Arc grid's rows have no headers, and the page has no heading

**Who it costs:** screen-reader users.

**What happened.**

- Each row's character cell is `gridcell`, not `rowheader`.
- Arrowing down a column reads only *"No state recorded — record it"*, with nothing to say whose cell it
  is.
- The header row's first cell is a `gridcell` "Character".
- "Character Arc" is plain text. Every other screen in this part has an `h1`.
- Visible focus and roving tab-stop behaviour work as documented (`arc2.cjs`).

### UX-3-21: The map character panel's "Alive" badge is a one-click death

**Who it costs:** everyone.

**Screen:** Maps, character panel.

**What happened.** A full-width green **Alive** strip looks like the read-only badge readers see. One
click recorded Jonathan Harker as **Deceased** at the scene: the pin gained a † and he left *On the map*.
There was no confirm and no toast. The button has no `aria-pressed` and no description of what it does.
Undo does work: *"Undo: Edited character state 'Jonathan Harker' — alive or dead"*.

**Evidence.** `shots/maps10-after-alive-click.png`.

**Mechanism.** `CharacterSnapshotPanel.tsx:246-254`.

### UX-3-22: Deleting says three different things and wears three different weights

**Who it costs:** everyone (consistency).

**What the confirms say:**

- Item: *"This will **permanently** remove the item and all its snapshots."* An **Undo** toast then
  appears and works.
- Research: *"Undo brings it back."*
- Map layer: *"This cannot be undone."* This one is true.

**How heavy the control is:**

- The guide says the map panels put delete "in the quietest weight there is". The relationship, faction
  and fact panels end with a full-width filled red **Delete permanently / Delete Faction / Delete Fact**,
  the loudest thing on each panel (`shots/rel4-edge-panel.png`, `shots/kn1-laptop-fact.png`).
- The item page's delete is a bare trash icon in its header.
- The character page puts delete in a ⋯ menu.

### UX-3-23: The empty Maps screen offers each door twice, under different names

**Who it costs:** everyone (low).

**What happened.**

- The header has **Upload Map** and **Generate with AI**. The body has **Add Map** and **Generate
  locations with AI**. Each pair opens the same dialog.
- The *Add a place* dialog's submit button says **Add Location**.
- Its type defaults to **City**, including in the kitchen-and-office book the guide uses to introduce
  it.
- The empty Maps header is a bare text "Maps", not the icon + h1 + count header the other screens use.

**Mechanism.** `EmptyMapHeader.tsx:8-9` and `MapExplorerView.tsx:1558-1576`.

### UX-3-24: Audit with AI disables its buttons without saying why

**Who it costs:** everyone (low).

With no key entered, **Run the audit** is disabled, and **Check the quotes** is disabled while the reply
box is empty. No reason is given. X-9's `BlockingReason` pattern ("Needs a key") is not used here
(`cc1.cjs`).

### UX-3-25: Offline, broken-image icons show under the "could not be loaded" banner

**Who it costs:** offline users of Library worlds (low).

The banner is correct. Inside the canvas, though, the failed `ImageOverlay` shows the browser's
broken-image glyph at its top-left. The pill for a character on a sub-map shows a broken portrait
(`shots/sweep-Dracula-writer-laptop-default-maps.png`, `shots/maps9-char-row.png`).

The broken portrait is from `LeafletMapCanvas.tsx:184`, which builds an `<img>` with no `onerror`
fallback to the initials it already supports. **Caveat:** the seam installs without images, so how many
portraits a real offline install would break is not measured.

### UX-3-26: Small touch targets on a coarse pointer

**Who it costs:** phone users (low).

Measured with an iPhone 13 emulation, including any `.pw-tap` overlay:

- Item page, *Link item image by URL*: **12×12**.
- Lore category *Rename* and *Delete*: **14×14 each, side by side**. Delete asks first.
- Search, **Whole words** checkbox: **12×12** (`h-3 w-3`).
- Map Layers rows: 24px tall (see UX-3-18).

### UX-3-27: Smaller visual faults

**Who it costs:** everyone (low).

- Faction cards in one row put their titles at y=188 and y=198, because content is vertically centred.
- The lore editor's *Revealed at* chip lets its chevron touch the text and the next chip
  (`shots/lore1-header.png`).
- In reading mode, the page for an item not yet reached is headed **"item"** in lower case
  (`shots/sweep-Dracula-reader-laptop-default-items-detail.png`).
- Story time lanes are about 168px tall each, so only about 3½ lanes fit at 1280×800
  (`shots/arc3-storytime.png`).

---

## The guide out of step

1. **Maps, the breadcrumb.** The guide says the open layer and its scale "read from the breadcrumb at the
   top of the window". Below 1024px the layer name is not shown (it is in the sidebar drawer instead),
   and below 1280px the scale is not shown anywhere except inside ⋯ → *Recalibrate (…)*
   (`TopBar.tsx:170-185`). **The guide should say so.**
2. **Help.** "Esc closes panels." Untrue for most panels in this part (UX-3-7). **The app is wrong.**
3. **Keyboard, screen readers and touch.** "Every field and control is named" and "move focus onto it"
   reveal hover controls. UX-3-8 and UX-3-18 are counter-examples. **The app is wrong.**
4. **World settings.** "There are twelve sections in all." There are **fourteen** chips. The guide's
   names **Database health**, **Folder and cloud sync** and *Export* appear in the app as **DB Health**,
   **Cloud Sync** and **Share**. **The guide should follow the app.**
5. **Items, deleting.** The guide says "Undo brings the whole lot back", and that is true. The app's
   confirm says "permanently". **The app's wording is wrong.**
6. **Map regions.** The guide lists *active, occupied, contested, abandoned, destroyed, unknown*. The
   panel also offers **rebuilt**. **The guide should add it.**
7. **Relationships.** "Can begin at a chosen scene." The New Relationship dialog has no start control:
   it says *"Starts at Ch. 20 … and won't appear in earlier chapters"*, taking the time cursor. Only the
   relationship panel afterwards has *Started in*. **The guide should say it starts at the cursor.**
8. **Family tree.** The screenshot is captioned *"Wuthering Heights at chapter 20, with the Heights passed
   to Hareton"*. The Library's *Wuthering Heights* has **no family recorded**: its tree opens on *"No
   family recorded"*. Someone trying the example sees nothing. **Either the book or the caption should
   change.**

---

## What I only suspect

- **The Writer's Brief lists the whole recorded cast, not the scene's.** At *A Fourth Transfusion*
  (Hillingham), *Characters 18* includes the Captain and First Mate of the Demeter in the Cargo Hold and
  Mr Swales. If the brief is meant to describe *this scene*, 15 of those rows are noise. If it is meant to
  be everyone's state at the cursor, it is working. **What would settle it:** the intended scope in
  `WritersBriefPanel`. The guide's "per-character state readout" does not say.
- **A relationship's Evolution history may not show at all.** The guide says selecting an edge opens "an
  **Evolution** history of every scene-based change". The panel I opened (Jonathan–Mina) had no Evolution
  section, but that relationship may have no changes. **What would settle it:** opening one with a
  snapshot at a later scene.
- **Map-layer delete on a real phone.** Whether a tap shows the hover-only trash depends on the browser's
  emulated `mouseenter`. Chromium's touch emulation showed it only after a tap. **What would settle it:**
  a real iOS/Android device.
- **Items with nobody carrying them.** The Dracula roster shows no "carried by" and no condition dots,
  because its data has no holders and no conditions. I cannot say from it whether the condition dot works.
  FotR showed "Intact · carried by …", so the condition text at least renders.

---

## What worked

- **No horizontal scrolling anywhere in this part.** All 13 routes were checked at 1280, 390, 360 and 320,
  in writer, reader and blank worlds (`log-sweep-*.txt`). The rosters reflow cleanly, apart from UX-3-3.
- **Custom fields matches the guide closely.**
  - A template adds three fields, and adding it twice says *"The Fantasy characters fields are here
    already."*
  - Values over time read *said here*, then *since Ch. 10 — Strider's Offer* at a later cursor, with
    **Take back**.
  - The roster gains *Filter by a field*.
  - The selects are named by field and value (`Race Human`), which is the rule this repo cares about.
- **Search.**
  - `Dantes` finds *Dantès*, with the mark on the real spelling.
  - `ch 74` goes to chapter 74 and sets the cursor.
  - Escape from the text box closes the palette only.
- **The Continuity Checker** opens with focus inside, its icon buttons are named, it closes on one
  Escape, and the keyless Audit view explains exactly where a prompt would go.
- **The Arc grid's keyboard model is as documented:** one tab stop, arrows, Ctrl+End, a visible cell
  focus, and Enter on a cell opening *Current State* at that scene.
- **Family.**
  - The family section's refusal is specific and announced (`role="alert"`): *"Mr Earnshaw is one of
    Hareton Earnshaw's ancestors, so Hareton Earnshaw cannot be their parent…"*.
  - *Whole family* lays out generations, a dashed adoptive line and a "married" partnership clearly.
- **Places.** *Add a place* in a world with no map works, and the same-name warning is a live
  `role="status"`.
- **Story time's block labels** are what a screen reader needs: *"3. The Carriage at Borgo Pass, 5 May,
  1893 (editorial), Jonathan Harker, in more than one place this day, at Borgo Pass"*.
- **Deleting an item** gives a named undo toast (*Deleted item "Elven Cloak" · Undo*).
- **Ctrl+Z and Ctrl+Y** walk the stack and their labels name the act.
- **The calendar's empty states offer the act.** *Enable calendar* is on the Calendar screen itself, as
  the guide says.
- **The reading-mode gate held** on every route I visited. Research redirects to the dashboard. An
  unreached item says *"You have not reached this item yet"*. Relationships drops *New Relationship* and
  *Generate*.
