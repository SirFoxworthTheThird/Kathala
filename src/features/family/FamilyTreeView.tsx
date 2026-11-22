import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ReactFlow, {
  Background, Controls, Handle, Position, useNodesInitialized, useReactFlow,
  type Edge, type Node, type NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ChevronDown, ChevronRight, GitFork, Pencil, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { familyLayout } from '@/lib/family'
import { PARENT_WORDS, PARTNER_WORDS } from '@/lib/kinship'
import { cn } from '@/lib/utils'
import { FamilySection } from './FamilySection'
import { SuccessionPanel } from './SuccessionPanel'
import { useFamily } from './useFamily'

/*
  The Family tree (issue #702, D-7): around a person — ancestors above,
  descendants below, partners beside — or the whole family; at the cursor, so
  births, deaths and marriages follow the story (D-2, D-4); for a reader, only
  what they have reached (D-6). The layout is `familyLayout`, pure and tested;
  this only draws it.
*/

const NODE_W = 160
const GAP_W = 200
const ROW_H = 130

interface PersonData {
  name: string
  alive: boolean
  born: boolean
  offStage: boolean
  folded: number
  hasChildren: boolean
  isFolded: boolean
  focus: boolean
  onOpen: () => void
  onFold: () => void
  onEdit?: () => void
}

function PersonNode({ data }: { data: PersonData }) {
  const state = !data.born ? 'not born yet' : !data.alive ? 'dead' : null
  return (
    <div
      data-person={data.name}
      data-state={state ?? 'living'}
      className={cn(
        'flex flex-col gap-1 rounded-md border bg-[hsl(var(--card))] px-2 py-1.5 shadow',
        data.focus ? 'border-[hsl(var(--ring))]' : 'border-[hsl(var(--border))]',
        !data.born && 'border-dashed opacity-50',
      )}
      style={{ width: NODE_W }}
    >
      <Handle id="t" type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0 }} />
      {/* Partners meet side to side: each side can start or end a partner's line. */}
      <Handle id="ls" type="source" position={Position.Left} isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="lt" type="target" position={Position.Left} isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="rs" type="source" position={Position.Right} isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="rt" type="target" position={Position.Right} isConnectable={false} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1">
        <button type="button" className="nodrag min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline" onClick={data.onOpen} aria-label={`Open ${data.name}`}>
          {data.name}{!data.alive && data.born ? ' †' : ''}
        </button>
        {data.onEdit && (
          <button type="button" className="nodrag text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={data.onEdit} aria-label={`Edit ${data.name}’s family`}>
            <Pencil className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
        {state && <span>{state}</span>}
        {data.offStage && <span>never on stage</span>}
        {data.hasChildren && (
          <button type="button" className="nodrag ml-auto flex items-center gap-0.5 hover:text-[hsl(var(--foreground))]" onClick={data.onFold}
            aria-label={data.isFolded ? `Unfold ${data.name}’s descendants` : `Fold ${data.name}’s descendants`} aria-expanded={!data.isFolded}>
            {data.isFolded ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
            {data.isFolded && data.folded > 0 ? `+${data.folded}` : ''}
          </button>
        )}
      </div>
      <Handle id="b" type="source" position={Position.Bottom} isConnectable={false} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes: NodeTypes = { person: PersonNode }

/** Fits once the people have a size, and again when the tree's shape changes. */
function Fit({ shape }: { shape: string }) {
  const { fitView } = useReactFlow()
  const ready = useNodesInitialized()
  const fitted = useRef<string | null>(null)
  useEffect(() => {
    if (!ready || fitted.current === shape) return
    fitted.current = shape
    fitView({ padding: 0.2, maxZoom: 1.2 })
  }, [ready, shape, fitView])
  return null
}

type Scope = 'around' | 'whole'

export default function FamilyTreeView() {
  const { worldId } = useParams<{ worldId: string }>()
  const bookId = worldId!
  const gate = useGate()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { family, status, people, relationships } = useFamily(bookId)
  const [scope, setScope] = useState<Scope>('around')
  const [generations, setGenerations] = useState(3)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)

  const inFamily = [...family.people.values()].sort((a, b) => a.name.localeCompare(b.name))
  const asked = params.get('focus')
  const focusId = asked && family.people.has(asked) ? asked : inFamily[0]?.id ?? null
  const setFocus = (id: string) => setParams((p) => { p.set('focus', id); return p }, { replace: true })

  const layout = useMemo(
    () => familyLayout(family, {
      focusId,
      ...(scope === 'around' ? { up: generations, down: generations } : {}),
      collapsed,
      width: GAP_W,
      height: ROW_H,
    }),
    [family, focusId, scope, generations, collapsed],
  )

  const nodes: Node<PersonData>[] = layout.nodes.map((n) => {
    const p = family.people.get(n.id)!
    return {
      id: n.id,
      type: 'person',
      position: { x: n.x, y: n.y },
      draggable: false,
      data: {
        name: p.name, alive: p.alive, born: p.born, offStage: p.offStage,
        folded: n.folded, hasChildren: n.hasChildren, isFolded: collapsed.has(n.id), focus: n.id === focusId,
        onOpen: () => navigate(`/worlds/${bookId}/characters/${n.id}`),
        onFold: () => setCollapsed((c) => { const next = new Set(c); if (next.has(n.id)) next.delete(n.id); else next.add(n.id); return next }),
        ...(gate.active ? {} : { onEdit: () => setEditing(n.id) }),
      },
    }
  })
  const xOf = new Map(layout.nodes.map((n) => [n.id, n.x]))
  const leftToRight = (a: string, b: string) => (xOf.get(a) ?? 0) <= (xOf.get(b) ?? 0)
  const edges: Edge[] = layout.edges.map((e) => e.kind === 'parent'
    ? {
        id: e.id, source: e.from, sourceHandle: 'b', target: e.to, targetHandle: 't', type: 'smoothstep',
        label: e.parent !== 'birth' ? PARENT_WORDS[e.parent!].toLowerCase() : undefined,
        style: { stroke: 'hsl(var(--muted-foreground))', strokeDasharray: e.parent !== 'birth' ? '5 4' : undefined },
        labelStyle: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
        labelBgStyle: { fill: 'hsl(var(--card))' },
      }
    : {
        id: e.id, source: e.from, target: e.to, type: 'straight',
        ...(leftToRight(e.from, e.to) ? { sourceHandle: 'rs', targetHandle: 'lt' } : { sourceHandle: 'ls', targetHandle: 'rt' }),
        label: `${PARTNER_WORDS[e.partner!].toLowerCase()}${e.active ? '' : ', ended'}`,
        style: { stroke: e.active ? 'hsl(var(--ring))' : 'hsl(var(--muted-foreground))', strokeDasharray: e.active ? undefined : '3 3' },
        labelStyle: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
        labelBgStyle: { fill: 'hsl(var(--card))' },
      })
  const shape = `${focusId}|${scope}|${generations}|${[...collapsed].sort().join(',')}|${layout.nodes.length}`
  const editingPerson = editing ? people.find((p) => p.id === editing) : undefined

  const header = (
    <PageHeader icon={GitFork} title="Family tree" count={family.people.size}
      description={gate.active ? 'The family as far as you have read.' : 'Parents, partners and children, as of the scene under the cursor.'}>
      {inFamily.length > 0 && (
        <>
          <div className="w-52">
            <Select value={focusId ?? ''} onValueChange={setFocus}>
              <SelectTrigger className="h-8 text-xs" aria-label={`Around: ${family.people.get(focusId ?? '')?.name ?? ''}`}><SelectValue /></SelectTrigger>
              <SelectContent>{inFamily.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div role="group" aria-label="Show" className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs">
            {(['around', 'whole'] as Scope[]).map((s) => (
              <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}
                className={cn('px-3 py-1', scope === s ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]')}>
                {s === 'around' ? 'Around them' : 'Whole family'}
              </button>
            ))}
          </div>
          {scope === 'around' && (
            <div className="w-44">
              <Select value={String(generations)} onValueChange={(v) => setGenerations(Number(v))}>
                <SelectTrigger className="h-8 text-xs" aria-label={`Generations each way: ${generations}`}><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5, 6].map((g) => <SelectItem key={g} value={String(g)} className="text-xs">{`${g} generation${g === 1 ? '' : 's'} each way`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
    </PageHeader>
  )

  if (inFamily.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <EmptyState icon={GitFork} title={gate.active ? 'No family yet' : 'No family recorded'}
          description={gate.active
            ? 'Nobody you have met has a parent, child or partner recorded yet.'
            : 'Say who is whose parent, child or partner on a character’s page, under Family, and the tree draws itself here.'}
          action={!gate.active && people[0] ? <Button asChild><Link to={`/worlds/${bookId}/characters/${people[0].id}`}>Open a character</Link></Button> : undefined}
          className="flex-1" />
        <div className="mx-auto w-full max-w-2xl p-4">
          <SuccessionPanel bookId={bookId} relationships={relationships} status={status} people={people} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1" aria-label="Family tree" role="region">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesConnectable={false} nodesDraggable={false}
            elementsSelectable={false} minZoom={0.02} proOptions={{ hideAttribution: true }}>
            <Background gap={24} size={1} />
            <Controls showInteractive={false} />
            <Fit shape={shape} />
          </ReactFlow>
        </div>
        <aside aria-label="Beside the tree" className="flex w-80 shrink-0 flex-col gap-4 overflow-auto border-l border-[hsl(var(--border))] p-3">
          {editingPerson && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">{editingPerson.name}</h2>
                <Button size="sm" variant="ghost" className="ml-auto h-6 w-6 p-0" aria-label="Close" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" aria-hidden="true" /></Button>
              </div>
              <FamilySection bookId={bookId} character={editingPerson} />
            </div>
          )}
          <SuccessionPanel bookId={bookId} relationships={relationships} status={status} people={people} />
        </aside>
      </div>
    </div>
  )
}
