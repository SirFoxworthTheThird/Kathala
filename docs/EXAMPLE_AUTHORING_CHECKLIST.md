# Example authoring checklist

Use this checklist whenever a book is added to or substantially revised in `example/` and `public/library/`. The automated rules below are enforced by `src/lib/__tests__/exampleQuality.test.ts`; the visual and editorial checks require a pass through the app.

## Story structure

- Include every chapter in reading order, with at least one event per chapter.
- Split a chapter into enough events to represent meaningful changes of place, cast, knowledge, ownership, or dramatic tension. Do not create filler beats merely to increase the count.
- Keep tension within the application’s 1–5 range and shape it to the actual pacing of the chapter.
- Give every event a non-negative elapsed-time value. If the example uses the calendar, also assign a valid in-world date and time to every event.
- Model separate timelines only when the book actually contains parallel or framing chronologies. A change of viewpoint or travel route is not by itself a new timeline.
- Add plot threads, motifs, lore, factions, knowledge reveals, relationships, goals, and items where they help explain the book. All references must resolve.

## Characters and state

- Add the characters needed to understand the complete book and their meaningful relationships.
- Create a character snapshot for every character present in an event, and no snapshot for a character who is merely mentioned or has not yet appeared.
- Give each present character an event-specific state and location. Describe what is true for that character at that moment—not a chapter summary or inherited context.
- Never copy one status across the whole cast. Avoid placeholders such as “state carried through,” “ongoing context,” or “not yet directly involved.”
- Check alive/dead state against the chronology; do not carry a later death backward into earlier events.
- Before assigning any portrait, item, or location illustration, inspect the image and record its subject and source in the generator/review notes. A URL returning an image is not a review. Do not use a merely similar image from another book or a generic period portrait as though it depicts a named fictional character.
- Verify portraits and item illustrations load, are visually consistent with the book’s tone, and are not unwanted photographic or cartoon styles. Give named characters distinct, subject-appropriate art where the source material allows it.

## Locations and maps

- Write each location description about the place itself. Keep it book-specific and spoiler-safe; never use text such as “a location relevant to the journey,” “portal to the submap,” or other app-navigation instructions.
- Add every submap needed to make important movement understandable. Every submap must have a location on its parent map that opens it; floor groups may share one building entrance.
- Give every map layer an image before shipping it. For linked images, use a stable direct HTTPS image URL and verify it still resolves.
- Never assign a map image to a character, world cover, or ordinary location illustration. An item that is literally a map and a map-chart gateway are the only exceptions; record that intent explicitly. A location’s illustration should depict that place or a book-specific scene there; it is not a substitute for its navigable map.
- Open every map and submap in the app. Confirm it finishes loading, is legible against the background, and is not an unsuitable illustration pretending to be a map.
- Visually check every marker against the image. Leaflet’s simple coordinate system can invert assumptions about north and south; do not approve coordinates from numeric inspection alone.
- Exercise playback across maps and floors. Confirm the active layer changes, the first arrival waits for the image, and the moving character is centered at a useful zoom.

## Editorial quality

- Describe the world as the book’s story, not as an example, dataset, or record of the work used to create it.
- Keep location, character, event, and item text specific rather than repetitive or generic.
- Avoid copying prose from the source book. Examples contain original structural summaries only.
- Keep descriptions spoiler-safe where they are visible before the relevant event in reading mode.
- Use illustrations and maps that suit the genre and have reliable attribution or source information in Lore.

## Packaging and release

- Keep the editable file in `example/` and the downloadable copy in `public/library/` synchronized.
- Store image blobs in the matching `.pwb` only when uploaded blobs are required. Linked-image examples do not need an empty `.pwb`.
- Update `public/library/index.json`: title, author, blurb, notice, cover, counts, world ID, filenames, and exact UTF-8 byte sizes.
- Load the downloadable copy through the Library dialog in reading mode and visit Timeline, Calendar, Characters, Arc, Relationships, Items, Maps, Lore, Factions, and Knowledge.
- Run `npm test -- --run libraryCatalogue exampleQuality exampleCompat` before committing.

## Automated guardrails

The example-quality suite prevents these regressions:

- chapters without events or events with invalid chapter references;
- missing, extra, or duplicate character snapshots;
- snapshots for absent characters, unresolved character/location references, empty or duplicated per-event status text, and known placeholder wording;
- generic or map-navigation-only location descriptions;
- missing map image IDs, invalid map references, or partially specified/non-numeric marker coordinates;
- tension outside 1–5 and negative or missing elapsed time;
- invalid timeline references;
- map images reused as character, item, or location illustrations;
- catalogue counts, world IDs, filenames, and UTF-8 byte sizes drifting from the shipped files.

Visual accuracy, historical accuracy, spoiler judgment, image availability, and whether an event deserves additional beats still require the manual review above.
