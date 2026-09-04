# Dracula character and item art review

Status: artwork and application validation complete.

## Direction and rules

- Built-in image generation was used in original-image mode, with no source image supplied.
- The shared direction is mature late-Victorian Gothic book illustration: realistic anatomy and materials, engraved linework, restrained oil-and-gouache colour, textured paper, and an oxblood/charcoal/tarnished-brass/fog-grey palette.
- Photographs, actor likenesses, film costumes, maps used as portraits, generic icons, childish/cartoon rendering, modern objects, borders, logos, and watermarks were prohibited.
- Every named character and item has its own file and URL; no illustration is reused.
- All 42 accepted files were displayed and visually inspected for identity, style, period suitability, and obvious generation defects.

## Character coverage

Twenty-five portraits cover every character record, including distinct group compositions for the Three Vampire Women and the Szgany Retainers, and a naturalistic wolf portrait for Bersicker. Dracula follows the novel's early physical description rather than a familiar screen incarnation.

## Item coverage

Seventeen still lifes cover every item record: the five documentary objects, four protective/access objects, the earth boxes, garlic, wafers, stake and hammer, transfusion equipment, maps and timetables, kukri, Bowie knife, and Winchester rifles.

The first earth-box draft was rejected because it invented readable shipping marks. The accepted replacement uses completely blank crates, with one opened to make the Transylvanian earth unambiguous.

## Integration

`replace-character-item-art.mjs` preserves the existing character and item image IDs, replaces only their blob metadata, verifies every local file has a PNG signature, asserts one distinct URL per entity, independently preserves the example and downloadable PWK metadata, and updates the catalogue byte count.

## Application validation

Validated in the local development application on 3 September 2026:

- Downloaded Dracula from the in-app Library and opened it in Reading Mode.
- Advanced the reader cursor to chapter 27 and confirmed all 25 character cards were revealed.
- Inspected both upper and lower gallery rows: every portrait loaded, remained visually distinct, and used a suitable circular crop.
- Opened Jonathan Harker's detail view and confirmed the portrait header crop.
- Confirmed all 17 item records and thumbnails loaded in the Items gallery after normal progressive image loading.
- Opened the regenerated Boxes of Transylvanian Earth and Jonathan's Journal detail views and confirmed their header thumbnails and routes.
- No broken-image indicators, generic icons, route errors, or rendering failures were observed.
