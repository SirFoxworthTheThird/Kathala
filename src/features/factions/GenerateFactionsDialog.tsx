import { GenerateSectionDialog } from '@/features/ai'
import { parseFactionsSpec, addFactionsToWorld } from '@/lib/sectionImport'
import type { SpecFaction } from '@/lib/worldSpec'

const PROMPT = `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON list of FACTIONS — organizations characters belong to, like kingdoms, guilds, or cults — no explanation, no markdown fences.

SHAPE:
{
  "format": "plotweave-factions",
  "factions": [
    {
      "name": "<group>",
      "description": "<purpose>",
      "tags": ["religious"],
      "members": ["<character name>", { "name": "<character name>", "role": "Leader" }]
    }
  ]
}

GUIDANCE:
- "name" is required and must be unique; everything else is optional.
- "members" reference characters BY NAME. Only names that already exist in this world are linked — unknown names are ignored, and no characters are created. Generate characters first if you need them.
- A member is either a plain name string, or { "name": …, "role": … } to give them a role in the faction.
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY / FACTIONS:
[DESCRIBE YOUR STORY, OR LIST THE FACTIONS YOU WANT, HERE]`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function GenerateFactionsDialog({ open, onOpenChange, worldId }: Props) {
  return (
    <GenerateSectionDialog<SpecFaction[]>
      open={open}
      onOpenChange={onOpenChange}
      title="Generate Factions with AI"
      intro="Add factions to this world with any AI assistant (ChatGPT, Claude, Gemini…). Copy the prompt, describe your story, and paste back the JSON — the factions are added to the world you're in now, and members are linked to characters that already exist."
      noun={['faction', 'factions']}
      prompt={PROMPT}
      parse={(text) => {
        const { factions, error } = parseFactionsSpec(text)
        return error ? { error } : { data: factions }
      }}
      count={(factions) => factions.length}
      apply={(factions) => addFactionsToWorld(worldId, factions)}
    />
  )
}
