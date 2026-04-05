import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, Sparkles, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { db } from '@/db/database'
import type { Chapter, WorldEvent, CharacterSnapshot } from '@/types'

// ── Types for the LLM response ────────────────────────────────────────────────

interface ChapterAIResponse {
  chapter: Chapter
  events: WorldEvent[]
  characterSnapshots: CharacterSnapshot[]
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  worldId: string,
  worldName: string,
  timelineId: string,
  timelineName: string,
  nextNumber: number,
  existingChapters: Chapter[],
  characters: ReturnType<typeof useCharacters>,
  items: ReturnType<typeof useItems>,
): string {
  const ts = Date.now()

  const chapterList = existingChapters.length > 0
    ? existingChapters.map((c) => `  - Ch.${c.number} "${c.title}"${c.synopsis ? ` — ${c.synopsis}` : ''}`).join('\n')
    : '  (none yet)'

  const characterList = characters.length > 0
    ? characters.map((c) => `  - "${c.name}" (id: "${c.id}")${c.description ? ` — ${c.description.slice(0, 120)}` : ''}${!c.isAlive ? ' [deceased]' : ''}`).join('\n')
    : '  (none)'

  const itemList = items.length > 0
    ? items.map((it) => `  - "${it.name}" (id: "${it.id}")${it.description ? ` — ${it.description.slice(0, 100)}` : ''}`).join('\n')
    : '  (none)'

  return `You are helping me add a new chapter to my story in PlotWeave, a story-tracking app.
Read the chapter content I provide, then output a single JSON object I can import directly.
Output ONLY the raw JSON — no explanation, no markdown fences.

═══════════════════════════════════════════════
WORLD CONTEXT  (copy these IDs exactly)
═══════════════════════════════════════════════

World:    "${worldName}"  (worldId: "${worldId}")
Timeline: "${timelineName}"  (timelineId: "${timelineId}")
New chapter number: ${nextNumber}
Use this timestamp for all createdAt / updatedAt fields: ${ts}

── Existing chapters (for narrative context only, do not recreate) ──
${chapterList}

── Characters — USE THESE EXACT IDs ──
${characterList}

── Items — USE THESE EXACT IDs (if relevant) ──
${itemList}

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

{
  "chapter": {
    "id": "<new uuid v4>",
    "worldId": "${worldId}",
    "timelineId": "${timelineId}",
    "number": ${nextNumber},
    "title": "<chapter title>",
    "synopsis": "<2–4 sentence summary of what happens>",
    "notes": "",
    "travelDays": null,
    "createdAt": ${ts},
    "updatedAt": ${ts}
  },
  "events": [
    {
      "id": "<new uuid>",
      "worldId": "${worldId}",
      "chapterId": "<same as chapter.id above>",
      "timelineId": "${timelineId}",
      "title": "<short event title>",
      "description": "<detailed description of what happens>",
      "locationMarkerId": null,
      "involvedCharacterIds": ["<use existing char id from list above>"],
      "involvedItemIds": [],
      "tags": ["<thematic tag>"],
      "sortOrder": 0,
      "createdAt": ${ts},
      "updatedAt": ${ts}
    }
    // ... 2–5 events total
  ],
  "characterSnapshots": [
    // One entry for EVERY character listed above
    {
      "id": "<new uuid>",
      "worldId": "${worldId}",
      "characterId": "<use existing char id from list above>",
      "chapterId": "<same as chapter.id above>",
      "isAlive": true,
      "currentLocationMarkerId": null,
      "currentMapLayerId": null,
      "inventoryItemIds": [],
      "inventoryNotes": "",
      "statusNotes": "<1–2 sentences: what this character is doing or experiencing this chapter>",
      "travelModeId": null,
      "createdAt": ${ts},
      "updatedAt": ${ts}
    }
  ]
}

═══════════════════════════════════════════════
RULES
═══════════════════════════════════════════════

1. Use proper UUID v4 format for every new id (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
2. Every characterId in events and snapshots MUST be one of the ids listed above.
3. Every itemId in involvedItemIds MUST be one of the item ids listed above.
4. Write a characterSnapshot for EVERY character in the list, even minor ones.
5. Set isAlive: false in the snapshot if the character dies in this chapter.
6. sortOrder in events starts at 0 and increments by 1.
7. Output ONLY the JSON object, starting with { and ending with }.

═══════════════════════════════════════════════
MY CHAPTER CONTENT
═══════════════════════════════════════════════

[PASTE YOUR CHAPTER / SCENE TEXT HERE]`
}

// ── Validation + import ───────────────────────────────────────────────────────

function validateResponse(
  raw: string,
  worldId: string,
  timelineId: string,
  characterIds: Set<string>,
  itemIds: Set<string>,
): ChapterAIResponse {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('Could not parse JSON. Make sure you copied the full response.') }

  if (typeof parsed !== 'object' || parsed === null) throw new Error('Response is not a JSON object.')
  const d = parsed as Record<string, unknown>

  // chapter
  if (typeof d.chapter !== 'object' || d.chapter === null) throw new Error('Missing "chapter" field.')
  const ch = d.chapter as Record<string, unknown>
  if (typeof ch.id !== 'string') throw new Error('chapter.id must be a string.')
  if (ch.worldId !== worldId) throw new Error(`chapter.worldId mismatch. Expected "${worldId}", got "${ch.worldId}".`)
  if (ch.timelineId !== timelineId) throw new Error(`chapter.timelineId mismatch. Expected "${timelineId}".`)
  if (typeof ch.number !== 'number') throw new Error('chapter.number must be a number.')
  if (typeof ch.title !== 'string' || !ch.title.trim()) throw new Error('chapter.title is required.')

  // events
  if (!Array.isArray(d.events)) throw new Error('Missing "events" array.')
  for (const ev of d.events as Record<string, unknown>[]) {
    if (typeof ev.id !== 'string') throw new Error('Each event must have an id string.')
    if (ev.worldId !== worldId) throw new Error(`Event "${ev.title}" has wrong worldId.`)
    if (ev.chapterId !== ch.id) throw new Error(`Event "${ev.title}" chapterId must match chapter.id.`)
    if (Array.isArray(ev.involvedCharacterIds)) {
      for (const cid of ev.involvedCharacterIds as string[]) {
        if (!characterIds.has(cid)) throw new Error(`Event "${ev.title}" references unknown characterId "${cid}".`)
      }
    }
    if (Array.isArray(ev.involvedItemIds)) {
      for (const iid of ev.involvedItemIds as string[]) {
        if (!itemIds.has(iid)) throw new Error(`Event "${ev.title}" references unknown itemId "${iid}".`)
      }
    }
  }

  // characterSnapshots
  if (!Array.isArray(d.characterSnapshots)) throw new Error('Missing "characterSnapshots" array.')
  for (const snap of d.characterSnapshots as Record<string, unknown>[]) {
    if (typeof snap.id !== 'string') throw new Error('Each snapshot must have an id string.')
    if (snap.worldId !== worldId) throw new Error('A snapshot has the wrong worldId.')
    if (snap.chapterId !== ch.id) throw new Error('A snapshot chapterId must match chapter.id.')
    if (typeof snap.characterId !== 'string' || !characterIds.has(snap.characterId as string)) {
      throw new Error(`Snapshot references unknown characterId "${snap.characterId}".`)
    }
  }

  return parsed as unknown as ChapterAIResponse
}

async function importChapter(data: ChapterAIResponse): Promise<string> {
  await db.transaction('rw', [db.chapters, db.events, db.characterSnapshots], async () => {
    await db.chapters.put(data.chapter)
    if (data.events.length) await db.events.bulkPut(data.events)
    if (data.characterSnapshots.length) await db.characterSnapshots.bulkPut(data.characterSnapshots)
  })
  return data.chapter.id
}

// ── Dialog ────────────────────────────────────────────────────────────────────

interface ChapterAIDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  worldName: string
  timelineId: string
  timelineName: string
  nextNumber: number
  existingChapters: Chapter[]
}

export function ChapterAIDialog({
  open, onOpenChange,
  worldId, worldName, timelineId, timelineName,
  nextNumber, existingChapters,
}: ChapterAIDialogProps) {
  const navigate = useNavigate()
  const characters = useCharacters(worldId)
  const items = useItems(worldId)

  const [step, setStep] = useState<'prompt' | 'paste'>('prompt')
  const [copied, setCopied] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const prompt = buildPrompt(worldId, worldName, timelineId, timelineName, nextNumber, existingChapters, characters, items)

  const characterIds = new Set(characters.map((c) => c.id))
  const itemIds = new Set(items.map((it) => it.id))

  function handleClose(v: boolean) {
    if (!v) {
      setStep('prompt')
      setPasteValue('')
      setError(null)
      setCopied(false)
    }
    onOpenChange(v)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleImport() {
    setError(null)
    setImporting(true)
    try {
      const data = validateResponse(pasteValue.trim(), worldId, timelineId, characterIds, itemIds)
      const chapterId = await importChapter(data)
      handleClose(false)
      navigate(`/worlds/${worldId}/timeline/${chapterId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-[hsl(var(--border))] px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--ring))]" />
            Generate Chapter {nextNumber} with AI
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex shrink-0 items-center gap-0 border-b border-[hsl(var(--border))]">
          {(['prompt', 'paste'] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                step === s
                  ? 'border-b-2 border-[hsl(var(--ring))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[10px]">{i + 1}</span>
              {s === 'prompt' ? 'Copy prompt' : 'Paste response'}
            </button>
          ))}
        </div>

        {step === 'prompt' && (
          <>
            <div className="shrink-0 px-6 py-3 text-xs text-[hsl(var(--muted-foreground))]">
              This prompt includes your world's real character and item IDs so the AI can reference them correctly.
              Copy it, paste into any AI assistant, then add your chapter text at the end.
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <pre className="h-full overflow-y-auto px-6 py-2 font-mono text-[10.5px] leading-relaxed text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">
                {prompt}
              </pre>
            </div>
            <div className="shrink-0 flex gap-2 border-t border-[hsl(var(--border))] px-6 py-3">
              <Button className="flex-1 gap-2" onClick={handleCopy}>
                {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Prompt</>}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setStep('paste')}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {step === 'paste' && (
          <>
            <div className="shrink-0 px-6 py-3 text-xs text-[hsl(var(--muted-foreground))]">
              Paste the AI's JSON response below. The chapter, events, and character snapshots will be added to your world.
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-6 pb-3">
              <textarea
                className="h-full w-full resize-none rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 font-mono text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                placeholder={'{\n  "chapter": { ... },\n  "events": [ ... ],\n  "characterSnapshots": [ ... ]\n}'}
                value={pasteValue}
                onChange={(e) => { setPasteValue(e.target.value); setError(null) }}
                spellCheck={false}
              />
            </div>
            {error && (
              <div className="mx-6 mb-3 flex items-start gap-2 rounded-md bg-red-950/30 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="shrink-0 flex gap-2 border-t border-[hsl(var(--border))] px-6 py-3">
              <Button variant="outline" onClick={() => setStep('prompt')}>
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={!pasteValue.trim() || importing}
                onClick={handleImport}
              >
                <Sparkles className="h-4 w-4" />
                {importing ? 'Importing...' : 'Import Chapter'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
