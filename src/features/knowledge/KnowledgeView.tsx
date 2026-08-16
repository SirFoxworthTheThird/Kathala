import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, X, Trash2, Eye, EyeOff, KeyRound, UserPlus, History, Sparkles } from 'lucide-react'
import {
  useKnowledgeFacts, useKnowledgeReveals,
  createKnowledgeFact, updateKnowledgeFact, deleteKnowledgeFact,
  createKnowledgeReveal, deleteKnowledgeReveal,
} from '@/db/hooks/useKnowledge'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useWorldSnapshots } from '@/db/hooks/useSnapshots'
import { suggestDeathFacts, suggestReveals } from '@/lib/knowledgeSuggestions'
import { useActiveEventId } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { GenerateKnowledgeDialog } from './GenerateKnowledgeDialog'
import type { KnowledgeFact } from '@/types'
import { orderFacts, FACT_ORDERS, FACT_ORDER_LABELS, type FactOrder } from '@/lib/factOrder'
import { eventsInReadingOrder } from '@/lib/readingOrder'

export default function KnowledgeView() {
  const { worldId } = useParams<{ worldId: string }>()
  const facts = useKnowledgeFacts(worldId ?? null)
  const reveals = useKnowledgeReveals(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const events = useWorldEvents(worldId ?? null)
  const chapters = useWorldChapters(worldId ?? null)
  const snapshots = useWorldSnapshots(worldId ?? null)
  const activeEventId = useActiveEventId()

  const deathSuggestions = useMemo(
    () => suggestDeathFacts({ characters, snapshots, events, chapters, existingFacts: facts }),
    [characters, snapshots, events, chapters, facts],
  )

  async function trackSuggestedFact(s: ReturnType<typeof suggestDeathFacts>[number]) {
    if (!worldId) return
    const fact = await createKnowledgeFact({ worldId, title: s.title, description: '', tags: [], originEventId: s.originEventId })
    // Everyone present at the death witnesses it — seed their reveals.
    await Promise.all(
      s.presentCharacterIds.map((cid) =>
        createKnowledgeReveal({ worldId, factId: fact.id, characterId: cid, eventId: s.originEventId, note: '' }),
      ),
    )
    setSelectedId(fact.id)
  }

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [factOrder, setFactOrder] = useState<FactOrder>('added')

  /*
    Every event in the world, in the order they are read.

    `useWorldEvents` returns them in Dexie's order, which is by primary key —
    no relation to the story. This was already sorted here for "known as of the
    cursor" to be decidable, and then the *unsorted* array was handed to the
    three "when did they learn it" pickers, so the writer chose a moment from a
    shuffled list: on the shipped *Dracula*, 84 options with chapters 1 to 3
    sitting at positions 12, 23, 34, 45, 56, 67, 78 and 84.
  */
  const orderedEvents = useMemo(() => eventsInReadingOrder(events, chapters), [events, chapters])

  // Narrative position of each event, so "known as of the cursor" is decidable.
  const eventPos = useMemo(
    () => new Map(orderedEvents.map((e, i) => [e.id, i])),
    [orderedEvents],
  )
  const cursorPos = activeEventId ? eventPos.get(activeEventId) ?? null : null

  const eventLabel = useMemo(() => {
    const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
    const m = new Map<string, string>()
    for (const e of events) {
      const n = chapterNumber.get(e.chapterId)
      m.set(e.id, `${n !== undefined ? `Ch.${n} — ` : ''}${e.title || 'Untitled event'}`)
    }
    return m
  }, [events, chapters])

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  /**
   * KN-4: the roster had one order — the order facts were added — and no way to
   * ask the two questions the screen exists for. Both numbers are already on
   * the cards; they simply had no say in the sequence. See `src/lib/factOrder.ts`.
   */
  const firstRevealPos = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of reveals) {
      const p = eventPos.get(r.eventId)
      if (p === undefined) continue
      const current = m.get(r.factId)
      if (current === undefined || p < current) m.set(r.factId, p)
    }
    return m
  }, [reveals, eventPos])

  const searched = facts.filter((f) => f.title.toLowerCase().includes(search.toLowerCase()))
  const filtered = orderFacts(searched, factOrder, {
    firstRevealPos: (id) => firstRevealPos.get(id) ?? null,
    knownCount: (id) => knownCount(id),
  })
  const selected = facts.find((f) => f.id === selectedId) ?? null
  const revealsForSelected = reveals.filter((r) => r.factId === selectedId)

  /** Is a reveal in effect at the active cursor? (No cursor → treat as visible.) */
  function knownAtCursor(eventId: string): boolean {
    if (cursorPos === null) return true
    const p = eventPos.get(eventId)
    return p !== undefined && p <= cursorPos
  }

  function knownCount(factId: string): number {
    return reveals.filter((r) => r.factId === factId && knownAtCursor(r.eventId)).length
  }

  async function handleCreate() {
    if (!newTitle.trim() || !worldId) return
    const f = await createKnowledgeFact({ worldId, title: newTitle.trim(), description: '', tags: [] })
    setNewTitle('')
    setCreating(false)
    setSelectedId(f.id)
  }

  const gate = useGate()
  const revealedCharIds = new Set(revealsForSelected.map((r) => r.characterId))
  const unrevealedChars = characters.filter((c) => !revealedCharIds.has(c.id))

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col min-w-0">
        <PageHeader
          icon={KeyRound}
          title="Knowledge"
          count={facts.length}
          description="Secrets and key information — track who knows what, and when they learn it."
          actions={
            creating ? (
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-56 text-sm"
                  placeholder="What is the fact or secret?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') { setCreating(false); setNewTitle('') }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewTitle('') }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAiOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5" /> Generate with AI
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
                  <Plus className="h-3.5 w-3.5" /> New Fact
                </Button>
              </div>
            )
          }
        >
          <Input
            placeholder="Search facts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs text-sm"
          />
          <Select value={factOrder} onValueChange={(v) => setFactOrder(v as FactOrder)}>
            <SelectTrigger className="h-8 w-auto gap-2 text-xs" aria-label="Order facts by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FACT_ORDERS.map((o) => (
                <SelectItem key={o} value={o}>{FACT_ORDER_LABELS[o]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeEventId && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Counts reflect the moment the cursor is on.
            </span>
          )}
        </PageHeader>

        <div className="flex-1 overflow-auto p-4">
          {!gate.active && deathSuggestions.length > 0 && (
            <div className="mb-4 rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Suggested from your story
              </p>
              <div className="flex flex-wrap gap-2">
                {deathSuggestions.map((s) => (
                  <button
                    key={s.originEventId}
                    onClick={() => trackSuggestedFact(s)}
                    className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] transition-colors hover:border-[hsl(var(--ring)/0.4)]"
                    title="Track this as a fact (and mark everyone present as knowing it)"
                  >
                    <Plus className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                    {s.title}{s.chapterNumber !== null ? ` · Ch. ${s.chapterNumber}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          {facts.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No facts yet"
              description="Add a secret or piece of information, then record which characters learn it and when."
              action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add Fact</Button>}
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon={KeyRound} title="No matches" description="Try a different search." />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {filtered.map((fact) => (
                <FactCard
                  key={fact.id}
                  fact={fact}
                  known={knownCount(fact.id)}
                  total={characters.length}
                  selected={fact.id === selectedId}
                  onClick={() => setSelectedId(fact.id === selectedId ? null : fact.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="flex h-full w-96 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
          <div className="flex items-start gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
            {gate.active ? (
              <h2 className="min-w-0 flex-1 text-sm font-semibold text-[hsl(var(--foreground))]">
                {selected.title}
              </h2>
            ) : (
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[hsl(var(--foreground))] outline-none"
                value={selected.title}
                onChange={(e) => updateKnowledgeFact(selected.id, { title: e.target.value })}
              />
            )}
            <button
              onClick={() => setSelectedId(null)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
            {gate.active ? (
              selected.description ? (
                <p className="whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">
                  {selected.description}
                </p>
              ) : null
            ) : (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Description</p>
                <Textarea
                  className="resize-none text-sm"
                  rows={3}
                  placeholder="What is this information?"
                  value={selected.description}
                  onChange={(e) => updateKnowledgeFact(selected.id, { description: e.target.value })}
                />
              </div>
            )}

            {!gate.active && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <Eye className="h-3 w-3" /> Reader learns at
                </p>
                <Select
                  value={selected.readerLearnsAtEventId ?? '__auto__'}
                  onValueChange={(v) => updateKnowledgeFact(selected.id, { readerLearnsAtEventId: v === '__auto__' ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto — when a POV character knows it</SelectItem>
                    {orderedEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{eventLabel.get(e.id) ?? e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                  Set an event to withhold from (or reveal early to) the reader; leave on Auto otherwise.
                </p>
              </div>
            )}

            {!gate.active && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <History className="h-3 w-3" /> Becomes true at
                </p>
                <Select
                  value={selected.originEventId ?? '__origin_none__'}
                  onValueChange={(v) => updateKnowledgeFact(selected.id, { originEventId: v === '__origin_none__' ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__origin_none__">True from the start</SelectItem>
                    {orderedEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{eventLabel.get(e.id) ?? e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                  Anyone who knows it before this is flagged by the continuity checker.
                </p>
              </div>
            )}

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                <Eye className="h-3 w-3" /> Known by ({revealsForSelected.length})
              </p>
              {revealsForSelected.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No one knows this yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {revealsForSelected.map((r) => {
                    const known = knownAtCursor(r.eventId)
                    return (
                      <div key={r.id} className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-2">
                        <span className="flex-1 truncate text-sm text-[hsl(var(--foreground))]">
                          {charById.get(r.characterId)?.name ?? 'Unknown character'}
                        </span>
                        <span
                          className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]"
                          title={known ? 'Known as of the active cursor' : 'Not yet known at the active cursor'}
                        >
                          {eventLabel.get(r.eventId) ?? 'learns it'}
                        </span>
                        {!known && <EyeOff className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />}
                        {!gate.active && (
                          <button
                            onClick={() => deleteKnowledgeReveal(r.id)}
                            className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {!gate.active && unrevealedChars.length > 0 && events.length > 0 && (
                <AddRevealRow
                  chars={unrevealedChars}
                  eventOptions={orderedEvents}
                  eventLabel={eventLabel}
                  onAdd={(characterId, eventId) =>
                    worldId && createKnowledgeReveal({ worldId, factId: selected.id, characterId, eventId, note: '' })
                  }
                />
              )}
              {!gate.active && events.length === 0 && (
                <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">Add events on the timeline to record when characters learn this.</p>
              )}

              {/* Co-presence suggestions: who shared a scene with a knower */}
              {!gate.active && (() => {
                const suggestions = suggestReveals({ fact: selected, reveals, events, chapters })
                  .filter((s) => !revealedCharIds.has(s.characterId))
                if (suggestions.length === 0) return null
                return (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Might also know</p>
                    {suggestions.map((s) => (
                      <div key={s.characterId} className="flex items-center gap-2 rounded border border-dashed border-[hsl(var(--border))] px-2.5 py-1.5 text-xs">
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-[hsl(var(--foreground))]">{charById.get(s.characterId)?.name ?? '—'}</span>
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                            {' '}— with {charById.get(s.viaCharacterId)?.name ?? '—'}{s.chapterNumber !== null ? ` in Ch. ${s.chapterNumber}` : ''}
                          </span>
                        </span>
                        <button
                          onClick={() => worldId && createKnowledgeReveal({ worldId, factId: selected.id, characterId: s.characterId, eventId: s.eventId, note: '' })}
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
                          title="Record that they learned it here"
                        >
                          + learned it
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

          {!gate.active && (
            <div className="border-t border-[hsl(var(--border))] p-3">
              <FactDeleteButton fact={selected} onDeleted={() => setSelectedId(null)} />
            </div>
          )}
        </div>
      )}

      {worldId && (
        <GenerateKnowledgeDialog open={aiOpen} onOpenChange={setAiOpen} worldId={worldId} />
      )}
    </div>
  )
}

// ── Fact card ────────────────────────────────────────────────────────────────

function FactCard({ fact, known, total, selected, onClick }: {
  fact: KnowledgeFact
  known: number
  total: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      data-fact-card
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors hover:border-[hsl(var(--ring)/0.4)] ${
        selected ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent)/0.15)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
      }`}
    >
      <p className="mb-1 font-semibold text-sm text-[hsl(var(--foreground))] line-clamp-2">{fact.title}</p>
      {fact.description && (
        <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">{fact.description}</p>
      )}
      <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
        <Eye className="h-3 w-3" />
        <span>known by {known}{total > 0 ? ` / ${total}` : ''}</span>
      </div>
    </button>
  )
}

// ── Add reveal row ───────────────────────────────────────────────────────────

function AddRevealRow({ chars, eventOptions, eventLabel, onAdd }: {
  chars: ReturnType<typeof useCharacters>
  eventOptions: ReturnType<typeof useWorldEvents>
  eventLabel: Map<string, string>
  onAdd: (characterId: string, eventId: string) => void
}) {
  const [characterId, setCharacterId] = useState<string>('')
  const [eventId, setEventId] = useState<string>('')

  function submit() {
    if (characterId && eventId) {
      onAdd(characterId, eventId)
      setCharacterId('')
      setEventId('')
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-dashed border-[hsl(var(--border))] p-2">
      <Select value={characterId} onValueChange={setCharacterId}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Character…" /></SelectTrigger>
        <SelectContent>
          {chars.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={eventId} onValueChange={setEventId}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Learns it at…" /></SelectTrigger>
        <SelectContent>
          {eventOptions.map((e) => <SelectItem key={e.id} value={e.id}>{eventLabel.get(e.id) ?? e.title}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={!characterId || !eventId} onClick={submit}>
        <UserPlus className="h-3.5 w-3.5" /> Record who learns it
      </Button>
    </div>
  )
}

// ── Delete ───────────────────────────────────────────────────────────────────

function FactDeleteButton({ fact, onDeleted }: { fact: KnowledgeFact; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <Button variant="destructive" size="sm" className="w-full gap-1.5" onClick={() => setConfirm(true)}>
        <Trash2 className="h-3.5 w-3.5" /> Delete Fact
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete "${fact.title}"?`}
        description="This removes the fact and every record of who knew it."
        onConfirm={async () => { await deleteKnowledgeFact(fact.id); onDeleted() }}
      />
    </>
  )
}
