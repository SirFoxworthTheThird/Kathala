import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, X, Trash2, Eye, EyeOff, KeyRound, UserPlus } from 'lucide-react'
import {
  useKnowledgeFacts, useKnowledgeReveals,
  createKnowledgeFact, updateKnowledgeFact, deleteKnowledgeFact,
  createKnowledgeReveal, deleteKnowledgeReveal,
} from '@/db/hooks/useKnowledge'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useActiveEventId } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { KnowledgeFact } from '@/types'

export default function KnowledgeView() {
  const { worldId } = useParams<{ worldId: string }>()
  const facts = useKnowledgeFacts(worldId ?? null)
  const reveals = useKnowledgeReveals(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const events = useWorldEvents(worldId ?? null)
  const chapters = useWorldChapters(worldId ?? null)
  const activeEventId = useActiveEventId()

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  // Narrative position of each event, so "known as of the cursor" is decidable.
  const eventPos = useMemo(() => {
    const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
    const ordered = [...events].sort((a, b) => {
      const byChapter = (chapterNumber.get(a.chapterId) ?? 0) - (chapterNumber.get(b.chapterId) ?? 0)
      return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
    })
    return new Map(ordered.map((e, i) => [e.id, i]))
  }, [events, chapters])
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

  const filtered = facts.filter((f) => f.title.toLowerCase().includes(search.toLowerCase()))
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
              <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> New Fact
              </Button>
            )
          }
        >
          <Input
            placeholder="Search facts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs text-sm"
          />
          {activeEventId && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Counts reflect the active chapter cursor.
            </span>
          )}
        </PageHeader>

        <div className="flex-1 overflow-auto p-4">
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
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[hsl(var(--foreground))] outline-none"
              value={selected.title}
              onChange={(e) => updateKnowledgeFact(selected.id, { title: e.target.value })}
            />
            <button
              onClick={() => setSelectedId(null)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
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
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{eventLabel.get(e.id) ?? e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                Set an event to withhold from (or reveal early to) the reader; leave on Auto otherwise.
              </p>
            </div>

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
                        <button
                          onClick={() => deleteKnowledgeReveal(r.id)}
                          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {unrevealedChars.length > 0 && events.length > 0 && (
                <AddRevealRow
                  chars={unrevealedChars}
                  eventOptions={events}
                  eventLabel={eventLabel}
                  onAdd={(characterId, eventId) =>
                    worldId && createKnowledgeReveal({ worldId, factId: selected.id, characterId, eventId, note: '' })
                  }
                />
              )}
              {events.length === 0 && (
                <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">Add events on the timeline to record when characters learn this.</p>
              )}
            </div>
          </div>

          <div className="border-t border-[hsl(var(--border))] p-3">
            <FactDeleteButton fact={selected} onDeleted={() => setSelectedId(null)} />
          </div>
        </div>
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
