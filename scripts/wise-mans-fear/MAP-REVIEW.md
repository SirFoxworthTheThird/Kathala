# The Wise Man's Fear — atlas map revision

Status: artwork and package work finished; application validation pending. Automated validation: 548 tests passed across libraryCatalogue, exampleQuality and exampleCompat.

This is a targeted map revision, not a new complete-book adaptation or an audit of all existing story records. The Name of the Wind's four newly drawn shared maps are deliberately reused. Six additional compositions were generated with the built-in image-generation tool, using only the Four Corners main map as a style reference. No former submap was supplied, traced, or used as a composition reference.

## Assets and reproduction

- New images: `public/library/the-wise-man-s-fear/maps/*-atlas.png`.
- Shared images: `public/library/the-name-of-the-wind/maps/*-atlas.png`.
- Full generation prompts, sources, measured top-left anchors, and editorial limitations: `map-manifest.json` and the shared Name of the Wind manifest.
- Apply package changes: `node scripts/replace-wise-mans-fear-maps.mjs`.
- Validate: `npm test -- --run libraryCatalogue exampleQuality exampleCompat`.

The six old placeholders all referenced the main map's image ID. The migration gives every submap a dedicated image ID, preserves the main image, and removes only unreferenced former map blobs. Inspection found no remaining embedded artwork in the Wise Man's Fear bundle after replacing its four inherited maps. All surviving links are in PWK, so its now-obsolete PWB is removed from both folders and the catalogue. Both PWK copies are synchronized and catalogue byte sizes recalculated. This does not remove the Name of the Wind's still-needed PWB.

## Artwork review

Each final generated image was displayed and inspected before assignment. Shared images were reopened during this revision. All marker anchors are assigned explicitly to the final artwork, never proportionally stretched from old coordinates. The migration flips top-origin image y coordinates exactly once.

- Severen: wealthy plateau and crowded lower city separated by the Sheer; two stairs and lifts visible; estate gateway sits on the upper palace, not the cliff face.
- Estate: courtyard and gardens form a navigable bird's-eye plan. Three named room insets are schematic and receive the corresponding room markers; their precise floor and arrangement are not asserted to be canonical.
- Eld: small mercenary camp distinct from the larger forest encampment with its central intact oak. No attack outcome in base artwork.
- Fae: glade and pavilion separated from the solitary flowering tree in its broad meadow. Neutral tree label avoids revealing its nature on the base image. Not a map of the entire realm.
- Ademre: low stone buildings sheltered by slopes and bluffs; school court and Sword Tree distinct; mountainous terrain, not a generic fortified town.
- Levinshir: village, nearby farm and roadside wagon camp. Pennysworth appears in a separate locality inset near the Eld, not as a surveyed neighboring village. Exact camp/farm bearings and distances are editorial.
- Shared University map: Grey Man marker uses a separate Imre-side inn footprint; its exact address is editorial. All inherited anchors match the first book's new atlas.

## Geographic limits

The main map is retained unchanged as requested by the style-matching task. Its accuracy is not newly certified by this revision. Newarre's location, the Fae gateway, and broad journey waypoints on that map remain approximate navigation aids. Existing story events, character snapshots, chronology and reveal settings are preserved. This revision does not claim a full source-edition review.

## Mandatory remaining application checks

The browser tool returned no available browsers or applications during this task. Therefore no GUI validation is claimed and this revision must not be described as release-complete (EX-206–208, EX-506–508). On 2026-09-03, after being explicitly informed of this merge gate, the user approved a one-time exception to merge the map updates into development with visual validation pending. The exception does not mark these checks complete or weaken the authoring rules for future work.

- [ ] Download/import the updated Library PWK (no PWB needed for this book now).
- [ ] Inspect all 11 layers in PlotWeave at useful zoom, including every marker.
- [ ] Exercise all gateways, especially Temerant → Severen → Maer's Estate.
- [ ] Check reading mode and editing mode, image loading and console health.
- [ ] Exercise playback across map transitions and first-arrival zoom.
- [ ] Verify the deployed relative image URLs once assets are published.

Local file/image review and automated tests do not satisfy these unchecked GUI gates.
