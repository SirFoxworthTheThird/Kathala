# The Iliad — source and continuity audit

Audit date: 10 September 2026. Data audit complete; artwork and application
release gates remain open.

## Source

The canonical source is Homer, *The Iliad*, translated into English prose by
Samuel Butler, Project Gutenberg eBook 2199:
https://www.gutenberg.org/ebooks/2199

The previously supplied eBook number 6130 was checked and belongs to Alexander
Pope’s translation, not Butler’s. The shipped Lore already records the corrected
Butler identifier. Gutenberg’s Butler text contains Books I–XXIV and identifies
Samuel Butler as translator. The source numbers the books; PlotWeave’s
descriptive book titles and exact calendar/time values are documented editorial
aids rather than source headings or historical claims.

Spot checks against the complete Butler text confirmed the recovered additions:
Chryseis’s return and sacrifice in Book I; Thersites’s challenge in Book II;
Machaon’s treatment and later wound in Books IV and XI; Idomeneus and Meriones
on the Achaean left in Book XIII; Sleep’s bargain with Hera in Book XIV; Balius
beside Xanthus in Books XVI and XIX; Artemis (Diana in Butler) in the divine
battle of Book XXI; and Agenor’s stand and Apollo’s rescue in Book XXI.

## Scene drafts

All 75 modeled events have a scene draft containing the corresponding
public-domain Butler narrative. The checked-in source is parsed reproducibly;
Gutenberg front matter, the translator’s per-book prose summaries, and end
matter are excluded. A range-coverage assertion ensures that every narrative
paragraph in Books I–XXIV is assigned exactly once. Parallel passages in Books
I and XVII–XVIII are attached to their matching event even where the poem
intercuts those actions. Together the event drafts contain 151,966 words.

## Structure and chronology

- 24 books appear in reading order, each with meaningful events.
- 75 events use one continuous timeline and strictly increasing cumulative
  `inWorldTime` values from 0 through 74.
- Tension values remain within 1–5 and elapsed-time values are non-negative.
- The two PWK files are byte-identical at 1,256,724 UTF-8 bytes.
- Catalogue metadata matches 52 characters, 24 chapters, 75 events and 17
  locations, with world ID `iliad-world`.

## Characters, knowledge and relationships

- 250 character snapshots correspond exactly to physically/directly involved
  characters; no involved character lacks a snapshot and no absent character
  has one.
- Snapshot location and map IDs agree with each event’s location. Status notes
  are event-specific and unique within their event.
- Involved and mentioned character sets do not overlap in any event.
- Death, injury, inventory and ownership changes pass the repository quality
  tests and the Iliad validator’s chronological/reference checks.
- All 11 knowledge facts have existing origin and reader-reveal events; no
  reader reveal precedes its origin. All 11 reveal records resolve.
- All 23 relationships reference existing characters.

## Maps

The hierarchy is Troad root → Troy and Troad root → Achaean Camp. Each submap
has one parent gateway and contains its story-relevant locations. Snapshot map
assignments follow this hierarchy. The root map image remains rejected because
it depicts Mount Olympus beside Troy; data structure validity does not excuse
that geographical defect.

## Automated evidence

- `npm test -- --run libraryCatalogue exampleQuality exampleCompat`: 3 files
  passed, 582 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- `node scripts/generate-iliad-example.mjs`: passed and preserved both PWKs and
  exact catalogue metadata.
- `node scripts/validate-iliad-example.mjs`: correctly fails the release gate
  while 29 expected files are missing and two existing files require replacement.

## Open gates

Image generation, final per-image review, a geographically corrected Troad map,
the Troy map, the Neoclassical cover replacement, and the complete in-app
reading/unrestricted pass remain incomplete. The managed browser could not
reach the container-local application, so no page, gateway, marker or playback
claim is made here.
