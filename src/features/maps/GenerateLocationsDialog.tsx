import { useMemo } from 'react'
import { GenerateSectionDialog } from '@/features/ai'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { parseLocationsSpec, addLocationsToWorld, countLocations, formatLocationTree } from '@/lib/sectionImport'
import type { SpecLocation } from '@/lib/sectionImport'

function buildPrompt(existingTree: string): string {
  const existingBlock = existingTree
    ? `
PLACES ALREADY IN THIS WORLD (indentation shows nesting) — do NOT recreate these; only ADD new places or nest new children under one of them. To add under an existing place, reuse its EXACT name as a parent and put the new place in its "children" (a matching name is updated in place, never duplicated):
${existingTree}
`
    : ''

  return `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON list of the PLACES in your world (each place may nest others via "children") — no explanation, no markdown fences.
${existingBlock}
SHAPE:
{
  "format": "plotweave-locations",
  "locations": [
    {
      "name": "<place>",
      "description": "<what it is>",
      "type": "region",
      "children": [
        { "name": "<sub-place>", "type": "city", "children": [ { "name": "<district or building>", "type": "building" } ] }
      ]
    }
  ]
}

GUIDANCE:
- The "locations" array holds the highest-level places. If the story has ONE overarching place — a world, realm, or continent that contains everything (e.g. a named setting) — you MAY make it the single top-level entry and nest everything else under it; otherwise list several top-level places. Follow the story and any instruction below. The only forbidden name is a generic container literally called "Locations" — that name is reserved, so never use it.
- A "location" is any PLACE — a world, a continent, a kingdom, a city, a tavern, a forest, a single room. It is NOT a map. Don't limit yourself to big, map-worthy places; include small and specific ones too.
- "children" means "places contained within this place" (a city inside a kingdom, a room inside an inn). Nest as deep as makes sense; a place with no sub-places just omits "children".
- "name" is required; "description" and "type" are optional. "type" is one of: city, town, dungeon, landmark, building, region, custom — pick the closest.
- If a place from "PLACES ALREADY IN THIS WORLD" above should gain sub-places, include it by its exact name with the new sub-places under "children"; otherwise don't repeat it.
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY / WORLD:
[DESCRIBE YOUR WORLD, OR LIST THE PLACES YOU WANT, HERE]`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function GenerateLocationsDialog({ open, onOpenChange, worldId }: Props) {
  const layers = useMapLayers(worldId)
  const markers = useAllLocationMarkers(worldId)
  const prompt = useMemo(() => buildPrompt(formatLocationTree(layers ?? [], markers ?? [])), [layers, markers])

  return (
    <GenerateSectionDialog<SpecLocation[]>
      open={open}
      onOpenChange={onOpenChange}
      title="Generate Locations with AI"
      intro="Map out your world's places with any AI assistant (ChatGPT, Claude, Gemini…). Copy the prompt, describe your world, and paste back the JSON — the places are created as pins on an auto-generated Locations map, nested into sub-maps. The prompt lists any places you already have so the AI extends them instead of repeating."
      noun={['location', 'locations']}
      prompt={prompt}
      parse={(text) => {
        const { locations, error } = parseLocationsSpec(text)
        return error ? { error } : { data: locations }
      }}
      count={(nodes) => countLocations(nodes)}
      apply={(nodes) => addLocationsToWorld(worldId, nodes)}
    />
  )
}
