# Book example release checklist

> [!CAUTION]
> This checklist is a release gate. Complete it for every new or substantially revised example. An unchecked applicable item means the example is not finished and must not be merged.

Read and follow the [mandatory example-authoring rules](EXAMPLE_AUTHORING_RULES.md) before starting. Rule IDs below refer to that document. Mark an item “N/A” only with a written reason in the generator, pull request, or review notes.

## Source and structure

- [ ] The complete source edition and all chapter titles were verified. (`EX-001`–`EX-002`)
- [ ] Every chapter has all necessary events, without compression or filler. (`EX-003`)
- [ ] Timeline count and chronology are justified. (`EX-004`)
- [ ] Tension, elapsed time, and calendar values are valid and editorial assumptions are documented. (`EX-005`–`EX-006`)
- [ ] All summaries are original writing rather than copied prose. (`EX-007`)

## Characters and continuity

- [ ] The meaningful cast and relationships are complete. (`EX-101`, `EX-107`)
- [ ] Every event has exactly one snapshot per present character and none for absent characters. (`EX-102`)
- [ ] Every snapshot has a unique, event-specific state and correct location/map. (`EX-103`–`EX-105`)
- [ ] Deaths, injuries, knowledge, goals, inventory, relationships, and affiliations respect chronology. (`EX-106`)

## Maps and locations

- [ ] Every map is a legible map rather than an unrelated illustration. (`EX-201`)
- [ ] All necessary submaps exist, contain locations, and have exactly one valid parent gateway. (`EX-202`–`EX-204`)
- [ ] Every location description is specific, place-focused, and spoiler-safe. (`EX-205`)
- [ ] Every marker on every map and submap was visually checked at a useful zoom in PlotWeave. (`EX-206`)
- [ ] Every gateway depth and map/floor transition was exercised. (`EX-207`)
- [ ] Playback was tested across layers, including first arrival and later movement. (`EX-208`)

## Images

- [ ] Every final image was opened and its depicted subject was verified. (`EX-301`)
- [ ] World, character, item, location, and map images match their entities and purposes. (`EX-302`, `EX-308`)
- [ ] No map is reused as ordinary entity artwork. (`EX-303`)
- [ ] Named characters and distinct items have distinct suitable illustrations. (`EX-304`)
- [ ] Artwork matches the genre, avoids unwanted photographs/cartoon styles, and has no broken URLs. (`EX-305`–`EX-306`)
- [ ] Sources, licences/public-domain status, and generated assets are recorded in Lore. (`EX-307`)

## Worldbuilding and reading mode

- [ ] The world description is about the book, and its theme suits the genre. (`EX-401`, `EX-406`)
- [ ] Threads, motifs, lore, factions, knowledge, goals, items, routes, and other supporting data are complete where meaningful—not padded. (`EX-402`–`EX-403`)
- [ ] All references resolve and reading-mode visibility does not leak later spoilers. (`EX-404`–`EX-405`)

## Packaging and validation

- [ ] `example/` and `public/library/` copies are synchronized. (`EX-501`)
- [ ] `.pwb` usage is necessary and correct, or no `.pwb` is included. (`EX-502`)
- [ ] `public/library/index.json` has exact metadata, counts, filenames, world ID, and UTF-8 byte size. (`EX-503`)
- [ ] The committed generator reproduces the shipped files and metadata. (`EX-504`)
- [ ] `npm test -- --run libraryCatalogue exampleQuality exampleCompat` passes. (`EX-505`)
- [ ] The Library download was opened in reading mode and every application page was visited. (`EX-506`)
- [ ] No broken images, infinite loaders, unresolved references, or relevant console errors remain. (`EX-507`)
- [ ] The handoff or pull request records counts and validation evidence. (`EX-508`)

## Required completion statement

Use this statement in the pull request or handoff and replace every bracketed value:

```text
Example rules review: COMPLETE
Source edition: [edition and URL/reference]
Counts: [chapters] chapters, [events] events, [characters] characters, [locations] locations, [maps] maps
Automated validation: [commands and passing results]
Visual validation: [all inspected map layers and application pages]
Image validation: [number checked, broken links = 0, duplicates/intentional shared images]
Exceptions: [none, or rule IDs with written justification]
```

Do not use `COMPLETE` if any applicable box remains unchecked.
