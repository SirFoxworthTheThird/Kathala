import { GenerateSectionDialog } from '@/features/ai'
import { parseLocationsSpec, addLocationsToWorld, countLocations } from '@/lib/sectionImport'
import type { SpecLocation } from '@/lib/sectionImport'

const PROMPT = `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON tree of LOCATIONS — the places in your world, nested from broad to specific — no explanation, no markdown fences.

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
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY / WORLD:
[DESCRIBE YOUR WORLD, OR LIST THE PLACES YOU WANT, HERE]`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function GenerateLocationsDialog({ open, onOpenChange, worldId }: Props) {
  return (
    <GenerateSectionDialog<SpecLocation[]>
      open={open}
      onOpenChange={onOpenChange}
      title="Generate Locations with AI"
      intro="Map out your world's places with any AI assistant (ChatGPT, Claude, Gemini…). Copy the prompt, describe your world, and paste back the JSON — the places are created as pins on an auto-generated Locations map, nested into sub-maps."
      noun={['location', 'locations']}
      prompt={PROMPT}
      parse={(text) => {
        const { locations, error } = parseLocationsSpec(text)
        return error ? { error } : { data: locations }
      }}
      count={(nodes) => countLocations(nodes)}
      apply={(nodes) => addLocationsToWorld(worldId, nodes)}
    />
  )
}
