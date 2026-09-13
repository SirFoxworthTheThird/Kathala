# Robinson Crusoe manuscript-first plan

## Verified edition

- Daniel Defoe, *The Life and Adventures of Robinson Crusoe*.
- Project Gutenberg eBook #521, plain-text edition updated 7 September 2025.
- Source: <https://www.gutenberg.org/ebooks/521>
- Project Gutenberg marks this edition public domain in the USA.
- The Gutenberg licence wrapper, title page, and contents are excluded; all narrative prose in the edition's twenty chapters is retained.

## Locked source totals

- 20 authored chapters
- 727 normalized narrative paragraphs
- 120,687 words

`source-text.mjs` isolates and normalizes the narrative. `full-scene-drafts.mjs`
owns every event boundary and asserts that the ordered scene drafts reproduce
the complete normalized narrative exactly. The first pass deliberately keeps
one full-text draft per chapter. Each chapter will then be read and split where
place, cast, knowledge, ownership, tension, or character state changes. The
world generator must consume only those audited slices; it must never summarize
or regenerate the manuscript prose.

## Build order

1. Verify source and lock chapter-level coverage. **Complete.**
2. Read each chapter and record all meaningful beats and paragraph cuts. **First
   complete pass: 99 scenes; boundary audit generated and source coverage
   reverified.**
3. Generate chapters, events, elapsed time, editorial calendar, and full scene drafts.
4. Add event-specific present-character snapshots and relationship changes.
5. Add the world, maps, locations, routes, items, factions, knowledge, lore,
   threads, motifs, and goals required by the complete narrative.
6. Create or source distinct period-appropriate illustrations and navigational maps.
7. Synchronize example/library copies, validate automatically, and complete the
   full visual application checklist before requesting a merge.
