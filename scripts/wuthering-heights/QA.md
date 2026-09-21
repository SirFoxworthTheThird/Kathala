# Wuthering Heights QA record

Validated on 13 September 2026 against the generated `example/Wuthering Heights.pwk` and the byte-identical `public/library/wuthering-heights.pwk`.

## Source and manuscript

- Source: Project Gutenberg eBook 768, plain-text edition updated 6 May 2026.
- Modelled all 34 numbered chapters in one timeline.
- Exact manuscript payload: 1,942 normalized paragraphs and 115,872 words.
- Concatenating the 34 stored scene texts reproduces the extracted narrative byte-for-byte; Gutenberg packaging is excluded.
- Chapter titles, summaries, event descriptions, tension, POV, and reconstructed dates are explicitly editorial.

## Structured-data checks

- 34 chapters, 34 events, and 34 final manuscript scenes.
- 16 characters, 177 event-specific character snapshots, 12 relationships, 5 relationship changes, 8 goals, 2 factions with 14 memberships, 5 knowledge facts with 6 reveals, 2 plot threads, 2 motifs, and 2 lore pages.
- Every event has a 1–5 tension value, a valid location, a POV, a date, elapsed-time data, and exactly one distinct state for every character present—none for absent characters.
- Character history sort keys follow story order. Death-state transitions occur only in the chapters where the deaths happen.
- All routes have waypoint arrays and all entity references resolve.

## Maps and pictures

- Visually inspected the Yorkshire Moors main map and the Wuthering Heights, Thrushcross Grange, and Gimmerton sub-maps in Kathala.
- Visually checked every marker after accounting for Leaflet's vertical image-coordinate direction. Gateways and interior markers align with the illustrated geography.
- Played chapter 1 into chapter 2 in the Maps view; playback changed from the moor overview to the Wuthering Heights sub-map and updated the visible cast and their independent state text.
- 42 distinct repo-hosted generated illustrations: 4 maps, 16 character portraits, 15 location views, 6 item still lifes, and 1 world cover.
- Every asset is over 100 KB, has a unique SHA-256 digest, and uses a library-relative URL. No photographs, actor likenesses, cartoon styling, or map-as-entity shortcuts are used.
- Generation intent and asset-by-asset provenance are recorded in `ASSET-MANIFEST.md` and the in-world Lore.

## In-app checks

- Download/replace from Library and initial reading-mode import.
- Dashboard spoiler gating at chapter 1.
- Timeline and pacing graph, Manuscript, Corkboard, Structure, Calendar, Characters, Items, Relationships, Character Arc, Lore, Factions, Knowledge, Settings, and all map layers.
- The manuscript view reports 34/34 scenes and 115,872 words; the first and last chapter prose match the source boundaries.
- Character and item rosters render distinct, relevant artwork.
- Heathcliff's History tab renders 30 chapter-ordered, non-generic states; chapter 34 records his death at the churchyard.
- The Lore page was retested after adding its required tags and entity-link fields; it no longer crashes.

## Commands

```text
node scripts/wuthering-heights/verify-source.mjs
node scripts/wuthering-heights/verify-manuscript.mjs
node scripts/wuthering-heights/generate-example.mjs
node scripts/wuthering-heights/validate-example.mjs
npm test -- --run libraryCatalogue exampleQuality exampleCompat
```

The focused test invocation currently reports unrelated pre-existing failures in older examples (legacy catalogue notice/reading-mode metadata and two generic location descriptions). Wuthering Heights produces no focused-suite assertion failures; its stricter dedicated validator passes.
