import { GenerateSectionDialog } from '@/features/ai'
import { parseKnowledgeSpec, addKnowledgeToWorld } from '@/lib/sectionImport'
import type { SpecKnowledge } from '@/lib/worldSpec'

const PROMPT = `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON list of KNOWLEDGE facts — secrets and key information, tracking who knows what and when — no explanation, no markdown fences.

SHAPE:
{
  "format": "plotweave-knowledge",
  "knowledge": [
    {
      "title": "<the secret, e.g. 'The king is dead'>",
      "description": "<what it is>",
      "tags": ["mystery"],
      "origin": "<event title where it becomes true in-world>",
      "readerLearnsAt": "<event title where the reader learns it>",
      "revealedTo": [ { "who": "<character name>", "at": "<event title>" } ]
    }
  ]
}

GUIDANCE:
- "title" is required and must be unique; everything else is optional.
- "origin", "readerLearnsAt", and each reveal's "at" reference EXISTING events BY TITLE. "who" references EXISTING characters by name. Anything that doesn't match something already in the world is simply left unlinked — no events or characters are created. Add your events and characters first.
- "revealedTo" records which characters learn the fact, and at which event.
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY / SECRETS:
[DESCRIBE YOUR STORY, OR LIST THE SECRETS YOU WANT TO TRACK, HERE]`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function GenerateKnowledgeDialog({ open, onOpenChange, worldId }: Props) {
  return (
    <GenerateSectionDialog<SpecKnowledge[]>
      open={open}
      onOpenChange={onOpenChange}
      title="Generate Knowledge with AI"
      intro="Map out your story's secrets with any AI assistant (ChatGPT, Claude, Gemini…). Copy the prompt, describe your story, and paste back the JSON — facts are added to the world you're in now, linked to events and characters that already exist."
      noun={['fact', 'facts']}
      prompt={PROMPT}
      parse={(text) => {
        const { knowledge, error } = parseKnowledgeSpec(text)
        return error ? { error } : { data: knowledge }
      }}
      count={(k) => k.length}
      apply={(k) => addKnowledgeToWorld(worldId, k)}
    />
  )
}
