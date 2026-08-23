# Mandatory rules for book examples

> [!IMPORTANT]
> These rules are requirements, not suggestions. They apply to every new or substantially revised book example in `example/` and `public/library/`. An example is not complete and must not be committed, reviewed as finished, or merged while any applicable rule is unmet.

The creator is responsible for completing the companion [release checklist](EXAMPLE_AUTHORING_CHECKLIST.md), running the automated checks, and performing the visual checks in PlotWeave. Passing tests does not replace visual review. Visual review does not replace tests.

If a rule genuinely does not apply, record the reason in the generator, pull request, or review notes. Do not silently omit required data and do not invent content merely to make a feature appear populated.

## 1. Source and story structure

- **EX-001 — Verify the source.** Use a complete, reliable edition to establish chapter order, characters, events, chronology, and places. Do not build a complete-book example from memory, a film adaptation, or a short synopsis.
- **EX-002 — Include the complete book.** Every chapter must appear in reading order and contain at least one meaningful event.
- **EX-003 — Model all necessary events.** Split chapters whenever place, participating cast, knowledge, ownership, dramatic tension, or a meaningful character state changes. Do not compress distinct beats or add filler.
- **EX-004 — Use one chronology by default.** Create multiple timelines only for genuinely parallel, framing, or otherwise distinct chronologies. Viewpoint changes, travel routes, and separated groups are not timelines by themselves.
- **EX-005 — Keep pacing values valid.** Dramatic tension must remain within 1–5 and reflect the actual beat. Every event must have non-negative elapsed time.
- **EX-006 — Complete the calendar when used.** Every event must have a valid in-world date and time. When the source is vague, use a clearly identified editorial chronology and explain its assumptions in Lore.
- **EX-007 — Use original summaries.** Do not copy the book’s prose. Titles, summaries, descriptions, and status notes must be original structural writing.

## 2. Characters and event state

- **EX-101 — Include the necessary cast.** Add every character needed to understand the complete story and omit background names that never affect the modeled narrative.
- **EX-102 — Snapshot only present characters.** Every character physically or directly present in an event must have exactly one snapshot. A character who is absent, merely mentioned, not yet introduced, or no longer participating must not have one.
- **EX-103 — Write event-specific status.** Each snapshot must state what is true for that individual at that exact moment. It must not summarize the chapter, carry generic context forward, or predict later developments.
- **EX-104 — Never duplicate cast status.** Do not assign the same status to multiple characters in an event. Prohibited wording includes “state carried through,” “ongoing context,” “not yet directly involved,” and equivalent placeholders.
- **EX-105 — Place every present character.** Each snapshot must reference the correct event location and map layer. Location and icon movement must follow map and floor changes during playback.
- **EX-106 — Respect chronology.** Alive/dead state, injuries, affiliations, knowledge, goals, relationships, inventory, and location must be correct for the event—not copied backward from the ending or forward from a later chapter.
- **EX-107 — Model meaningful relationships.** Define the relationships needed to understand the story and add snapshots when their label, strength, sentiment, or active state materially changes.

## 3. Maps and locations

- **EX-201 — Use maps as maps.** Every map layer must have a legible navigational image. A decorative scene, portrait, transparent shape, inappropriate modern map, or unrelated illustration is not a map.
- **EX-202 — Build the necessary hierarchy.** Add submaps wherever they materially clarify movement through a country, city, building, ship, floor, or other nested space. Do not create empty submaps.
- **EX-203 — Provide exactly one gateway.** Every submap must be opened by exactly one location on its parent map, except documented floor-group behavior that intentionally shares a building entrance. The gateway must sit on the depicted parent location.
- **EX-204 — Populate every map.** Each map and submap must contain all story-relevant locations depicted at that scale. A submap with no locations must not ship.
- **EX-205 — Write place descriptions.** Descriptions must explain the place itself, be book-specific, and remain spoiler-safe before their reveal. Prohibited text includes “a location relevant to the journey,” “portal to the submap,” and other navigation or dataset language.
- **EX-206 — Validate markers visually.** Load every layer in PlotWeave, zoom until all markers can be checked, and compare every marker with the artwork. Numeric inspection is insufficient. Account for Leaflet’s inverted image-coordinate assumptions.
- **EX-207 — Validate deep nesting.** Open gateways through every nesting depth and confirm the correct child loads without an infinite spinner or console error.
- **EX-208 — Validate playback.** Exercise events crossing root maps, submaps, deep submaps, and floors. The active layer must change, the image must finish loading, and the moving character must be centered at a useful zoom on first arrival and later movement.

## 4. Images and visual quality

- **EX-301 — Review every image visually.** A successful HTTP response, filename, alt text, or search caption is not validation. Open the image and confirm what it depicts before assigning it.
- **EX-302 — Match the entity.** Character art must depict that character; item art must clearly depict that item; location art must depict that place or a book-specific scene there; the world image must represent the book. Do not use generic or merely similar stand-ins.
- **EX-303 — Never substitute maps.** A navigable map must not be used as a portrait, world image, item image, or ordinary location illustration. The only exceptions are an item literally representing a map or a documented map-chart gateway.
- **EX-304 — Keep images distinct.** Named characters and distinct items must not share an illustration unless it intentionally depicts the same group or inseparable object set and the decision is documented.
- **EX-305 — Follow the art direction.** Prefer illustrations over photographs. Avoid childish, cartoonish, tonally inconsistent, or visibly modern imagery unless the book explicitly requires it.
- **EX-306 — Use reliable assets.** Repository-hosted assets are preferred. Linked assets must use stable direct HTTPS URLs. Verify every final URL in the same environment readers will use.
- **EX-307 — Record provenance.** Document public-domain or licensed sources and original generated artwork in Lore and, where useful, generator/review notes.
- **EX-308 — Keep maps and art separate.** Navigable maps, portraits, items, locations, and the world cover must each have purpose-appropriate assets; completing one category never satisfies another.

## 5. Worldbuilding and continuity

- **EX-401 — Describe the book, not the example.** The world description must summarize the story world and premise. It must not discuss dataset construction, application features, or work performed by the authoring agent.
- **EX-402 — Add meaningful supporting data.** Plot threads, motifs, lore, factions, memberships, knowledge, goals, items, placements, routes, and location changes must be included wherever they clarify the book.
- **EX-403 — Do not pad features.** A feature may remain unused when genuinely irrelevant. Record the decision instead of inventing factions, regions, timelines, or relationships.
- **EX-404 — Resolve every reference.** All entity, event, chapter, timeline, image, map, location, route, faction, relationship, item, goal, thread, motif, and knowledge references must point to existing records.
- **EX-405 — Preserve reading-mode spoilers.** Data visible before an event must not reveal later deaths, identities, alliances, locations, ownership, or outcomes. Use reveal events and snapshots at the correct time.
- **EX-406 — Use a genre-appropriate theme.** Do not leave the world on the default theme when an existing theme clearly matches the book.

## 6. Packaging and release

- **EX-501 — Synchronize both copies.** The editable `.pwk` in `example/` and downloadable `.pwk` in `public/library/` must be byte-for-byte synchronized when both are shipped.
- **EX-502 — Use `.pwb` only when needed.** Include one only for uploaded image blobs. A linked-image example must not carry an empty or obsolete `.pwb`.
- **EX-503 — Update the catalogue exactly.** `public/library/index.json` must contain the correct ID, title, author, blurb, notice, cover, data filename, world ID, entity counts, and exact UTF-8 byte size.
- **EX-504 — Keep generation reproducible.** When a generator is used, commit it and make regeneration preserve both shipped copies and catalogue metadata.
- **EX-505 — Run automated validation.** At minimum run `npm test -- --run libraryCatalogue exampleQuality exampleCompat`. Any failure blocks release. Run the full suite when shared code or validation logic changes.
- **EX-506 — Complete the application pass.** Load the downloadable copy through Library in reading mode. Visit Timeline, Calendar, Characters, Arc, Relationships, Items, Maps, Lore, Factions, and Knowledge; then disable reading mode and repeat checks requiring the complete dataset.
- **EX-507 — Check runtime health.** There must be no broken image, infinite loader, unresolved reference, or relevant console error during the application pass.
- **EX-508 — Report evidence.** A pull request or handoff must state counts, tests and results, image/link checks, and the map layers visually inspected.

## Enforcement

The suite in `src/lib/__tests__/exampleQuality.test.ts` enforces rules that can be determined from exported data. Manual rules remain equally mandatory when a test cannot detect them.

A reviewer must reject or return an example when:

- an applicable rule is knowingly unmet;
- the checklist contains an unchecked item without an explained non-applicability decision;
- visual validation is claimed without opening every map and submap in PlotWeave;
- images were assigned from URLs or filenames without visual inspection;
- only one of the editable and downloadable copies was updated;
- completion is reported without validation evidence.

When a recurring failure is machine-detectable, add or strengthen an automated guardrail so the same mistake cannot silently return.
