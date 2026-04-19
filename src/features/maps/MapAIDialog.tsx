import { useState, useMemo } from 'react'
import { Copy, Check, Sparkles, ArrowRight, AlertCircle, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { fetchSnapshot, upsertSnapshot } from '@/db/hooks/useSnapshots'

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  worldId: string,
  characters: ReturnType<typeof useCharacters>,
  events: ReturnType<typeof useWorldEvents>,
  chapters: ReturnType<typeof useWorldChapters>,
  markers: ReturnType<typeof useAllLocationMarkers>,
  layers: ReturnType<typeof useMapLayers>,
): string {
  const chapById = new Map(chapters.map((c) => [c.id, c]))
  const layerById = new Map(layers.map((l) => [l.id, l]))

  const charList = characters.length > 0
    ? characters.map((c) => `  - "${c.name}" (id: "${c.id}")${c.description ? ` — ${c.description.slice(0, 80)}` : ''}`).join('\n')
    : '  (none)'

  const locationList = markers.length > 0
    ? markers.map((m) => {
        const layer = layerById.get(m.mapLayerId)
        const layerHint = layer ? ` [map: "${layer.name}", mapLayerId: "${m.mapLayerId}"]` : ''
        return `  - "${m.name}" (markerId: "${m.id}"${layerHint})`
      }).join('\n')
    : '  (none)'

  const sortedEvents = [...events].sort((a, b) => {
    const chapA = chapById.get(a.chapterId)
    const chapB = chapById.get(b.chapterId)
    const orderA = (chapA?.number ?? 0) * 10_000 + a.sortOrder
    const orderB = (chapB?.number ?? 0) * 10_000 + b.sortOrder
    return orderA - orderB
  })

  const eventList = sortedEvents.length > 0
    ? sortedEvents.map((e) => {
        const ch = chapById.get(e.chapterId)
        return `  - "${e.title}" (eventId: "${e.id}")${ch ? ` [Ch.${ch.number}]` : ''}${e.description ? ` — ${e.description.slice(0, 80)}` : ''}`
      }).join('\n')
    : '  (none)'

  return `You are helping me extract character location moves from narrative prose in PlotWeave (worldId: "${worldId}").

I will paste travel narrative text below this prompt. Read it carefully and extract which character is at which location at each event.

Output ONLY a JSON array — no explanation, no markdown fences, no trailing text.

═══════════════════════════════════════════════
WORLD CONTEXT  (copy these IDs exactly)
═══════════════════════════════════════════════

── Characters ──
${charList}

── Locations ──
${locationList}

── Events ──
${eventList}

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

[
  {
    "characterId": "<id from Characters list>",
    "eventId": "<id from Events list>",
    "locationMarkerId": "<markerId from Locations list>",
    "mapLayerId": "<mapLayerId from Locations list>"
  }
]

Rules:
- Only include entries where you are confident about the character's location at that event.
- Skip any event/character pairs where the location is ambiguous or not mentioned.
- Use EXACT IDs — never invent new ones.
- You may include multiple entries for the same event (one per character).
- You may include multiple entries for the same character (one per event).

── Paste your travel narrative below this line ──
`
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocationMove {
  characterId: string
  eventId: string
  locationMarkerId: string
  mapLayerId: string
}

type Step = 'prompt' | 'paste' | 'review'

// ── Component ─────────────────────────────────────────────────────────────────

interface MapAIDialogProps {
  worldId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MapAIDialog({ worldId, open, onOpenChange }: MapAIDialogProps) {
  const [step, setStep] = useState<Step>('prompt')
  const [copied, setCopied] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [moves, setMoves] = useState<LocationMove[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)

  const characters = useCharacters(worldId)
  const markers    = useAllLocationMarkers(worldId)
  const layers     = useMapLayers(worldId)
  const events     = useWorldEvents(worldId)
  const chapters   = useWorldChapters(worldId)

  const prompt = useMemo(
    () => buildPrompt(worldId, characters, events, chapters, markers, layers),
    [worldId, characters, events, chapters, markers, layers]
  )

  // Lookup maps for review UI
  const charById   = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const markerById = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers])
  const eventById  = useMemo(() => new Map(events.map((e) => [e.id, e])), [events])
  const chapById   = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])

  function reset() {
    setStep('prompt')
    setCopied(false)
    setPasteText('')
    setMoves([])
    setError(null)
    setImporting(false)
    setImportDone(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function parsePaste() {
    setError(null)
    const trimmed = pasteText.trim()
    if (!trimmed) { setError('Paste Claude\'s response first.'); return }

    // Strip markdown fences if present
    const cleaned = trimmed.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      setError('Could not parse JSON. Make sure Claude returned raw JSON only.')
      return
    }

    if (!Array.isArray(parsed)) {
      setError('Expected a JSON array at the top level.')
      return
    }

    const valid: LocationMove[] = []
    for (const item of parsed) {
      if (
        typeof item !== 'object' || item === null ||
        typeof (item as Record<string, unknown>).characterId !== 'string' ||
        typeof (item as Record<string, unknown>).eventId !== 'string' ||
        typeof (item as Record<string, unknown>).locationMarkerId !== 'string' ||
        typeof (item as Record<string, unknown>).mapLayerId !== 'string'
      ) {
        continue
      }
      const m = item as LocationMove
      // Validate IDs exist
      if (!charById.has(m.characterId)) continue
      if (!eventById.has(m.eventId)) continue
      if (!markerById.has(m.locationMarkerId)) continue
      valid.push(m)
    }

    if (valid.length === 0) {
      setError('No valid location assignments found. Check that Claude used the exact IDs from the prompt.')
      return
    }

    setMoves(valid)
    setStep('review')
  }

  async function applyMoves() {
    setImporting(true)
    setError(null)
    try {
      for (const move of moves) {
        const existing = await fetchSnapshot(move.characterId, move.eventId)
        await upsertSnapshot({
          worldId,
          characterId: move.characterId,
          eventId: move.eventId,
          currentLocationMarkerId: move.locationMarkerId,
          currentMapLayerId: move.mapLayerId,
          isAlive: existing?.isAlive ?? true,
          inventoryItemIds: existing?.inventoryItemIds ?? [],
          inventoryNotes: existing?.inventoryNotes ?? '',
          statusNotes: existing?.statusNotes ?? '',
          travelModeId: existing?.travelModeId ?? null,
        })
      }
      setImportDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error during import.')
    } finally {
      setImporting(false)
    }
  }

  // Group moves by event for review
  const movesByEvent = useMemo(() => {
    const map = new Map<string, LocationMove[]>()
    for (const m of moves) {
      if (!map.has(m.eventId)) map.set(m.eventId, [])
      map.get(m.eventId)!.push(m)
    }
    // Sort events by chapter + sortOrder
    return [...map.entries()].sort((a, b) => {
      const evA = eventById.get(a[0])
      const evB = eventById.get(b[0])
      const chA = evA ? chapById.get(evA.chapterId) : undefined
      const chB = evB ? chapById.get(evB.chapterId) : undefined
      const orderA = (chA?.number ?? 0) * 10_000 + (evA?.sortOrder ?? 0)
      const orderB = (chB?.number ?? 0) * 10_000 + (evB?.sortOrder ?? 0)
      return orderA - orderB
    })
  }, [moves, eventById, chapById])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[hsl(var(--border))] shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            {step === 'prompt' && 'Map AI — Copy Prompt'}
            {step === 'paste' && 'Map AI — Paste Response'}
            {step === 'review' && 'Map AI — Review Moves'}
          </DialogTitle>
          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-2">
            {(['prompt', 'paste', 'review'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />}
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${step === s ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  {s === 'prompt' ? '1. Prompt' : s === 'paste' ? '2. Paste' : '3. Review'}
                </span>
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* ── Step 1: Prompt ── */}
          {step === 'prompt' && (
            <>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Copy the prompt below, open Claude, paste it, then add your travel narrative text at the bottom. Come back and paste Claude's JSON response in the next step.
              </p>
              <div className="relative">
                <pre className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3 text-[10px] leading-relaxed overflow-auto max-h-72 whitespace-pre-wrap font-mono">
                  {prompt}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 gap-1.5 text-xs"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 2: Paste ── */}
          {step === 'paste' && (
            <>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Paste Claude's JSON response below. It should be an array of location assignments.
              </p>
              <textarea
                className="w-full h-64 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                placeholder='[{"characterId":"...","eventId":"...","locationMarkerId":"...","mapLayerId":"..."}]'
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
            </>
          )}

          {/* ── Step 3: Review ── */}
          {step === 'review' && !importDone && (
            <>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {moves.length} location assignment{moves.length !== 1 ? 's' : ''} found. Review before applying.
              </p>
              {movesByEvent.map(([eventId, eventMoves]) => {
                const ev = eventById.get(eventId)
                const ch = ev ? chapById.get(ev.chapterId) : undefined
                return (
                  <div key={eventId} className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                    <div className="bg-[hsl(var(--muted)/0.4)] px-4 py-2">
                      <p className="text-xs font-semibold">
                        {ev ? ev.title : eventId}
                        {ch && <span className="ml-2 text-[hsl(var(--muted-foreground))] font-normal">Ch. {ch.number}</span>}
                      </p>
                    </div>
                    <div className="divide-y divide-[hsl(var(--border))]">
                      {eventMoves.map((move) => {
                        const char   = charById.get(move.characterId)
                        const marker = markerById.get(move.locationMarkerId)
                        return (
                          <div key={`${move.characterId}-${move.eventId}`} className="flex items-center gap-3 px-4 py-2">
                            <span className="text-xs font-medium w-32 truncate">{char?.name ?? move.characterId}</span>
                            <ArrowRight className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                            <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                              <MapPin className="h-2.5 w-2.5" />
                              {marker?.name ?? move.locationMarkerId}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* ── Import done ── */}
          {importDone && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Check className="h-8 w-8 text-green-400" />
              <p className="text-sm font-medium">Applied {moves.length} location assignment{moves.length !== 1 ? 's' : ''}.</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Character snapshots have been updated.</p>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-950/30 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[hsl(var(--border))] px-6 py-4 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false) }}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {step === 'paste' && (
              <Button variant="outline" size="sm" onClick={() => setStep('prompt')}>
                Back
              </Button>
            )}
            {step === 'review' && !importDone && (
              <Button variant="outline" size="sm" onClick={() => setStep('paste')}>
                Back
              </Button>
            )}

            {step === 'prompt' && (
              <Button size="sm" onClick={() => setStep('paste')}>
                Next: Paste Response
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
            {step === 'paste' && (
              <Button size="sm" onClick={parsePaste} disabled={!pasteText.trim()}>
                Parse &amp; Review
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
            {step === 'review' && !importDone && (
              <Button size="sm" onClick={applyMoves} disabled={importing}>
                {importing ? 'Applying…' : `Apply ${moves.length} Move${moves.length !== 1 ? 's' : ''}`}
              </Button>
            )}
            {importDone && (
              <Button size="sm" onClick={() => { reset(); onOpenChange(false) }}>
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
