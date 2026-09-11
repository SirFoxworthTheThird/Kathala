# The Iliad — artwork review

Status: **in progress; release blocked**.

## Direction

All final artwork must be an original painted Neoclassical oil illustration with
Late Bronze Age Aegean or Anatolian material details. Photorealism, modern
objects, malformed anatomy, unclear limb ownership, bad weapon grips,
duplicated objects, pseudo-text, chronological spoilers and incorrect geography
are rejection conditions. Navigable maps and ordinary location scenes remain
separate assets.

## Reviewed recovery

- Opened and visually reviewed all 52 repository-hosted character portraits,
  including the recovered Priam portrait and the newly generated Machaon,
  Idomeneus, Sleep, Balius, Meriones and Artemis portraits. They are distinct
  and match their assigned entities; no rejected portrait is linked. The new
  portraits were checked for anatomy, hands or hooves, limb ownership, weapon
  and object grips, occlusion, duplication, period suitability, chronology and
  geography. Idomeneus and Balius were corrected to remove coastal-fortress
  imagery before acceptance. The accepted Agenor uses inland Late Bronze Age
  mudbrick ramparts and projecting gate towers; Thersites is anatomically
  coherent and avoids caricaturing the disability described in the poem.
- Opened and visually reviewed eleven repository-hosted location illustrations
  and eight supporting story illustrations. They depict separate locations or
  story subjects and are not used as navigable maps. The Temple of Athena uses
  a single cult image in a timber-and-mudbrick sanctuary with no pseudo-text,
  people, or later marble order. The Troy Burial Ground uses blank marker stones,
  coherent tumuli, and a cold pyre with inland Troy and Mount Ida beyond; it has
  no corpse, named tomb, inscription, or modern cemetery form. The Walls of Troy
  and Palace of Priam were accepted only after rejected crenellated/pseudo-text
  drafts were replaced.
- Opened both recovered navigable maps. The Achaean Camp map is a legible,
  purpose-specific schematic with distinct camp sectors. The Troad root map
  now isolates Mount Olympus inside a bordered `DISTANT INSET — NOT TO SCALE`
  panel; Troy, Mount Ida, Scamander, the plain and the Achaean shore remain on
  the main navigable geography. The corrected label is complete and legible.
- Opened the cover. Its scene and chronology fit Book XXIV, but the finish is
  too close to photography for the required painted Neoclassical direction.

The complete per-file state and reconstructed production prompts are recorded
in `asset-manifest.json`.

## Outstanding image work

- Six location illustrations: Achaean Assembly, Agamemnon’s Quarters, Achilles’
  Camp, Achaean Ships, Achaean Wall and Ditch and Myrmidon Open Ground.
- Ten object illustrations, one for every modeled object.
- The Troy navigable submap.
- Replacement of the cover with a clearly painted Neoclassical treatment.

## Validation still required

After the assets are complete, every final file must be opened again at useful
size. The application pass must then inspect the Troad, Troy and Achaean Camp
layers, all markers, both gateways, cross-layer playback, reading mode and the
unrestricted views listed in `docs/EXAMPLE_AUTHORING_CHECKLIST.md`. Until those
checks pass, the checklist completion statement must not say `COMPLETE`.

The production application build passed again on 11 September 2026. The managed
browser could not reach the container-local static server (`ERR_BLOCKED_BY_CLIENT`),
so no Library import, page-by-page application inspection, gateway exercise or
playback check is claimed by this recovery session.
