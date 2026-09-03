# The Name of the Wind — original local atlas maps

## Scope and art direction

Four new maps were generated from written geographic briefs. The ONLY image
reference was the existing Four Corners/Temerant main map, used for its black
engraved linework, muted green/ivory/turquoise palette, ornamental border and
lettering. No previous submap image or layout was provided to image generation.
The existing main map is unchanged. These are original, unofficial reader
reconstructions, not official maps, measured surveys or historical documents.

## Research and limits

The briefs use the existing book dataset and descriptive references below.
This pass did not claim a fresh full-book textual audit. Secondary references
were used to check specific spatial relationships; speculative fan theories
were not adopted as geographic facts.

- [University](https://kingkiller.fandom.com/wiki/The_University): west of Imre,
  across the Omethi, connected by Stonebridge; town serving the students.
- [Anker's](https://kingkiller.fandom.com/wiki/Anker%27s): University-side inn,
  not in Imre. The existing marker and misleading description were corrected.
- [Archives](https://kingkiller.fandom.com/wiki/The_Archives): unadorned stone,
  no windows, one main set of doors. Haven remains on the University side.
- [Haven](https://kingkiller.fandom.com/wiki/Haven): University asylum.
- [Tarbean discussion](https://thatshelf.com/page-of-the-wind-on-cities/):
  the contrast between Hillside and Waterside; streets are editorial.
- [Mauthen Farm](https://kingkiller.fandom.com/wiki/Mauthen_Farm): near Trebon,
  with farmhouse, barn, windmill, wheatfields, pasture and pine/fir stands.
- [Trebon](https://kingkiller.fandom.com/wiki/Trebon): north of Imre; detailed
  relative placement of farm, standing stone and bluffs remains editorial.
- [Frame-story scene index](https://ezekeal.gitbooks.io/kingkiller-encyclopedia/content/present.html):
  the rural ruined-house encounter. No invented Newarre province is asserted.
- [Chapter 69 discussion](https://www.reddit.com/r/KingkillerChronicle/comments/doi6gc/):
  the House of the Wind is a courtyard observed from rooftops.

The exact street plans, compass bearings of local sites, terrain spacing,
architectural silhouettes and minor unnamed buildings are artistic choices.
The Underthing inset is explicitly schematic. Newarre's existing approximate
root gateway is unchanged and is not evidence for its canonical wider location.
The maps avoid depicting the wedding attack, town fire or scrael fight.

## Packaging safeguards

`replace-name-of-the-wind-maps.mjs` reads `map-manifest.json`, validates all PNG
dimensions and all 32 submap anchors, and converts top-origin image pixels to
bottom-origin Leaflet coordinates. Both PWK copies use the same new linked
map records. Both PWB copies also use those links, not old embedded map bytes:
importing an image bundle cannot overwrite the new maps with the old versions.
The PWB remains necessary for other existing embedded illustrations.

The editable world adopts the Library copy's existing fantasy theme while
synchronizing the two copies; story events, snapshots and timelines are retained.
The migration refuses unexpected coordinate-bearing collections rather than
silently leaving stale movement paths or annotations behind.

## Review status

Each final generated image is opened for direct artwork inspection. Anchors
are selected on the new images, not rescaled from old submaps. This is NOT an
in-app marker review. `cua.getState()` returned no apps or browsers.

Pending release checks: open all five layers in PlotWeave, inspect all markers
at useful zoom, follow all gateways and test event playback and image loading.
Do not mark EX-206–EX-208 or EX-506–EX-508 complete without that application pass.
Generation errors on initial University/Newarre attempts were retried rather
than substituted with the old maps. Full prompts are in the map manifest.

## Completed data checks

- Four final 1536 × 1024 PNG maps inspected; 32 explicit location anchors.
- Trebon's town hall was corrected to a flat roof with a rooftop cistern and
  re-inspected before assigning the final image.
- `node scripts/replace-name-of-the-wind-maps.mjs`: passed.
- `npm test -- --run libraryCatalogue exampleQuality exampleCompat`: 548 tests
  passed across three files.
- Both PWKs match byte-for-byte, 667,880 bytes each. Both PWBs match,
  1,831,070 bytes each; bundle map records have the same new URLs as the PWKs.
- Events, chapters, timelines, characters, character snapshots, items and
  relationships are unchanged from the pre-map-replacement Library world.
- PNG signatures/dimensions, anchor bounds and complete anchor coverage pass.
- `git diff --check`: passed.

## One-time merge exception — 2026-09-03

After being explicitly informed that the browser was unavailable and the
repository rules prohibit merging without the in-app checks, the user approved
a one-time exception to merge these map changes into development. The pending
visual checks above remain pending; this approval is not validation evidence
and does not change the authoring rules for future examples.
