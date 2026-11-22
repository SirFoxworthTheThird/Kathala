import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Library, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useResearchItems } from '@/db/hooks/useResearch'
import { researchMatches, type ResearchFilter } from '@/lib/research'
import type { ResearchTarget } from '@/types'
import { AddResearchDialog } from './AddResearchDialog'
import { ResearchCard } from './ResearchCard'
import { useOpenResearch } from './useOpenResearch'
import { TARGET_WORDS, useResearchTargets } from './useResearchNames'

/*
  The Research screen (issue #700): every source the writer keeps, filtered by
  kind and by what it is attached to, and searched across titles, notes,
  clippings, sources and addresses. The writer's alone: reading mode sends its
  address to the dashboard (research-plan.md, D-6).
*/

const KINDS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Every kind' },
  { value: 'image', label: 'Images' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'link', label: 'Links' },
  { value: 'clip', label: 'Clippings' },
]

export default function ResearchView() {
  const { worldId } = useParams<{ worldId: string }>()
  const items = useResearchItems(worldId)
  const targets = useResearchTargets(worldId)
  const { open, problem, lightbox } = useOpenResearch()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState('all')
  const [on, setOn] = useState('anything')
  const [query, setQuery] = useState('')

  const filter: ResearchFilter = useMemo(() => {
    const f: ResearchFilter = { query }
    if (kind !== 'all') f.kind = kind as ResearchFilter['kind']
    if (on === 'world' || on === 'nothing') f.on = on
    else if (on.startsWith('kind:')) f.on = { kind: on.slice(5) as ResearchTarget }
    else if (on.includes(':')) { const [k, id] = on.split(/:(.*)/); f.on = { kind: k as ResearchTarget, id } }
    return f
  }, [kind, on, query])
  const shown = items.filter((i) => researchMatches(i, filter))

  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={Library} title="Research" count={items.length}
        description="Your sources: pictures, PDFs, links and clippings, kept with what they inform."
        actions={<Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add research</Button>}>
        <Input aria-label="Search research" placeholder="Search research…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 max-w-xs text-sm" />
        <div className="w-36">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-8 text-xs" aria-label={`Kind: ${KINDS.find((k) => k.value === kind)!.label}`}><SelectValue /></SelectTrigger>
            <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value} className="text-xs">{k.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-60">
          <Select value={on} onValueChange={setOn}>
            <SelectTrigger className="h-8 text-xs" aria-label="Attached to"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anything" className="text-xs">Attached to anything</SelectItem>
              <SelectItem value="world" className="text-xs">The world as a whole</SelectItem>
              <SelectItem value="nothing" className="text-xs">Attached to nothing</SelectItem>
              {(Object.keys(TARGET_WORDS) as ResearchTarget[]).map((k) => (
                <SelectItem key={k} value={`kind:${k}`} className="text-xs">{`Any ${TARGET_WORDS[k].toLowerCase()}`}</SelectItem>
              ))}
              {targets.all.map((t) => <SelectItem key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`} className="text-xs">{`${TARGET_WORDS[t.kind]}: ${t.label}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>
      <div className="flex-1 overflow-auto p-4">
        {problem && <p role="alert" className="mb-3 text-xs text-[hsl(var(--destructive))]">{problem}</p>}
        {shown.length === 0 ? (
          <EmptyState icon={Library} title={items.length === 0 ? 'No research yet' : 'No matches'}
            description={items.length === 0
              ? 'Keep reference pictures, PDFs, links and clippings here, attached to the scenes, places, characters and items they inform.'
              : 'Try a different search or filter.'}
            action={items.length === 0 ? <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add research</Button> : undefined} />
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map((i) => <ResearchCard key={i.id} item={i} targets={targets.all} label={targets.label} onOpen={(x) => void open(x)} />)}
          </div>
        )}
      </div>
      {worldId && <AddResearchDialog open={adding} onOpenChange={setAdding} worldId={worldId} />}
      {lightbox}
    </div>
  )
}
