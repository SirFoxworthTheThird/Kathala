import { useState } from 'react'
import { Copy, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Prompt template
// ---------------------------------------------------------------------------

const PROMPT = `You are helping me import my story into PlotWeave, a story-tracking application. Your task is to read the story document I provide and generate a valid PlotWeave export file in JSON format that I can import directly.

Output ONLY the raw JSON — no explanation, no markdown fences, no commentary.

═══════════════════════════════════════════════════════════
FILE STRUCTURE
═══════════════════════════════════════════════════════════

{
  "version": 1,
  "type": "full",
  "exportedAt": <current unix timestamp in ms, e.g. 1700000000000>,
  "world": { ... },
  "characters": [ ... ],
  "items": [ ... ],
  "relationships": [ ... ],
  "timelines": [ ... ],
  "chapters": [ ... ],
  "events": [ ... ],
  "characterSnapshots": [ ... ],
  "mapLayers": [],
  "locationMarkers": [],
  "characterMovements": [],
  "itemPlacements": [],
  "locationSnapshots": [],
  "itemSnapshots": [],
  "relationshipSnapshots": [],
  "travelModes": [],
  "blobs": []
}

Use UUIDs in the format "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" for every id field.
Use the same timestamp (milliseconds) for all createdAt / updatedAt fields.

═══════════════════════════════════════════════════════════
SCHEMA REFERENCE
═══════════════════════════════════════════════════════════

── world (single object) ──────────────────────────────────
{
  "id": "<uuid>",
  "name": "<story/world title>",
  "description": "<brief description>",
  "coverImageId": null,
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}

── characters (one per named character) ───────────────────
{
  "id": "<uuid>",
  "worldId": "<world.id>",
  "name": "<full name>",
  "aliases": ["<nickname>", "<title>"],   // empty array if none
  "description": "<bio, role, key traits>",
  "portraitImageId": null,
  "tags": ["protagonist", "mage"],        // role/archetype tags
  "isAlive": true,                        // false if they die before the story ends
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}

── items (notable objects, weapons, artifacts) ─────────────
{
  "id": "<uuid>",
  "worldId": "<world.id>",
  "name": "<item name>",
  "description": "<description and significance>",
  "iconType": "<weapon|armor|potion|scroll|ring|key|treasure|book|artifact|other>",
  "imageId": null,
  "tags": []
}

── relationships (one per pair of related characters) ──────
{
  "id": "<uuid>",
  "worldId": "<world.id>",
  "characterAId": "<character id>",
  "characterBId": "<character id>",
  "label": "<mentor|rival|siblings|lover|allies|enemy|...>",
  "strength": "<weak|moderate|strong|bond>",
  "sentiment": "<positive|neutral|negative|complex>",
  "description": "<optional detail about this relationship>",
  "isBidirectional": true,
  "startChapterId": null,
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}

── timelines (at least one; use more for parallel storylines) ─
{
  "id": "<uuid>",
  "worldId": "<world.id>",
  "name": "Main Story",
  "description": "",
  "color": "#6366f1",
  "createdAt": <timestamp>
}

── chapters (one per chapter / act / major scene) ──────────
{
  "id": "<uuid>",
  "worldId": "<world.id>",
  "timelineId": "<timeline.id>",
  "number": 1,                  // sequential, starting at 1
  "title": "<chapter title>",
  "synopsis": "<2–4 sentence summary of what happens>",
  "notes": "",
  "travelDays": null,
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}

── events (key plot moments, 2–5 per chapter) ──────────────
{
  "id": "<uuid>",
  "worldId": "<world.id>",
  "chapterId": "<chapter.id>",
  "timelineId": "<timeline.id>",
  "title": "<short event title>",
  "description": "<what happens in detail>",
  "locationMarkerId": null,
  "involvedCharacterIds": ["<char id>", "..."],
  "involvedItemIds": ["<item id>"],   // empty array if none
  "tags": ["battle", "revelation"],   // thematic tags
  "sortOrder": 0,                     // ascending within a chapter
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}

── characterSnapshots (one per character × chapter) ────────
Create a snapshot for EVERY character in EVERY chapter they appear in,
showing their state at that point in the story.
{
  "id": "<uuid>",
  "worldId": "<world.id>",
  "characterId": "<character.id>",
  "chapterId": "<chapter.id>",
  "isAlive": true,              // set to false once the character dies
  "currentLocationMarkerId": null,
  "currentMapLayerId": null,
  "inventoryItemIds": [],
  "inventoryNotes": "",
  "statusNotes": "<what this character is doing / experiencing this chapter>",
  "travelModeId": null,
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}

═══════════════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════════════

1. Read the full story document.
2. Extract every named character; infer their role, traits, and fate.
3. Extract every meaningful relationship between characters.
4. Extract significant items/objects that appear in the story.
5. Divide the story into logical chapters (aim for 1 chapter per major scene or act).
6. For each chapter, write a synopsis and list 2–5 key events.
7. For each character × chapter combination, write a statusNotes sentence describing their situation.
8. Cross-reference all ids consistently — every characterId in events/snapshots must match a character in the characters array.
9. Output ONLY the final JSON object, starting with { and ending with }.

═══════════════════════════════════════════════════════════
MY STORY
═══════════════════════════════════════════════════════════

[PASTE YOUR STORY DOCUMENT HERE]`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LLMPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LLMPromptDialog({ open, onOpenChange }: LLMPromptDialogProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-[hsl(var(--border))] px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--ring))]" />
            Generate World from AI
          </DialogTitle>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-3 border-b border-[hsl(var(--border))] px-6 py-4">
          <p className="text-sm text-[hsl(var(--foreground))]">
            Use this prompt with any AI assistant (ChatGPT, Claude, Gemini, etc.) to turn a story document into a PlotWeave world file.
          </p>
          <ol className="flex flex-col gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">1.</span>Copy the prompt below.</li>
            <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">2.</span>Paste it into your AI assistant, then paste your story after the last line.</li>
            <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">3.</span>The AI will reply with a JSON block — save it as a <code className="font-mono">.pwk</code> file.</li>
            <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">4.</span>Import the file here using the <span className="font-semibold text-[hsl(var(--foreground))]">Import World</span> button.</li>
          </ol>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <pre className="h-full overflow-y-auto px-6 py-4 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))] whitespace-pre-wrap font-mono">
            {PROMPT}
          </pre>
        </div>

        <div className="shrink-0 border-t border-[hsl(var(--border))] px-6 py-3">
          <Button className="w-full gap-2" onClick={handleCopy}>
            {copied
              ? <><Check className="h-4 w-4" /> Copied!</>
              : <><Copy className="h-4 w-4" /> Copy Prompt</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
