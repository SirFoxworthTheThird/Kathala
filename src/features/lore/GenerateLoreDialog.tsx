import { GenerateSectionDialog } from '@/features/ai'
import { parseLoreSpec, addLoreToWorld } from '@/lib/sectionImport'
import type { SpecLore } from '@/lib/worldSpec'

const PROMPT = `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON list of LORE pages — your world's history, rules, and mythology — no explanation, no markdown fences.

SHAPE:
{
  "format": "plotweave-lore",
  "lore": [
    { "category": "Magic", "title": "<page title>", "body": "<markdown>", "tags": ["system"] }
  ]
}

GUIDANCE:
- "title" is required and must be unique; everything else is optional.
- "category" groups pages (e.g. Magic, History, Geography, Religion, Culture). Reuse the same category name across pages to file them together — categories are created automatically.
- "body" is markdown: a few sentences to a few paragraphs about the topic.
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY / WORLD:
[DESCRIBE YOUR WORLD, OR LIST THE LORE TOPICS YOU WANT, HERE]`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function GenerateLoreDialog({ open, onOpenChange, worldId }: Props) {
  return (
    <GenerateSectionDialog<SpecLore[]>
      open={open}
      onOpenChange={onOpenChange}
      title="Generate Lore with AI"
      intro="Flesh out your world's history and rules with any AI assistant (ChatGPT, Claude, Gemini…). Copy the prompt, describe your world, and paste back the JSON — the lore pages are added to the world you're in now, grouped into categories."
      noun={['lore page', 'lore pages']}
      prompt={PROMPT}
      parse={(text) => {
        const { lore, error } = parseLoreSpec(text)
        return error ? { error } : { data: lore }
      }}
      count={(lore) => lore.length}
      apply={(lore) => addLoreToWorld(worldId, lore)}
    />
  )
}
