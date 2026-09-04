# Journey to the West — manuscript submap revision

Status: ARTWORK REVIEWED; APPLICATION VALIDATION PENDING. Do not mark the
example-authoring checklist complete or merge this revision as fully validated.

## Scope

Seven separately generated PNG maps: Road West, Chang'an, Vulture Peak,
Flower-Fruit Mountain, Celestial Court, Dragon Palace and Underworld.
The Four Continents chart, hierarchy, gateway IDs and story content are retained.
The generator reads the map manifest for asset dimensions, MIME type and
top-left pixel anchors, then applies the app's bottom-origin y conversion.
Event snapshots and movement endpoints inherit the revised location positions.
Original JPGs remain available as references and for recovery.

## Artwork inspection

All seven generated images were opened and visually inspected before assignment.
The new sheets have muted ink/wash, aged paper and mature architectural detail;
they remain maps with distinct paths, terrain, buildings and room divisions.
Cartoon people and modern English legends have been removed. The cave cutaway
and archive detail remain useful editorial insets rather than historical claims.
Follow-up edits added a visible Water-Belly Cave entrance and a distinct walled
City of the Wrongly Dead, both rechecked visually after generation.

Detailed-map anchors were picked against the new images, not blindly copied.
Major road anchors were also adjusted. Unlisted road locations remain inherited,
rescaled editorial approximations; they are NOT individually validated against
the new road artwork. The route must receive a complete marker review before
release, particularly its numerous small caves, settlements and water crossings.

## Blocking application checks

Automated checks: generator succeeded; `npm test -- --run libraryCatalogue
exampleQuality exampleCompat` passed all 548 tests across three files. Both PWK
copies are byte-identical (1,494,512 bytes), and the catalogue is regenerated.
PNG signatures and dimensions are checked by the generator; explicit anchors
were checked against image bounds. `git diff --check` passed.

`cua.getState()` returned empty apps and browsers. A subsequent
`cua.getBrowser({url: 'http://127.0.0.1:5173'})` returned `No browser is available`.
Consequently EX-206, EX-207, EX-208 and EX-506–EX-508 remain open for this revision.
The previous browser deferral for entity artwork is not recorded as approval to
skip this newly changed map validation.

- Load the downloadable PWK through Library, then disable reading mode.
- Open all eight layers and inspect every marker at sufficient zoom.
- Recheck inherited route approximations and adjust each to suitable terrain.
- Follow both three-level gateway chains and all other child gateways.
- Play events across layers, checking first-arrival zoom, centering and images.
- Check for broken URLs, loaders and console errors in the reader environment.

Full generation and correction prompts are in `generated-map-manifest.json`.
