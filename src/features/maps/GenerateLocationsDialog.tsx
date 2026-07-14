import { useMemo } from 'react'
import { GenerateSectionDialog } from '@/features/ai'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { parseLocationsSpec, addLocationsToWorld, countLocations, formatLocationTree } from '@/lib/sectionImport'
import type { SpecLocation } from '@/lib/sectionImport'

function buildPrompt(existingTree: string): string {
  const existingBlock = existingTree
    ? `\nALREADY IN THIS WORLD — these places already exist (indentation shows nesting). Do NOT recreate them. Add NEW places, or extend the tree by nesting new children under one of these — reuse a place's EXACT name to add under it (a matching name is updated in place, never duplicated):
${existingTree}
`
    : ''

  return `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON tree of LOCATIONS — the places in your world, nested from broad to specific — no explanation, no markdown fences.

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
- "name" is required; everything else is optional. Nest places with "children" (continent → kingdom → city → district), as deep as makes sense.
- "type" is one of: city, town, dungeon, landmark, building, region, custom. Pick the closest.
- PlotWeave has no standalone "places" list, so these are created as pins on an auto-generated **Locations map**; a place with children becomes a pin that drills into a sub-map holding them. No image is needed — a blank map is created for you.
- To add a place UNDER one that already exists, use that place's exact name as a parent and put the new place in its "children". Reusing an existing name updates it in place rather than duplicating it.
- Output ONLY the JSON object, starting with { and ending with }.
${existingBlock}
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
