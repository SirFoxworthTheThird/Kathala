import { GenerateSectionDialog } from '@/features/ai'
import { parseCharactersSpec, addCharactersToWorld } from '@/lib/sectionImport'
import type { SpecCharacter } from '@/lib/worldSpec'

const PROMPT = `You are helping me populate my story in PlotWeave, a story-tracking app. Output ONLY a compact JSON list of CHARACTERS — no explanation, no markdown fences.

SHAPE:
{
  "format": "plotweave-characters",
  "characters": [
    { "name": "<full name>", "aliases": ["<nickname>"], "description": "<role & key traits>", "tags": ["protagonist"], "alive": true }
  ]
}

GUIDANCE:
- "name" is required and must be unique; everything else is optional.
- "aliases" and "tags" are arrays of strings. "alive" defaults to true — set it false for characters who are already dead.
- Keep each description to a sentence or two: their role in the story and a couple of defining traits.
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY / CAST:
[DESCRIBE YOUR STORY, OR LIST THE CHARACTERS YOU WANT, HERE]`

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function GenerateCharactersDialog({ open, onOpenChange, worldId }: Props) {
  return (
    <GenerateSectionDialog<SpecCharacter[]>
      open={open}
      onOpenChange={onOpenChange}
      title="Generate Characters with AI"
      intro="Add a cast to this world with any AI assistant (ChatGPT, Claude, Gemini…). Copy the prompt, describe your story, and paste back the JSON — the characters are added to the world you're in now."
      noun={['character', 'characters']}
      prompt={PROMPT}
      parse={(text) => {
        const { characters, error } = parseCharactersSpec(text)
        return error ? { error } : { data: characters }
      }}
      count={(chars) => chars.length}
      apply={(chars) => addCharactersToWorld(worldId, chars)}
    />
  )
}
