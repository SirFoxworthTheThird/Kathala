# Moby-Dick example review

## Source ledger

- Complete Project Gutenberg edition 2701 checked: 135 chapters plus Epilogue.
- One chronology is used because the novel presents a single voyage and retrospective narration rather than parallel timelines.
- Every reading unit has a meaningful event, dramatic tension from 1 to 5, non-negative elapsed time, and an editorial calendar position.

## Visual asset review

- 21 character portraits reviewed as distinct, mature, period-appropriate depictions.
- 12 item images reviewed as recognizable object studies. No item uses a character, location, or map image.
- 26 location images reviewed for subject and period fit.
- 4 faction covers reviewed as distinct group scenes.
- 4 map layers reviewed as navigational maps. The New England map was regenerated to remove the post-novel Cape Cod Canal.

## Map review targets

- Root voyage chart: New England gateway, Pequod gateway, Azores, Cape of Good Hope, Indian Ocean, Sunda Strait, Japan Grounds, Equatorial Pacific.
- New England: New Bedford, Spouter-Inn, Whaleman's Chapel, Nantucket, Try Pots, Nantucket Wharf.
- Pequod weather deck: quarterdeck, main deck, try-works, forecastle, mastheads, whaleboat davits, companionway gateway.
- Pequod below decks: Ahab's cabin, cabin table, crew berths, oil hold, blubber room.
- Nesting path: world chart → Pequod weather deck → below decks.

## Known editorial choices

- Essayistic chapters remain individual chapters and events because they materially advance Ishmael's understanding, motifs, and plot threads.

## Completed application pass

- Loaded the downloadable library copy in reading mode and confirmed its 136-chapter progression and spoiler gating.
- Visited Timeline, Calendar, Characters, Arc, Relations, Items, Maps, Lore, Factions, and Knowledge without a page crash or infinite loader.
- Disabled reading mode and repeated the full-data checks needed to inspect all entities and map layers.
- Visually checked every marker on the world voyage chart and New Bedford/Nantucket chart at a useful zoom.
- Opened the world → weather deck gateway and switched through the weather deck → below-decks level group; all locations loaded on the intended plan.
- Confirmed the 21 character portraits and 12 item studies load in their application cards and remain distinct and entity-appropriate.
- Exercised the chapter cursor through the shipboard transition and confirmed character locations resolve to the ship maps.
- Fixed the Knowledge suggestion list's duplicate React key when several deaths share one event, then reloaded the view with no new console error.

## Automated evidence
- `npm test -- --run src/lib/__tests__/libraryCatalogue.test.ts src/lib/__tests__/exampleQuality.test.ts src/lib/__tests__/exampleCompat.test.ts`: 3 files and 582 tests passed.
- Full `npm test`: 186 files and 2,776 tests passed after the shared Knowledge-view fix.
