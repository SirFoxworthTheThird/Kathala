import { useState } from 'react'
import { ArrowDown, ArrowUp, Crown, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { createSuccession, deleteSuccession, updateSuccession, useSuccessions } from '@/db/hooks/useSuccessions'
import { successionAt, successionLine, type PersonStatus } from '@/lib/family'
import type { Relationship, Succession, SuccessionRule } from '@/types'

/*
  Successions (issue #702, D-3): what is inherited, by which rule, and who
  holds it and is next at the cursor. A reader sees the line among the people
  they have met, with no gap where a hidden heir would be (D-6), and nothing to
  change.
*/

const RULES: Record<SuccessionRule, string> = { eldest: 'Eldest first', byHand: 'Chosen by hand' }

function SuccessionCard({ s, relationships, status, nameOf, people }: {
  s: Succession
  relationships: Relationship[]
  status: PersonStatus
  nameOf: (id: string) => string
  people: Array<{ id: string; name: string }>
}) {
  const gate = useGate()
  const [confirm, setConfirm] = useState(false)
  const line = successionLine(s, relationships)
  const { holder, heirs } = successionAt(line, status)
  const handLine = s.line
  function move(i: number, by: number) {
    const ids = [...handLine]
    const [it] = ids.splice(i, 1)
    ids.splice(i + by, 0, it)
    void updateSuccession(s.id, { line: ids })
  }
  return (
    <article aria-label={`Succession: ${s.title}`} className="flex flex-col gap-2 rounded-md border border-[hsl(var(--border))] p-3">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        <h3 className="text-sm font-medium">{s.title}</h3>
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{RULES[s.rule]}, from {nameOf(s.founderId)}</span>
        {!gate.active && (
          <Button size="sm" variant="ghost" className="ml-auto h-6 w-6 p-0" aria-label={`Delete succession ${s.title}`} onClick={() => setConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
      <p className="text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">Held by </span>
        <span data-holder>{holder ? nameOf(holder) : 'no one living'}</span>
      </p>
      {heirs.length > 0 && (
        <ol aria-label={`Heirs to ${s.title}`} className="list-decimal pl-5 text-sm">
          {heirs.map((id) => <li key={id}>{nameOf(id)}</li>)}
        </ol>
      )}
      {!gate.active && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Select value={s.rule} onValueChange={(v) => void updateSuccession(s.id, { rule: v as SuccessionRule })}>
              <SelectTrigger className="h-7 text-xs" aria-label={`Rule for ${s.title}: ${RULES[s.rule]}`}><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(RULES) as SuccessionRule[]).map((r) => <SelectItem key={r} value={r} className="text-xs">{RULES[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}
      {!gate.active && s.rule === 'byHand' && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">The line after {nameOf(s.founderId)}, in order. The dead and the not-yet-born are passed over at the cursor.</p>
          <ol aria-label={`Line of ${s.title}`} className="flex flex-col gap-1">
            {handLine.map((id, i) => (
              <li key={id} className="flex items-center gap-1 text-sm">
                <span className="w-5 text-right text-xs text-[hsl(var(--muted-foreground))]">{i + 1}.</span> {nameOf(id)}
                <span className="ml-auto flex">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === 0} aria-label={`${nameOf(id)}: earlier in ${s.title}`} onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" aria-hidden="true" /></Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === handLine.length - 1} aria-label={`${nameOf(id)}: later in ${s.title}`} onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" aria-hidden="true" /></Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label={`Take ${nameOf(id)} out of ${s.title}`} onClick={() => void updateSuccession(s.id, { line: handLine.filter((x) => x !== id) })}><X className="h-3 w-3" aria-hidden="true" /></Button>
                </span>
              </li>
            ))}
          </ol>
          <div className="w-52">
            <Select value="" onValueChange={(id) => void updateSuccession(s.id, { line: [...handLine, id] })}>
              <SelectTrigger className="h-7 text-xs" aria-label={`Add to the line of ${s.title}…`}><SelectValue placeholder="Add to the line…" /></SelectTrigger>
              <SelectContent>
                {people.filter((p) => p.id !== s.founderId && !handLine.includes(p.id)).map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Delete “${s.title}”?`} description="The people stay; only the succession goes. Undo brings it back."
        confirmLabel="Delete succession" onConfirm={() => { void deleteSuccession(s.id) }} />
    </article>
  )
}

export function SuccessionPanel({ bookId, relationships, status, people }: {
  bookId: string
  relationships: Relationship[]
  status: PersonStatus
  /** Everyone the one looking may see. */
  people: Array<{ id: string; name: string }>
}) {
  const gate = useGate()
  const all = useSuccessions(bookId)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [founderId, setFounderId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const names = new Map(people.map((p) => [p.id, p.name]))
  const nameOf = (id: string) => names.get(id) ?? 'Someone'
  // A reader sees a succession only once they have met its founder.
  const shown = gate.active ? all.filter((s) => status(s.founderId) !== null) : all
  if (gate.active && shown.length === 0) return null

  async function add() {
    setError(null)
    try {
      await createSuccession(bookId, { title, founderId })
      setAdding(false)
      setTitle('')
      setFounderId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section aria-label="Succession" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Succession</h2>
        {!gate.active && !adding && (
          <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" aria-hidden="true" /> Add a succession
          </Button>
        )}
      </div>
      {shown.length === 0 && !adding && (
        <p className="text-xs italic text-[hsl(var(--muted-foreground))]">None yet. A succession names what is inherited — a throne, a house, a name — and reads the line at the cursor.</p>
      )}
      {adding && (
        <div role="group" aria-label="New succession" className="flex flex-col gap-2 rounded-md border border-[hsl(var(--border))] p-2">
          <Field label="What is inherited"><Input className="h-8 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Heights" /></Field>
          <Field label="Founder" className="flex flex-col gap-1">
            <Select value={founderId} onValueChange={setFounderId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{people.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {error && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => void add()}>Add succession</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAdding(false); setError(null) }}>Cancel</Button>
          </div>
        </div>
      )}
      {shown.map((s) => <SuccessionCard key={s.id} s={s} relationships={relationships} status={status} nameOf={nameOf} people={people} />)}
    </section>
  )
}
