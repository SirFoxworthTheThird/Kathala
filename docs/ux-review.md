# UX review — working document

A screen-by-screen review of PlotWeave's interface, started after v1.0.0. The
premise is that a released version is exactly when reworking is affordable, so
nothing here is constrained to small fixes: where a screen would be better built
differently, that is what the entry says.

**This is a working document, not user documentation.** It is a shared list to
argue with, tick off, and eventually delete.

---

## Method

Screens were captured from the real app driven by Playwright at
`deviceScaleFactor: 2`, 1440×900, against two worlds:

- **A populated world** — *The Fellowship of the Ring* imported from
  `example/` with its `.pwb` images. That file carries no `readingMode` flag, so
  it opens in **writing mode**; the dashboard shows the alive/dead split, Scene
  Status, and Writing Progress, all three of which reading mode removes. The
  populated screens are therefore the writer's UI, not the reader's.
- **A brand-new empty world** — created through the real *New World* flow, then
  built up one chapter, one event, and one character at a time, capturing each
  empty screen and each creation dialog on the way.

Reading mode has **not** been reviewed yet, and neither have phone widths.

## Triage — decisions taken

Settled on 2026-08-07. Three cross-cutting questions were answered first,
because they change how a dozen screens read and would otherwise force rework.

| Question | Decision |
|---|---|
| **X-1** the watermark | **Drop it entirely.** Empty states become the loudest thing on an empty screen, which is what they are for. |
| **X-2** wide screens | **Use the width.** Content and panels expand rather than huddling into a left column. |
| **X-3** the nav rail | **Labels always visible.** Icon + word for every item; the guessing ends. Pairs with the width freed by X-2. |

### Buckets

**A — fix now (18).** Unambiguous defects; no design decision needed. In hand.

`OP-1` `OP-5` `DASH-1` `DASH-2` `DASH-5` `MS-1` `MS-3` `MS-5` `TL-6` `TL-3`
`OP-3` `OP-4` `OP-6` `EV-2` `EV-4` `EV-5` `CB-3` `CB-4` `X-6`

Ordered by value: **OP-1** first (it loses a half-filled form today), then
**OP-5** (every new user is left without a cursor), then the rest.

Added by later passes, same bucket: **`X-10`** (no dialog is a modal — one
component, 21 files' worth of dialogs, and `useFocusTrap` already exists),
**`AI-2`**, **`AI-3`**. **`AI-4`** goes to bucket B: preserving a failed paste
across an accidental close is clearly right, but whether that means a confirm,
a draft, or simply not resetting on backdrop-click is a decision.

**`AI-1` is fixed** (all four AI parsers now share `stripCodeFence`), joining
`OP-1`, `OP-8`, `OP-9` and the mobile map cursor.

**`PH-1` joins the front of the queue with them** — the map showing 2 of 5
markers on a phone is the same class of problem: a headline screen not doing its
one job, measured rather than argued. Later passes also add `SQ-1`, `SQ-2`,
`HP-1`, `X-14`, `PH-2`, `PH-3`, `PH-4` and `ST-2` to bucket A.

**`RD-1`, `RD-2` and `RD-6` are fixed** (see section 22). `RD-7`, found while
fixing them, is left open on purpose — it changes what a whole screen shows in
reading mode, which is a product decision rather than a defect fix.

**`RD-2` jumped the queue; `RD-1` followed it.** `RD-1` was downgraded from high to
med by the depth pass (see the correction in section 22 — its headline example
turned out to be a chapter title, and the gate holds on all eleven routes for
everything it has data about). What survives is a real but latent hole, and
`RD-2` is the reason it could go unnoticed at all: the guarantee spec is
structurally unable to fail on that class. Fix `RD-2` first, so `RD-1` has a test
that can go red. Also added to bucket A from later passes: `X-11`, `X-12`, `X-13`,
`WR-2`, `DF-1`, `DF-2`, `RD-3`, `RD-4`. `DF-3` and `WR-1` are bucket B — both
need a decision (what should a chapter diff compare; how should the inline
editor grow) rather than just a fix.

**B — design work, direction now set (7).** `X-1` `X-2` `X-3` are decided above
and have been done, as have `TL-1` (pacing curve), `ST-1` (structure
proportion) and `REL-1` (graph layout) — the three visualisation findings, and
the only ones of this batch that held up in full when measured. `EV-1`
(event-card disclosure) and `SEL-1` (selector entry points) still need their own
shape before they can be built.

**C — verify before deciding (3).** `CB-1` and the two operations left unproven
in section 10. Cheap; folded into the next pass over those screens.

**D — closed or downgraded (4).** `OP-7` closed as corrected. `OP-2` downgraded:
a modal intercepting clicks is defensible on its own, and only looked wrong
next to OP-1. `SEL-4` (tagline) and `X-5`/`W-2` (permanent help text) are
house-voice calls rather than defects, and wait for someone with an opinion
about the voice.

**OP-2's downgrade was half wrong.** It was filed as "an open palette traps
you" and downgraded on the grounds that a modal intercepting clicks is normal.
That part stands. What did not stand is the assumption behind it — that the
palette was a well-behaved modal. It also survived navigation, which is
**OP-9**, now fixed. The trapping is by design; the outliving was not.

---

## Legend

| | |
|---|---|
| **Severity: high** | Actively misleads, blocks, or makes the product look broken |
| **Severity: med** | Costs the user time or confidence every time they meet it |
| **Severity: low** | Polish; worth doing when the surrounding area is touched |
| **Status** | `open` · `agreed` · `doing` · `done` · `rejected` |

---

## Cross-cutting

These recur on nearly every screen, so they are worth settling once rather than
per page.

| ID | Severity | Status | Finding |
|---|---|---|---|
| X-1 | high | **fixed** | **The watermark competes with the content.** A very large PW logo over a map illustration sits behind every screen. On populated screens it shows through the gaps; on empty screens it is the loudest thing in view, with far more visual mass than the actual message. Empty screens read as decorative rather than actionable. **Fixed:** removed. Worth noting the app had already decided this — every named theme (Fantasy, Sci-Fi, Horror, …) set `--app-image: none`, so the default was the only one still carrying it. |
| X-2 | med | **fixed** | **Wide viewports are largely unused.** Content columns stop around 55–65% of a 1440px window, leaving a third of the screen as wallpaper, while the panels that *are* shown get cramped. **Measured at 1600px, and the finding was broader than the fault.** The rosters — characters, items, lore, knowledge, factions — already use **97%** of the window; the timeline uses 167% and scrolls by design. The one screen that matched the complaint was the **dashboard at 64%**, capped at `max-w-5xl`. Settings uses 42% and was left alone on purpose: it is a form, and a 1600px-wide text field is worse than a narrow one. **Fixed** for the dashboard, which is tiles and panels rather than prose — now 97%, with a sixth column once there is room. |
| X-3 | med | **fixed** | **14 unlabelled nav icons, one faint divider.** Corkboard, Structure, and Arc are three abstract grid glyphs in a row and cannot be told apart without hovering each. The guide describes a "More" divider separating everyday screens from the rest; visually that split barely registers. **Half of this was already handled:** every rail item carries an `aria-label` and, when collapsed, a `title`, so the names are available — the problem was purely visual. **Fixed:** Dashboard, Corkboard and Arc were three grid glyphs (`LayoutDashboard`, `LayoutGrid`, `TableProperties`); Corkboard is now a sticky note and Arc a curve, which is what each screen actually is. The tier divider gained vertical room so the grouping reads when the "More" label is hidden. |
| X-4 | med | **fixed** | **Empty states are inconsistent.** Some are excellent (Arc: heading, explanation, and a CTA routing to the prerequisite). Others are italic grey sentences sitting where a control should be ("No characters assigned.") with no affordance to act. Others are simply blank panels. | **Fixed as a rule, with a stated boundary.** `EmptyState` now carries the rule it enforces, in order: **offer the act** where the thing can be made from here (the Arc grid and the Calendar, **CAL-1**, are the model); **route to the prerequisite** where it cannot, naming the screen *and going there*; **say nothing** where the control that fills the section is already beside it, because a sentence announcing the absence next to a *+ Add character…* picker is noise. Applied to: the character Appearances tab (which had the heading and the explanation and stopped there — it has the Timeline control now), the birth-date field with no calendar, the region panel's owning faction (the twin of **LP-3**, which got its link on the location panel and not here), and the scene card's cast and mention sections. **A bare unset value — "No description." — is deliberately not in scope**: that is a field reading empty, not a section with nothing to do, and the same goes for the *"No location"* / *"No POV character"* options inside pickers. Two things the work turned up: rule 3 is the dangerous one, since "say nothing" is one step from the blank panels this finding is partly about, so the scene card keeps a sentence for the case where no picker can render at all; and a first draft added that fallback to the Items section too, where the section is only offerable when items exist and the branch could never run.
| X-5 | med | **corrected — measured, and it is one screen** | **Permanent help text.** Explanatory sentences under form fields never go away. The writing is good, but once learned it is noise on every future visit. | **Measured across eleven screens and three edit forms.** Outside Settings there is almost none: the character edit form has **one** sentence (the birth-date/calendar note added for **X-4**), the Knowledge detail has **two** — which this review itself calls *the best panel in the app* and quotes approvingly — and the roster screens carry a one-line definition of what the section is, at **16px**. Settings is where the finding is real: **ten paragraphs totalling ~330px**, one per section. But Settings is also the screen where the prose earns its place, because sections there are visited rarely and *Continuity: consecutive events without a snapshot* is not self-evident on the third visit any more than the first. **So the fix is navigation rather than dismissal** (**SET-2**): the index lets you go to the setting you came for without reading past nine explanations, which is the actual cost. A dismiss-and-remember mechanism, with the settings screen to restore it from, would have been more machinery than the 16px it reclaims anywhere else. |
| X-7 | high | **fixed** | **Clickable things that are not controls, inconsistently.** The 18 item cards on the Items roster are not links or buttons — a query for `a, button` inside the main region returns only *Generate with AI*. The corkboard's status pill is the same (**CB-1**). So are the map sidebar's **region rows**: measured, **0** reachable by `role=button`, **8** by div text. So are its **character rows**. But its **location rows are real buttons**. Three different answers inside one sidebar. These are `div`s with click handlers: no keyboard, no screen reader, no focus. **Measured across twelve routes, and it is four problems rather than one:** roster cards (characters 45, items 18, lore 25), the Arc grid's cells (628), the relationship graph's ReactFlow nodes (181), and the pacing curve's SVG points (117). Only the first is the finding as filed, and it is a defect rather than a matter of taste — a card is a way to that entity's page, so it should be a link. **Fixed:** all three rosters are links now, reachable by Tab, openable with Enter, and able to go to a new tab on middle-click. The lore card carries a delete button, and a button inside an anchor is invalid, so it uses the link-overlay pattern — the title is the link and its `::after` covers the card. `e2e/rosterCards.spec.ts` asserts the property (no clickable non-controls in `main`) rather than the markup of one card. **Left open on purpose:** the grid, the graph and the chart each need their own answer — a data grid wants roving-tabindex cell navigation, not 628 links — and are tracked as **X-7a**. **X-7a is now closed, with three different answers.** The Arc grid got roving-tabindex navigation under `role="grid"` (`src/features/arc/gridNavigation.ts`): one tab stop, arrows to move, Home/End and Ctrl+Home/End, PageUp/PageDown, Enter or Space to activate, clamped at the edges rather than wrapping. The pacing curve got a visually-hidden data table — a chart's accessible equivalent is the numbers behind it, and 117 focusable circles would have been worse. The relationship graph got neither: it visualises data that already has an accessible home on each character's Relationships tab, and bolting keyboard navigation onto a ReactFlow canvas would have bought less than the Focus control shipped for `REL-1` already does. **The map sidebar's own rows outlived all of this** — they were named here as an instance and then never counted among the four, so they were closed separately as **SB-4** in section 16. |
| X-9 | med | **fixed** | **Primary actions disable themselves without saying why.** *Add Location* greys out until Name is filled (**OP-6**); *Save route* greys out until the route has both a name and two points (**RT-1**). Neither marks a required field, shows helper text, or explains itself on hover — the button simply does nothing and the user has to guess which of several fields is at fault. Two instances found without looking for a third. | **Fixed, with a stated boundary.** `src/lib/blockingReason.ts` names *every* unmet requirement, not the first, and returns null — not an empty string — when the action can run, so nothing is drawn and no space is reserved. `BlockingReason` renders it with `role="status"`, which is the only thing that works here: a disabled button carries `disabled:pointer-events-none`, so a `title` on it never receives hover and `aria-describedby` never gets read, because it is out of the tab order. (I wrote the `title` version first; it would have shipped inert.) **Applied where the condition is compound or non-obvious** — Add Location, Save route, Save region, the relationship dialog's four conditions, the timeline-relationship pair and its sync-point row, artifact eras, travel modes, and Add Chapter on the merged view. There are 48 `disabled={!…}` sites in all; the ~40 that are a single visible empty field beside their own Save are deliberately left alone, since nothing is being guessed at there. A third instance turned up in the sweep: the **region** HUD disabled its save on exactly the same silent pair as **RT-1**.
| X-17 | high | **fixed** | **A stored `sortKey` was compared against a freshly computed one, and the shipped library disagrees with the formula.** Snapshot resolution read each record's stored `sortKey` but computed the cursor's position from scratch. That holds only while every writer of a key agrees with the current formula — and **fourteen of the twenty shipped `.pwk` worlds do not**: they carry keys on the pre-v7 scale (`chapter + sortOrder / 1_000`) while the code computes `chapter + sortOrder / 1_000_000`. The importer rewrites old keys only for files declaring `version < 7`; these declare **16 and 18**, so nothing corrected them. The two orderings are identical among themselves, which is why this was invisible: nothing looked out of order. Compared against each other, `1.001 > 1.000001`, so a snapshot was ruled out as *after the cursor* while the cursor sat on **the very event it was authored on**. Measured on *The Fellowship of the Ring*: **396 of 533** character snapshots skipped that way, the resolver falling back to whatever earlier snapshot did pass — so a large part of that world's cast state read as an earlier chapter's, on the map, the Arc grid and every character panel. Only snapshots at `sortOrder 0` were unaffected, which is what made it look like ordinary sparse data. **Fixed by computing both sides.** A record's position is derived the same way as the cursor's, so the two cannot disagree whatever wrote the record or however the file arrived — the class of fault goes rather than the instance. The stored key still backs `HistoryTab`'s ordering and the Dexie indexes; it was only unfit as a *comparand* for a computed one. The one place it is still read is an **orphaned** snapshot whose event has been deleted: there is no position to compute, so the stored key is all there is. **Found by accident**, chasing MT-8 — a fixture of mine invented a `sortKey` on the wrong scale, and asking why that failed turned out to be the same question. |
| X-10 | high | **fixed** | **No modal in the app is a modal, as far as the browser is concerned.** `DialogContent` (`src/components/ui/dialog.tsx:40`) renders a bare `<div>`: no `role="dialog"`, no `aria-modal`, no `aria-labelledby` pointing at the `DialogTitle` it already renders, no focus trap, no focus restore on close. Tab walks straight out of an open dialog into the page behind it; a screen reader is never told a dialog opened; closing one leaves focus wherever it fell. This is **21 files** worth of dialogs — every generation dialog, every create/edit form, the diff modal, the confirms — from one component. `useFocusTrap` (`src/lib/useFocusTrap.ts`) already existed and was already used by the search palette. **Fixed:** the panel now carries `role="dialog"`, `aria-modal="true"` and an `aria-labelledby` resolved from `DialogTitle`; `useFocusTrap` keeps Tab inside; focus moves in on open and returns to the opener on close. One subtlety worth recording — the opener has to be captured during `Dialog`'s **render**, not in an effect: child effects run before parent ones, so for any dialog whose form focuses its first field the "previously focused element" was already an input *inside* the dialog. Guarded by `e2e/dialogA11y.spec.ts`, whose four cases fail one-for-one when each mechanism is removed individually. |
| X-6 | low | **fixed on the card it names** | **Dates are unlabelled and US-format.** `4/1/2026` on a world card — created or edited, April or January? | **Both questions answered where they were asked.** It is the creation date, so the card says *Created*; and the month is named rather than numbered, which is the whole of the format ambiguity — no locale forcing needed, since a named month reads the same either way round. The card is the only place the finding names; other dates are relative (*2d ago*) and were unified separately under **DASH-3**. |

---

## 1. World selector

| ID | Severity | Status | Finding |
|---|---|---|---|
| SEL-1 | high | **fixed** | **Five equal-weight entry points, no hierarchy.** Library / Generate from AI / Import World / Import Manuscript / New World. Three mean "I already have something", two mean "I'm starting fresh", and nothing groups them. A newcomer must read all five to find themselves. **Fixed** with two labelled `role="group"`s — *Start something new* and *Bring something in* — rather than a primary button and a menu: all five stay one click away, which matters most for Library, the best first run the app has. The grouping is a real ARIA group, not a visual arrangement, so it reaches a screen reader too. |
| SEL-2 | high | **fixed** | **Permanent instructional text in the header** explaining the import file formats — an action nobody has started, described with two extensions (`.pwk`, `.pwb`) a new user has never seen. Belongs inside the import dialog. **Fixed.** Import World now asks before opening the picker, and the same sentence travels with the ask — at the one moment "select both files together" is something you can act on. |
| SEL-3 | med | **fixed, one part left open** | **The world card is poorer than the Library card.** Name, an unlabelled date, a truncated description. No chapter or cast count, no cover art — even for a world whose images were imported. The card seen a hundred times tells less than the one seen once. | **Counts added** — chapters and cast, from `useWorldSummary`, which uses indexed `count()` rather than loading the rows, so a shelf of twenty worlds costs forty index counts and not forty table reads. The date is labelled and its month named (**X-6**). **The cover-art half is left open and re-filed as SEL-3a:** the card already renders `world.coverImageId` and falls back to a globe, so nothing is wrong *here* — the gap is that an imported world never gets a cover assigned, which is an importer question rather than a card one, and worth its own look. |
| SEL-3a | low | **premise measured false; the real cause found and fixed** | **An imported world gets no cover image.** Split out of **SEL-3**, whose card half is fixed. The card renders `world.coverImageId` and falls back to a globe, so the card is not the problem — nothing assigns a cover when a world arrives by import, even when the import carried images. | **Every shipped world already carries one.** All 20 `.pwk` files in `example/` have a `coverImageId`, and a library world downloaded **without** its image bundle still draws its cover, because those covers are stored as *links* rather than bytes — probed on a real Dracula download: `coverImageId: dracula-image-cover`, a blob with a URL and no data. A fix was written for this finding (have the library keep the cover its own catalogue card shows) and then **deleted, because the mutation that removed it still passed** — the assignment was redundant, which is precisely what mutation testing is for. **What actually produces the globe** is the opposite of the finding: an id whose *bytes* live in the `.pwb` bundle, which is tens of megabytes and a separate decision. Fellowship, Two Towers and Philosopher's Stone have binary covers; download the data only and the reference dangles. So the placeholder now says which of the two it is — *Image not available — it may not have been downloaded with this world* — and stays silent when there is no id at all, since an empty slot is not a missing picture. |
| SEL-4 | med | **fixed** | **"Story Tracker" undersells the product.** The guide's own framing — *a story bible for fiction writers* — is more specific and more appealing. | **Taken as filed**, using the guide's own words: the world list now reads *A story bible for fiction writers*. |
| SEL-5 | low | **fixed** | **"New World" appears twice**, as a header button and as a dashed tile, with no stated relationship. | **The codebase had already written down why this is wrong and then done it anyway.** The empty state carries a comment — *two buttons reading "New World" on one screen is an ambiguity for anyone navigating by name, not only for a test* — and refuses to repeat the header's button; the populated screen repeated it regardless. The tile is named for what it does, in the app's own words: the empty state calls this route *start from scratch*. Deliberately **not** *Start a new world*, which still contains "new world" — `getByRole` matches names by substring, so that would have left the ambiguity exactly where it was. Its title states the relationship the finding asked for: *the same as New World, at the top of the screen*. The test asserts "New World" is one button on a populated page, which is the half the empty-state spec never covered. |

**If rebuilt:** two zones. *Start something* — one primary action plus a quiet
"or bring in a draft you already have" that opens a single chooser for
import/manuscript/AI. Then *your shelf*, with cover art, chapter and scene
counts, and relative dates.

---

## 2. World dashboard

| ID | Severity | Status | Finding |
|---|---|---|---|
| DASH-1 | high | **fixed** | **The Continuity tile shows `—`.** Every other tile shows a number; the one tile whose entire purpose is to warn you says nothing, and a dash reads as broken or still loading rather than "not run yet". **Fixed** as **X-14**, which is the same defect filed again from a different screen: a tile with no count is an action, not a statistic, and now shows a chevron. Guarded by `e2e/readingModeToggle.spec.ts`. |
| DASH-2 | med | **fixed** | **"Character Arc / snapshot coverage / 100%"** — the title names a screen while the metric measures something else. Two concepts in one tile. | **The title names the number now** — *Snapshot coverage* — and the line beneath says where pressing it goes: *opens the Character Arc grid*. The tile keeps both jobs, but each is stated once. In reading mode there is no coverage figure to name, so it stays *Character Arc* and carries no number at all, which is the shape **X-14** settled for an action tile. |
| DASH-3 | med | **fixed** | **Recent Events has ambiguous reading order.** Two columns running Ch 6 → 12 → 21 on the left and Ch 1 → 2 on the right; column-major or row-major is unclear, and "recent" is never defined. | **Both halves, without a layout fight.** *Recent* meant the five most recently **updated** scenes and never said so; the heading reads **Recently edited**. The order is legible from the rows now rather than from where they land, because each carries how long ago it was — which makes the column question moot instead of answering it. **A shared `relativeTime` came out of this:** there were three private copies, and they disagreed. Two floored and one rounded, so a 31-minute-old edit read *"31m ago"* in one place and *"1h ago"* in another; the lore card also dropped straight from hours to a locale date, so a page edited yesterday showed *12/08/2026* beside a scene showing *1d ago*. One helper, five unit tests, all three call sites migrated. |
| DASH-4 | low | **fixed** | **Ragged tile grid** — four over three, with a hole where the eye expects a fourth. | **Not fixable by counting.** Seven tiles into rows of four leaves a hole, and adding an eighth would not help: reading mode drops the Continuity tile and makes it six. So the row fills itself — a flex-wrap whose basis reproduces the old breakpoints exactly (two, three, four, six across) with `flex-1`, so the remainder goes to whatever is on the last row and a short row is wide rather than gapped. The test measures every row against the container, gaps included, and pairs it with the wrapping points being unchanged, so it cannot pass by the tiles becoming one enormous row. |
| DASH-5 | low | **fixed** | **A generic person glyph represents the world**, even when the world has images. | **Found the mechanism: `PortraitImage` defaults its placeholder to a person**, which is right for the portraits it was built for and wrong for a world. The dashboard's cover slot only renders when a cover *is* set, so the placeholder is reached exactly when the id is there and the picture is not — the world has images and is drawn as a stranger, which is the finding's "even when the world has images" precisely. It falls back to a globe now, the same glyph the world card next door uses: the same world in two places should fall back to the same thing. |

**If rebuilt:** the dashboard's question is *"what should I do next?"*, not
*"how big is my world?"*. Lead with continuity problems, scenes still in
Idea/Outline, and threads that have gone quiet. Demote raw counts to a thin
strip.

---

## 3. First run — the four-step setup guide

| ID | Severity | Status | Finding |
|---|---|---|---|
| NEW-1 | high | **fixed** | **The full 14-icon nav rail is present during onboarding**, so every one of a dozen empty screens is one click away from a flow that is trying to guide you. The guide and the freedom undercut each other. **Tried twice and reverted; the cost outran the finding.** Hiding the whole rail broke 33 e2e specs, and the sweep that found them is itself the argument against it: leaving a blank world by the rail is the normal path, so removing navigation makes the guide modal in all but name. Hiding only the extended tier — which is exactly the dozen empty screens — needed no spec changes but introduced a visible flicker: the dashboard renders the full rail, the wizard latches a beat later, and ten icons vanish. Playwright caught it as *element was detached from the DOM*, which is a real defect, not a test artefact. Removing the flicker means the rail must know whether onboarding applies before it first paints, and the only sources of that are a loading-state signal (which flickers for every other world instead) or duplicating the wizard's dismissal state into global chrome. Neither is worth it for a tidiness finding. **Left open with the ground mapped**: whoever takes it next should either make the wizard visually own the screen without touching the rail, or move the latch decision somewhere the rail can read it before its first paint. | **Fixed, third time, by changing the answer rather than the implementation.** The design question was which should win on a new world's first screen — the guide, or the freedom to wander — and the answer taken was *the guide wins visually, not structurally*. The wizard now sits centred on a card and reads as the subject of the screen; the rail dims to 0.55 and stays entirely clickable. Nothing leaves the DOM, so the 33 specs stand and the flicker cannot happen: an opacity ease a beat after paint reads as intentional, where ten icons vanishing did not. Hover and `:focus-within` restore it in full, so it never looks disabled to whoever is reaching for it. The signal is a `pw-guiding` class on the document root, added and removed by the wizard's own effect — deliberately not store state, which is the coupling the earlier attempt was rejected for. Two things worth recording: the first hook was a bare `data-nav-rail`, which collides with AppShell's width carrier and would have dimmed the entire application; and the spec asserts the rail still *works* during the guide, not only that it dims, so a future attempt to hide it fails on the half that matters.
| NEW-2 | med | **fixed** | **The step indicator is four bare numbers.** You cannot see what you are committing to, how long it is, or what step 3 will ask. | **The names already existed** — inside each dot's `aria-label`, so a screen reader was told what step 3 would ask and a sighted reader was not. They are drawn now, which answers all three of the finding's questions at once. Below `sm` only the current step keeps its name, since four labels in a row do not fit a phone; the numbers and the tick still carry position there. |
| NEW-3 | med | **fixed** | **"Begin" is the label on step 1 of 4** — it reads as "start the wizard", but the wizard has already started; it means "next". | **It does not mean "next" either** — the step has one field, *Timeline name*, and the button makes that timeline. It reads **Create and continue** — it makes the timeline and moves the guide on, and says both; "Next" would have been just as vague in the other direction. **Not "Create timeline"**, which was the first attempt: the Timeline screen's own empty state already carries a *Create Timeline* button, and re-using the name made the two indistinguishable to any lookup that is not screen-scoped. Two specs began failing intermittently, clicking the guide's button while a navigation was still settling — a collision caused by the *app* rather than by a test, and the reverse of the four locator collisions earlier in this review. |
| NEW-4 | med | **already fixed, measured** | **Content occupies the top-left third**; the remaining two-thirds is watermark (see X-1, X-2). At this moment — the very first screen of a new world — the impression is emptiness rather than invitation. | **Both halves were resolved by other work before this was reached.** The watermark went with **X-1**; the card was centred for **NEW-1**, which needed it out of the rail's way. Measured at 1440×900: a **576×366** card at **left=458, top=291** — centred horizontally to within a pixel, starting a third of the way down. `e2e/onboardingSteps.spec.ts` holds those numbers, and the case goes red when the card is pinned back to the top-left, so the finding cannot quietly return. |
| NEW-5 | low | **fixed** | **No way back.** There is a forward action and "Skip and explore on my own", but no step-back once you are past step 1. | **Back is navigation, not undo, and that distinction is the whole fix.** Every step of the guide writes a record when it completes — a timeline, a chapter and a scene at step 1, a character at step 2 — so a naive Back would hand you a blank form that builds a *second* opening scene. Steps 1 and 2 show what they already made, with a **Continue**, rather than the form; step 3 writes a snapshot, which is idempotent, so it keeps its form. From the last step, Back skips step 3 when there is nobody to place — that is the state *Skip for now* on step 2 jumps over, and landing on "place a character" with no character would be a worse dead end than the one being fixed. Named **Back a step** rather than *Back*, because the chapter detail screen already has a button called Back and `getByRole` matches names case-insensitively and by substring. The test walks forward, back, and forward again, then counts the world: one timeline, one chapter, one event, one character. |

**Credit:** the copy is genuinely good — *"Your story begins with a moment"*,
and placeholders like *"The Age of Embers, The Long Road, Act One…"* teach by
example rather than instruction.

---

## 4. The expanded event card

The densest form in the app, and the one a writer meets most often.

| ID | Severity | Status | Finding |
|---|---|---|---|
| EV-1 | high | **fixed** | **Roughly a dozen sections, flat and all expanded at once** — description, scene draft, tags, characters, mentions, elapsed time, flashback, story beat, and more below the fold. A scene that has just been created and needs only a title and some prose presents its full ontology immediately. **Fixed** by showing what the scene holds: a section with content renders, and the rest collapse into one row of chips named exactly as the sections they open. The data decides rather than a ranking someone had to invent, nothing is hidden behind a menu or a mode, and choosing *Edit* opens everything. A section's own precondition is unchanged — a world with no maps offers no Location chip. |
| EV-2 | high | **fixed** | **The Character States panel is a large empty column** with no empty state at all — no heading explanation, no "assign characters to see them here". It is simply blank. | **Fixed** with CD-1: a chapter that has scenes but nobody in them now says *"No one in this chapter yet"* and what to do about it, instead of rendering a blank column.
| EV-3 | med | **fixed** | **The most important field is third.** Scene Draft sits below Description, and Description renders as italic "No description." — which reads as a read-only note rather than something you can click and type into. | **Both halves, and the second was literally true:** the description *was* read-only, editable only through the card's Edit button somewhere else entirely, while the prose directly below it took typing in place. The scene draft leads the card now — it is what the app is for — and the description follows as the summary it is. Its read view is the control that opens the editor, so the thing you want to change is the thing you click, and the empty state says so rather than describing itself. |
| EV-4 | med | **already fixed, measured** | **Characters has no visible add control** in the expanded card; just the sentence "No characters assigned." | **Both halves went with other work before this was reached.** The sentence was removed under **X-4** rule 3 — it announced an absence beside the control that fills it — and the section is offered as a named **+ Characters** chip under **EV-1**, which opens the *+ Add character…* picker. Measured on an expanded card: the sentence appears **0** times and the chip is present. `e2e/eventCardOrder.spec.ts` holds both, and follows the chip through to the picker so it is the add control rather than a label that looks like one. |
| EV-5 | med | **fixed** | **Delete sits in the header beside the status pill and the reorder arrows**, giving a destructive action the same weight and neighbourhood as routine ones. | **Fixed** by the same menu as **TL-3**. The routine controls — move earlier, move later, expand — stay exactly where they were; only delete moves, since it was the one that did not belong in that row. |
| EV-6 | low | **fixed** | **Focus mode is a very small text affordance** ("Focus  0 words") for one of the nicer features in the product. | **The row was three things at 10px and only one of them was pressable.** *Focus*, *History (n)* and the word count were drawn identically in muted 10px text, so the one action read as the third readout. Focus is a bordered button now, and it moved to the end of the row so the two readouts stay together. The test measures the difference rather than asserting a class — the button's font size against the word count's, in the same test, so it fails both if Focus shrinks back and if everything grows. |
| EV-7 | low | **fixed** | **The chapter bar looks broken with one chapter.** A truncated "1 · T…" segment and a clipped "+" read as a rendering fault rather than an empty track. | **Reproduced, and it is worse than it reads.** A one-chapter world drew a **48px** segment in a **1388px** bar: the title cut to *1 · L…* after two characters, and 1300px of nothing beside it. The "clipped +" is the rail crossing its single centred tick — at 48px wide the horizontal rail and the vertical tick are the same length, so they read as a plus sign rather than as a track with a moment on it. **The cause is a fixed width.** Each segment was `max(3rem, scenes × 2rem)` and `flex-shrink: 0`, so the track was as wide as its content and never as wide as the bar. Segments grow into whatever the chapters do not fill, in proportion to how many scenes each holds, keeping the existing weighting; the old width becomes the flex basis and the minimum, so a book with more chapters than fit behaves exactly as before. `e2e/cursorBar.spec.ts` measures both on one screen — one chapter takes over 90% of the track with an unclipped title, then forty more are seeded and the track goes back to overflowing with each segment at its floor. Restoring the fixed width turns it red. |

**If rebuilt:** title and prose first, everything else progressively disclosed —
a quiet row of "add location / cast / thread / beat" chips that expand on
demand. The full ontology stays available and stops being the default view.

---

## 5. Doing things — findings from driving a real session

These came from operating the app rather than looking at it: creating a world
through the guide, adding a cast, uploading images, and reaching for the
everyday tools. Each was then **re-verified in isolation**, because the first
run's failures turned out to be mostly bad selectors in the harness rather than
faults in the product. Only what survived that second check is listed.

| ID | Severity | Status | Finding |
|---|---|---|---|
| OP-1 | high | **done** | **One Escape closes two layers.** Open a dialog (Add Character), press Ctrl+K, and the search palette opens *on top of it*. A single Escape then dismisses **both** — verified: palette `false`, dialog `false` after one press. A user who searches for a name mid-form and presses Escape to get back loses the half-filled dialog and its input. Escape should dismiss the topmost layer only. |
| OP-2 | med | **both halves measured false; guarded instead** | **An open palette traps you.** With the palette up, the nav rail is unreachable: the link resolves but the click is intercepted by the overlay, so the only way out is Escape. That is defensible for a modal on its own, but combined with OP-1 it means overlay layering is not being managed deliberately — the palette will happily stack on anything, and Escape does not respect the stack. | **Neither half reproduces.** *Escape is not the only way out*: the overlay's own `onClick` closes the palette, so a backdrop click leaves it, and it closes itself on navigation — an effect added under **OP-1**, which is the finding this one was filed as a symptom of. *Escape does respect the stack*: `Dialog` keeps an explicit `openDialogs` list so only the innermost reacts (added when a confirm over Scene history was closing the history behind it), and the palette stops the event so nothing below it hears the press. **Measured on a real stack** — the Brief open, the palette opened over it with Ctrl+K — one Escape closes the palette and leaves the Brief; the second closes the Brief. Worth noting *which* stacks are reachable at all: the Brief traps focus and covers the chapter bar, so a `Dialog` cannot be opened over it, and a Dialog's backdrop covers the top bar, so the Brief cannot be opened over one. The palette is the exception because Ctrl+K is a document-level shortcut. **None of this was tested**, which is how it would quietly stop being true, so the outcome of this finding is `e2e/overlayStack.spec.ts` rather than a change: backdrop-closes paired against a click *inside* not closing it, and the two-layer unwind. Reverting the palette's `stopPropagation`, or its backdrop handler, turns it red. |
| OP-3 | med | **fixed** | **The first-run guide creates more than it says.** Step 1 asks only for a timeline name, under the heading *"Your story begins with a moment"*. Verified by reading IndexedDB straight after: naming a timeline and a character leaves **1 chapter, 1 event, and 1 character** in the world. The chapter and the event were never named, shown, or mentioned — the user then meets a "Ch. 1" and an untitled scene they did not knowingly make. Either say so, or let them name the scene, which is what the heading already promises. | **Both, because they were the same fix.** The step asks for the first scene as well as the timeline, and states what it will build from the two: the timeline, a *Chapter 1* inside it, and that scene inside the chapter, all three renameable later. **One detail the finding got wrong, and it was the sharper half:** the scene was not untitled — it silently took the *timeline's* name, so a writer who typed *The Age of Embers* met an opening moment called *The Age of Embers*. That is worse than untitled, because it looks deliberate. Validation is now per field, so an empty scene marks the scene input rather than the timeline one. |
| OP-4 | low | **fixed** | **Two buttons whose names both begin with "Add", adjacent.** On the character step, *"Add a description (optional)"* (a disclosure) sits directly above the primary *"Add them to the story"*. Clicking the wrong one silently expands a field instead of submitting, with no feedback that nothing happened. It cost this review a whole run. | **Fixed by naming the disclosure for what it reveals rather than for an action** — *Description (optional)*. A disclosure is not a verb, and the moment it stopped being one the collision went with it: there is now exactly one button on the step whose name begins with *Add*, and it is the one that submits. |

| OP-5 | high | **fixed** | **Finishing the first-run guide leaves no time cursor set.** The pill reads *"All chapters"* the moment the guide ends — verified twice, and visible in the capture. Step 3 of that same guide is headed *"Where does their story begin?"* and places the character at Ch. 1, so the guide selects a moment on the user's behalf and then hands them an app that has forgotten it. Everything cursor-dependent is consequently switched off for a brand-new user who has done everything they were asked. **Fixed.** Step 1 creates the moment, so it now sets the cursor to it — the later steps place a character at that same moment, which makes them agree rather than the guide choosing a moment and the app forgetting it. |
| OP-9 | high | **done** | **The search palette outlived the screen it was opened on.** Choosing a result closed it, but arriving anywhere by any other route did not — so a modal sat over an unrelated screen, swallowing every click until Escape. It derailed three separate runs of this review before being recognised as a fault rather than a fluke, which is about as strong a usability signal as a review can produce. Now closed on route change. |
| OP-8 | med | **done** | **Opening search took focus on a 50ms timer.** Whatever had focus kept it until the timer fired, so a keystroke in that window went to the screen behind the palette — open search from a half-filled form, type straight away, and the first characters landed in the form. Found while testing OP-1, not from the screen sweep. Now focused synchronously: the palette renders nothing until it is open, so by the time the effect runs the input is mounted and there is nothing to wait for. **Shipped without a regression test** — see below. |
| OP-6 | med | **fixed** | **A disabled primary button with no reason given.** *Add Location* is greyed until Name is filled, with no required marker, no helper text, and no message on hover. Nothing says which field is blocking it. Generalised as **X-9** once *Save route* turned out to do the same thing. | **Fixed** by **X-9**'s pattern: Name is marked *(required)* and the footer reads *"Needs a name."* until it is filled, then says nothing.
| OP-7 | low | corrected | **Map placement is gated on the time cursor — and the app says so.** `MapSidebar.tsx` renders the crosshair only inside `{activeEventId && …}`, so with no cursor there is no placement control and no drag. This was first written up as a silent lockout; that was wrong. The sidebar prints *"Select an event from the timeline bar below to place characters onto the map."* The gate is deliberate and explained, so what is left is minor: the 60%-opacity card is a weak signal next to a clear sentence, and the sentence points at the bar rather than offering a way to act. |

**Note on method.** The first attempt at this journey produced fourteen failing
steps that looked like a damning list and were not: a stray palette opened
early, swallowed every click, and everything downstream failed for that one
reason. The rewritten harness makes every step assert **its own effect** rather
than merely not throwing — the earlier version happily reported `OK` for a
click that expanded a disclosure instead of submitting a form. On the second
run **21 of 22 steps passed**, with zero page or console errors.

**OP-7 was overstated and has been corrected.** It was first filed as a silent
lockout, on a reading of the source alone. Checking the running app turned up
an explanatory sentence in the sidebar that the code read had missed, so the
finding drops from *med* to *low* and changes character entirely. It is left in
the table rather than deleted, because the correction is the useful part.

The consequence for **OP-5** sharpens, though: a new user who finishes the guide
lands with no cursor, and the message that tells them what to do points at the
chapter bar — which in a one-chapter world is the clipped, truncated strip filed
as **EV-7**, too small to hit reliably even from a script. The instruction is
correct and the target is poor.

**Still to drive:** the relationship editor, export/import round-trip, chapter
diff, the corkboard and structure boards with real content, and the whole of
this at phone width.

---

## 6. Timeline

Driven on *The Fellowship of the Ring* (22 chapters, 91 scenes).

| ID | Severity | Status | Finding |
|---|---|---|---|
| TL-1 | med | **fixed** | **The pacing curve cannot be read, only glanced at.** No y-axis, no scale, no legend. Dots sit at varying heights in green, yellow and blue with nothing saying what high means, what the colours encode, or which chapter a peak belongs to. The shape is suggestive; the chart is unreadable as data. **Narrower than filed, again.** The chart already drew gridlines at levels 1–5 and already said *"point size = scene length"*, and colour is a redundant encoding of the same value as height, which is fine. Two things were genuinely missing: nothing named the **scale**, so a height meant nothing, and 58 events ran in a row with no way to tell which **chapter** a spike belonged to — the question you bring to a pacing chart. **Fixed:** the five levels are labelled (Calm → Climactic) in a gutter drawn outside the scrolling plot so it stays put while you pan, and each chapter start gets a faint numbered rule. Downgraded high → med, since "unreadable as data" overstated what was absent. |
| TL-2 | med | **fixed** | **`Set Active` on all 22 chapter rows.** A text button repeated down the page whose meaning — *move the time cursor here* — is not in its label, competing for attention with the open-detail and delete icons beside it. | **Fixed as copy.** *Set Active* names a state; the row now says where pressing it takes you — **View from here**, flipping to **Viewing** once the cursor is inside the chapter — with the full sentence on hover. *Moment* is the app's own word for where the cursor sits (*Previous moment*, *Next moment*, *pick a moment*), so the title text uses it rather than inventing a third vocabulary. The competition half of the finding is answered by **TL-3**: one of the two icons it competed with is gone from the row. |
| TL-3 | med | **fixed** | **A bare trash icon on every chapter row**, immediately beside open-detail. Twenty-two chances to misclick the most destructive action on the screen, with nothing in the affordance suggesting weight. | **Fixed with a menu, not a hover.** The review's own suggestion was to copy **LORE-1**; that turned out to be a defect rather than a pattern (see its corrected entry), so the answer is `src/components/ui/menu.tsx`: one named, always-visible trigger with the destructive item one deliberate step inside it, separated by a rule and drawn in red. That works identically on a phone and from the keyboard — ArrowDown opens onto the first item, Escape closes and hands focus back — and it costs a click exactly where a click should be costly. Applied to the four sites that had the same shape: the chapter row, the scene card (**EV-5**), the character header (**CH-4**) and the lore card (**LORE-1**). **The map toolbar's own overflow menu is deliberately left alone** — it is a floating cluster over a canvas with its own layout rules, and it groups set-up commands rather than guarding a destructive one. |
| TL-4 | med | **fixed** | **Chapter rows carry a truncated summary and nothing else.** No scene count, no word count, no status roll-up. The row repeats prose you already wrote instead of telling you the state of the chapter. | **All three, from one roll-up** (`src/lib/chapterProgress.ts`), shared with the corkboard columns (**CB-4**). The counts read *3 scenes · 1,240 words*, dropping the word clause on a chapter that is outlined but not yet written — *0 words* there is noise, since the outlining is the work that has been done. The status pill takes the **least-advanced** scene rather than an average: a chapter of four Final scenes and one Idea is not four-fifths finished, it is unfinished, and the tooltip separates *Every scene is Final* from *Least advanced of 5 scenes: Idea* so one word on a pill cannot be read two ways. An unrecognised status — a `.pwk` can carry any string — ranks below every known one, because the one thing we cannot claim about a status we do not know is that it is finished. **Reading mode keeps the counts and drops the pill:** the size of a chapter is the shape of the book, which a contents page carries; how finished it is belongs to whoever is writing it. The words are resolved once for the whole world in `TimelineView` rather than per row, which is twenty-odd rows' worth of the same table read. |
| TL-5 | low | **fixed** | **Thread pills wrap unbounded.** Nine threads already take two rows and ~80px above the content; the strip grows with every thread added. | **Bounded at six** (`src/lib/threadStrip.ts`), with the rest folded behind *+N more*. Nine threads and ninety now cost the same vertical space, which is the half that mattered — the screen was getting worse the more of it you used. One exception, deliberate: the **selected** thread stays on screen even when it sits in the folded tail, because a strip that filtered by something it did not show would be worse than a long one. That makes the row at most one pill longer than the limit, which is still bounded. |
| TL-6 | low | **fixed** | **The beat marker on the curve reads "Incite"** — a truncation of *Inciting Incident* that is not a word in this sense. | **Fixed, and two more of the same** found by reading the other two templates: *Resolve* for **Resolution** was the same substitution of a verb for a noun, and *Cat* for **Catalyst** was three letters that read as the name of the sheet it belongs to (Save the Cat). All three now say the beat. The old test capped `short` at eight characters, which described the three-act sheet while its neighbours already shipped *Dark Night* at ten through the same `<text>`; the bound now covers every template and reflects what actually renders. |

## 7. Corkboard

The strongest screen reviewed so far: dense, scannable, and the drag affordance is clear.

| ID | Severity | Status | Finding |
|---|---|---|---|
| A11Y-1 | med | **fixed** | **Thirteen unnamed buttons out of twenty on chapter detail.** Every scene card carries the same row of icons — move earlier, move later, expand, delete — and none had an accessible name, so a screen reader announced "button, button, button, button" once per scene. Found while verifying CB-1, not filed in the original pass. Naming them was not enough on its own: four buttons all called *Move earlier* are no more use than four with no name, so each says which scene it acts on. |
| CB-1 | med | **withdrawn** | **The status pill is not a button.** The guide says to change a scene's status "right on the card with the status pill", but there is no control with that accessible name — a click driven at it finds nothing. It reads as a static badge, and is one to keyboard and screen-reader users. **It does not hold.** The pill is a `<select>` with `aria-label="Scene status"` overlaid on it at `opacity: 0` — a standard pattern. Driven: three selects found, `selectOption('final')` succeeds, the value reads back, the card re-renders as *Final*, and `el.focus()` lands. The original probe looked for `role=button` and a button with an accessible name, and a select is neither — the same class of measurement error as the five harness failures recorded in §10. Pinned by a test in `e2e/buttonNamesChapter.spec.ts` so it cannot be re-raised from the same measurement. |
| CB-2 | med | **fixed** | **No sense of how much board there is.** Five of twenty-two chapter columns are visible, with no scrollbar, count, or overview to say seventeen more exist off-screen. | **Measured, and the scrollbar half was worse than filed.** On the bundled Philosopher's Stone at 1280px the board showed **1,228px of 4,624** — five of seventeen columns — and the scroll container's `offsetHeight - clientHeight` was **0**: the platform draws an overlay scrollbar, so the one affordance that would have said *there is more* appeared only to someone who had already found out. The first fix was CSS — `::-webkit-scrollbar { height: 10px }` — and it changed nothing; a direct probe showed that in this Chromium **no** scrollbar reclaims layout space, styled, `scrollbar-width: thin`, or plain. So it was reverted rather than shipped as a claim that could not be measured. **What shipped instead is the app's own:** the header states the size (*17 chapters · 74 scenes*, from the same roll-up as **CB-4**), and a chevron sits at each edge of the board, each appearing only when there is board in that direction. They are present before the first gesture, reachable from the keyboard, and each press moves about a screenful. |
| CB-3 | low | **fixed** | **Cards carry no length signal.** The corkboard is where scene length should be comparable at a glance; there is no word count on the card. | **Fixed**, beside the POV name in the card's footer. A scene with no prose yet shows nothing rather than *0 words*, so the signal reads as length where there is length and stays quiet where there is only an outline. The POV name gained `min-w-0` so it yields space to the number instead of pushing it out of a 256px column. |
| CB-4 | low | **fixed** | **Column headers omit their scene count** — "Chapter 1 · A Long-expected Party", but not how many scenes are in it. | **Fixed with the same roll-up as TL-4**, so the header totals both the scenes and their words — the one thing a column of cards cannot show once it scrolls. An empty column is left to the *No scenes yet* line below it, which is also its drop target; saying it twice would have been the header's only contribution there. |

## 8. Manuscript

| ID | Severity | Status | Finding |
|---|---|---|---|
| MS-1 | high | **withdrawn** | **Find & replace and Export are live on an empty manuscript.** With *0 of 91 scenes written · 0 words*, both remain enabled. Export would compile an empty book; find has nothing to search. | **Withdrawn — does not reproduce.** Measured on a world reading *0 of 2 scenes written · 0 words*: both controls carry `disabled`, `pointer-events: none` and `opacity: 0.5`. The gating (`disabled={!hasProse}`) predates the review by a month. The page also says why, in its own empty state — *"No prose yet — write scene prose on your events, and it stitches together here"* — which is more than **X-9**'s other two instances offer, so nothing folds into that finding either.
| MS-2 | med | **fixed** | **A bare `0` badge beside the title.** Zero what — words, scenes, chapters? The subtitle answers it a line below, which is where the badge should have got its label. | **Fixed by dropping it.** `PageHeader`'s count pill reads as *"N &lt;title&gt;"*, which is why it works on the rosters — *Characters 45* needs no label because the title names what is counted. *Manuscript 0* names nothing, and the subtitle one line below was already giving the same number with its unit attached. The pill is right everywhere else and was wrong here; the fix is not to label it but to stop using it on a title that is not a plural noun. |
| MS-3 | med | **fixed** | **`Goal —`** puts an em-dash in a control that looks like an input, the same "reads as broken" pattern as the Continuity tile (**DASH-1**). | **It *is* an input** — a `type="number"` with `placeholder="—"`, so the dash was the empty-value hint rather than a rendered value, which is worse than the finding assumed: it looks like a number that failed to load. Both goal fields — the book's and the per-chapter one — now read *none*, and both gained an `aria-label`, since *Goal* was the only thing naming them and there are two on the same screen. |
| MS-4 | med | **withdrawn — the reader never reaches this screen** | **The empty state gives a downloaded book the wrong instruction.** It says *"Write scene prose on your events"* — but library worlds ship deliberately without prose, and nobody is going to type Tolkien's. On a reading-mode world this screen should explain why it is empty, not hand out a task. | **Manuscript is `writingOnly`,** so the router redirects a reading-mode world to its dashboard rather than serving the screen — and a Library world arrives in reading mode. The only person who sees that sentence is one who has turned reading mode off, and for them it is correct advice: they can write the prose it asks for. A first draft of this fix added the second sentence anyway; it would have been unreachable code, which is what the Items section in `EventCard` turned out to be under **X-4**. The withdrawal is guarded by a test that asserts the redirect, so it fails the moment the guard stops holding. |

**Credit:** the chapter bar on this screen — named chapters with per-chapter progress ticks — is the best version of that bar anywhere in the app.

## 9. Structure board

| ID | Severity | Status | Finding |
|---|---|---|---|
| ST-1 | high | **fixed** | **The board shows sequence but not proportion.** A beat sheet exists to reveal whether Act 2 sags, and this is a flat list of equal-height rows. Nothing conveys that Climax and Resolution both landed in Ch. 22 out of 22, or that Act 1 covers two chapters while Act 2 covers twelve. The one question the screen is for is the one it does not answer. **Held up under measurement.** **Fixed** with two additions, both computed in `buildBeatSheet`. A band above the list divides the book's chapters between the acts at widths proportional to their share, with the conventional 25 / 50 / 25 drawn as dashes to compare against; an act starts at the chapter of the first beat placed in it, so the division is read off the writer's own tagging rather than assumed, and the band holds off entirely until Act 2 and Act 3 each have a beat. Each row then carries a dot on a track at the beat's position along the book, measured by chapter rank so beats sharing a chapter coincide — which is what makes a climax and a resolution both crammed into Ch. 22 visible as two dots at the same place. |
| ST-2 | med | **fixed** | **Rows are ~1400px wide with content at both ends** and nothing between (see **X-2**). | **The middle was not empty by accident.** The beat's name and hint took `flex-1` and swallowed the slack, while the **position track** — the one element on the row that reads better the wider it is, and which the code's own comment calls a profile of where beats fall along the book — was pinned at **112px**. So the fix is not to put something in the middle but to give the middle to the thing that wanted it: the track flexes now, and at 1600px it settles at **406px** where it used to be 112. **A refinement tried and dropped, since it changed nothing:** capping the label column so the track could take more than half. Measured, both columns settle at 406px at that width — under any cap worth setting — so the class would have been decoration. The test asserts the track spans the row's centre and shrinks with the window, rather than a number that only holds at one viewport. |
| ST-3 | low | **fixed, and counted** | **The template switcher is a native select** styled unlike the app's own Select components used elsewhere. | **The premise holds, measured: 66 uses of the app's `Select` across 19 files against 14 native `<select>`s across 10.** Both of the Structure board's pickers are converted, not only the switcher the finding names — leaving one of two on the same screen would have traded a product-wide inconsistency for one visible at a glance. **The other native selects are deliberately left**, and listed here so the next pass has them rather than re-deriving them: `InWorldDatePicker`, `TimelineScopeSelect`, Corkboard, the relationship graph's focus picker, World settings' theme and timeline pickers, Manuscript, `MapSidebar`, `LocationDetailPanel` and `ChapterDiffModal`. Converting those is a sweep across drag, diff and map screens and would rewrite ten `selectOption` calls; it is worth its own finding rather than being smuggled in under this one. |

## 10. What actually happens when you use them

The findings above were written from looking at the writing screens. Going back
and *operating* them — writing prose into scenes, dragging a card between
chapters, replacing a term across the manuscript, exporting a file — changed
the picture, mostly in the product's favour.

**Confirmed working, each with a real check:**

| Operation | Result |
|---|---|
| Prose written on a scene appears in the Manuscript | Verified by asserting the sentence itself appears |
| Find & replace across every scene | Opens, counts matches, replaces across scenes |
| Dragging a scene into another chapter on the corkboard | Verified end to end: *The Birthday Party* moved from Ch.1 to Ch.2 **and the move persisted to IndexedDB**, not just the DOM |
| The export dialog | Format tabs, two options, and a **live word and scene count before you commit** — one of the better-designed dialogs in the app |

That last one matters for how the earlier notes should be read: the corkboard
was called the strongest screen in section 7 *without its main verb having been
tried*. It survives the test.

| ID | Severity | Status | Finding |
|---|---|---|---|
| MS-5 | low | **fixed, and it was not one slip** | **"1 scenes"** in the export dialog's count. Unpluralised. | **The dialog said "1 words" too, and so did two dozen other places.** The shape — a raw number, a space, a hard-coded plural — was written out at every call site that counts something, and each one is wrong exactly when the count is one, which is the most common count on a new world. `src/lib/plural.ts` is one function with unit tests; it is applied where a count stands alone and a one is reachable, and deliberately **not** to ratio forms like *0 of 1 scenes* or *3/8 scenes*, where the plural belongs to the whole. Sites whose count cannot be one — the Library cards, the beat sheets — were left alone rather than given a branch that no state reaches. The number is grouped while passing: `6223` reads as an identifier and `6,223` reads as a quantity. `e2e/countsAndDates.spec.ts` drives the dialog the finding names on a world of one scene and one word; the mutation that always pluralises turns three unit cases and the e2e red. |

**OP-8 has no regression test, deliberately.** Three approaches were tried and
each was rejected: typing immediately after the shortcut is a race against a
50ms window and would be flaky; a frozen `page.clock` turned out **not** to
discriminate at all — the test passed with the timer restored, which makes it
worse than no test; and asserting on the absence of a `setTimeout` tests the
implementation rather than the behaviour. The fix is a small, obviously-correct
simplification and the existing focus assertion in the OP-1 test still covers
"focus lands at all", but nothing guards the *timing*. Recorded rather than
papered over.

**Still unproven, either way:** assigning a beat on the Structure board, the
scene reorder arrows in chapter detail, and whether **CB-1** (the status pill
not being a control) holds up — the pill has no accessible name, which is why
a driven click cannot find it, but that has not been separated from "it is a
button with a different label".

**Method note.** Five of the fourteen operations in this run failed on the
harness, not the app: a card selector that matched a status pill, mouse events
where HTML5 drag needed `dragTo`, and an export click that hit the format tab
rather than the download button. Each was chased down before anything was
written here, because the first instinct — that a failed step is a product
fault — was wrong every single time in this run.

---

## 11. Across the writing screens

| ID | Severity | Status | Finding |
|---|---|---|---|
| W-1 | med | **fixed, and the finding understated it** | **The chapter bar is present on Timeline and Manuscript but absent on Corkboard and Structure**, while the top-bar cursor pill still shows a chapter on all four. The global cursor's main control disappears on two of the screens that are most about story order. | **Counting which screens actually read `activeEventId` inverted the case.** The two named read it **zero** times — Structure only *sets* it, by opening a scene. Meanwhile the **Arc grid (8 uses)**, the **Lore roster (4)** and the **Calendar (2)** all answer to the cursor *and* all hid its control, which is strictly worse than what was filed: those screens change under a cursor the reader cannot reach. **Fixed by a rule rather than a list** — the bar shows where the cursor means something. Arc, Lore and Calendar gain it outright. Corkboard and Structure were given something for it to mean: each now marks the scene the cursor is on (`aria-current`), because a control that moved nothing would have been worse than its absence. **Still hidden, on the evidence:** the dashboard and settings, neither of which has a moment in it, and the lore *page editor*, which is a full-height writing surface like Focus mode. **Factions is left alone deliberately** — it does not read the cursor and was not filed, and taking it on either count would be guessing. |
| W-2 | med | **withdrawn on measurement** | **Every screen opens with a title and a line of instruction** — *"Drag scene cards to reorder them…"*, *"The classic seven-beat, three-act spine."* — costing ~110px of vertical space permanently for a sentence read once (see **X-5**). | **Measured at 16px, not ~110px, and not every screen.** The instruction line is a single 16px row on seven screens; **Timeline, Relationships and the Arc grid carry none at all**. The ~110px is the whole header — title, padding and the primary action — which is not instruction and is not what the finding objects to. Two of the sentences counted are not instruction either: the Manuscript's is a live statistic (*N of M scenes written · X words*), and Structure's per-beat hints are the beat sheet's content. What is left is 16px on a ~800px screen for a sentence that tells a newcomer what the section is, which is not worth a mechanism to remove. |

---

## 12. The world-element screens

Characters, Items, Lore, Factions and Knowledge share a shape — a counted
roster leading to a detail view — so they are best read against each other.
Driven on *The Fellowship of the Ring*; all eight character tabs render, roster
filtering works, and Lore, Factions and Knowledge all open.

### Character detail

| ID | Severity | Status | Finding |
|---|---|---|---|
| CH-1 | med | **fixed, finding half-corrected** | **The Overview tab hides most of the character.** It shows the name and biography only. Aliases, map/Arc colour and birth date live behind **Edit**, so you cannot tell whether a character even *has* aliases without entering edit mode. A read view that omits the data is not a read view. | **Measured, two of the three named fields were already there.** Aliases rendered as *"Also known as…"* and the colour was the dot beside the name — the reviewer was almost certainly looking at a character that had neither set, which is the finding's own complaint about not being able to tell. **The third was real, and worse than filed:** the birth date was gated on `calendar &&`, so a world with no calendar dropped a *stored* value and said nothing at all about it. A read view may omit a field that is unset; it may not omit one that is set. **Fixed:** the date is shown either way — formatted where a calendar can name the month, raw where none exists (and `month` is 0-based in storage, which no reader should have to know, so it is printed 1-based). The colour is a labelled row now rather than a bare dot that says nothing about what the colour is *for*. **Aliases moved the other way:** they are identity, they were already in the page header, and repeating them below is **CH-2**'s mistake one field over — so the header owns name and aliases and reads *"Also known as Strider, Elessar"*, and the tab owns everything else. **No `Born: —` rows for unset fields** — that is X-4's rule 3 and **X-14**'s ambiguous em-dash, and a row per unset field on every character would cost far more than it tells. |
| CH-2 | med | **fixed** | **The name is printed twice** — in the header beside the portrait, and again as a heading directly under the tabs. | **Measured at two occurrences, now one.** The header is the identity block — portrait, name, aliases — and nothing below repeats it. Worth recording that the first draft of the **CH-1** fix reintroduced this one field over, by giving the Overview an *Also known as* row while the header already had one; the test caught it as a strict-mode violation. |
| CH-3 | med | **fixed** | **Tabs carry no counts.** Eight tabs, and a character with no goals, no lore and no factions looks identical to one with three of each. Every sibling screen in this group counts things — the rosters, the map sidebar sections — except the one place it would save the most clicking. | **Fixed for the six tabs that hold a list** — History, Appearances, Goals, Relationships, Lore, Factions. Overview and Current State each show a single record, and *Overview 1* would be noise. **The zero is drawn rather than omitted:** "none" is the answer the finding is asking for, and an absent number would only move the ambiguity somewhere else. Each count comes from the same hook the tab itself reads, so the number and the list behind it cannot disagree — which is the failure mode a separately-derived count invites. |
| CH-4 | med | **fixed** | **Delete stands alone in the header** as the only icon, top right, with nothing implying weight. Compare Lore, which reveals its delete on hover (see LORE-1). | **Fixed** by the same menu as **TL-3** — and *not* by the comparison the finding draws, which measured badly. Reading mode still hides the control entirely, as it did before: a reader has nothing to delete. |
| CH-5 | low | **fixed** | **The portrait's upload and link controls are two ~10px icons** crowded onto the bottom edge of a 48px avatar. | **Measured: 12×12px each, two pixels apart.** Enlarging them where they stood was not available — `.pw-tap`, the app's own answer to small controls, overlays a 44px hit area and its comment says *only apply to well-spaced, standalone controls so hit areas never overlap*, which two adjacent icons are not. So the pair is the fault rather than their size: one **Menu** trigger, the same component the review settled on for TL-3, EV-5, CH-4 and LORE-1, with *Upload an image* and *Link by URL* one step inside. `LinkImageButton` gained an optional controlled-open mode for it, since a `role="menuitem"` button cannot also be that component's own trigger. **Three existing specs named the controls that went**, and one of them — reading mode's *the upload button is absent* — would have started passing **vacuously**, on a page still offering the whole menu. All three now drive the menu. |

### Items

| ID | Severity | Status | Finding |
|---|---|---|---|
| IT-1 | high | **fixed** | **The cards are not controls** — see **X-7**, of which this is the clearest instance. |
| IT-2 | med | **fixed** | **The roster shows nothing about where anything is.** Items have per-event placement and condition, and the list shows type and description only, so with a cursor set you still cannot see what is where. The map sidebar manages a condition dot per item; the screen devoted to items does not. | **Both, from the sidebar's own logic rather than a second copy of it.** `resolveItemWhereabouts` came out of `MapSidebar`'s private `getItemLocation`, and the sidebar now calls it too: an explicit placement wins over a stale inventory, and where the sidebar showed only the room, the roster also names the carrier — *carried by Kestrel · Weathertop* — since who has it usually says more. The condition dot came with the palette, which was also private to the sidebar. **A bulk resolver was needed**, not a per-card one: `useBestItemSnapshots` is the item twin of the character and relationship hooks, because a roster of dozens of cards each opening its own live query is the shape this screen would otherwise grow into. With no cursor there is no moment to answer about, so the line is absent rather than guessed. |

**Credit:** thumbnails, name, category and description make this the most scannable roster in the app.

### Lore

| ID | Severity | Status | Finding |
|---|---|---|---|
| LORE-1 | med | **corrected — this was not good, and was the pattern being recommended** | **Delete appears on hover**, not permanently. This was filed as the pattern **TL-3** and **CH-4** should adopt rather than a trash icon sitting on every row forever. **Measured, it is worse than what it would have replaced.** At rest the button is `opacity: 0` with `pointer-events` still live, and it hit-tests to itself — so on a touch device, where there is no hover and the resting state is the *only* state, a tap on apparently blank card deletes the page. It was 14×14px, well under any touch-target guidance, and carried **no accessible name at all** — no `aria-label`, no `title`, no text, the same defect as **X-12**. Hiding a control is not the same as giving it weight. Fixed with the menu described in **TL-3**. *The lesson worth keeping: this review's own recommendation would have spread a defect to two more screens. A pattern named as good in a screenshot review has not necessarily been driven.* |
| LORE-2 | med | **fixed** | **Nothing on a card says whether it is gated.** *Revealed at* is a headline lore feature; a page revealed in chapter 17 is indistinguishable from one visible from the start. Knowledge solves the same problem with "known by 4 / 45". | **A gated card names the chapter it opens at** — *From ch. 2* — and an ungated one carries nothing, so the badge is about the gating rather than decoration on every card. **The chapter, not the scene:** a chapter is the unit a writer thinks in, and a scene title on a card is one truncation too many. A reveal point whose scene has since been deleted still reads *Revealed later*, because the page is still gated and saying so vaguely beats saying nothing. |
| LORE-3 | low | **fixed, in the shared helper** | **Every card shows the same unlabelled US-format date** (`4/7/2026`) — the import date, on all 25 (see **X-6**). | **Both halves, and not only on this card.** The format half lived in `relativeTime`, whose past-a-week fallback was a bare `toLocaleDateString()` — so the same `4/7/2026` reached the lore cards, the Recently-edited list and the scene-history dialog alike. It names its month now, which is the answer **X-6** took on the world card and the whole of the ambiguity. The *which date* half is the word on the card: it reads **Edited 2d ago**. Two things worth recording. The existing unit test compared the fallback against `toLocaleDateString()` — the implementation against itself — so it would have passed on the very string the finding names; it asserts the absence of an all-numeric date now, and goes red when the old call is restored. And `RelatedLoreSection` carried a **fourth** private copy of the relative-time logic, diverging again (it dropped to a locale date after one day rather than seven) — exactly the drift `relativeTime`'s own docblock was written about. It uses the shared one. **`12-lore.png` is deliberately not re-shot:** the change adds one word to a 10px label, and reproducing that screenshot means re-downloading a 72-page library world, on which every card would then read *just now* — a worse illustration than the one there. The guide names the label in words instead. |

### Factions

| ID | Severity | Status | Finding |
|---|---|---|---|
| FAC-1 | med | **fixed** | **Faction-to-faction stances are invisible.** Cards carry a member count only, yet stances are a headline feature — and for a story like this one, who is hostile to whom is the whole point. | **Allies and enemies are counted on the card.** A stance is stored once for the pair, so both sides are counted from the one record — the mutation that counts only `factionA` turns the test red, which is the part worth guarding. **Neutral is left off**: it is the default, so a count of it says nothing that its absence does not. |
| FAC-2 | med | **fixed** | **No search box**, while Items, Knowledge, Lore and Characters all have one in the same position. Fine at ten factions; the inconsistency is the finding. | **Added in that position**, with the *No matches* state its siblings have — an empty grid with no word for it reads as a loading failure rather than a search with no hits, which would have been half a fix. |
| FAC-3 | low | **fixed** | **Card titles truncate while their descriptions wrap.** *"The Fellowship of the R…"* is cut at 29 characters directly above two full lines of body text. | **The name gets the same two lines the description has.** It was `truncate` — one line, ellipsis — set directly above a `line-clamp-2` body, so the card cut the thing it is named for and wrapped the thing it isn't. The colour dot moves to the top of the row, so it sits with the first line when the name does wrap. Measured rather than eyeballed: a single-line `truncate` reports content wider than its box and a wrapped element does not, so the test asserts the long name overflows nothing and is taller than a short one on the same screen — a pair that vacuity cannot satisfy, since the short name must stay on one line. |

### Knowledge

The best-designed screen reviewed so far.

| ID | Severity | Status | Finding |
|---|---|---|---|
| KN-1 | — | **good** | **"Suggested from your story"** proposes real work — *"+ Barrow-wight is dead · Ch. 8"* — and adds it in one click. The strongest affordance in the app; the pattern the dashboard wants (see the DASH rebuild note). |
| KN-2 | — | **good** | **"known by 4 / 45"** on every card: a number that means something at a glance. |
| KN-3 | low | **corrected** | **The *when* is on the detail panel, not the roster.** Filed as "missing from the screen about when" before the detail panel had been opened. It is not missing: the panel carries **Reader learns at** (*Ch.10 — Gandalf's Delayed Letter*), **Becomes true at**, and a **Known by** list naming the event each character learned it at. What stands is much smaller — the *roster card* shows only the count, so you cannot scan reveal order without opening facts one at a time. |
| KN-4 | low | **fixed** | **No ordering control** — 21 facts in a fixed order, with no way to sort by reveal point or by how widely known they are. | **Both numbers were already on the cards; they just had no say in the sequence.** `src/lib/factOrder.ts` adds *When it gets out* (earliest reveal in narrative order), *How widely known* (most first — the question is what is out, not what is safe), *Name*, and the original *Order added*. Every order is **stable**, so a roster where nothing is known yet does not shuffle itself, and a fact nobody knows sorts to the **end** rather than the beginning — treating "no reveal" as position zero would claim it gets out first. Unit-tested, including the stability property by reversing the input. One thing the e2e turned up worth keeping: the AI world spec's `id` fields are not the rows' ids, so reveals keyed on `"e1"` resolve to no position and every order silently collapses back to the order facts were added — a test seeded that way would have looked like coverage and asserted nothing. |

**Not established:** the "open a fact" step passed against a verify that matched
`known by` text already on the roster, so it proved nothing about the detail
view. Knowledge detail is therefore **unreviewed**, not reviewed-and-fine.

---

## 13. Arc grid, Maps, Relationships, Continuity

### Character Arc grid

The best use of screen width in the app, and the counter-example to **X-2**:
full-bleed columns, a legend at the foot, and the interaction spelled out
(*"Click a column to set cursor · Click a notes cell to expand"*).

| ID | Severity | Status | Finding |
|---|---|---|---|
| ARC-1 | med | **fixed** | **Empty rows drown the signal.** 45 characters × 22 chapters, and a dozen rows (Arwen, Boromir, Cave-troll, Celeborn, Durin's Bane…) are entirely blank. There is no way to hide characters with no recorded state, so the grid is mostly emptiness at exactly the scale it is meant for. | **A control that says what it would do before you press it** — *Hide 12 with no recorded state* — flipping to *Showing recorded only (12 hidden)* once it is on. The count is the argument for pressing it, so it belongs in the label rather than behind it. It is a filter and not a deletion: pressing again brings them back. The button only appears when there is something to hide, which on a world where every character has state means it never appears at all. |
| ARC-2 | med | **fixed** | **Inherited state is styled like recorded state.** Bilbo shows *"Argues with Gan…"* verbatim in all eleven visible chapters. A small clock glyph marks the carried-forward cells, but the text reads at full weight, so eleven inherited cells look like eleven decisions. | **The carried cells recede.** The dimming is applied to a cell's *content*, not to the cell, so the faction stripe, the active-column highlight and the focus ring all keep their contrast — the authored cells are the ones that read at full strength, which is the whole point. A screen reader was getting even less than the glyph offered, since a `title` on a span is not reliably announced; there is a visually-hidden *Carried forward* in each of those cells now. |
| ARC-3 | low | **fixed** | **Alphabetical only.** Barrow-wight and Bill the Pony sort above Frodo; no ordering by appearances or by importance. | **Most-seen first is the default now**, counting the scenes a character is the POV of, is involved in, or is named in — once each, however many of the three apply. A–Z stays as the other half of the toggle, because it is the right order when you already know whose row you want. Ties fall back to the name rather than to load order, so a grid does not reshuffle itself when an unrelated character gains a scene. |

### Maps

| ID | Severity | Status | Finding |
|---|---|---|---|
| MAP-1 | high | **fixed** | **The default view is illegible.** Opened at *All chapters* on the shipped example, roughly fifteen label pills pile onto one another across the north of the map — *"16 characters"*, *"3 characters"*, *"Glorfindel"*, *"The Watcher in the Water"*, *"Trollshaws"* — several completely hidden behind others. There is no collision avoidance, no decluttering, and no zoom-dependent thinning. This is the arrival state of the app's most visually impressive screen.. **Measured on a shipped world with images: 9 overlapping label pairs from 11 markers.** The map already had a per-marker dot-only icon mode built in — and a filter that turned *every* label off at once — but nothing joined them up, so `showLabel` was a parameter no caller ever passed `false`, and the only way to read a crowded map was to lose every name on it. **Fixed:** `labelDeclutter.ts` decides per marker whether its pill clears the ones already placed, in a stable order, with the selected marker exempt; the rest fall back to the dot that already existed, and zooming in brings the names back. Label-on-label collisions go **9 → 1**, with 5 of 11 keeping their names. The survivor is a location label against a *character* pin, which is a separate icon path and a separate problem. |
| MAP-2 | med | **fixed** | **The floating toolbar sits on top of content.** *+ Location / Label / Measure / ⋯* overlaps a marker and its label in the top-right corner. | **The map opens below the band rather than behind it.** The fit ran `padding: [0, 0]`, so the image was placed edge to edge and whatever sat near its top opened underneath the floating toolbar. The fit now insets by the band's **measured** height — measured, because the band wraps and its height depends on the filter bar and info chip inside it — plus half a marker pill, since a pin is anchored at its point with the label centred on it, so clearing the band with the image's edge still leaves a marker at that edge poking up into it. **Two things had to move together, and the first alone did nothing.** Padding the fit is undone immediately by `setMaxBounds(bounds)`, which forbids showing anything above the image — exactly the space the inset asks for. The bounds are extended upward by the inset converted back into image pixels at the fitted scale, so the allowance is the band rather than a fraction of it. Measured at 1280×720: the top-right marker moved from overlapping the band (top 81, band bottom 102) to clear of it (top 124). |
| MAP-3 | med | **fixed earlier, by SB-3** | **The sidebar contradicts itself.** It says *"Select an event from the timeline bar below to place characters onto the map"* while listing every character with a location beneath it (*Aragorn · Weathertop*). Both are true — placement needs a cursor, display does not — but read together they do not make sense. | **Real, and already resolved by a change made for a different finding.** The row used to render `{locationName && …}` unconditionally, and with no cursor `selectBestSnapshots` falls back to each character's *most recently updated* snapshot — so there was always a place to print beside a sentence saying you had to pick a moment first. **SB-3** gated that line on `activeEventId` to make an empty second line mean "nowhere" rather than "not loaded", which made the two mutually exclusive. Confirmed by reverting both halves in a mutation, not by reading the diff: `e2e/mapCast.spec.ts` now holds the property, so the pair cannot drift back together. |

### Relationships graph

| ID | Severity | Status | Finding |
|---|---|---|---|
| REL-1 | high | **fixed** | **The graph does not survive its own example.** 45 characters produce a knot in the upper third with unreadable overlapping edge labels, while unconnected characters are flung hundreds of pixels away — so distance reads as meaning when it carries none. Both side thirds are empty. There is no re-layout, no clustering, no filter to one character's neighbourhood, and no way to reduce what is drawn. **Held up, and the cause was one line.** Every character went onto a fixed four-column grid — 880 × 1920 for a cast of 45, so `fitView` zoomed out to swallow the height and left both side thirds empty, and a grid slot said nothing about who knew whom. **Fixed** with a deterministic force layout (`graphLayout.ts`): relationships pull, every pair inside a cutoff pushes, connected groups are shelf-packed towards 16:9, and characters with no relationships are gathered into a block of their own instead of being scattered through the grid. The repulsion cutoff matters on its own — without it a chain of fifteen drew its links half again as long as a chain of five's, so the same relationship had two lengths depending on cast size. Three controls followed: **Tidy up** re-runs the layout and drops hand-placed positions, **Focus** draws one character's neighbourhood at one or two hops with a count of what is shown, and edge labels are dropped below the zoom at which they are legible — with a note saying so, since `fitView` on a twenty-character world lands at 0.33 and silence there would read as "this graph has no labels". |
| REL-2 | med | **fixed** | **The minimap is unreadable** — a smear of dim blue on near-black with no visible viewport rectangle, in the one situation where a minimap should be earning its place. | **Both halves had a measurable cause.** Every node drew as `hsl(222,47%,20%)` on an `hsl(222,47%,11%)` background — the same hue nine points apart, so the nodes *were* the background — and the viewport was marked only by a 40% mask with no stroke, so there was no rectangle to find. Nodes now carry the colour the graph gives them (the faction's when that overlay is on, the character's otherwise), the viewport has an actual outline, and the mask is dark enough for inside and outside to read as different places. It is **pannable and zoomable** as well: on a graph big enough to need a minimap, steering from it is the point of having one. **A third thing, not in the finding:** every colour here was a hardcoded slate literal, so the minimap ignored the theme entirely — a fantasy or western world got a blue-grey box regardless. They are tokens now, like the rest of the app. |

### Continuity Checker

Well built: grouped by category with counts, a suppress control and a jump
control on every row, and keyboard hints at the foot (*↑↓ navigate · Enter go
to event*).

| ID | Severity | Status | Finding |
|---|---|---|---|
| CC-1 | high | **fixed** | **The model has no notion of a thing there is more than one of, and the checker reports it as an error.** *"Barrow-blades appears in multiple places in Ch. 12 — Held by: Meriadoc, Peregrin, Samwise, Frodo"*. There are four barrow-blades, one each. Same for *Elven Cloak* and *Lembas*, held by six characters apiece. Almost all of the 79 item errors are this class. It is a modelling gap surfacing as a wall of false positives, and false positives are how a checker teaches people to ignore it. |
| CC-2 | high | **fixed** | **The shipped example reports 72 errors and 25 warnings.** Someone who downloads *The Fellowship of the Ring* and clicks the shield meets 97 problems in a world they did not write. Either the example is wrong or the checks are, and either way that is the first impression the feature makes. **Measured: the checks are.** Running the checker over the shipped fixture, **71 of the 97 issues are a single rule** — *"X appears in multiple places"* — and the three items it fires on are *Lembas* (6 simultaneous holders), *Elven Cloak* (6) and *Barrow-blades* (4). All three are things there are several of, so the example data is right. **Fixed as CC-1**, which drops the Fellowship from **97 issues to 23, and from 72 errors to 1** — the survivor being a genuine fixture slip (Gandalf alive in Ch. 22 after dying in Ch. 17), and most of the rest legitimate observations about the novel rather than faults. |
| CC-3 | med | **fixed** | **No triage within a category.** *Items 79* is one repeated fault; nothing groups by kind, so the real findings are buried under the noise from CC-1. | **Issues carry a `kind` now**, not just a category, and a category with more than one kind in it groups by kind with a name and a count on each run — Measured on the Fellowship example, whose Characters category now reads *Alive after dying 1* above *Dead character in a scene 3* — the error first, and each run named rather than run together. **Errors lead regardless of size**, which is the case the finding is actually about: one error among fifty warnings was previously wherever its check happened to run. A category with a single kind renders exactly as before, since a heading there would only repeat the category. The kind is read off the issue rather than inferred from the wording of its message — the names match the prefixes the issue ids already carried. **One thing this had to fix on the way:** keyboard focus was an index into one flat list while the rows were drawn from another, bridged by `baseIdx` arithmetic that only held while the two orders agreed. Grouping makes them disagree, so focus is tracked by issue id and the arrow keys walk the same `groupIssuesByKind` output the panel renders. |

**Correctly caught, for the record:** *"Gandalf the Grey is alive in Ch. 22 after
dying in Ch. 17"* is exactly right for this book, and the eye icon beside it is
the right answer.

---

## 14. Using the map as a writer

Not looking at the map — working it. Opening the shipped *Fellowship*, asking
where everyone is at a given chapter, following one character, drilling into a
city, playing the story back, and stepping the cursor forward to watch the cast
move.

**What works, measured rather than assumed.** The map genuinely tracks the
story: markers drawn fall **43 → 31 → 24 → 16** as the cursor moves from *All
chapters* to Ch.6, Ch.11 and Ch.21. Drilling into *Minas Tirith* works and
returns cleanly. Playback runs and redraws. The bottom chapter bar — segments
with per-scene ticks, the current chapter picked out, the active scene named
beside it — is the best navigation in the product, and on this screen it is
doing real work.

| ID | Severity | Status | Finding |
|---|---|---|---|
| MW-1 | high | **fixed** | **Label collision is not just an *All chapters* problem.** With the cursor on Ch.6 the north of the map still stacks *Trollshaws* / *Rivendell* / *High Pass* / *The Bruinen Ford* on one another, and *Dimrill Dale* / *Lothlórien* / *Dol Guldur* on each other. Setting a moment — the app's whole premise — does not make the map readable. This extends **MAP-1** rather than repeating it. **Already fixed by MAP-1, verified rather than assumed.** This was filed in #185; the label declutter landed in #186, after it. `e2e/mapScaleAndLabels.spec.ts` now pins the property on twenty markers crowded into a fifth of the map — no two labels that are drawn may overlap — and disabling the declutter turns that test red, so it is the declutter doing the work. |
| MW-2 | high | **fixed** | **Two contradictory scales are on screen at once.** The breadcrumb states *1 km = 2 px*, while the map artwork carries its own printed scale bar in **miles**. A writer measuring a leg of the journey has no way to know which one the answer will come back in, and the two cannot both be right. **Fixed for the map it was filed against, and it was a data defect.** The artwork's printed bar reads *Miles* (five 50-mile segments, ~0.85 px per mile at 1600 px wide); the layer was configured at 1.945 px per **km**, which makes Middle Earth 822 km — about 511 miles — across instead of roughly 1900. Recalibrated to 0.85 px per mile. **The Shire, checked the same way, is correct**: its bar reads *ten leagues* over 199 px, which is 4.13 px/km against a configured 4.017 — so this is not a blanket error and a bulk conversion would have introduced one. The other thirteen layers have not been measured; see **MW-9**. App side, Set Map Scale now states what the entered scale makes the whole map, since "100 km between two points" looks reasonable on its own and only the total gives an order-of-magnitude error away. |
| MW-9 | med | **fixed** | **Thirteen map scales in the Fellowship example are unverified.** Two of the fifteen have been checked against their own printed bars — Middle Earth was wrong by 3.7× and in the wrong unit, the Shire was right — so neither "they are all fine" nor "convert them all" is safe. Each remaining layer needs its artwork read: some may carry no bar at all, in which case the honest answer is to clear the scale rather than assert a number nothing backs. | **Every layer's artwork read; six corrected, one cleared, two confirmed, six left alone.** The images were extracted from the `.pwb` and each bar measured off the pixels — tick positions from a column-darkness profile between the rules, not by eye — then cross-checked against the size of the place the map is *of*. <br><br>**Corrected:** Middle Earth **1.9449 → 0.53127** (bar reads *Miles*, 42.75 px per 50; 3,012 km across, and 1.9449/0.53127 = 3.66, which is the review's own "3.7×"); **Lothlórien Journey** and **The Lower Anduin** likewise, since all three reference the same image `kImOXlIVVkxowBRHH8KbM` — one number, not three. **Minas Tirith 1.7611 → 1781.1** (*Feet*, 325.7 px per 600 → 1.01 km across, which is the city). **Isengard 0.2837 → 299.2** (*Feet*, 136.8 px per 1500 → 2.46 km, which is the ring). **Hobbiton 519.7 → 2040** (*100 m* bar, 204 px → 490 m, which is the village around The Water). <br><br>**Confirmed correct:** Moria (bar reads *a scale of twenty leagues*: 120 px measures 1.2427 px/km against 1.2592 stored, 1.3% apart) and the Shire (*ten leagues*: 4.494 measured against 4.0166, which is endpoint noise on an arrow-tipped bar, not a defect). **Moria matters most here** — the arithmetic screen flagged it at 813 km and its own bar backed that. The screen finds candidates, not errors. <br><br>**Cleared:** Edoras. It has a bar, ticked 200/400/600, but the unit above it is written in a script this pass could not read, and the stored number was wrong by two to three orders of magnitude under either reading (feet → 1.14 km across, metres → 3.74 km, stored → 1,138 km). No number can be backed, so none is asserted. **Left alone:** Rohan, Gondor, Mordor, Bree, Bree-land and Anórien carry no printed bar anywhere on the plate, and their stored extents (768, 1,235, 809, 2.7, 155 and 329 km) are all plausible for what they depict — clearing a plausible number to gain nothing measurable would cost six maps their distances. Rivendell had no scale to begin with. <br><br>**One thing this turned up that the finding did not mention:** the shipped `example/` copy and the `public/library/` copy had **diverged** — the library's Middle Earth read `0.85` where the example's read `1.9449` — so a reader who downloaded the book and a writer who imported the file were measuring the same map differently. <br><br>`src/lib/__tests__/exampleMapScales.test.ts` holds it: per-layer bounds on the implied extent (wide, and justified by what each map is a map of, since they are meant to catch three orders of magnitude rather than pin a number down), a unit-present-iff-scale-present rule, the list of deliberately unscaled layers, and the two copies agreeing. Reverting Minas Tirith turns two cases red; restoring a scale on Edoras turns three red. |
| MW-3 | med | **fixed** | **"Who is where" is buried in a list of everyone.** With the cursor on Ch.6 the sidebar lists all 45 characters at equal weight, each with a placement crosshair, but only a handful carry a location beneath their name. The question the screen exists to answer — *who is on stage now* — is a minority of the rows, undistinguished from the rest. | **Fixed by splitting the list**, not by filtering it: **On the map (n)** above **Not placed (n)**, each sorted by name. Placing someone new is the other thing this list is for, so the rest stay one scroll away rather than behind a toggle. **The groups only appear when both are non-empty** — a heading over the whole list says nothing — and only with a cursor, since without one there is no moment for a placement to belong to. The ordering is a pure function (`src/lib/mapCast.ts`) with unit tests, including the case where a snapshot points at a marker that has since been deleted: that is *not* a placement, or the row reads as placed and shows nothing where the place should be. |
| MW-4 | med | **fixed** | **Regions are labelled twice.** *Rohan* appears as a polygon label and again as a marker pin reading *Rohan · Region*; *Mordor* likewise, with the two labels overlapping. | **Read from the data first, which changed the fix.** The second label is not a stray duplicate to delete: *Rohan*, *Mordor* and *Gondor* are location markers with `iconType: 'region'` **and a `linkedMapLayerId`** — they are the doorways into those sub-maps, and they carry the region's picture. Removing the marker would remove the way in. What is duplicated is only the *word*, so that is all that goes: a pin standing inside a region polygon of the same name draws as a dot instead of a pill, keeping its position, its click target and its sub-map ring, while the polygon keeps the centred label — a centred name describes an area, a pill describes a point. Handled in `labelDeclutter.ts`, which already decides which pins can show a name, so this is one more reason a label is held back rather than a second mechanism. **Containment is tested, not the name alone:** two places can share a name on one map, and blanking the label of a pin that stands somewhere else entirely would be a worse fault than the one being fixed. |

### The three that were unproven — now settled

All three work. Each was measured rather than eyeballed.

| Feature | Result |
|---|---|
| **Journeys** | Works, and needs no character selected. Overlay paths go **5 → 17 → 5** across off/on/off, so the lines are genuinely drawn and genuinely removed. |
| **Measure** | Works. Two points on the Middle-earth map report **"101 km"**. |
| **Film strip** | Works on a *single-character* pin. Clicking Radagast at Rhosgobel lists his stop as *"Ch.14 — The Council of Elrond"*. |

Chasing them turned up three new faults and hardened a fourth.

| ID | Severity | Status | Finding |
|---|---|---|---|
| MW-5 | high | **fixed** | **Measure mode does not take exclusive control of the canvas.** With Measure armed, the first click both places the point **and selects the region polygon underneath**, opening its detail panel over the right of the map — verified: a region panel was open and the tool was still in Measure mode. On the first attempt that panel covered the spot intended for the second point and swallowed the click entirely, so the measurement could not be completed at all. A mode that says "click two points on the map" has to own those two clicks. **Fixed** by switching pointer events off for the interactive Leaflet layers while the mode is armed, so the click reaches the map instead of the overlay. Two obvious approaches do not work and were tried first: Leaflet reads `interactive` when it *creates* a layer, and react-leaflet hands `className` to the map container once at creation, so neither can be toggled on a map already on screen. The class lives on the React wrapper instead. |
| MW-6 | med | **fixed, cause corrected** | **A cluster popup renders off the top of the viewport.** Clicking a "16 characters" pin opens a list whose first entry (*Meriadoc Brandybuck*) is cut off above the canvas, behind the toolbar. It is not scrolled into view and cannot be reached. | **It never left the canvas** — Leaflet's auto-pan already keeps a popup inside its container. What it ran into is the *floating* toolbar drawn on top of the canvas. Measured on a 600px-tall viewport: a sixteen-name popup opened at **y=67** and stood **363px** tall, while the toolbar occupies **y=61..89**. It rose straight into that band. **Fixed** with `autoPanPaddingTopLeft`, which pans the map so the popup clears the toolbar rather than merely the container, and `maxHeight`, so a long list scrolls inside itself instead of growing past the room it has: the same popup now opens at **y=180** and stands **250px**. **Worth recording:** the first version of the test asserted the popup stayed inside the *canvas*, passed with the fix reverted, and was no test at all — the numbers above are what found the real cause. |
| MW-7 | med | **fixed** | **"(sub-map)" tells you nothing useful.** Fourteen of the sixteen names in that list read *"Frodo Baggins (sub-map)"*, *"Sauron (sub-map)"*. It presumably means the character is really on a child map and is being shown at the parent pin — but it does not say **which** map, and repeated on nearly every row it reads as noise rather than information. | **The guess in the finding was right,** and the name was already one lookup away: `resolveCharacterPin` walks from the character's own layer up to the one being viewed, so the layer it started from is exactly the answer. It returns that id now, and the row reads *"Frodo Baggins · in Bag End"*. The pure function's existing unit tests carried the new field, and one of them caught a wrong expectation immediately: a character on a building's *ground* floor resolves to that floor, not to the building's representative one. |
| MW-8 | low | **fixed, premise half-corrected** | **A cluster pin and a character pin do different things without saying so.** A single pin opens the film strip; a cluster opens a plain member list with no strip and no way to reach one. | **There is a way to reach one — every row is it.** A member button calls `onCharacterClick`, the same handler a single pin's click calls, so choosing a name opens exactly what a single pin opens: the character's panel and their journey strip. What was missing was any statement of that; the list read as a different kind of thing that happened to name some characters. The heading says it now — *At this location — pick one to open their journey:* — which is the relationship the finding asked for, and costs nothing. |

**MW-2 is now firmer, not weaker.** The measurement came back in **kilometres**
on a map whose own printed scale bar is in **miles**. Both are on screen at
once and they disagree.

---

## 15. Worlds with several timelines

Driven on two shipped examples, deliberately of different kinds: **The Two
Towers** (parallel storylines) and **The Name of the Wind** (frame narrative).
The guide says these get different bottom bars, and they do.

**Correct, and verified rather than assumed:**

- The **scope selector** is present on the parallel world and **absent** on the
  frame narrative, which instead gets two stacked tracks — exactly as
  documented, checked both ways.
- The **All timelines** tab is offered in both.
- Timeline tabs carry colour dots, and the **arc grid** offers matching pills
  (*All · The Road to Mordor · Rohan and Isengard*), so the same colour means
  the same storyline in two places.
- **Link Timelines** appears in the header only when there is more than one.

| ID | Severity | Status | Finding |
|---|---|---|---|
| MT-1 | high | **fixed** | **In the frame-narrative bar, the outer track loses its chapter titles while the inner keeps them.** The top track reads `0 1 2 3 4 5 6 13 17 25 45 48 57 75 88 92 93` — bare numbers — directly above an inner track reading *8 · Thie…*, *12 · Puz…*, *22 · A Time for…*. The same component renders at two densities side by side because segment width follows event count, so the *frame* of a frame narrative is the half you cannot read. | **Fixed.** The compact segment floor was 2.5rem, which fits a digit and nothing else; it is 5.5rem now, so a title survives truncation the same way the story track's does, and both tracks read *number · title* with the full title on hover. Fixing that exposed a second defect the bare digit had hidden: the rail and its ticks are absolutely positioned, so their box collapsed to zero height and drew straight through the label beneath it. Given a 14px floor, it clears the tallest tick.
| MT-2 | med | **fixed** | **Two play buttons, one per track, with nothing to say what either does.** Neither is labelled for its track, and nothing states whether playing one moves the other, or which one is "play the story". | **Each names its own track** — *Play The Attic — moves the cursor along this track* — where both previously read the same *Play story on the map*. `Controls` already took a `playLabel`; the stacked bar was the one caller that never passed one, so both buttons inherited the default. The label deliberately says only what the button does to *its* track: **MT-6** is still open, and while it is, playing the inner track moves a hidden outer cursor that only the map reads while playing the outer syncs nothing — so a label promising more than that would be the kind of claim this review keeps finding. Which one is "play the story" is answered by the track names themselves. |
| MT-3 | med | **fixed, figure corrected** | **The stacked bar costs roughly 150px of height permanently** — two rows on every screen in the world, on a surface where the map and the manuscript both want the vertical space. | **It costs 100px, not 150.** `BAR_H_STACKED` is `6.25rem` and the app does not override the root font size, so the frame narrative's two tracks are 100px and every other world's single track is 64px. That matters, because collapsing *only* the stacked case back to one row would have recovered 36px — not worth a control. So the whole bar rolls up instead, on any world: **a 28px strip** carrying where the cursor is and a click to bring the bar back, so a screen reserves 28px instead of 64 or 100. The state is persisted with the rest of the UI shell, because someone who put 100px of chrome away on the map did not mean *until the next navigation*. The control lives in `Controls`, which all four tracks render, so it needed no wiring through any of them — with the frame narrative's outer track opting out, since one bar rolls up as one thing. `e2e/barCollapse.spec.ts` reads the padding `main` reserves rather than looking at the bar, and pairs each absence with its presence: the track's scene markers are there before and gone after, the strip the other way round, and the height returns exactly on expanding. Three mutations red — the collapsed height, the persistence whitelist, and the strip's label. |
| MT-4 | low | **fixed, premise corrected** | **A timeline's chapter count and its first chapter number disagree on sight.** *The Road to Mordor (10 chapters)* opens at **Ch. 12**, because numbering runs globally across timelines rather than per timeline. That is right for a book published as two halves, but nothing on the screen says so, and "10 chapters" starting at twelve reads as missing data. | **The symptom is real; the stated cause is not.** Numbering does *not* run globally across timelines — `nextNumber` is `chapters.length + 1` for the current timeline, so chapters added through the UI restart at one, and a test that created a second timeline and two chapters in it got Ch. 1 and Ch. 2. What produces a timeline opening at twelve is the world being *authored* that way: the shipped examples carry the book's own numbering, and an import carries whatever it was given. So the header describes what is there rather than assuming where it came from — *2 chapters · Ch. 12–13* — and stays out of the way when the timeline does start at one, since "10 chapters · Ch. 1–10" adds nothing. A gap in the numbering is still reported as a span, which is the honest description of where the timeline sits in the book. |

### Sync points and the "ghost cursor line"

| ID | Severity | Status | Finding |
|---|---|---|---|
| MT-5 | high | **done** | **The guide described a feature that does not exist.** It said a *"ghost cursor line marks the corresponding moment on the other track"*. There is no such line. `syncPoints` appears in exactly one place in the source — `useTimelinePlayback.ts` — and `StackedTrack` is never given the sync-point data, so it could not draw one. Confirmed in the running app: with the cursor set to Ch.6 of the outer timeline, there are **zero** dashed, dotted or ghost-styled elements anywhere on the page. `docs/GUIDE.md` now describes what sync points actually do. |
| MT-6 | med | **fixed, partly corrected** | **Sync points only work one way, and only while playing.** They fire when playback advances the **inner** track onto a paired event, moving a hidden outer cursor that only the **map** reads (for ghost pins). Playing the outer track syncs nothing, and moving the cursor by hand syncs nothing in either direction. A writer who pairs nine moments and then scrubs between them sees no effect at all. | **The "only while playing" half is fixed.** The sync was applied inside the playback timer's callback, so it fired only when the timer moved the cursor. It is an effect on the cursor now (`src/lib/syncPoints.ts`), so it follows every way the cursor moves — the timer, a click on the scrubber, the previous/next arrows, the search palette. It also **holds** the last pairing rather than matching exactly, which is what a frame narrative means: the teller stays at that point in the telling until the story reaches the moment that moves them. Exact matching would have shown the frame's cast on one scene and dropped them on the next. **The "one way" half is the design, not a fault.** The outer cursor exists to draw the frame's cast as ghost pins beside the inner story — something you want while you are *in* the tale — and has no consumer in the other direction, so a symmetrical sync would set a value nothing reads. **Now covered end-to-end.** It shipped without an e2e because a purpose-built frame narrative produced no ghost pins at all — which turned out to be **X-17**, not MT-6. With snapshot positions computed on both sides the fixture resolves, and `e2e/frameNarrativeScrub.spec.ts` drives the finding directly: scrubbing (never playing) onto a paired moment brings the frame moment in, it holds past the pairing, and it lets go before it. Three mutations red. |
| MT-8 | med | **withdrawn — it was the fixture, and it found something bigger** | **Ghost pins could not be produced in a purpose-built frame narrative.** | **Not a defect in ghost pins.** The fixture invented `sortKey: 100` where snapshot positions are `chapterNumber + sortOrder / 1_000_000`, so the seeded snapshot read as far *after* a cursor at ~10.000001 and was correctly ruled out. Filing it as an observation rather than a defect was the right call. **Chasing it down found a real one, though — see X-17**, which is the same comparison failing on shipped data rather than on a test fixture. |
| MT-7 | med | **fixed** | **Nothing on the bar shows which moments are paired.** Having set up sync points, there is no mark on either track saying "this one is linked" — so the only way to know a pairing exists is to open the relationship editor and read the list. | **A dot above the tick on both sides of each pairing**, and the moment's hover text says *paired with a moment on the other track*. Above the tick rather than on it, because the tick already carries position and whether playback has passed it. No new plumbing was needed: `ChapterTimelineBar` already loads the frame relationship to decide whether to draw a stacked bar at all, so the sync points were data in hand. This is a mark on what exists, not a claim that scrubbing to it does anything — that is **MT-6**, still open. |

**What sync points really do**, for the record: during playback of the inner
timeline, reaching a paired event sets `activeOuterEventId`, which
`useMapViewState` uses to resolve the outer timeline's snapshots and draw its
cast as ghost pins on the map. That is a genuinely good feature — cutting back
to the frame while the map shows both casts — and it is invisible everywhere
except the map, during playback, in one direction.

---

## 16. The map sidebar, and the panels that open on the right

Asked for directly, and fairly — the left bar had one finding against it
(**MW-3**) and the right-hand panels had never been looked at.

### The left sidebar

Sections: Map Layers · Characters · Locations · Items · Routes · Regions, each
with a count in its header, which is the right idea and done well.

| ID | Severity | Status | Finding |
|---|---|---|---|
| SB-1 | high | **fixed** | **Opening the sections produces one unbounded scroll.** They are not an accordion and their headers do not stick, so with Items expanded (18 rows) *Map Layers*, *Characters* and *Locations* have all scrolled off the top. In a 22-chapter world with 29 locations and 45 characters, opening two sections makes the third unreachable without hunting. | **Fixed.** The column is a panel stack: headers and section bodies are siblings in the sidebar's own flex column, headers never shrink, and each body scrolls inside itself. The wrapper each pair used to sit in was the problem — a flex item's automatic minimum height is its min-content height, and a wrapper's min-content includes its whole body, so nothing could give. Flat, `flex-1` shares the leftover height between the open bodies and `max-h-fit` stops a one-row section growing past its one row, handing the surplus back to whichever section needs it. Measured on the review's world (29 locations, 45 characters, 18 items) with all six sections open: four of six headers were outside the column before, none after.
| SB-2 | med | **fixed** | **Names are truncated far earlier than the column requires.** *The Witch-kin…*, *Samwise Gam…*, *Radagast the …*, *Bow of the Galad…*, *The Mirror of Gal…* — cut at roughly fourteen characters in a 280px column. *The Witch-king of Angmar* and *The Witch-king of the North* would be indistinguishable. | **Fixed.** Measured at `lg:w-52`: with a moment selected, the place-on-map control took 40px and a row's name was left 101px — enough to cut *Samwise Gamgee* (108px) and to render both Witch-kings identically. The column is one width at both breakpoints now (256px), giving the name 149px; *Samwise Gamgee* and *Radagast the Brown* fit whole, and the two Witch-kings diverge on screen. Every truncatable name in the sidebar also carries a `title`, so whatever is still cut is one hover from being read.
| SB-3 | low | **fixed** | **Only some rows carry their per-event state.** At a given chapter a handful of characters and items show a location line and the rest show nothing, at identical weight — the list version of **MW-3**. | **Fixed** alongside SB-2: with a moment selected, every character and item row states where it stands — the place name, or *Not placed* in a dimmer italic. An absent second line no longer has to be read as either "nowhere" or "not loaded".

**Example-data note:** at Ch.12 the sidebar reads *Sauron · Bag End*. That is the
shipped Fellowship example, not the UI, but it is the kind of thing a reader
will screenshot.

### The location panel

| ID | Severity | Status | Finding |
|---|---|---|---|
| LP-1 | high | **fixed** | **Delete is the loudest thing in the panel.** *Delete Location* is a full-width, saturated red bar pinned to the bottom, more visually dominant than the location's own name. Lore hides its delete until hover (**LORE-1**); this is the opposite extreme, on the panel a writer opens most often. | **Fixed** with PAN-1 — the shared `PanelDangerFooter`. Every panel that can delete what it is showing now does it at the same quiet weight the route and region panels already used.
| LP-2 | med | **fixed** | **The panel is clipped by its own delete bar.** *Upload Sub-map* is cut in half by it, so the last section cannot be read or reached at the default height. | **Fixed** by the `shrink-0` footer that came with **PAN-1** — deliberately not claimed at the time, since the claim had not been measured. It has been now: the body's bottom edge and the footer's top edge meet at the same pixel, and *Upload Sub-map* sits clear of it.
| LP-3 | med | **fixed** | **Three sections in a row send you somewhere else and none of them takes you there.** *Characters here* wants an event; *Controlling Faction* says "create one in the Factions view"; *Lore* says "open a lore page and use the link button". The copy is clear and correct — and there is not a single link among the three. | **Fixed for two of the three; the third turned out already to act.** Measured before: zero links in the whole panel. *Controlling Faction* and *Lore* now each carry a button to the screen their copy names. *Characters here* was the one the finding read wrongly — when there is no moment it already offers a chapter picker and a **New chapter** button inline, so it does take you there, and it is left alone.
| LP-4 | low | **fixed** | **The name is shown twice and the header carries neither.** The map popup reads *Saltmouth · City*, the panel repeats *Saltmouth · City* immediately beside it, and the panel's own header says only *"Location"*. | **Fixed** as a consequence of PAN-1: the name and kind moved into the header, so the body no longer repeats them.

**Credit:** the empty states here are among the better-written in the app —
they say what is missing *and* why, rather than just reporting absence.

### The character panel

The best of the panels, and the yardstick the others should be held to. Its
header carries **the moment** — *Frodo Baggins · Ch.12 — Flight to the Ford* —
then portrait, an **Alive** badge, the status note in his own words, travel
mode, location, inventory with per-item remove and *+ Add item…*, inventory
notes, and relationships.

Clicking a character in the sidebar also opens the **film strip** along the
bottom — *The Party Tree Ch.1 · Bag End Ch.1 · Hobbiton Ch.3 · Woodhall Ch.3 ·
Shire Ch.4 …* — which is the feature earlier passes kept failing to reach.

| ID | Severity | Status | Finding |
|---|---|---|---|
| PAN-1 | high | **fixed** | **The four panels share no contract.** The character panel names the moment in its header; the location panel's header says only *"Location"*. The location panel ends in a full-width saturated red **Delete Location**; the character panel has no delete at all. Same edge of the same screen, opened the same way, and they disagree about what a panel is. | **Fixed.** One `PanelChrome` module states the contract and all four panels use it: the header names *the thing* with its kind beneath and the moment alongside where the panel's content is per-chapter; the close button is an icon at the right, labelled *Close &lt;kind&gt; panel*; and a destructive action, where there is one, sits alone in a `shrink-0` footer at the quietest weight that still reads as destructive. The character panel still has no delete, and that is now the contract rather than a gap in it: a character outlives every marker they stand on, so their panel links to the screen that does own them.
| PAN-2 | med | **fixed** | **Selecting a character costs two rows of chrome.** The right panel and the film strip open together, and the strip stacks above the chapter bar — so a laptop loses the panel width *and* roughly a third of the remaining map height in one click, with no way to keep one without the other. | **The strip can be put away on its own, and stays away.** It was worse than "no way to keep one without the other": the strip's own X *cleared the character selection*, so the one control that looked like "close the strip" closed the panel with it. That X now closes the strip, and the panel carries a **Hide journey / Show journey** toggle to bring it back — someone who dismissed it once was not asking to be shown it again by the next character they click. **One correction to the finding's mechanics:** the strip does not stack above the chapter bar and take height from the canvas; it is absolutely positioned over the canvas's bottom edge, so the canvas keeps its size and the strip covers a band of it. The cost is real either way and the test measures the band rather than repeating an estimate. The X also carried **no accessible name at all**, which is fixed with it. |

### The region panel — the row that would not open it

| ID | Severity | Status | Finding |
|---|---|---|---|
| SB-4 | high | **fixed** | **The region and route rows are not controls.** Measured, zero region rows responded to `role=button` and eight to a div-text query: the rows are `div`s with click handlers (**X-7**), as are the item and character rows beside them. That is not a harness excuse — it is the finding. A keyboard user could not open the region panel at all, and the location markers immediately above them were already buttons, so the same sidebar was navigable in some rows and not others. | **Fixed.** All four rows are `<button>`s: the region and route rows carry `aria-pressed` for their selected state, the item row `aria-expanded` for its disclosure. `e2e/mapSidebarKeyboard.spec.ts` reaches a region row by `Tab` alone — no click anywhere in the test — and presses `Enter` to open the panel that could not be opened. **The character row was nearly missed twice.** X-7 named it and then left it out of the four things it went on to count; and a check run while fixing the other three reported *"0 of 0 clickable `div`s"* against a world with no cast, which is the vacuous-pass shape this document keeps recording. The third test seeds a character so the row exists to be found. Its drag had to be kept where it was: the drag source is the nearest draggable ancestor, so moving `draggable` onto the new button would have put the place-on-map crosshair outside the draggable area, and the test asserts the source is the row rather than the button. |
| SB-5 | med | **fixed** | **The per-row deletes were LORE-1 again.** Both rows carried a `Trash2` with **no accessible name at all**, at `opacity-0` with pointer events still live — the exact shape LORE-1 measured and found worse than a permanent icon, because an invisible control that still hit-tests means a tap on an apparently blank row deletes the record, and on a touch device the resting state is the only state. | **Fixed alongside SB-4**, which forced the question: a button cannot nest a button, so the delete had to become the row's sibling either way. It keeps the hover reveal, gains `Delete route <name>` / `Delete region <name>`, shows itself on keyboard focus, and is `pointer-events-none` at rest. The spec pairs the absence with the presence in one test — `none` at rest, `auto` on hover. |

| SB-6 | med | **open** | **The Map Layers row is the one row still not reachable.** Found while closing SB-4, by checking the claim before writing it into the guide. It is a `div` whose entire activation is a pointer gesture: `onPointerDown` starts a press, and `pointerup` without movement selects the layer while `pointerup` after movement re-parents it. There is no click handler to promote and no key handler, so a keyboard user can expand a layer's children and delete it — both are real buttons — but cannot open one. | **Left open deliberately, because the obvious fix breaks the feature.** Wrapping the name in a `<button>` is what SB-4 did everywhere else, and here it would disable drag-to-nest across most of the row: the row's own `onPointerDown` bails on any press that starts inside a `button`, and the name is the widest thing in it. So this needs its own answer — either a key handler on a `tabIndex={0}` row with `role="button"`, or keyboard re-parenting so the row can be a button and the drag stops being the only way to nest. The guide says which rows are reachable rather than implying all of them are. |

The panels themselves remain unreviewed; what this closes is the reason they
could not be reached.

---

## 17. Writer's Brief, Calendar, Knowledge detail, Settings

### Knowledge detail — the best panel in the app

Header carries the fact's own title. **Reader learns at** and **Becomes true
at** are both explicit, each with a line explaining what it does — *"Anyone who
knows it before this is flagged by the continuity checker."* **Known by (4)**
lists each character beside the event they learned it at, with a remove control,
and a *Character… / Learns it at… / Record who learns it* row to add more. This
is what **KN-3** was wrongly filed against, now corrected.

### Writer's Brief

| ID | Severity | Status | Finding |
|---|---|---|---|
| WB-1 | med | **fixed** | **A full-height panel to deliver one sentence.** With no cursor set it says *"Select an event from the timeline bar to see the brief"* and nothing else — roughly 440px of screen for a single line, on the tool the app promotes most. Worse, it does not help: the Arc and Calendar empty states both offer a button that takes you to the prerequisite, and this one offers no way to pick an event at all. | **Fixed by offering the act rather than the nudge.** The finding asks for a button to the Timeline, and **X-4** rule 2 would have granted it — but rule 1 outranks it, and picking a scene *can* be done from here: the cursor is one store value, and the list the bottom bar already draws fits comfortably in the space the sentence was wasting. So the panel lists every scene in the world, grouped by chapter in the bottom bar's own reading order, and clicking one fills the brief in around it. The routing fallback survives for the one case where rule 1 cannot apply — a world with no scenes at all, where **Open Timeline** is the only honest answer. Two existing specs used the removed sentence as a *negative* proxy for "the cursor got set" (`pacing`, `chapterCursor`); both would have passed vacuously from the moment the sentence went, and are now positive assertions on the briefed moment. |
| WB-2 | med | **fixed, finding corrected** | **The panel has no backdrop.** The timeline underneath stays fully lit and is sliced off mid-sentence at the panel edge (*"…using his magic ring"*, *"…the Dark Lord Sauro"*), so the page reads as truncated rather than overlaid. The search palette dims its background; this does not. | **The panel does have a backdrop** — `bg-black/30`, present since the file was written. What it does not have is the *shared* one: `Dialog` dims to 60% with a blur, and at half that with no blur the page behind stays legible enough that the observation holds exactly as filed, for a different reason. The real fault is that the dim was never in one place: five hand-rolled overlays each picked a number, and the two that picked lowest were the two right-hand slide-overs — the brief and, its twin again, the timeline relationship panel. `MODAL_BACKDROP` in `src/components/ui/dialog.tsx` is now the single value, and the search palette, continuity checker, chapter diff and both slide-overs read it. **Deliberately not included:** the four mobile drawers, which dim to 40% and disappear at `lg`; a drawer that only exists on a phone is not the same thing as a modal that covers the app at every width. `e2e/writersBriefCursor.spec.ts` measures the brief's backdrop against the shared `Dialog`'s in one test rather than asserting a literal, so the two cannot drift apart again. |

*The populated brief remains unreviewed — the cursor was at* All chapters *for this capture.*

*A note on the twins.* **WB-2** is the fourth time a fix has had an unnoticed
sibling: the region HUD for **RT-1**, the region panel's faction for **LP-3**,
the region panel's empty state for **X-4**, and now the timeline relationship
panel, which is the Writer's Brief's slide-over twin down to the z-index. The
pattern is consistent enough to be worth a habit: after fixing something, grep
for the shape rather than the name.

### Calendar

| ID | Severity | Status | Finding |
|---|---|---|---|
| CAL-1 | — | **good** | **An exemplary empty state**: *"No calendar yet"*, one line saying what the view is for, and **Open World settings** — the prerequisite, one click away. This and the Arc grid are the pattern **X-4** should standardise on. |
| CAL-2 | low | **fixed differently — the remedy would have hidden the feature** | **The nav item is present when the feature cannot work.** Calendar sits in the rail whether or not a calendar exists, so the first visit is always a dead end. | **The item is the only place the feature is mentioned.** Nothing else in the app tells you a world can have a calendar, so removing it from the rail removes the feature for anyone who has not read the guide — the same trap **NEW-1** fell into twice. What actually made the visit a dead end was the way out: the empty state said *enable a calendar in world settings* and offered a button landing at the **top of an eleven-section page**, with Calendar somewhere down it. **The screen does the thing now** — one **Enable calendar** button, on the screen you are already on, starting from the standard twelve-month year the settings editor starts from; *Set it up in World settings* stays as the secondary for renaming months and setting the year. A section-deep link was tried first and abandoned: the app is on a hash router, so `#settings-calendar` after a hash route is not a fragment. `e2e/calendar.spec.ts` pairs the absence with the presence — the empty state and no Calendar heading, then the heading and no empty state — and reads the world back to check a real calendar was written rather than a flag. |

### Settings

| ID | Severity | Status | Finding |
|---|---|---|---|
| SET-1 | high | **fixed** | **Settings offers to override a setting that cannot be set.** The Theme section reads *"Override the global app theme for this world"* and its first card is **Inherit global theme** — but there is no global theme control anywhere in the app. `ThemePicker` is exported and never rendered. So the default option inherits from a value the user has no way to change, and the explanatory sentence describes a screen that does not exist. | **Fixed.** The app theme is real and load-bearing — it is what the world list wears and what every inheriting world resolves to — so the fix is to give it a control rather than to drop the concept. World Settings' Theme section now opens with a labelled **App theme** select above the per-world cards, and the first card reads *Inherit app theme* pointing at it. `ThemePicker` was the dead control the finding named; it is gone, and its module renamed to `ThemeProvider` after the one thing it still holds. `docs/features/themes.md` claimed *"`ThemePicker` in `TopBar`"* and ticked it off — corrected to what is there.
| SET-2 | med | **fixed** | **Ten sections in one unbroken scroll** — world, reading mode, theme, travel modes, continuity, calendar, manuscript, timelines, database health, folder sync, export — with no tabs, jump links, or section index. | **Eleven, counted.** Settings now opens with a sticky index of chips, one per section, that scrolls to it. **The index is read from the sections themselves rather than from a list kept beside them:** half of them are conditional — the world block is hidden in reading mode, sync and calendar appear with their data — so a hand-maintained list would eventually offer a chip that scrolls nowhere. A `MutationObserver` keeps it honest, and the test that proves it toggles reading mode and watches nine sections leave. **Below three sections the index does not render**, which is what reading mode leaves: an index of two is more chrome than the scrolling it saves. |
| SET-3 | low | **fixed** | **Inline pencil affordances.** Name and Description are edited through small pencil glyphs, the Description one floating at the right of a three-line paragraph with no clear anchor. | **Both were 12px and neither had an accessible name at all** — no `aria-label`, no `title`, no text — which is the same defect as **X-12** and **LORE-1** and is not what the finding was about. **EV-3** already settled the pattern for this exact shape: *its read view is the control that opens the editor, so the thing you want to change is the thing you click*. The name row and the description paragraph are the buttons now, named *Edit world name (currently …)* and *Edit world description*, with the pencil kept inside as a cue rather than being the whole target. The empty description also stops announcing its own absence — *No description yet.* becomes the placeholder *Describe your world…* on the control that fills it, which is **X-4** rule 3. |

### One more cross-cutting

| ID | Severity | Status | Finding |
|---|---|---|---|
| X-8 | med | **one claim of four holds; the rest measured false** | **The shipped examples leave several features undemonstrated.** *The Fellowship of the Ring* has no scene prose (so Manuscript, Find & Replace, Focus mode and Cast Balance are all empty), no calendar (so the Calendar view is a dead end), and no cover image (so its world card shows the generic glyph). Someone exploring the flagship example meets four blank screens in a row and has no way to know the features work. | **Counted across all twenty examples rather than one.** <br><br>**No scene prose — true**, of every example, and staying that way deliberately. These are unofficial references to other people's novels, so the choice is between reproducing their text and inventing pastiche, and invented prose inside a reference to a real book is worse than none. <br><br>**"So four screens are blank" — false for three of the four.** *Cast Balance* falls back to scenes on stage when there are no words (`usesWords = totalWords > 0 && maxWords > 0`), so it ranks the cast and warns about dormancy exactly as it would with prose. *Find & Replace* and *Export* are **disabled**, not empty — measured under **MS-1**, which withdrew the same claim from the other direction. *Focus mode* is a per-scene surface that opens and works on an empty scene. Only *Manuscript* is blank, and it says why: *"No prose yet — write scene prose on your events, and it stitches together here."* <br><br>**"No calendar" — false as a statement about the examples.** **Fourteen of the twenty ship one**, with an in-world date pinned on every scene: Dracula, Around the World in Eighty Days, The Count of Monte Cristo, Pride and Prejudice, Treasure Island and nine more. The four without are the secondary-world ones — Fellowship, The Two Towers, The Name of the Wind, The Wise Man's Fear — whose reckonings carry **intercalary days**: the Shire's Yule and Lithe, the Four Corners' span days. **This entry first said the model could not express them. That was wrong, and the correction is worth keeping** — every consumer already walks `months` as an ordered list of named runs of days and only ever asks how long each is, so a one-day entry always worked arithmetically. What did not work was reading: *"1 Midyear's Day"* rather than *"Midyear's Day"*. The limitation was presentational, which is an order of magnitude smaller than "cannot be expressed", and it is fixed — see the `intercalary` flag added alongside this entry. What is still out of reach is a year that changes shape, so leap days (the Shire's Overlithe) have no rule behind them; a calendar needing one is right in every ordinary year and a day out in the leap ones. **Giving the four examples a calendar is now possible, and is deliberately not done.** Two of them — The Two Towers and The Wise Man's Fear — already carry an `inWorldTime` on **every** scene, 93 and 154 of them, which render as *Day N*. Attaching a calendar turns those 247 neutral day counts into 247 confident dates, and they are only right if both the reckoning and the timeline's `dayOffset` anchor land on what the book actually says. The anchor is available (`dayOffset` exists for exactly this), but the Shire's Overlithe is not, so a shipped Shire Reckoning would be right in ordinary years and a day out in leap ones — on data the reader can check against the appendices. That is **MW-9**'s mistake with a larger surface: a wrong number is worse than none precisely where someone might rely on it. It waits for a leap rule. And the "dead end" half went with **CAL-2**: an unconfigured Calendar screen now starts one where you stand. <br><br>**"No cover image" — false.** All twenty `.pwk` files carry a `coverImageId`. The placeholder the finding saw is a cover whose *bytes* live in the `.pwb` bundle that was not downloaded — see **SEL-3a**, where the same mistake was made and the placeholder now says which of the two it is. <br><br>`e2e/exampleCompleteness.spec.ts` pins the three fallbacks that would quietly turn into blank screens: Cast Balance ranking by scenes with no word readout, Manuscript's empty state paired against writing one word and watching it go, and the tools flipping from disabled to enabled with it. Two mutations red. |

---

## 18. A writing session — chapter detail with real content

Not screenshots this time: opening chapter twelve of *The Fellowship of the
Ring* to work on it, reading who is in the scene, leaving a note, opening the
brief alongside, and tracing a route on the map.

**Verified working.** *Writer's Notes* takes a note, says **Auto-saved**, and
the note is still there verbatim after a full reload. Checked by asserting the
exact text, not the presence of a textarea.

| ID | Severity | Status | Finding |
|---|---|---|---|
| CD-1 | high | **fixed** | **The Character States panel leads with everyone who is not there.** On *Ch.12 — Flight to the Ford*, a scene with five named characters, the panel's dominant content is **"36 characters not in any event:"** followed by Arwen, Barliman, Barrow-wight, Bilbo, Bill Ferny, Boromir, Cave-troll, Celeborn, Durin's Bane, Déagol, Elendil, Elrond… each marked *no snapshot*. The writer's question is "who is here and what state are they in"; the screen answers with a roll-call of the absent. The five who *are* in the scene are listed in the event card on the left instead. | **Fixed.** The panel is built from the scene's cast (`involvedCharacterIds`) rather than from whichever snapshots happen to exist, so a named cast member with nothing recorded appears as *in the scene, no state recorded* instead of vanishing. Everyone else in the world is folded into one line — *"36 other characters not in this chapter"* — that opens on click. The logic is `src/lib/chapterCast.ts`, unit-tested, and each of the three rules was mutation-checked.
| CD-2 | high | **fixed** | **Opening a chapter does not put you in it.** After opening Ch.12 the cursor still reads *All chapters* — so every per-moment tool stays dark. Measured in the same session: the **Writer's Brief opened empty**, still saying *"Select an event from the timeline bar to see the brief"* while chapter twelve was on screen. A writer who opens a chapter to draft it has to go and find the bottom bar and set the cursor by hand before the app will tell them anything about the moment. **Fixed**, and it is the same defect as OP-5: nothing set the cursor. Opening a chapter moves it to that chapter's first scene, unless the cursor is already inside the chapter — a writer who set it to a scene and then opened that scene's chapter has already said where they want to be. Never while reading, where the cursor is the reader's own place. Two things the wiring turned up: the live query still holds the previous chapter's rows for a render after the route changes, so settling on those reproduced the bug one chapter later; and a reload cannot test "leave it alone", because the store rehydrates its persisted cursor after the effect has run. |
| CD-3 | low | **fixed, one half corrected** | **`Day 6223`** sits as a badge on the event. With no calendar configured that is a raw day count from an arbitrary zero, presented with the same weight as the scene's status and tension. | **The chip says the date when the world keeps a calendar.** The app already has the machinery and already uses it — the Writer's Brief reads `calendar ? formatInWorldDate(…) : 'In-world day N'` — and the scene card was the one place holding the raw number where a date was available. It now reads *5 Thawmonth, 998 AC*. **Two corrections.** The zero is not arbitrary: it is the story's first scene, and the chip's hover said so already. And the chip does **not** carry the same weight as status and tension — status is a saturated coloured button and the day chip is `--muted` on `--muted-foreground`, the quietest thing in the row. What was wrong with it was that the number meant nothing, not that it shouted. Without a calendar there is nothing truer to say, so it stays a day count, grouped. `e2e/countsAndDates.spec.ts` drives both states on one world and asserts the day count is *gone* once the date appears, so neither half can pass by showing both. |

**CD-1 and EV-2 are the same fault from opposite ends.** On an empty world the
Character States panel is blank with no explanation; on a full one it is packed
with irrelevance. Neither version keys off the scene's actual cast, which is
the only thing the panel is for.

### Drawing a route

Three attempts failed to complete a route. The fourth traced the cause, and the
cause is the finding rather than an excuse.

| ID | Severity | Status | Finding |
|---|---|---|---|
| RT-1 | med | **fixed** | **Save route is disabled until the route is named, and nothing says so.** The control exists and is well labelled — *Save route*, with a tick. It is `disabled` while `waypoints.length < 2 \|\| !name.trim()`. Placing three points and pressing it therefore does nothing at all, silently, because the *name* field above is empty. The HUD does show a live "3 points" counter, which hints at the waypoint half of the condition; there is no equivalent hint for the name, no required marker on the field, and no tooltip on the dead button. See **X-9**. | **Fixed** by **X-9**'s pattern, and it names both halves: *"Needs a name and two points."* narrows to *"Needs a name."* as points are placed. The region HUD had the same fault and is fixed with it.

**The route HUD is otherwise well made** and worth saying so: it opens with
*"Drawing route — click anywhere to add points"*, offers the six route types as
chips, names each waypoint as you place it (*Point*, or the marker's name if you
click one), keeps a live point count, and has Undo beside Save.

**The route detail panel is still unreviewed** — but now for a known reason
rather than an unexplained one.

---

## 19. The AI generation dialogs

Ten of them exist. Nine share one component (`GenerateSectionDialog`) through thin
per-section wrappers; `ChapterAIDialog` and `MapAIDialog` are bespoke. This is the
route by which most of a world's content is meant to arrive, so it was driven
rather than read: a world spec into the generator, and a nested locations tree —
regions, sub-places, and a keep with floors — into the locations dialog.

**The shared dialog is the best-designed surface reviewed so far**, and that is
worth stating before the findings. It numbers the four steps in order, shows the
whole prompt in a scrollable pre with a sticky *Copy prompt* button, parses as you
type, previews the count *before* committing (*"Ready to import 5 locations. New
ones are added; ones that already exist are updated in place."*), reports the
result afterwards (*"Added 3 characters"*, with updated/unchanged counts), and
swaps *Cancel* to *Done* once it has run. The locations prompt even feeds the
existing place tree back to the assistant so it extends the world instead of
duplicating it. Nothing else in the app explains itself this well.

| ID | Severity | Status | Finding |
|---|---|---|---|
| AI-1 | high | **fixed** | **Fenced JSON was rejected as invalid by half the parsers.** Every prompt ends with "no markdown fences"; assistants add them anyway. `sectionImport` stripped them, `MapAIDialog` stripped them with its own private regex, and **`worldSpec` and `ChapterAIDialog` did not strip them at all** — so a first-time writer pasting a perfectly valid, fenced world spec was told *"That isn't valid JSON."* about JSON that is valid. The two bespoke dialogs, the ones a writer is most likely to reach for first, were the two that failed. Fixed: `stripCodeFence` moved to `src/lib/codeFence.ts` and all four parsers now share it. |
| AI-2 | low | **fixed** | **Unrecognised keys are dropped in silence.** A tree that put a floor's rooms in `levels[].locations` instead of the documented `levels[].children` imported "successfully": the floors were created empty, the two rooms vanished, and nothing anywhere said so. The count line was honest — it said 5, and 5 arrived — so the only signal available to the writer is noticing later that rooms they asked for are missing. The prompt documents `children` correctly and this was my own malformed paste, but an assistant drifting one key from a long spec is exactly the failure this flow should catch. A "2 unrecognised fields were ignored" note under the preview would cost little. **Fixed:** the locations parser collects keys it does not recognise and the dialog shows them beside the count — *"Ignored one field this app doesn't recognise: “locations”. Anything under it was not imported."* The tests pair a drifted key against a spec in the documented shape, so the warning cannot fire on every ordinary import. The other section parsers could adopt the same helper; only locations, where nesting makes drift likely, is wired up. |
| AI-3 | low | **fixed** | **Three different messages for the same failure.** "That isn't valid JSON. Paste the JSON the AI returned." (`sectionImport`), "Could not parse JSON. Make sure you copied the full response." (`ChapterAIDialog`), "Could not parse JSON. Make sure Claude returned raw JSON only." (`MapAIDialog`). The last also names one assistant, while every dialog's own intro correctly says "any AI assistant (ChatGPT, Claude, Gemini…)". **Fixed:** all four share `INVALID_JSON_MESSAGE` from `src/lib/codeFence.ts`. A unit test asserts the message names no particular assistant and that every parser returns exactly it, paired with a parse *success* so the check cannot pass vacuously. |
| AI-4 | med | **fixed** | **Nothing survives closing the dialog.** `reset()` clears the pasted text on every close, including an accidental Escape or a click on the backdrop — and the backdrop is the whole screen. A long paste that failed to validate is gone, with no confirm and no undo, and the writer has to go back to their assistant for it. See **X-10**, now fixed, which also makes *Cancel* reachable by keyboard. **Fixed:** closing no longer clears the box. A successful import already clears it, so the paste survives only while it is still unused — no confirm needed, and nothing accumulates. |

**Not a finding, recorded so it isn't re-investigated:** duplicate map-layer names
after a levels import (two layers both called "Keep of Ash") are correct. Floor
layers are named after their marker, with the floor name carried in `levelLabel`
(`sectionImport.ts:1198`). Likewise, an early probe suggesting no result banner
appears after a locations import was a harness artefact — the banner is real
(`GenerateSectionDialog.tsx:134`) and shared by all nine wrapper dialogs.

**Still unopened in this group:** the sequel wizard, manuscript import, and the
paste-back half of `ChapterAIDialog` and `MapAIDialog` driven end to end with a
real assistant response.

---

## 20. The writing screens, with real prose in them

Everything above was driven against worlds with structure but no text. This pass
wrote a scene, revised it, restored it, and compared chapters — the loop the app
exists for.

**Focus mode is the best screen in the product.** Full-bleed, serif, generous
line height, a measure of about 75 characters, the scene title top-left and
`882 words · Esc to exit` top-right, and nothing else. It top-aligns and scrolls
correctly with 880 words in it, and the live `(+3 this session)` counter appears
as you type. I went looking for problems here and found one cosmetic one (below).

**Scene history is nearly as good.** Word-level diff, a `+23 −12 words to reach
current` summary, `Diff vs current` / `This version` toggle, and a **Restore
confirm whose copy is the best in the app**: *"The current prose will be saved as
a new version first, so you can undo this."* It then keeps that promise — I
restored, and the top-bar Undo was live afterwards.

| ID | Severity | Status | Finding |
|---|---|---|---|
| WR-1 | med | **fixed** | **The scene-draft editor is a five-line box.** In chapter detail, 882 words of prose sit in a fixed `~5`-row textarea with an internal scrollbar — you write a novel through a letterbox. There is a resize handle and a *Focus* button, and Focus mode is excellent, but the default inline experience for the app's central activity is cramped. Auto-growing the textarea to its content would cost little. | **Fixed as suggested:** the box grows to its content on every change, with the five rows kept as a floor so an empty scene does not open as a full page. **The resize handle went with it** — it existed to escape the letterbox, and hand-resizing would only be undone by the next keystroke, since auto-growing and dragging cannot both own the height. Guarded by measuring the element rather than the markup: after typing, `scrollHeight - clientHeight` must be under a line height, which is the definition of "nothing is hidden". |
| WR-2 | med | **fixed** | **The scene-history diff runs deletions and insertions together with no separator.** `"years, and it showed.years."`, `"onea solidsingle piece,seized lump"` — the red strikethrough run and the green inserted run are adjacent with no space, so short substitutions read as garbage and the writer has to mentally unpick which half is which. A thin gap, or a `→`, or side-by-side columns would fix it. The diff itself is correct; only its typography is at fault. **Fixed:** each changed run is now a padded pill with a margin, and `splitEdges` keeps the highlight off the surrounding whitespace so the block hugs the words that actually changed. `e2e/sceneHistory.spec.ts` measures the gap between adjacent highlights and reports `0px apart` without the change. |
| WR-3 | low | **already fixed by X-1, now guarded** | **The watermark bleeds into Focus mode.** X-1's diagonal background band is faintly visible behind the prose on the one screen whose entire purpose is to remove everything but the prose. | **There is nothing left to bleed.** `--app-image` is `none` on `:root` and on every theme, so the band the finding describes cannot be drawn anywhere. Measured in the running app: the document's `background-image` resolves to the theme gradient and `none`. **The mechanism is still worth a guard**, though, because it is not obvious from the markup: the app's own `body` is deliberately translucent over that gradient — measured `rgba(15, 23, 41, 0.43)` — and the only reason focus mode is exempt is that its overlay paints an opaque surface of its own. `e2e/focusMode.spec.ts` asserts the overlay's alpha is exactly 1 and that it carries no image, paired against the body's alpha being under 1 in the same test, so the assertion is about focus mode rather than about every surface in the app. Dropping the overlay to 0.9 turns it red. |
| DF-1 | med | **fixed** | **Chapter Diff is invisible until you activate an event.** Measured: `Compare chapters` is present **0** times on the timeline, and **1** time after clicking an event in the playback bar. A headline feature is gated behind an unrelated action with nothing to hint at the connection — opening a chapter is not enough, and neither is selecting one. | **All three DF findings are one design mistake:** the tool took its base side from the time cursor and nothing else, so the button was gated on `!!activeEventId`. Comparing two chapters needs *two chapters*, so that is what the button is gated on now — and with one chapter it is correctly absent, since there is nothing to compare against. |
| DF-2 | low | **fixed** | **Chapter Diff opens empty when only one comparison is possible.** With two chapters in the world, the base is filled in (`Base: Ch. 1 — The Gate`) and the other side is an unselected `Compare with…` whose only real option is Ch. 2. Measured: preselected value `""`. With exactly one candidate it should be chosen. | **Fixed, and the base became a control rather than a readout.** Both sides are seeded when the panel opens — the base from the cursor's chapter if there is one and the first chapter otherwise, the comparison from the next chapter along. Two bugs in the first draft of this, both caught by the tests rather than by reading it: the body still gated on the cursor's chapter, so the panel said *"Select a chapter from the timeline bar first"* while showing two chapters in its own selects; and choosing the comparison chapter as the new base left both sides on the same chapter, diffing it against itself. |
| DF-3 | med | **fixed** | **"No recorded differences" is the answer a writer gets for two chapters full of prose.** The diff compares each chapter's *last event's snapshots*, so two chapters with events, scenes and 880 words of text report no differences until someone has set character states by hand. The sentence is technically true and completely misleading; it should say what it compared and what it needs. | **Fixed by separating the two cases**, which the one sentence had been covering for. *Nothing was recorded to compare* now says so, and says what the tool reads — where each character is, what they carry, how relationships stand, where items are, as recorded at each chapter's last scene — and what it does not: scene prose and word counts. *Both chapters have state and it matches* keeps a sentence of its own, which is the only case where the original wording was ever true. |

## 21. Which overlays close on Escape — and which don't

Not a general grumble: measured in one run, so a stuck key or a dead page would
have shown up on every line instead of two.

```
Writer's Brief      open → Escape → closed   ✓
Continuity Checker  open → Escape → closed   ✓
Recent changes      open → Escape → STILL OPEN
Chapter Diff        open → Escape → STILL OPEN
```

The first three are opened from the same top-bar cluster, one beside the other.

| ID | Severity | Status | Finding |
|---|---|---|---|
| X-16 | med | **fixed** | **Typing while a scene save is in flight loses those keystrokes.** The editor keeps `draft === null` for "show the stored value" and a string for unsaved edits. Saving awaited the write and then cleared the slot *unconditionally*, so anything typed during the write was discarded and the box snapped back to the text that had just been saved — no undo entry, no revision, nothing. The window is small, since the save runs on blur, but it is not theoretical: the **Focus** button saves while the editor stays open and keeps taking input. Not filed by the review; found because the scene-history spec typed a second draft the instant the first was stored, lost it, and then waited for a revision that could never be captured. `draftAfterSave` (`src/lib/draftHandoff.ts`) hands back to the stored value only when nothing was typed meanwhile. **Left alone, and worth knowing:** two saves racing each other can still both read "nothing stored yet" and neither capture a revision — blur-driven saves are serialised by how fast a person can click, and a save queue is more machinery than that earns. |
| X-15 | med | **fixed** | **The spoiler confirm can be skipped by clicking too early.** *View all chapters* asks a reader before revealing the whole book — but the reveal gate reports itself inactive **while the world is still loading**, which is indistinguishable from "this world is being written". A click landing in that window took the writing path and cleared the cursor outright, discarding the reading position and revealing every character, place and subplot the story had not yet introduced. Not filed by the review: it surfaced as a **flaky test**, failed three times across the session, and was waved through twice as load-related before the retry loop in its own helper turned out to be compensating for it. `revealAllAction` (`src/lib/revealAll.ts`) now distinguishes *not loaded yet* from *not gated*, and the control waits rather than guessing — the same rule the router's `WritersOnly` guard already applied for the same reason. The helper's retry loop is gone, so a regression fails instead of being retried away. |
| X-11 | med | **fixed** | **Escape closes some overlays and not others, with no pattern a user could learn.** `WritersBriefPanel` and `ContinuityChecker` register their own `keydown` handlers; `RecentChangesPanel` (`src/features/history/RecentChangesPanel.tsx`), `ChapterDiffModal` (`src/features/diff/ChapterDiffModal.tsx`) and `HelpPanel` (`src/features/help/HelpPanel.tsx`) register none, because both are hand-rolled overlays rather than the shared `Dialog`. Backdrop click closes both, so neither traps you — but the key that works everywhere else silently does nothing. **Fixed:** all three now register the same handler — the Help panel turned out to have the same gap, found when a test could not click past its full-screen overlay. `e2e/overlayDismissal.spec.ts` drives all four in one test, so a broken key would take every line down together rather than looking like a real result. **Reopened and re-fixed later in the review.** The claim above — that all three "now register the same handler" — was not true of the Continuity Checker: it closed off its container's React `onKeyDown`, which only fires once focus is *inside* the panel, and focus was handed over by a `setTimeout(…, 0)`. Press Escape before that ran and the key went nowhere. It failed roughly one run in eight under a loaded suite, and was invisible as a *bug* because the test's marker was a page-wide `getByText(/Continuity/)` — so "the overlay closed" really asserted "no word like that is anywhere on screen", and the failure read as a flake. Tightening the marker to the labelled `role="dialog"` made it a real failure; the panel now registers a document listener like the others, guarded by `defaultPrevented` so the inline suppress-reason field's own Escape still wins. A test that blurs focus out of the panel first reproduces the old behaviour every time rather than one run in eight. |
| X-12 | med | **fixed** | **Chapter Diff's close button has no accessible name.** Measured: `text="" aria-label=null title=null` — a bare `<X>` icon in the header. A screen reader announces "button". Compare the shared `Dialog`, which gives its close button an `sr-only` "Close". **Fixed:** the panel is now a labelled `role="dialog"` and its close button carries `aria-label="Close chapter diff"`. |
| X-13 | med | **fixed** | **One Escape closes a confirm *and* the dialog behind it.** Restoring a scene version opens a confirm stacked over Scene history. Escape — the natural way to back out of a confirm — dismissed **both**, measured: `confirm 0, history 0`. Because `Dialog` listens on `document` and never checks whether it is topmost, cancelling the inner decision also throws away the outer context. Part of **X-10**. |

**The Recent changes drawer is otherwise good** — a plain reverse-chronological
list of journalled operations (*Added event "The gate"*, *Added chapter "The
Road"*, …) with relative timestamps. One note: only the topmost row carries an
*Undo*, which is correct for a linear stack but is never explained, and the
other rows look identical and inert.

## 22. Reading mode

Downloading a book from the Library drops you straight into it. It is a real
second product: its own warm sepia theme, a serif face, a reduced nav (no
Manuscript, Structure, or Corkboard), and a dashboard whose every figure is
scoped to how far you have read — *"6 / Characters / you have met so far"*,
*"maps you have reached"*, *"between characters you have met"*. Advancing the
cursor from ch.1 to ch.3 took the cast from 6 to 10, and the roster carries an
honest notice: *"Reading mode — 44 characters not yet met by chapter 1 are
hidden. Move the chapter cursor forward to reveal them."* The idea is good and
mostly well executed.

| ID | Severity | Status | Finding |
|---|---|---|---|
| **RD-1** | **med** | **fixed** | **The spoiler guard fails open for entities with no recorded appearance.** `isRevealed` (`src/lib/spoilers.ts:135`) returns `true` for any entity that appears in no event, documented as a deliberate choice so standalone reference material isn't hidden forever. In *Philosopher's Stone* that class is 3 of 50 characters, 1 of 16 items and 10 of 40 locations, and they bypass the cursor on every screen that lists them. Measured leaks at chapter 1, after excluding everything the reader's own book already prints (see the correction below): **Charlie Weasley** on Characters, Maps, Relationships and Arc; **Flying Motorcycle** on Items; **Godric's Hollow** on Maps. Two causes, both fixable: the fail-open default, and a fixture leaving those entities linked to no event. For a guard, fail-**closed** with an explicit opt-out — a `revealAt: 'always'` flag for genuine reference material — is the safer default, and would make the fixture's gaps visible instead of silent. |
| **RD-2** | **high** | **fixed** | **The guarantee spec cannot catch RD-1.** `e2e/spoilerGuarantee.spec.ts` walks every route asserting no unmet name appears — but its ground truth, `unmetNames` in `e2e/helpers/unmet.ts`, computes `hidden = f !== undefined && f > cursor`: the *same* fail-open rule as the implementation. An entity with no appearance is never counted as unmet, so it can never be reported as leaked. The test is real and does catch genuinely-linked characters; it is simply blind to the entire class that RD-1 is about, because it was written against the implementation's definition of "unmet" rather than the reader's. Fixing RD-1 without fixing this helper would leave the regression unguarded. |
| RD-3 | med | **fixed** | **The screen you land on is the one screen that never says "reading mode".** Measured: the phrase appears 0 times on the dashboard, where the Library drops you, and the mode is inferable only from a changed theme and sublabels like "you have met so far". Every roster explains itself properly. The landing screen should too, and should say how to leave. | **A notice under the world's name**, carrying all three things the finding asked for: that the mode is on, where the reader is and what that is holding back — *You are reading up to chapter 4, so 12 characters, 4 places and 2 items you have not met stay hidden until you reach them* — and a link to the settings screen that turns it off. Groups with nothing hidden are left out rather than reported as zero, and once the whole book is revealed it says so instead of naming a chapter. |
| RD-4 | low | **already fixed, now guarded** | **`Character Arc` shows an em-dash where every other card shows a number.** `—` reads as "unknown" rather than "nothing yet"; the five cards beside it all show a count. | **Fixed in passing by DASH-2**, which replaced the em-dash with a chevron on every tile that counts nothing — *a tile with no count is an action, not a statistic*. Reading mode is where the finding saw it, and no test covered that screen: `dashboardTiles.spec.ts` drove the writing dashboard only. It now reads the tile's number slot in reading mode and asserts it holds no character at all and two glyphs — the tile's icon plus the chevron — beside a counting tile on the same screen that holds a number and one glyph. Putting the em-dash back turns it red. |
| RD-5 | med | **fixed** | **Reading mode inherits X-7 at its worst.** Character cards on the reading-mode roster are not links or buttons — measured **0** links in `main`. A reference companion whose entire job is "tell me who this is" gives the reader no way to open anyone from the cast list by keyboard. **Fixed by X-7** — the roster cards are links now, in reading mode as well as writing mode. `readingMode.spec.ts` had encoded the old behaviour in its locator (`main div.cursor-pointer`, with a comment saying "Roster cards are clickable divs, not buttons"), which is exactly the kind of test that quietly pins a defect in place; it now clicks the link. |

### What the fix did, and what it turned up

`RD-2` first, so the guard had something that could fail: `unmet.ts` now counts an
entity with no appearance as unmet (`f === undefined || f > cursor`). The
guarantee spec immediately went red with **16 leaks across 6 routes** — Charlie
Weasley on Characters, Maps, Relationships and Arc; Trevor on four; Godric's
Hollow, Hogwarts Castle and London on Maps; Flying Motorcycle on Items.

`RD-1` then made `isRevealed` fail closed. That is affordable precisely because
"all chapters" still returns `true`, so an unplaced entity is late rather than
lost — the reveal-all control brings it straight back. Fifteen of the sixteen
leaks closed.

The sixteenth was a **second, unrelated gap**, found only because the guard could
finally report it: a faction's *Territories* list rendered regions and location
markers straight from Dexie without passing either through the gate. Now fixed
(`FactionsView.tsx`), and it is the kind of bug that only ever surfaces when a
test is allowed to fail.

| ID | Severity | Status | Finding |
|---|---|---|---|
| RD-6 | med | **fixed** | **A faction's territories bypassed the reveal gate.** `mapRegions` and `locationMarkers` were queried by `factionId` and rendered directly, so a faction's holdings could name a place the reader had not reached. Both now go through `gate.filter`. |
| RD-7 | med | **fixed** | **The factions list itself is never gated, and disagrees with search.** `gate.filter` is applied to a faction's members, stance and territories, but never to the roster of factions — so every faction in the world is listed at chapter 1, descriptions included. `SearchPalette.tsx:115` gates factions by membership (`isRevealed(member) && hasReached(startEvent)`), so the same faction can be hidden in search and listed on the Factions page at the same cursor. One of the two is wrong; the search rule looks right. **Fixed:** the rule moved into `useFactionReveal`, which both screens now share, so they cannot drift apart again. At chapter one of *Philosopher's Stone* the roster keeps *The Dursley Household* and drops *Voldemort and His Servants* and *Slytherin House*. Also fixed the last spoiler-guarantee failure by rewording one faction description that happened to contain a location's full name — the collision was in authored prose, not a listing, so the fix was the copy rather than the matcher. |

### Found while testing the fixes above

Two defects that no amount of screenshot-reading would have surfaced — both came
out of trying to *write a test* and finding the app would not cooperate.

| ID | Severity | Status | Finding |
|---|---|---|---|
| ON-1 | **high** | **fixed** | **"Skip and explore on my own" did nothing.** The dashboard keeps the onboarding wizard mounted via a latch that arms whenever the world has no timeline *or no events*. Skipping set the latch false — and the effect immediately set it back, because the trigger condition was still true. So the escape hatch was a no-op for **every world the wizard appears for**, and a new user could not reach their own dashboard without first creating an event through the wizard. Fixed with a separate "dismissed" flag the latch respects. Guarded by `e2e/readingModeToggle.spec.ts`. |
| ON-2 | med | **fixed** | **The wizard does not notice work done elsewhere.** Create a timeline *and* a chapter on the Timeline screen, return to the dashboard, and it still opens at step 1 of 4: *"Your story begins with a moment — give your timeline a name."* The latch keys off `eventCount === 0`, so the wizard is right that something is missing, but it asks for the one thing the writer has already done. It should open at the step that matches the world's actual state. **Fixed** the cheaper way: the wizard triggers on `timelineCount === 0` alone, so it greets a world with nothing in it and leaves alone one that has been started. |


### Correction to RD-1, from the depth pass

The first version of RD-1 led with *"Nicolas Flamel is on the roster at chapter
1 — the book's central late reveal."* **That was wrong, and the severity has
been dropped from high to med because of it.**

Re-running the check against the project's own definition of benign text — the
book's title, description, and chapter titles, all printed in the reader's
physical copy — shows **"Nicolas Flamel" is the title of chapter 13**. It is on
the contents page of the paperback. PlotWeave showing that name gives away
nothing the reader's own book does not, which is precisely the rationale
`e2e/helpers/unmet.ts` already documents. *Trevor* likewise falls under the
short-name threshold and is no more identifying than "the toad".

My first pass used an ad-hoc benign list rather than the real one, and the
headline example did not survive contact with it. The mechanism is still real —
the orphan class does bypass the cursor, and RD-2 still means nothing can catch
it — but it is a latent hole with three modest leaks today, not a spoiled book.

### And the part that works: the gate holds everywhere else

Same run, all eleven reading-mode routes, against every character, item and
location the reader has demonstrably not reached:

```
dashboard  timeline  characters  maps  items  relationships
calendar   arc       lore        factions     knowledge
                    → LATE-leak: 0 on every one
```

**44 late characters, 15 late items and 29 late locations, and not one of them
appears anywhere.** For everything the gate has data about, it is airtight
across the whole app — including screens like Arc, Factions and Knowledge that
nothing in this review had previously opened under a cursor. That is the
stronger half of the story and it should not be lost behind RD-1.

**The Library itself is good** and needs no findings: honest sizes on every
button (`Download (323 KB)`), per-book counts, a blurb, a rights notice on each
entry, and a download that lands you in the world with the cursor already at the
opening moment rather than at "all chapters".

---

## 23. Phone widths (390×844)

Swept every world-scoped route at 390px, measuring page overflow and tap-target
size rather than eyeballing screenshots.

**The layout itself is sound and deserves saying so.** `documentElement.scrollWidth`
equals `clientWidth` — **390 on every single screen**. Nothing pushes the page
sideways. The nav collapses to a hamburger, the cursor chip shortens to `Ch.1`,
the pacing curve redraws at width, and the Character Arc grid (2004px wide) scrolls
inside its own container instead of dragging the page with it. That is more than
most apps this size manage.

The findings are about what happens *inside* that correct frame.

| ID | Severity | Status | Finding |
|---|---|---|---|
| **PH-1** | **high** | **fixed** | **The map does not fit its content on a phone.** Measured, same world, same wait, one run: **desktop 1440×900 → 5 of 5 markers visible; phone 390×844 → 2 of 5**. **Cause:** both `fitBounds` and `getBoundsZoom` clamp to the map's current `minZoom`, and Leaflet's default is 0 — the zoom at which a `CRS.Simple` image draws 1:1. `MapContainer` sets no `minZoom`, so any image larger than its container could never be fitted; the fit clamped to 0 and the map opened on the middle of the image. `setMinZoom` was then called *after* the fit, too late to help it. Fixed by opening the floor before fitting and adopting the fitted zoom as the new floor afterwards, so a reader still cannot zoom out past the map. Guarded by `e2e/mapFit.spec.ts`, which fails by 125px without the change. Three markers sit outside the viewport on arrival, and two labels cross the edge — *"Hogwarts School of Witchcraft…"* spans `[207..590]` on a 390px-wide screen, so most of it is simply not there. The background image layer loads in both cases, so this is the initial fit-to-bounds, not a loading race. On the one screen whose entire job is showing where things are, a phone user arrives looking at empty ground. |
| PH-2 | med | **fixed** | **The time-cursor controls are 20×24px.** `Previous moment`, `Next moment` and `View all chapters` measure 20×24; `Play story on the map` is 18×18. These drive the time cursor — the app's central concept — and on a phone they are less than half the 44px WCAG target, set side by side, with a destructive-adjacent `✕` (clear cursor) in the same cluster. **Fixed:** the step buttons are now 32×32, matching every other icon button in the top bar, and the `✕` is set apart from *next moment* rather than sitting 2px from it. Deliberately **not** `.pw-tap` — that utility centres a 44px hit area and its own guidance is to use it only on well-spaced controls; here *previous moment* sits ~6px from the brand button that navigates out of the world, so overlapping 44px zones would make the neighbours easier to hit by accident, not harder. Reaching a true 44px needs the bar re-laid-out, which is a design change rather than a fix. |
| PH-3 | med | **fixed** | **Chapter rows spend their width on controls and truncate the only identifying text.** At 390px: *"Ch. 2 — The Vanish…"*, *"Ch. 4 — The Keepe…"*, while `Set Active` + an open-in-new icon + a delete icon take roughly 40% of the row. The title is the one thing that tells the rows apart. *Left open deliberately:* the fix is a trade — shrink `Set Active` to an icon on narrow screens and the row reads better but its most-used action gets less discoverable. That is a design call. **Resolved** the other way: the row wraps below `sm`, so the title gets the whole first line and the controls fall to a second — spending vertical space, which a phone has more of, and keeping every control labelled. |
| PH-4 | low | **partly corrected, partly fixed** | Filed as "the easiest thing on the row to hit by accident". **Half of that was wrong:** deleting a chapter opens a `ConfirmDialog` naming the chapter and warning that its events go too, so a mis-tap costs a dismissal, not a chapter. What *was* real is that the button had **no accessible name at all** — measured `text="" aria-label=null title=null`, and the only nameless control on the entire timeline screen, where a screen reader announced it as "button" next to a properly-titled *Open chapter detail*. Now labelled, and `e2e/buttonNames.spec.ts` sweeps the screen for the whole class rather than that one instance. |

**Not filed, checked and cleared:** the `right≈478` overflows reported by my
first sweep on six screens are the bottom playback bar's scrubber strip, which
scrolls horizontally by design and does not move the page. The Character Arc
table's 2004px width is likewise contained.

---

## 24. Help, settings, the writer dashboard, manuscript import, the sequel wizard

The last of the never-opened screens. Three of the five need no findings at all,
which is worth recording as carefully as the problems.

**The reading-mode setting has the best explanatory copy in the app:** *"Present
this world to someone reading the book rather than writing it. Characters, items
and places the story has not introduced yet are hidden until the chapter cursor
reaches them, and the writing screens step aside."* — followed, when it is on, by
*"If this world came from the library, note that downloading it again restores
the original and discards your changes — export it first if you want to keep
them."* That warns about a destructive interaction nobody would have guessed at.

**Manuscript import** explains its own format without being asked: *"`#`/`##` or
'Chapter …' headings become chapters, and lines like `* * *` split scenes"*, with
both a file picker and a paste box.

**The sequel wizard is a genuinely well-designed feature.** *"Pick what carries
over — relationships continue from where they ended, and the previous story can
become reference lore. The new book is a copy; editing it won't change the
original."* Three checkboxes, each explained in a clause: seed an opening chapter
at each character's ending state; turn the story into "Previously…" lore, one
recap page per chapter; carry world-building lore forward.

**The writer dashboard** is dense and useful — 17 chapters / 58 events, 43 alive
/ 7 dead, 100% arc snapshot coverage (58/58), Recent Events with chapter
attribution, a Scene Status bar, and a Cast Balance panel whose best line is a
sentence rather than a number: *"Draco Malfoy — drops out for 4 chapters
mid-story."* That is the kind of observation a writer actually acts on.

| ID | Severity | Status | Finding |
|---|---|---|---|
| SQ-1 | med | **fixed** | **The sequel wizard is filed under export.** Measured on the selector: the word "sequel" appears **0** times at rest, **0** on hover, and **1** only after opening a world card's overflow menu — whose own label is *"More export options"*. The control is properly named (see SQ-2, withdrawn); the problem is that its name advertises exports and nothing else, so starting book two of a series — for an app whose pitch is tracking a series — sits behind a menu a writer has no reason to open unless they want to export. Renaming the menu, or promoting the sequel action out of it, would be enough. **Fixed:** the menu is *More actions* rather than *More export options*, so its name no longer contradicts half its contents. |
| SQ-2 | — | **withdrawn** | **Filed as "three unlabelled buttons on every world card" — that was wrong.** All three carry `title` attributes (*Export world (single file)*, *More export options*, *Delete world*), which do contribute to the accessible name: `getByRole('button', { name: … })` matches each one. My probe logged only `aria-label` and text content, so a real label looked like an absent one. Nothing to fix here. |
| HP-1 | med | **fixed** | **The Help panel documents screens the current mode has removed.** In a reading-mode world it still lists *"Corkboard & manuscript"*, *"Timeline & chapter AI"*, and the other writing topics, though the nav has hidden all of them. Help should follow the mode, or say which topics apply to the writer's view. **Fixed:** sections describing screens and tools reading mode removes are marked `writerOnly` and drop out of the panel. The test pairs the hidden topics with ones that must survive, so "hidden" cannot quietly mean "the panel failed to render", and checks they all return when reading mode is turned off. |
| ST-2 | low | **fixed** | **The reading-mode toggle labels its state, not its action, in one direction only.** On: *"Reading mode is on"* — a status. Off: *"Turn on reading mode"* — an imperative. So the control changes grammatical mood depending on state, and in the "on" state gives no hint that clicking changes anything. It also carries no `aria-pressed` (measured: `null`) despite being a toggle, so assistive tech is told neither that it toggles nor what it currently is. **Fixed:** the label is an action in both directions (*Turn on* / *Turn off reading mode*), `aria-pressed` carries the state, and the sentence "Reading mode is on." moved beside the button where it belongs. |
| X-14 | low | **fixed** | **An em-dash stands in for "nothing to report" on stat cards, ambiguously.** `Continuity — check for issues` on the writer dashboard, and `Character Arc —` in reading mode, sit beside five cards showing real numbers. On the Continuity card especially, `—` could mean "no issues", "not run yet", or "unknown", and those are very different things to a writer about to hand in a draft. (Supersedes **RD-4**, which is the same tic on a different card.) **Fixed:** a tile with no count is an *action*, not a statistic, so it now shows a chevron — "this goes somewhere" — instead of a value that looks missing. |

**Not filed, my error rather than the app's:** an earlier probe reported the
reading-mode toggle as having no control role and being unclickable. It is an
ordinary `<Button>`; my probe was looking for `switch`/`checkbox` roles and so
never clicked it. The toggle works — `Reading mode is on` → `Turn on reading
mode`, and the nav regains Manuscript, Corkboard and Structure immediately.

---

## 25. Depth pass: overlays at 390px

X-10 was filed from a source read — no `role`, no `aria-modal`, no focus trap on
the shared `Dialog`. This pass measured what that costs on a phone, where an
escaped focus ring has nowhere good to go. Ten Tab presses per overlay, counting
how many land outside it:

```
Add Character dialog        7 of 10 Tabs land OUTSIDE   ← focus escapes
Generate Characters dialog  5 of 10 Tabs land OUTSIDE   ← focus escapes
Search palette              0 of 10 Tabs land outside   (trapped)
```

**The palette is the control, and it is the proof.** All three ran in one pass,
same key, same viewport. The only one that holds focus is the one already using
`useFocusTrap` — the hook added to `SearchPalette` earlier in this review. So
X-10 is not just real, it is real *and* the remedy is already in the codebase,
applied once, three lines from being applied everywhere.

| ID | Severity | Status | Finding |
|---|---|---|---|
| X-10a | — | — | *Measurement supporting **X-10**, not a separate finding.* On a phone, tabbing out of an open dialog puts the focus ring on nav links and page content behind a full-screen overlay the user cannot see past. Sighted keyboard users lose the ring entirely; screen-reader users are never told a dialog opened. `useFocusTrap` already exists and is already proven here. |

**Otherwise the overlays behave well at 390px**, and the numbers say so:

- **Nothing overflows horizontally.** Both dialogs measure `[16..374]` inside a
  390px viewport — a consistent 16px gutter, no sideways scroll.
- **The tallest dialog in the app still fits.** Generate Characters occupies
  `[42..802]` of 844px with its prompt block, four numbered steps, paste box and
  footer. The paste box is visible without scrolling and *Copy prompt* is
  reachable — the two things that flow actually needs.

**Checked and cleared, against my own expectation:** the phone top bar shows only
a hamburger, the cursor chip and search, and I expected to find Writer's Brief,
Continuity Checker, Recent changes and Help simply missing below `lg`. They are
not. Measured phone vs desktop in one run: all four are absent from the top bar
at 390px and **all four are present in the nav menu behind the hamburger**. That
is a deliberate, correct responsive relocation, and no finding.

---

## 26. The Highbarrow writer-journey review, verified

`docs/writer-journey-ux-review-highbarrow.md` is a separate end-to-end pass,
taken at `5c7b9e1` while writing a story from an empty library. It is a good
document — its findings are specific, they name where they were seen, and its
executive summary picks the right largest problem. It was written 44 commits
behind `development`, so each finding was re-checked here before being taken on.

**Four of its eleven do not survive**, which is the same ratio this review keeps
finding in itself. Three were fixed in the interim; one was never true.

| ID | Their finding | Verdict |
|---|---|---|
| HB-1 | **Adding a scene participant gives no path to the snapshot it needs.** | **Now fixed; it was half fixed already.** The mislabelling half is gone: `charactersNotInChapter` (added after their pass) starts the panel from the scene's own cast, so an assigned character shows under their scene as *"in the scene, no state recorded"* and the folded group reads *"N **other** characters **not in this chapter**"* — their recommendation 2, already done. The action half stood: **1 of 28** issue kinds in `computeIssues.ts` carried a one-click `fix`, and `char-before-intro` only navigated to the chapter. **Fixed** — see HB-1a. |
| HB-2 | **Important inputs are not programmatically labelled.** | **Confirmed by measurement, and fixed here.** See below. |
| HB-3 | **Calendar start year reverts unless Enter is pressed.** | **The mechanism is false and the symptom did not reproduce.** The field has no Enter handler at all — it writes on every keystroke — and `CalendarEditor.tsx` is byte-identical to the commit they tested. Driving their exact sequence (742 → edit the suffix → navigate → return) persisted both values, as did a back-to-back version with no settle between. **A real hazard is left open as HB-3a** rather than dismissed: both fields `patch({ ...cal, field })` against the `calendar` read at last render, so a write to one landing inside the other's live-query round-trip spreads a stale value back over it. That produces exactly the symptom they describe. Unproven, cheap to close, and not claimed as the cause. |
| HB-4 | **Carried-forward arc states read like authored ones.** | **Fixed since, as ARC-2** — inherited cells dim to 50% with an `sr-only` *Carried forward*. Their filter suggestion (*Changes only* / *Appearances only*) is not done; Arc orders by name or appearances only. |
| HB-5 | **Untimed events pile onto the first calendar day.** | **Stands.** No derived-date marking, no *"N events need timing"* summary, no way to set elapsed time from a calendar cell. |
| HB-6 | **Recent Changes is too generic.** | **Stands, minus one part.** `describeOperation` names the entity when the payload carries a name or title, but a tension-only edit carries neither and reads *"Edited scene"*; there is no field-level detail. *"Only the newest action is undoable"* is **deliberate** — the journal is a stack and undoing from the middle would leave later operations on a state that never existed — but the panel never says so, which is their last sub-point and is fair. |
| HB-7 | **Creation flows return the writer to inconsistent places.** | **Stands, confirmed.** `CreateCharacterDialog` and `CreateItemDialog` are near-identical, but `ItemRosterView` passes `onCreated={navigate to detail}` and the character roster passes nothing. Factions select into a panel; Lore opens a full-page editor immediately. |
| HB-8 | **Thread and Motif empty states don't explain how to attach scenes.** | **Stands, with one premise corrected.** Their recommendation asks for *"a stable entity link over matching free-text tags"* — it already is one, `event.threadIds` / `motifIds`, assigned on the event card. The gap is discoverability from the dashboard, not the data model. |
| HB-9 | **Calendar configuration overwhelms Settings.** | **Stands, partly mitigated.** `SettingsIndex` (SET-2, added after their pass) gives the page a jump nav, but sections are still not collapsible, the twelve month rows still expand inline, and there are no presets. |
| HB-10 | **The wizard creates three similarly-named concepts without a preview.** | **Fixed since, as OP-3** — separate *Timeline name* and *The first scene* fields, and a sentence stating it builds the timeline, a Chapter 1 inside it, and that scene. The scene no longer inherits the timeline's name. Chapter 1's title is still not editable in the wizard, which is the part of their recommendation left. |
| HB-11 | **React Flow warns that nodeTypes/edgeTypes are recreated.** | **Not true, and was not true when they filed it.** Both have been module-level constants since `06a060f`, well before `5c7b9e1` — the recommended fix was already in place. Measured on a production build: zero React Flow warnings on Relations. A Vite HMR artifact of the dev server they tested on, where module constants *are* recreated on hot update. |

### What their pass caught that they filed too narrowly

| ID | Severity | Status | Finding |
|---|---|---|---|
| HB-1a | high | **fixed** | **The warning knew everything the fix needed and still sent you away.** `char-before-intro` names the character and the scene they first appear in, and its only action opened the chapter — so clearing it meant leaving the panel, moving the time cursor, opening the character, finding Current State and saving, **once per character**. Their acceptance criterion: *"add a new character to a scene, create the first state without leaving, and clear the corresponding continuity warning in one guided flow."* | **Fixed, with the ensemble case treated as the finding rather than a detail of it.** `Issue.fix` was shaped for exactly one check — `{ label, eventId, setTravelDays }` — so it is a discriminated union now and the checker dispatches on `kind`. `char-before-intro` carries `initialSnapshot`, and there is nothing to ask the writer: an initial record is alive, nowhere in particular, carrying nothing, which is what *"they exist from here"* means; anything more specific is an edit made afterwards on a record that now exists. A run of two or more gets **Record initial state for all N**, because *"eight buttons instead of one"* would have answered the letter of their finding and not the complaint. `upsertSnapshot` already refuses to duplicate an identical earlier state, so the batch cannot write no-op rows. **The one thing this got wrong first:** the batch filters out suppressed rows, and a mutation removing that filter *survived* — with **Show suppressed** off, the section had already dropped them before the batch could see them. That filter earns its place only with the toggle on, which is precisely when a batch could overrule a writer who had said they knew. The test drives the toggle. |
| HB-2 | high | **fixed** | **Controls with no accessible name, measured rather than sampled.** Their P1 named the two Elapsed Time inputs and the travel-mode speed, and gestured at *"several scene row actions and map tool buttons"*. Measured: both Elapsed Time inputs carry no `<label>`, no `aria-label` and no `title` — only the placeholders `"0"` and `"auto"`, while the text that explains them (*"days since the previous event"*) is an unassociated sibling `<span>`. | **Fixed, and the check found more than the review did.** They asked for an automated check instead of another list, and `e2e/controlNames.spec.ts` is it — a property over eight screens plus the expanded scene editor, where a **placeholder deliberately does not count** as a name. It surfaced **thirteen** unnamed controls: the two Elapsed Time inputs; the scene description, prose and title fields; the tag input; the chapter's Writer's Notes; three roster search boxes; travel-mode name, speed and its icon-only add; and the chapter bar's prev/next scene steppers, which are the *"scene row actions"* they could only describe. Each screen asserts a **floor** on controls found as well as zero unnamed, so a route that renders nothing cannot turn it green. **One thing the check forced a real fix for:** in edit mode the scene card's disclosure `<button>` *wrapped* the title `<Input>` — inert, since its own handler checked `!editing`, and nameless, since a button takes its name from content that was now a field. Interactive content inside a button is not valid markup either. The two are alternatives now, not nested. |
| HB-2a | high | **fixed, two sites deliberately excluded** | **The invisible-but-clickable control is not one site, it is seven.** Their P1 mentions icon-only controls in passing; the real shape is **LORE-1**, which this review measured once and then never grepped for. `opacity-0` with pointer events still live hit-tests to itself, so on a touch device — where the resting state is the only state — a tap on an apparently blank row fires it. Six sites beyond the map sidebar: `WorldCard` (**delete a world**), `LoreView` category rename and delete, `CadenceManager` thread/motif delete, `SceneHistoryDialog` revision delete, and the `ChapterRow`/`EventRow` selection checkboxes. | **Fixed for the five destructive ones**, guarded by `e2e/hoverRevealSafety.spec.ts`, which pairs the absence with the presence in each test — `none` at rest, `auto` on hover. Two things this cost. `opacity` **is not inherited**, so reading it off the control says `1` even inside a faded wrapper; the helper walks up to the first ancestor that actually fades, and `pointer-events` — which *is* inherited — is what makes the gate work at all. And the first assertion failed on a measured `0.966906`: a fade still in progress, not a control that stayed lit, so the resting value is polled rather than sampled. **The gate belongs on the destructive control, not the cluster around it** — gating the world card's whole action row took **Export** with it, and `e2e/importExport.spec.ts` caught that within one run. A control that is merely hidden until wanted should not be made hard to reach; only the one worth costing a deliberate hover is. |
| HB-2b | med | **open** | **The two selection checkboxes have the same shape and are left alone.** `ChapterRow`'s select-all and `EventRow`'s per-scene checkbox are `opacity-0` with live pointer events, exactly like the deletes. | **Open, deliberately.** Gating them is the wrong fix twice over: a tap that toggles a selection is visible and reversible where a tap that deletes is neither, and `group-hover` never fires on a touch device — so `pointer-events-none` would remove the only way to select rows on a phone rather than protect anything. Both are **named** here, which is all HB-2 asks of them. The real answer is a touch affordance for bulk selection, which is a design change rather than a class. |
| HB-3a | med | **open** | **Two Settings fields patch one shared object from a stale render.** Both calendar fields do `patch({ ...cal, field })` where `cal` is `world.calendar` as of the last render, so a write to one inside the other's live-query round-trip writes back a stale copy of the other. | **Open.** Not reproduced — see HB-3 — so this is filed on the code rather than on a symptom. The fix is to patch by function of the current record rather than by spreading a rendered snapshot, and it applies to any other pair of fields sharing one nested object. |

---

## Still not reviewed

Kept honest: this list only shrinks when a screen has actually been driven and
looked at.

### Whole passes, each a session of its own

Both outstanding depth passes are done — the reveal gate across all eleven
reading-mode routes (section 22) and the overlays at 390px (section 25). What
remains is narrower:

- **The chapter-detail editor at 390px** — the one writing surface not measured
  at phone width. WR-1 (a five-line textarea) will read differently there, and
  Focus mode is the obvious mitigation but has not been driven on a phone.
- **A second book.** Every reading-mode measurement in this document comes from
  *Philosopher's Stone*. RD-1's severity depends on how many orphaned entities a
  given fixture has, and that is a per-book number — the other nineteen library
  worlds are unmeasured.

### Screens never opened

*(This list is now empty. Every screen named in earlier passes has been driven.)*

### Parts of screens

- **The route detail panel** — blocked by **RT-1**, now understood.
- **Scene history with many versions** — only a two-version history has been
  seen, so nothing is known about how the list behaves at twenty.
- **The Relationship States panel** in chapter detail — the Character States and
  Writer's Notes panels beside it are reviewed; this one has not been seen.
- **The Writer's Brief with a cursor set** — only its empty state is known, and
  **WB-1**/**WB-2** describe that state alone.

---

## Bugs found incidentally

Not UX, but surfaced while capturing.

| ID | Finding |
|---|---|
| BUG-1 | `Cannot update a component (TopBar) while rendering a different component (MapExplorerView)` — a setState-during-render on the Maps screen. |
| BUG-2 | `Encountered two children with the same key, 'lotr-ev-last-alliance'` — duplicate React key, in the Fellowship example data or its render. |
