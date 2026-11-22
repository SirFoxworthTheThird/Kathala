import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, GitFork, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { updateCharacter } from '@/db/hooks/useCharacters'
import { addParent, addPartner, orderChildren, partnershipAt, removeKin } from '@/db/hooks/useKinship'
import { useActiveEventId } from '@/store'
import { childrenOf, parentLinks, partnerLinks, PARENT_WORDS, PARTNER_WORDS } from '@/lib/kinship'
import type { Character, ParentKind, PartnerKind } from '@/types'
import { useScenes } from './useScenes'
import { useFamily } from './useFamily'

/*
  A character's family on their page (issue #702): parents, partners and
  children, added and ordered here, and *never on stage* (D-5). A writer sees
  every link, whatever the cursor; a reader sees the family as far as they
  have read (D-6), and nothing to change.
*/

type Role = 'parent' | 'partner' | 'child'
const ROLE_WORDS: Record<Role, string> = { parent: 'Add a parent', partner: 'Add a partner', child: 'Add a child' }
const BEFORE = 'before'

function AddKin({ bookId, character, role, onDone }: { bookId: string; character: Character; role: Role; onDone: () => void }) {
  const { people } = useFamily(bookId)
  const scenes = useScenes(bookId)
  const [personId, setPersonId] = useState('')
  const [kind, setKind] = useState<string>(role === 'partner' ? 'married' : 'birth')
  const [from, setFrom] = useState(BEFORE)
  const [error, setError] = useState<string | null>(null)
  const others = people.filter((p) => p.id !== character.id)
  const isBirth = role !== 'partner' && kind === 'birth'

  async function add() {
    setError(null)
    if (!personId) { setError('Choose who.'); return }
    const start = from === BEFORE ? null : from
    try {
      if (role === 'parent') await addParent(bookId, personId, character.id, kind as ParentKind, start)
      else if (role === 'child') await addParent(bookId, character.id, personId, kind as ParentKind, start)
      else await addPartner(bookId, character.id, personId, kind as PartnerKind, start)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const who = role === 'parent' ? 'Parent' : role === 'child' ? 'Child' : 'Partner'
  return (
    <div role="group" aria-label={ROLE_WORDS[role]} className="flex flex-col gap-2 rounded-md border border-[hsl(var(--border))] p-2">
      <div className="flex flex-wrap gap-2">
        <Field label={who} className="flex min-w-40 flex-1 flex-col gap-1">
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>{others.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Kind" className="flex min-w-32 flex-col gap-1">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {role === 'partner'
                ? (Object.keys(PARTNER_WORDS) as PartnerKind[]).map((k) => <SelectItem key={k} value={k} className="text-xs">{PARTNER_WORDS[k]}</SelectItem>)
                : (Object.keys(PARENT_WORDS) as ParentKind[]).map((k) => <SelectItem key={k} value={k} className="text-xs">{k === 'birth' ? 'By birth' : PARENT_WORDS[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={isBirth ? 'Born in' : 'From'} className="flex min-w-48 flex-1 flex-col gap-1">
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={BEFORE} className="text-xs">Before the story</SelectItem>
              {scenes.events.map((e) => <SelectItem key={e.id} value={e.id} className="text-xs">{scenes.label(e)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {isBirth && from !== BEFORE && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Before this scene the child is not born yet: faded in the tree, and not shown to a reader.</p>
      )}
      {error && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={() => void add()}>Add</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

export function FamilySection({ bookId, character }: { bookId: string; character: Character }) {
  const gate = useGate()
  const cursor = useActiveEventId()
  const { family, people, relationships } = useFamily(bookId)
  const scenes = useScenes(bookId)
  const [adding, setAdding] = useState<Role | null>(null)
  const nameOf = useMemo(() => {
    const names = new Map(people.map((p) => [p.id, p.name]))
    return (id: string) => names.get(id) ?? 'Someone'
  }, [people])
  const sceneLabel = (id: string | null) => {
    const ev = id ? scenes.events.find((e) => e.id === id) : undefined
    return ev ? scenes.label(ev) : null
  }

  // A writer's lists hold every link; a reader's, the family as far as they have read.
  const links = gate.active
    ? { parents: family.parents.map((l) => ({ ...l, startEventId: null as string | null })), partners: family.partners.map((l) => ({ ...l, startEventId: null as string | null })) }
    : { parents: parentLinks(relationships), partners: partnerLinks(relationships) }
  const parents = links.parents.filter((l) => l.childId === character.id)
  const children = childrenOf(character.id, links.parents.map((l) => ({ ...l, startEventId: l.startEventId ?? null })))
  const partners = links.partners.filter((l) => l.aId === character.id || l.bId === character.id)
  const nowOf = (relationshipId: string) => family.partners.find((p) => p.relationshipId === relationshipId)
  const unborn = (id: string) => family.people.get(id)?.born === false

  const empty = !parents.length && !children.length && !partners.length
  if (gate.active && empty) return null

  function move(i: number, by: number) {
    const ids = children.map((c) => c.childId)
    const [it] = ids.splice(i, 1)
    ids.splice(i + by, 0, it)
    void orderChildren(bookId, character.id, ids)
  }

  const row = 'flex items-center gap-2 text-sm'
  const muted = 'text-xs text-[hsl(var(--muted-foreground))]'
  return (
    <section aria-label="Family" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Family</h3>
        <Link to={`/worlds/${bookId}/family?focus=${character.id}`} className="ml-auto flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:underline">
          <GitFork className="h-3 w-3" aria-hidden="true" /> Open in the family tree
        </Link>
      </div>
      {empty && <p className={`${muted} italic`}>No family recorded.</p>}
      {parents.length > 0 && (
        <div>
          <p className={muted}>Parents</p>
          <ul aria-label="Parents" className="flex flex-col gap-1">
            {parents.map((l) => (
              <li key={l.relationshipId} className={row}>
                <Link to={`/worlds/${bookId}/characters/${l.parentId}`} className="hover:underline">{nameOf(l.parentId)}</Link>
                {l.parent !== 'birth' && <span className={muted}>{PARENT_WORDS[l.parent]}</span>}
                {!gate.active && <Button size="sm" variant="ghost" className="ml-auto h-6 w-6 p-0" aria-label={`Take ${nameOf(l.parentId)} off as ${character.name}’s parent`} onClick={() => void removeKin(l.relationshipId)}><X className="h-3 w-3" aria-hidden="true" /></Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {partners.length > 0 && (
        <div>
          <p className={muted}>Partners</p>
          <ul aria-label="Partners" className="flex flex-col gap-1">
            {partners.map((l) => {
              const other = l.aId === character.id ? l.bId : l.aId
              const now = nowOf(l.relationshipId)
              const since = sceneLabel(l.startEventId)
              const state = !now ? (since ? `from ${since}` : null) : now.active ? PARTNER_WORDS[now.partner] : `${PARTNER_WORDS[now.partner]}, ended`
              return (
                <li key={l.relationshipId} className={row}>
                  <Link to={`/worlds/${bookId}/characters/${other}`} className="hover:underline">{nameOf(other)}</Link>
                  {state && <span className={muted}>{state}</span>}
                  {!gate.active && cursor && now && (
                    <div className="ml-auto w-40">
                      <Select value="" onValueChange={(v) => void partnershipAt(bookId, l.relationshipId, cursor, v === 'ended' ? { ended: true } : { partner: v as PartnerKind })}>
                        <SelectTrigger className="h-6 text-[11px]" aria-label={`${nameOf(other)}: from this scene…`}><SelectValue placeholder="From this scene…" /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PARTNER_WORDS) as PartnerKind[]).map((k) => <SelectItem key={k} value={k} className="text-xs">{PARTNER_WORDS[k]}</SelectItem>)}
                          <SelectItem value="ended" className="text-xs">Ended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!gate.active && <Button size="sm" variant="ghost" className={`${cursor && now ? '' : 'ml-auto '}h-6 w-6 p-0`} aria-label={`Take ${nameOf(other)} off as ${character.name}’s partner`} onClick={() => void removeKin(l.relationshipId)}><X className="h-3 w-3" aria-hidden="true" /></Button>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {children.length > 0 && (
        <div>
          <p className={muted}>Children, eldest first</p>
          <ol aria-label="Children" className="flex flex-col gap-1">
            {children.map((l, i) => (
              <li key={l.relationshipId} className={row}>
                <Link to={`/worlds/${bookId}/characters/${l.childId}`} className={unborn(l.childId) ? 'opacity-50 hover:underline' : 'hover:underline'}>{nameOf(l.childId)}</Link>
                {l.parent !== 'birth' && <span className={muted}>{l.parent === 'adoptive' ? 'adopted' : 'stepchild'}</span>}
                {unborn(l.childId) && <span className={muted}>not born yet</span>}
                {!gate.active && (
                  <span className="ml-auto flex">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === 0} aria-label={`${nameOf(l.childId)}: earlier`} onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" aria-hidden="true" /></Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === children.length - 1} aria-label={`${nameOf(l.childId)}: later`} onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" aria-hidden="true" /></Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label={`Take ${nameOf(l.childId)} off as ${character.name}’s child`} onClick={() => void removeKin(l.relationshipId)}><X className="h-3 w-3" aria-hidden="true" /></Button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {!gate.active && (
        adding
          ? <AddKin bookId={bookId} character={character} role={adding} onDone={() => setAdding(null)} />
          : (
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ROLE_WORDS) as Role[]).map((r) => (
                <Button key={r} size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAdding(r)}>
                  <Plus className="h-3 w-3" aria-hidden="true" /> {ROLE_WORDS[r]}
                </Button>
              ))}
            </div>
          )
      )}
      {!gate.active && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={!!character.offStage} onChange={(e) => void updateCharacter(character.id, { offStage: e.target.checked || undefined })} className="accent-[hsl(var(--ring))]" />
          Never on stage
          <span className="text-[hsl(var(--muted-foreground))]">— left out of scene casts, the header’s suggestions and Cast Balance; kept in the family tree</span>
        </label>
      )}
    </section>
  )
}
