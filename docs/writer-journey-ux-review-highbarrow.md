# Writer Journey UX Review: “Sir Foxworth and the Impossible Company”

**Test date:** 2026-08-09

**Build tested:** `5c7b9e1` on `codex/odyssey-example`

**Environment:** Local development build at `http://127.0.0.1:5180/`, clean browser storage, desktop viewport

**Method:** End-to-end exploratory UX test performed through the browser while acting as a fantasy writer, starting from an empty library and using the supplied Highbarrow story brief.

## Executive summary

PlotWeave already supports an unusually complete writer workflow. A new project can move from premise to cast, outline, timeline, prose, geography, continuity, and reader-facing presentation without leaving the application. Search, the Writer's Brief, the Continuity Checker, Structure templates, linked map previews, manuscript export, and spoiler-aware Reading mode were particularly effective.

The largest usability problem is the boundary between **scene participation** and **state snapshots**. Adding a character to a scene feels like completing the character assignment, but it does not create an initial state. The writer only discovers the missing step later through continuity warnings, and the chapter panel can incorrectly describe assigned characters as “not in any event.” This is conceptually central to PlotWeave, so the application should teach and resolve it in the scene workflow rather than after the fact.

No fatal runtime error occurred during the test. The console contained only React Flow memoization warnings.

## Project created during the test

The browser session produced a representative story project containing:

- 1 world and 1 timeline
- 5 chapters and 6 events
- 9 characters (Foxworth, seven companions, and Marshal Vargan)
- 4 tracked items
- 1 linked map, 1 location, and a placed protagonist
- 1 character relationship
- 2 factions with membership and a hostile faction relationship
- 1 lore page and 1 time-aware knowledge fact
- 3 assigned structural beats
- 1 plot thread and 1 motif
- A configured calendar and fantasy theme
- A 34-word scene draft with POV, location, elapsed time, tension, characters, and an item

This was sufficient to exercise both empty states and populated states across the application.

## Prioritized findings

### P1 — Adding a scene participant does not provide a path to create the required snapshot

**Where:** Timeline → Chapter detail → expanded event; Continuity Checker; Character Arc

**Observed:** Eight characters were assigned to “Seven Specialists Return.” The scene showed all eight under Characters, but the adjacent Character States panel continued to say “9 characters not in any event” and listed each as `no snapshot`. The Continuity Checker later produced six “appears before any snapshot record” warnings. Its action opened the chapter but did not take the writer to a state form or offer a one-click initial snapshot.

**Writer impact:** The interface confirms that a character is in the scene, then describes the same character as not being in an event. A writer must already understand PlotWeave's delta model, move the time cursor, leave the scene, open each character, find Current State, and save a record. For a group scene, this becomes repetitive and easy to miss.

**Recommendation:**

1. After adding a character with no prior snapshot, show an inline choice: **Use previous state**, **Create initial state**, or **Assign only**.
2. In Character States, distinguish “assigned, snapshot missing” from “not assigned to any event.”
3. Add **Create state here** to each continuity warning and support a batch initial-state workflow for ensemble scenes.
4. Keep the existing Help explanation, but surface it contextually the first time this condition occurs.

**Acceptance criteria:** A writer can add a new character to a scene, create the first state without leaving the scene, and clear the corresponding continuity warning in one guided flow.

### P1 — Important event and settings inputs are not programmatically labelled

**Where:** Expanded event editor; World Settings; some icon-only row controls

**Observed:** The two Elapsed Time number inputs were exposed only as unnamed `spinbutton` controls. The Travel Mode speed input was also unnamed. Several scene row actions and map tool buttons had no accessible name, while nearby destructive or expand actions depended on icons alone.

**Writer impact:** Screen-reader users cannot reliably identify the fields. Voice control and keyboard-oriented automation also become ambiguous, especially where multiple unnamed controls sit beside one another.

**Recommendation:** Associate visible labels and helper text with unique input IDs; add explicit accessible names such as “Days since previous event,” “Exact in-world day,” “Travel speed,” “Expand event,” and “Delete event.” Add automated accessibility checks for unnamed interactive elements.

### P1 — Calendar start year silently reverts unless Enter is pressed

**Where:** Settings → Calendar → Start year

**Observed:** Changing Start year from `1` to `742`, then editing the adjacent suffix and navigating to Calendar, left the suffix saved but reverted the year to `1`. Returning to Settings, entering `742`, and pressing Enter persisted it; Calendar then correctly showed “January 742 HB.”

**Writer impact:** The edited value appears valid in the field, but navigation can discard it with no warning. The adjacent text field behaves differently, making the failure hard to predict.

**Recommendation:** Save valid numeric changes on blur as well as Enter, or provide an explicit Save button with dirty-state feedback. Use the same commit behavior for every Settings input and add a regression test covering edit → click another field → navigate away.

### P2 — Carried-forward arc states can be mistaken for scene presence or a fresh update

**Where:** Character Arc

**Observed:** Barnaby's chapter-one note (“Watching Foxworth's departure… not yet recruited”) appeared with nearly equal visual weight in every later chapter. Later cells included a carried-forward indicator, but the repeated status and prose dominated the cell.

**Writer impact:** In a wide ensemble grid, repeated prose looks like repeated scene-specific state. This encourages the same misunderstanding previously seen in example data: persistence may be read as presence or as a deliberately authored state for that chapter.

**Recommendation:** Visually de-emphasize inherited cells, show “Carried from Ch. 1” as the primary label, and reveal the inherited prose on expand/hover. Add filters for **Changes only**, **Appearances only**, and **All carried state**.

### P2 — Untimed events silently pile onto the first calendar day

**Where:** Calendar

**Observed:** Five events without elapsed or pinned-day data all appeared on January 1. The one event with two elapsed days appeared on January 3. The page did not call out that most events were using a default date.

**Writer impact:** The calendar looks authoritative even when it mostly reflects missing data. Writers can mistake the stack for an intentional same-day sequence.

**Recommendation:** Mark derived/default dates, show a summary such as “5 events need timing,” and offer **Set elapsed time** from each calendar card. Consider a setup assistant that distributes or explicitly confirms untimed scenes.

### P2 — Recent Changes is too generic for event-heavy editing

**Where:** Header → Recent changes

**Observed:** Editing prose, location, characters, POV, item, elapsed time, and tension generated a long run of indistinguishable “Edited event” entries. Only the newest reversible action exposed an Undo button.

**Writer impact:** The history answers that something changed but not what changed or in which scene. It is difficult to audit an accidental edit or build confidence before undoing.

**Recommendation:** Include entity title and field-level summaries, for example “Changed tension in ‘Seven Specialists Return’ from unset to 5.” Group rapid edits to the same event into a collapsible session and explain which entries are undoable.

### P2 — Creation flows return the writer to inconsistent places

**Where:** Characters, Items, Factions, Knowledge, Lore

**Observed:** Adding a Character returned to the collection, adding an Item navigated directly to its detail page, adding a Faction opened an editor panel, adding a Fact opened an inline detail editor, and New Lore page immediately opened a full-page editor.

**Writer impact:** Serial entry becomes unpredictable. A writer adding a cast can continue quickly, while adding several props requires repeated navigation back to Items.

**Recommendation:** Standardize creation behavior or offer explicit submit choices: **Save and add another** and **Save and open details**. Remember the last choice per entity type.

### P2 — Plot Thread and Motif empty states do not explain how to attach scenes

**Where:** Dashboard → Plot Threads / Motifs & Themes

**Observed:** After creating a thread and motif, both showed “no scenes tagged yet” without a visible action or explanation of the tag convention needed to populate them.

**Writer impact:** The feature appears unfinished immediately after creation, and the next step is not discoverable from the dashboard.

**Recommendation:** Add **Attach scenes** to each new thread/motif, allow multi-select across events, and link to the relevant scene tag field. Prefer a stable entity link over relying on matching free-text tags.

### P2 — Calendar configuration overwhelms the rest of Settings

**Where:** World Settings

**Observed:** Enabling Calendar expanded twelve month-name inputs, twelve length inputs, and twelve remove buttons inline. Share, database health, and cloud-sync controls were pushed far below the fold.

**Writer impact:** The Settings page changes from a manageable overview into a long data-entry form. It is difficult to scan or return to unrelated settings.

**Recommendation:** Make each settings area collapsible, keep Calendar summarized when configured, and provide presets (Gregorian, simple 12×30, custom) before exposing the month editor.

### P3 — Timeline onboarding creates several similarly named concepts without a preview

**Where:** New-world wizard

**Observed:** Entering “The Impossible Quest” during guided setup resulted in a timeline and opening event using that title while the chapter remained “Chapter 1.” Later screens displayed all three concepts together.

**Writer impact:** A first-time user may not yet understand the difference between timeline, chapter, and event, so it is easy to name the wrong layer or accept a generic chapter unintentionally.

**Recommendation:** Preview the resulting hierarchy in the wizard and label each field by object: Timeline, Chapter 1 title, Opening event. Let the writer edit all three before finishing.

### P3 — React Flow repeatedly warns about unstable node/edge type objects

**Where:** Relations

**Observed:** The console logged repeated React Flow warning 002 messages indicating that `nodeTypes` or `edgeTypes` objects are recreated instead of memoized.

**Writer impact:** No visible failure occurred in this session, but unnecessary graph re-renders can reduce responsiveness as casts and relationship graphs grow.

**Recommendation:** Define node and edge type maps outside the component or memoize them, then profile a large relationship graph.

## What worked especially well

- **New-world wizard:** Friendly progressive disclosure and a clear explanation of the time cursor.
- **Global search:** One query found Barnaby across character, event, and relationship records with useful keyboard hints.
- **Writer's Brief:** Consolidated current event, character state, goals, factions, location, calendar date, and knowledge into a compact working reference.
- **Continuity Checker:** Correctly detected characters who appeared without snapshots and named the first affected scene.
- **Reading mode:** Hid writing-only pages, clearly stated how many characters were spoiler-hidden, and revealed only Barnaby and Foxworth at chapter one.
- **Manuscript:** Draft and Reading views, per-chapter counts, find/replace with revision safety, goals, and exports formed a coherent writing workflow.
- **Structure:** Three templates and scene assignment selectors made structural planning immediately usable.
- **Maps:** URL linking provided a preview, image dimensions, and a clear warning about export limitations. Location and character placement were understandable.
- **Knowledge:** Separating when a fact becomes true, when a character learns it, and when the reader learns it is powerful and well explained.
- **Factions:** Membership, territory guidance, colour, and inter-faction sentiment worked well in one editor.
- **Playback:** Advanced through the story cursor while keeping the map visible and disabled conflicting cursor controls during playback.

## Coverage matrix

| Area | Workflows exercised | Result |
|---|---|---|
| World list / onboarding | Empty library, create world, four-step wizard | Completed |
| Dashboard | Metrics, progress, cast balance, plot thread, motif | Completed; thread attachment needs guidance |
| Timeline | Add chapters/events, participants, POV, tags, status, prose, item, location, time, tension | Completed |
| Corkboard | Multi-chapter cards, status controls, ordering affordance | Inspected; pointer drag was not used in this automated pass |
| Calendar | Disabled state, enable/configure, dated event display | Completed; found commit/default-date issues |
| Structure | Template view and beat assignments | Completed |
| Manuscript | Draft/Reading views, prose counts, find/replace, export dialog | Completed |
| Characters | Create cast, overview, state, goal, history tabs | Completed |
| Maps | Linked map, marker, location, character placement, playback | Completed; routes/regions were inspected but not fully authored |
| Items | Create and inspect multiple items | Completed |
| Relations | Create relationship, graph controls, faction overlay | Completed after pinning navigation |
| Arc | Chapter grid, inherited states, filters/export affordances | Completed |
| Lore | Create/edit Markdown page and inspect visibility/link controls | Completed |
| Factions | Create, describe, add member, hostile relation | Completed |
| Knowledge | Create fact and time a character's knowledge | Completed |
| Settings | Theme, Reading mode, Calendar, share/health/sync surfaces | Core workflows completed; destructive/export actions not executed |
| Global tools | Search, Writer's Brief, Continuity, Recent Changes, Help | Completed |

## Recommended implementation order

1. Integrate snapshot creation and correction into scene participation and continuity warnings.
2. Fix numeric Settings commit behavior and label all interactive controls.
3. Make default/untimed calendar data visibly provisional.
4. Improve inherited-state presentation in Arc.
5. Add field-level Recent Changes and direct thread/motif scene attachment.
6. Standardize creation destinations and progressively collapse Settings.
7. Clarify onboarding hierarchy and resolve React Flow warnings.

## Notes on test interpretation

- The earlier accidental navigation from Relations to Dashboard was caused by interacting with the collapsed hover navigation, not by the New Relationship feature. It was retested with navigation pinned open; the relationship dialog opened and saved successfully, so no defect is filed for that action.
- The local story project was test data in isolated browser storage. This review intentionally adds only this Markdown report to the repository.
