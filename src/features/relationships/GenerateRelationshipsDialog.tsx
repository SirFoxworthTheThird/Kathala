import { GenerateSectionDialog } from '@/features/ai'
import { parseRelationshipsSpec, addRelationshipsToWorld } from '@/lib/sectionImport'
import type { SpecRelationship } from '@/lib/sectionImport'

const PROMPT = `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON list of RELATIONSHIPS between characters — no explanation, no markdown fences.

SHAPE:
{
  "format": "plotweave-relationships",
  "relationships": [
    {
      "a": "<character name>", "b": "<character name>",
      "label": "mentor", "strength": "strong", "sentiment": "positive", "description": "<optional>",
      "changes": [
        { "at": "<event title>", "label": "rivals", "sentiment": "negative", "description": "<what shifted>" },
        { "at": "<later event title>", "label": "reconciled", "sentiment": "positive" }
      ]
    }
  ]
}

GUIDANCE:
- "a" and "b" are required and reference characters BY NAME. Only pairs where BOTH names already exist in this world are added — unknown names are ignored, and no characters are created. Generate characters first.
- "label" is a short word or phrase (mentor, rival, siblings, lover, allies, enemy…).
- "strength" is one of: weak, moderate, strong, bond. "sentiment" is one of: positive, neutral, negative, complex.
- The top-level "label"/"strength"/"sentiment" are the relationship's DEFAULT (starting) state.
- Relationships change over the story. Use "changes" to record how the bond shifts at specific EVENTS: each "at" is an EXISTING event title (add your timeline/events first), and it sets the state from that event onward. Omitted fields inherit the current state; set "ended": true when the relationship breaks off. Skip "changes" for bonds that never change.
- Give each unordered pair of characters at most one relationship.
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY / RELATIONSHIPS:
[DESCRIBE YOUR STORY, OR LIST THE RELATIONSHIPS YOU WANT, HERE]`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function GenerateRelationshipsDialog({ open, onOpenChange, worldId }: Props) {
  return (
    <GenerateSectionDialog<SpecRelationship[]>
      open={open}
      onOpenChange={onOpenChange}
      title="Generate Relationships with AI"
      intro="Map out how your cast connects with any AI assistant (ChatGPT, Claude, Gemini…). Copy the prompt, describe your story, and paste back the JSON — relationships are added to the world you're in now, between characters that already exist."
      noun={['relationship', 'relationships']}
      prompt={PROMPT}
      parse={(text) => {
        const { relationships, error } = parseRelationshipsSpec(text)
        return error ? { error } : { data: relationships }
      }}
      count={(rels) => rels.length}
      apply={(rels) => addRelationshipsToWorld(worldId, rels)}
    />
  )
}
