import { GenerateSectionDialog } from '@/features/ai'
import { parseItemsSpec, addItemsToWorld } from '@/lib/sectionImport'
import type { SpecItem } from '@/lib/worldSpec'

const PROMPT = `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON list of ITEMS — objects characters carry, use, or lose — no explanation, no markdown fences.

SHAPE:
{
  "format": "plotweave-items",
  "items": [
    { "name": "<item>", "description": "<why it matters>", "icon": "weapon", "tags": ["cursed"] }
  ]
}

GUIDANCE:
- "name" is required and must be unique; everything else is optional.
- "icon" is one of: weapon, armor, potion, scroll, ring, key, treasure, book, artifact, other. Pick the closest; default to "other".
- "tags" is an array of strings.
- Keep each description to a sentence: what the item is and why it matters to the story.
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY / ITEMS:
[DESCRIBE YOUR STORY, OR LIST THE ITEMS YOU WANT, HERE]`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function GenerateItemsDialog({ open, onOpenChange, worldId }: Props) {
  return (
    <GenerateSectionDialog<SpecItem[]>
      open={open}
      onOpenChange={onOpenChange}
      title="Generate Items with AI"
      intro="Add items to this world with any AI assistant (ChatGPT, Claude, Gemini…). Copy the prompt, describe your story, and paste back the JSON — the items are added to the world you're in now."
      noun={['item', 'items']}
      prompt={PROMPT}
      parse={(text) => {
        const { items, error } = parseItemsSpec(text)
        return error ? { error } : { data: items }
      }}
      count={(items) => items.length}
      apply={(items) => addItemsToWorld(worldId, items)}
    />
  )
}
