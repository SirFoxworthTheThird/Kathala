import { useMemo, useState } from 'react'
import { Copy, Check, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { parseWorldSpec, worldSpecStats, createWorldFromSpec } from '@/lib/worldSpec'

// ---------------------------------------------------------------------------
// Prompt template — asks for a compact "story spec" (names, not UUIDs; state as
// deltas). The app expands it on import, so large stories don't overflow the
// model's output limit and truncate.
// ---------------------------------------------------------------------------

const PROMPT = `You are helping me import my story into PlotWeave, a story-tracking app. Read the story I provide and output a compact "story spec" as JSON that PlotWeave expands on import.

Output ONLY the raw JSON — no explanation, no markdown fences.

TWO RULES THAT KEEP THE OUTPUT SMALL (so long stories don't get cut off):
1. Reference everything BY NAME — never invent ids/UUIDs.
2. Give character state as CHANGES only. Add a "changes" entry for a character solely when something changes for them at that event (they first appear, move, gain/lose an item, die, or their situation shifts). Do NOT repeat unchanged state every scene.

SHAPE:
{
  "format": "plotweave-spec",
  "version": 1,
  "world": { "name": "<title>", "description": "<1-2 sentences>" },
  "characters": [
    { "name": "<full name>", "aliases": ["<nickname>"], "description": "<role & key traits>", "tags": ["protagonist"], "alive": true }
  ],
  "items": [
    { "name": "<item>", "description": "<why it matters>", "icon": "weapon|armor|potion|scroll|ring|key|treasure|book|artifact|other" }
  ],
  "factions": [
    { "name": "<group>", "description": "<purpose>", "members": ["<char name>", { "name": "<char name>", "role": "Leader" }] }
  ],
  "relationships": [
    { "a": "<char>", "b": "<char>", "label": "mentor|rival|siblings|lover|allies|enemy", "strength": "weak|moderate|strong|bond", "sentiment": "positive|neutral|negative|complex", "description": "<optional>" }
  ],
  "chapters": [
    {
      "title": "<chapter title>",
      "synopsis": "<2-4 sentence summary>",
      "events": [
        {
          "id": "e1",
          "title": "<short event title>",
          "description": "<what happens>",
          "characters": ["<names present in the scene>"],
          "pov": "<name, or omit>",
          "mentioned": ["<names referenced but absent>"],
          "items": ["<item names involved>"],
          "tags": ["battle", "revelation"],
          "tension": 3,
          "beat": "hook|inciting-incident|plot-point-1|midpoint|plot-point-2|climax|resolution",
          "flashback": false,
          "changes": [
            { "who": "<name>", "location": "<place>", "gains": ["<item>"], "loses": ["<item>"], "dies": true, "note": "<what they're doing/feeling now>" }
          ]
        }
      ]
    }
  ],
  "lore": [
    { "category": "Magic|History|Geography|Religion|...", "title": "<page title>", "body": "<markdown>" }
  ],
  "knowledge": [
    { "title": "<secret, e.g. 'The king is dead'>", "description": "<what it is>", "origin": "<event id where it becomes true>", "readerLearnsAt": "<event id, or omit>", "revealedTo": [ { "who": "<name>", "at": "<event id>" } ] }
  ]
}

GUIDANCE:
- Divide the story into chapters (roughly one per major scene or act), 1-5 events each, in order.
- Every name in characters/pov/members/relationships/changes must match a character "name" (or alias).
- Put an "id" slug (e.g. "e1", "e2") on an event only if a knowledge entry needs to point at it. Slugs must be unique.
- tension (1-5), beat, and knowledge are optional — include them when the story supports it.
- Omit fields you have nothing for (empty arrays are fine too). Every field is optional except world.name and chapters.
- Output ONLY the JSON object, starting with { and ending with }.

MY STORY:
[PASTE YOUR STORY DOCUMENT HERE]`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LLMPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: (worldId: string) => void
}

const nf = new Intl.NumberFormat()

export function LLMPromptDialog({ open, onOpenChange, onImported }: LLMPromptDialogProps) {
  const [copied, setCopied] = useState(false)
  const [raw, setRaw] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => (raw.trim() ? parseWorldSpec(raw) : null), [raw])
  const spec = parsed?.spec
  const stats = useMemo(() => (spec ? worldSpecStats(spec) : null), [spec])

  async function handleCopy() {
    await navigator.clipboard.writeText(PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setRaw('')
    setError(null)
  }

  async function handleImport() {
    if (!spec) return
    setImporting(true)
    setError(null)
    try {
      const worldId = await createWorldFromSpec(spec)
      reset()
      onOpenChange(false)
      onImported?.(worldId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-y-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[hsl(var(--border))] px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--ring))]" />
            Generate World from AI
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] px-6 py-4">
            <p className="text-sm text-[hsl(var(--foreground))]">
              Turn a story document into a PlotWeave world using any AI assistant (ChatGPT, Claude, Gemini…).
              The prompt asks for a <span className="font-medium">compact spec</span> — names instead of ids, and only
              state <span className="font-medium">changes</span> — so even long books fit without getting cut off.
            </p>
            <ol className="flex flex-col gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">1.</span>Copy the prompt.</li>
              <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">2.</span>Paste it into your AI assistant, then paste your story after the last line.</li>
              <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">3.</span>Copy the JSON it returns and paste it in the box below.</li>
              <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">4.</span>Review the preview and click <span className="font-semibold text-[hsl(var(--foreground))]">Import</span>.</li>
            </ol>
          </div>

          {/* The prompt */}
          <div className="relative border-b border-[hsl(var(--border))]">
            <div className="sticky top-0 flex justify-end bg-gradient-to-b from-[hsl(var(--card))] to-transparent px-6 pt-3">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopy}>
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy prompt</>}
              </Button>
            </div>
            <pre className="max-h-64 overflow-y-auto px-6 pb-4 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))] whitespace-pre-wrap font-mono">
              {PROMPT}
            </pre>
          </div>

          {/* Paste the result */}
          <div className="flex flex-col gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <Wand2 className="h-4 w-4 text-[hsl(var(--ring))]" />
              Paste the AI’s JSON result
            </div>
            <textarea
              aria-label="Story spec JSON"
              placeholder={'{\n  "world": { "name": "…" },\n  "characters": [ … ],\n  "chapters": [ … ]\n}'}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />

            {raw.trim() && parsed?.error && (
              <p className="text-xs text-red-400" role="alert">{parsed.error}</p>
            )}
            {spec && stats && (
              <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="font-medium text-[hsl(var(--foreground))]">{spec.world.name}</span>
                {' — '}
                {nf.format(stats.characters)} character{stats.characters !== 1 ? 's' : ''} ·{' '}
                {nf.format(stats.chapters)} chapter{stats.chapters !== 1 ? 's' : ''} ·{' '}
                {nf.format(stats.events)} scene{stats.events !== 1 ? 's' : ''}
                {stats.factions > 0 && <> · {nf.format(stats.factions)} faction{stats.factions !== 1 ? 's' : ''}</>}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[hsl(var(--border))] px-6 py-3">
          {error ? <p className="text-xs text-red-400" role="alert">{error}</p> : <span />}
          <Button className="gap-2" onClick={handleImport} disabled={!spec || importing}>
            <Sparkles className="h-4 w-4" />
            {importing ? 'Importing…' : 'Import world'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
