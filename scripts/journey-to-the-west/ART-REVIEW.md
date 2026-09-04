# Journey to the West — missing-art completion

## Scope and result

Added 189 separate, repository-hosted illustrations with the built-in image
generation tool: 66 character portraits, 116 location illustrations and seven
faction covers. Every new final image was opened and visually reviewed before
assignment. Prompts and individual review records are in
`generated-art-manifest.json`.

Coverage is now 121/121 characters, 146/146 locations, 23/23 items and 9/9
factions. The existing world cover, item illustrations and all eight maps were
preserved. No timeline, chapter, event, snapshot, movement or relationship data
was changed by this artwork pass.

Unsuitable drafts were corrected and rechecked, including a solid-bottomed
ferry, invented roadside standing stones, overly literal animal-shaped cliffs,
incorrect temple statuary and pseudo-lettering on the celestial gate. No rejected
draft is linked from the book. These are modern artistic interpretations in the
existing mature Chinese ink/mineral-wash style, not historical illustrations.

## Verification

- `node scripts/generate-journey-to-the-west-example.mjs` succeeds.
- `node scripts/journey-to-the-west/art-gaps.mjs` reports zero gaps in all four
  entity categories.
- `npm test -- --run libraryCatalogue exampleQuality exampleCompat`: 548 tests
  passed across three files.
- All 189 additions have distinct SHA-256 hashes and valid PNG signatures and
  dimensions. All 309 image references resolve to files under `public/`.
- Editable and downloadable PWKs are byte-for-byte identical; catalogue data
  size is 1,494,398 bytes.
- Compared against HEAD: original map, event, chapter, snapshot, movement,
  relationship, item and world data remain unchanged. Existing entity images
  are preserved; only missing image fields are populated. Lore changes concern
  image provenance.

## Nine-Headed Insect correction

The initial portrait incorrectly showed eight heads despite the prompt asking
for nine. A targeted built-in image_gen edit added one head and neck above the
breast, preserving the existing composition. The replacement was visually
counted: one top head, two upper side heads, three middle heads, and three lower
heads, for nine total. The full edit prompt is stored in the art manifest.
The stable asset path is unchanged, so both PWKs use the corrected illustration.

## Remaining release gate

The new full-resolution PNG masters total approximately 592.6 MiB. Web-delivery
compression should be addressed before publishing this large asset set; no
lossy conversion has been silently applied to the generated originals.

The browser connection returned no available browser. Consequently this pass
does **not** claim Library loading, reader-environment URL checks, application
page review, playback or visual marker validation. Those application checks
remain pending under EX-306 and EX-506–EX-508; map coordinates and map images
were not modified. Artwork completion is not a declaration that the full
example release checklist is complete. The user subsequently requested merging
to development for now after being informed that browser access is unavailable.
The browser checks are explicitly deferred for this merge, not marked passed.
