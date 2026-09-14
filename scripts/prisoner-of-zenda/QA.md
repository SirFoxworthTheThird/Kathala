# The Prisoner of Zenda — QA ledger

## Source and structure

- [x] Project Gutenberg eBook 95 recorded as the public-domain source.
- [x] Gutenberg front/end matter excluded.
- [x] All 22 source chapters retained in order.
- [x] 55 editorial scenes reconstruct all 53,408 narrative words byte-for-byte.
- [x] Scene cuts follow changes of place, cast, knowledge, or immediate objective.

## Story model

- [x] One chronology; the novel does not require parallel timelines.
- [x] Every event has a location, tension from 1–5, an absolute calendar day, and elapsed time.
- [x] Character snapshots exist only for characters physically present.
- [x] Every snapshot has an event-specific, character-specific current state.
- [x] Relationships, changing relationships, goals, factions, lore, knowledge, items, motifs, and plot threads are represented.
- [x] Death state begins at the event where the death occurs, never before it.

## Maps

- [x] Hierarchy designed: Europe → Ruritania → Strelsau/Zenda → Castle of Zenda.
- [x] Every non-root map has exactly one parent-map gateway.
- [x] Every event location belongs to a map layer.
- [x] Generate and review all five original period maps as functional cartography.
- [x] Import in authoring mode and visually place every marker against the rendered maps.
- [x] Exercise every nested layer through Europe → Ruritania → Strelsau and Europe → Ruritania → Zenda → Castle.
- [x] Run playback across the Zenda-to-castle map change and confirm first-arrival character focus and zoom.

## Artwork

- [x] Original cover generated and reviewed.
- [x] Eighteen distinct character portraits generated and reviewed; only the intentional royal doubles resemble one another.
- [x] Europe overview map generated and reviewed as functional cartography.
- [x] Generate and review all 31 location and nine item illustrations.
- [x] Verify every asset exists at the same library-relative URL used by the `.pwk`.

The generated example has passed structural, source-losslessness, asset-resolution, and in-app map/playback validation.
