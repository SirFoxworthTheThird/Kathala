import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  type NodeTypes,
  type EdgeTypes,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, Trash2, Network, Plus, Check, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships, createRelationship, deleteRelationship, updateRelationship } from '@/db/hooks/useRelationships'
import { useBestRelationshipSnapshots, useWorldRelationshipSnapshots, upsertRelationshipSnapshot } from '@/db/hooks/useRelationshipSnapshots'
import { computeRelationshipTimeline } from '@/lib/relationshipTimeline'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useActiveEventId } from '@/store'
import { PortraitImage } from '@/components/PortraitImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/EmptyState'
import { useFactions, useFactionMemberships } from '@/db/hooks/useFactions'
import { cn } from '@/lib/utils'
import type { Character, Relationship, RelationshipSentiment, RelationshipStrength, RelationshipSnapshot } from '@/types'

// ─── Custom Node ────────────────────────────────────────────────────────────

// Invisible connection strips hugging each edge of a character card. Together
// they let a drag start or end anywhere along the card's border (in any
// direction, thanks to ConnectionMode.Loose), while the centre stays free to
// drag the node itself.
const CONNECT_EDGE_BASE: React.CSSProperties = {
  background: 'transparent', border: 'none', borderRadius: 0, transform: 'none', minWidth: 0, minHeight: 0,
}
const CONNECT_EDGE_STYLE: Record<'left' | 'right' | 'top' | 'bottom', React.CSSProperties> = {
  left:   { ...CONNECT_EDGE_BASE, top: 0, left: 0, width: 10, height: '100%' },
  right:  { ...CONNECT_EDGE_BASE, top: 0, right: 0, left: 'auto', width: 10, height: '100%' },
  top:    { ...CONNECT_EDGE_BASE, top: 0, left: 0, width: '100%', height: 10 },
  bottom: { ...CONNECT_EDGE_BASE, bottom: 0, top: 'auto', left: 0, width: '100%', height: 10 },
}

function CharacterNode({ data }: { data: { name: string; portraitImageId: string | null; factionColor?: string | null; factionName?: string | null } }) {
  return (
    <div
      className="relative flex flex-col items-center gap-1 rounded-lg border-2 bg-[hsl(var(--card))] px-3 py-2 shadow-lg min-w-20 overflow-hidden"
      style={{ borderColor: data.factionColor ?? 'hsl(var(--border))' }}
    >
      {/* Perimeter connection zones — drag from any edge of one character to
          any edge of another to link them (undirected). The centre stays free
          for dragging the node to rearrange the graph. */}
      <Handle id="l" type="source" position={Position.Left}   style={CONNECT_EDGE_STYLE.left} />
      <Handle id="r" type="source" position={Position.Right}  style={CONNECT_EDGE_STYLE.right} />
      <Handle id="t" type="source" position={Position.Top}    style={CONNECT_EDGE_STYLE.top} />
      <Handle id="b" type="source" position={Position.Bottom} style={CONNECT_EDGE_STYLE.bottom} />
      <PortraitImage
        imageId={data.portraitImageId}
        alt={data.name}
        className="pointer-events-none h-10 w-10 rounded-full object-cover"
        fallbackClassName="h-10 w-10 rounded-full"
      />
      <span className="pointer-events-none text-xs font-medium text-[hsl(var(--foreground))] max-w-24 text-center leading-tight">
        {data.name}
      </span>
      {data.factionColor && data.factionName && (
        <span className="pointer-events-none text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: data.factionColor + '33', color: data.factionColor }}>
          {data.factionName}
        </span>
      )}
    </div>
  )
}

// ─── Custom Edge ────────────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<RelationshipSentiment, string> = {
  positive: '#4ade80',
  neutral: '#94a3b8',
  negative: '#f87171',
  complex: '#fbbf24',
}

function RelationshipEdge({
  id, sourceX, sourceY, targetX, targetY, data, markerEnd,
}: {
  id: string
  sourceX: number; sourceY: number; targetX: number; targetY: number
  data?: { label: string; sentiment: RelationshipSentiment; isInherited: boolean; onSelect: (id: string) => void }
  markerEnd?: string
}) {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const color = SENTIMENT_COLORS[data!.sentiment]
  // Inherited edges are dashed to signal "carrying forward from a previous chapter"
  const strokeDasharray = data!.isInherited ? '6 3' : undefined

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: 2, strokeDasharray }} />
      <EdgeLabelRenderer>
        <button
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
          className="absolute cursor-pointer rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-0.5 text-xs hover:bg-[hsl(var(--accent))] nodrag nopan"
          onClick={() => data!.onSelect(id)}
        >
          {data!.label}
        </button>
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes: NodeTypes = { character: CharacterNode }
const edgeTypes: EdgeTypes = { relationship: RelationshipEdge }

// ─── Snapshot Editor ─────────────────────────────────────────────────────────

function SnapshotEditor({
  worldId, relationshipId, eventId, base, existing,
  onSaved,
}: {
  worldId: string
  relationshipId: string
  eventId: string
  base: { label: string; strength: RelationshipStrength; sentiment: RelationshipSentiment; description: string }
  existing: RelationshipSnapshot | undefined
  onSaved: () => void
}) {
  const [label, setLabel]               = useState(existing?.label       ?? base.label)
  const [strength, setStrength]         = useState<RelationshipStrength>(existing?.strength   ?? base.strength)
  const [sentiment, setSentiment]       = useState<RelationshipSentiment>(existing?.sentiment ?? base.sentiment)
  const [description, setDescription]   = useState(existing?.description ?? base.description)
  const [saving, setSaving]             = useState(false)

  async function save() {
    setSaving(true)
    await upsertRelationshipSnapshot({ worldId, relationshipId, eventId, label, strength, sentiment, description, isActive: true })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Label</Label>
        <Input className="h-7 text-xs" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Strength</Label>
        <Select value={strength} onValueChange={(v) => setStrength(v as RelationshipStrength)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['weak', 'moderate', 'strong', 'bond'] as RelationshipStrength[]).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Sentiment</Label>
        <Select value={sentiment} onValueChange={(v) => setSentiment(v as RelationshipSentiment)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['positive', 'neutral', 'negative', 'complex'] as RelationshipSentiment[]).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea className="text-xs resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button size="sm" disabled={!label.trim() || saving} onClick={save}>
        <Check className="h-3.5 w-3.5" /> Save
      </Button>
    </div>
  )
}

// ─── Base relationship editor (default label/strength/sentiment) ─────────────

function BaseEditor({ relationship, onSaved }: { relationship: Relationship; onSaved: () => void }) {
  const [label, setLabel]             = useState(relationship.label)
  const [strength, setStrength]       = useState<RelationshipStrength>(relationship.strength)
  const [sentiment, setSentiment]     = useState<RelationshipSentiment>(relationship.sentiment)
  const [description, setDescription] = useState(relationship.description)
  const [saving, setSaving]           = useState(false)

  async function save() {
    setSaving(true)
    await updateRelationship(relationship.id, { label: label.trim(), strength, sentiment, description })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Label</Label>
        <Input className="h-7 text-xs" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Strength</Label>
        <Select value={strength} onValueChange={(v) => setStrength(v as RelationshipStrength)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['weak', 'moderate', 'strong', 'bond'] as RelationshipStrength[]).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Sentiment</Label>
        <Select value={sentiment} onValueChange={(v) => setSentiment(v as RelationshipSentiment)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['positive', 'neutral', 'negative', 'complex'] as RelationshipSentiment[]).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea className="text-xs resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button size="sm" disabled={!label.trim() || saving} onClick={save}>
        <Check className="h-3.5 w-3.5" /> Save relationship
      </Button>
    </div>
  )
}

// ─── Create relationship dialog ──────────────────────────────────────────────

function CreateRelationshipDialog({ open, onOpenChange, worldId, characters, startEventId, startChapterLabel, initialA = '', initialB = '' }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  worldId: string
  characters: Character[]
  startEventId: string | null
  startChapterLabel: string | null
  initialA?: string
  initialB?: string
}) {
  const [aId, setAId]                 = useState(initialA)
  const [bId, setBId]                 = useState(initialB)
  const [label, setLabel]             = useState('')
  const [strength, setStrength]       = useState<RelationshipStrength>('moderate')
  const [sentiment, setSentiment]     = useState<RelationshipSentiment>('neutral')
  const [description, setDescription] = useState('')
  const [saving, setSaving]           = useState(false)

  function reset() {
    setAId(''); setBId(''); setLabel(''); setStrength('moderate'); setSentiment('neutral'); setDescription('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!aId || !bId || aId === bId || !label.trim()) return
    setSaving(true)
    await createRelationship({
      worldId, characterAId: aId, characterBId: bId,
      label: label.trim(), strength, sentiment, description,
      isBidirectional: true, startEventId,
    })
    setSaving(false)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Relationship</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Character A</Label>
              <Select value={aId} onValueChange={setAId}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {characters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Character B</Label>
              <Select value={bId} onValueChange={setBId}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {characters.filter((c) => c.id !== aId).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Relationship Label</Label>
            <Input placeholder="e.g. mentor, rival, sibling" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Strength</Label>
              <Select value={strength} onValueChange={(v) => setStrength(v as RelationshipStrength)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['weak', 'moderate', 'strong', 'bond'] as RelationshipStrength[]).map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sentiment</Label>
              <Select value={sentiment} onValueChange={(v) => setSentiment(v as RelationshipSentiment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['positive', 'neutral', 'negative', 'complex'] as RelationshipSentiment[]).map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Input placeholder="Optional description…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {startChapterLabel && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Starts at <span className="font-medium text-[hsl(var(--foreground))]">{startChapterLabel}</span> and won't appear in earlier chapters.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!aId || !bId || aId === bId || !label.trim() || saving}>
              {saving ? 'Saving…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main View ──────────────────────────────────────────────────────────────

export default function RelationshipGraphView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const activeEventId = useActiveEventId()
  const allChapters = useWorldChapters(worldId ?? null)
  const allEvents = useWorldEvents(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const relationships = useRelationships(worldId ?? null)
  const snapshots = useBestRelationshipSnapshots(worldId ?? null, activeEventId)
  const allRelSnapshots = useWorldRelationshipSnapshots(worldId ?? null)
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null)
  const [editingSnapshot, setEditingSnapshot] = useState(false)
  const [editingBase, setEditingBase] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pendingConn, setPendingConn] = useState<{ a: string; b: string } | null>(null)
  const [showFactionOverlay, setShowFactionOverlay] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const allFactions    = useFactions(worldId ?? null)
  const allMemberships = useFactionMemberships(worldId ?? null)

  // Map characterId → active faction (first found, ordered by faction creation)
  const charFactionMap = new Map<string, { color: string; name: string }>()
  if (showFactionOverlay) {
    for (const m of allMemberships) {
      if (!charFactionMap.has(m.characterId)) {
        const f = allFactions.find((f) => f.id === m.factionId)
        if (f) charFactionMap.set(m.characterId, { color: f.color, name: f.name })
      }
    }
  }

  const posKey = `wb-rel-pos-${worldId ?? ''}`
  const [persistedPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try { return JSON.parse(localStorage.getItem(posKey) ?? '{}') } catch { return {} }
  })
  const posRef = useRef(persistedPositions)

  // Sync nodes — preserve positions across renders and navigation
  useEffect(() => {
    setNodes((prev) => {
      const livePos = new Map(prev.map((n) => [n.id, n.position]))
      return characters.map((c, i) => {
        const faction = showFactionOverlay ? charFactionMap.get(c.id) : undefined
        return {
          id: c.id,
          type: 'character',
          position: livePos.get(c.id) ?? posRef.current[c.id] ?? { x: (i % 4) * 220, y: Math.floor(i / 4) * 160 },
          data: {
            name: c.name,
            portraitImageId: c.portraitImageId,
            factionColor: faction?.color ?? null,
            factionName: faction?.name ?? null,
          },
        }
      })
    })
  }, [characters, setNodes, showFactionOverlay, allMemberships, allFactions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync edges — filter by startEventId, hide inactive, use snapshot data when available
  useEffect(() => {
    const snapshotMap = new Map(snapshots.map((s) => [s.relationshipId, s]))
    const chapterNumberById = new Map(allChapters.map((c) => [c.id, c.number]))
    const eventById = new Map(allEvents.map((e) => [e.id, e]))

    function globalOrder(eventId: string) {
      const ev = eventById.get(eventId)
      if (!ev) return -1
      return (chapterNumberById.get(ev.chapterId) ?? -1) * 10_000 + ev.sortOrder
    }

    const activeOrder = activeEventId ? globalOrder(activeEventId) : null

    const edges = relationships.flatMap((r) => {
      // Hide relationships that haven't started yet in the active event
      if (activeOrder !== null && r.startEventId) {
        const startOrder = globalOrder(r.startEventId)
        if (startOrder !== -1 && activeOrder < startOrder) return []
      }

      const snap = snapshotMap.get(r.id)
      const isActive = snap?.isActive ?? true
      // Hide relationships explicitly ended via a snapshot
      if (activeEventId && !isActive) return []

      return [{
        id: r.id,
        source: r.characterAId,
        target: r.characterBId,
        type: 'relationship',
        data: {
          label:       snap?.label     ?? r.label,
          sentiment:   snap?.sentiment ?? r.sentiment,
          isInherited: !!snap && !!activeEventId && snap.eventId !== activeEventId,
          onSelect:    (id: string) => {
            setSelectedRelId(id)
            setEditingSnapshot(!!activeEventId && !snapshotMap.has(id))
            setEditingBase(false)
          },
        },
      }]
    })
    setEdges(edges)
  }, [relationships, snapshots, setEdges, activeEventId, allChapters, allEvents])

  const selectedRel      = relationships.find((r) => r.id === selectedRelId)
  const selectedSnap     = snapshots.find((s) => s.relationshipId === selectedRelId)
  const isSnapInherited  = !!selectedSnap && !!activeEventId && selectedSnap.eventId !== activeEventId
  const inheritedEvent   = isSnapInherited ? allEvents.find((e) => e.id === selectedSnap!.eventId) : undefined
  const charA            = characters.find((c) => c.id === selectedRel?.characterAId)
  const charB            = characters.find((c) => c.id === selectedRel?.characterBId)

  // Label for the chapter a newly-created relationship would start in (the cursor).
  const createStartEvent   = activeEventId ? allEvents.find((e) => e.id === activeEventId) : undefined
  const createStartChapter = createStartEvent ? allChapters.find((c) => c.id === createStartEvent.chapterId) : undefined
  const startChapterLabel  = createStartChapter
    ? `Ch. ${createStartChapter.number} — ${createStartChapter.title}${createStartEvent ? ` / ${createStartEvent.title}` : ''}`
    : null

  if (characters.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No relationships yet"
        description="Define how characters know and feel about each other."
        action={
          <Button onClick={() => navigate(`/worlds/${worldId}/characters`)}>
            <Plus className="h-4 w-4" /> Add Relationship
          </Button>
        }
        className="h-full"
      />
    )
  }

  return (
    <div className="relative flex h-full">
      <div className="flex-1 relative" style={{ background: 'hsl(222,47%,9%)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          style={{ background: 'hsl(222,47%,9%)' }}
          onConnect={(c) => {
            // Drag between two characters → open the create dialog pre-filled.
            if (c.source && c.target && c.source !== c.target) {
              setPendingConn({ a: c.source, b: c.target })
              setCreating(true)
            }
          }}
          onEdgeClick={(_, edge) => {
            // Clicking anywhere on the connection selects the relationship.
            setSelectedRelId(edge.id)
            setEditingSnapshot(false)
            setEditingBase(false)
          }}
          onNodeDragStop={(_, node) => {
            posRef.current = { ...posRef.current, [node.id]: node.position }
            localStorage.setItem(posKey, JSON.stringify(posRef.current))
          }}
        >
          <Background color="#334155" gap={20} />
          <Panel position="top-left">
            <Button size="sm" className="gap-1.5 shadow-md" onClick={() => { setPendingConn(null); setCreating(true) }} disabled={characters.length < 2}>
              <Plus className="h-4 w-4" /> New Relationship
            </Button>
          </Panel>
          <Controls style={{ background: 'hsl(222,47%,14%)', borderColor: 'hsl(217,33%,22%)' }} />
          <MiniMap
            nodeColor="hsl(222,47%,20%)"
            maskColor="rgba(0,0,0,0.4)"
            style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,22%)' }}
          />
          {allFactions.length > 0 && (
            <Panel position="top-right">
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setShowFactionOverlay((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-md transition-colors',
                    showFactionOverlay
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : 'border-[hsl(217,33%,30%)] bg-[hsl(222,47%,14%)] text-[hsl(210,40%,70%)] hover:bg-[hsl(222,47%,20%)]'
                  )}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Factions
                </button>
                {showFactionOverlay && allFactions.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-1.5 rounded border border-[hsl(217,33%,30%)] bg-[hsl(222,47%,14%)] px-2 py-1 text-[10px] text-[hsl(210,40%,70%)]"
                  >
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: f.color }} />
                    {f.name}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {selectedRel && (
        <div className="flex w-64 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
            <div>
              <span className="text-sm font-semibold">Relationship</span>
              {activeEventId && (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
                  Event active
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedRelId(null); setEditingBase(false); setEditingSnapshot(false) }}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            {/* Characters */}
            <div className="text-center text-sm">
              <p className="font-semibold">{charA?.name}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] my-1">
                ↕ {selectedSnap?.label ?? selectedRel.label}
              </p>
              <p className="font-semibold">{charB?.name}</p>
            </div>

            {/* Started-in event picker */}
            {worldId && (() => {
              const chapterNumberById = new Map(allChapters.map((c) => [c.id, c.number]))
              const sortedEvents = [...allEvents].sort((a, b) => {
                const cn = (chapterNumberById.get(a.chapterId) ?? 0) - (chapterNumberById.get(b.chapterId) ?? 0)
                return cn !== 0 ? cn : a.sortOrder - b.sortOrder
              })
              return (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Started in</Label>
                  <Select
                    value={selectedRel.startEventId ?? '__beginning__'}
                    onValueChange={async (v) => {
                      await updateRelationship(selectedRel.id, { startEventId: v === '__beginning__' ? null : v })
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__beginning__">Beginning (always visible)</SelectItem>
                      {sortedEvents.map((ev) => {
                        const ch = allChapters.find((c) => c.id === ev.chapterId)
                        return (
                          <SelectItem key={ev.id} value={ev.id}>
                            Ch. {ch?.number ?? '?'} — {ev.title}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )
            })()}

            {/* Inherited / base info */}
            {!editingSnapshot && (
              editingBase ? (
                <BaseEditor relationship={selectedRel} onSaved={() => setEditingBase(false)} />
              ) : (
                <>
                  {isSnapInherited && inheritedEvent && (
                    <p className="text-[10px] italic text-[hsl(var(--muted-foreground))] text-center">
                      Inherited from event: {inheritedEvent.title}
                    </p>
                  )}
                  <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
                    <p><span className="font-medium text-[hsl(var(--foreground))]">Strength:</span> {selectedSnap?.strength ?? selectedRel.strength}</p>
                    <p><span className="font-medium text-[hsl(var(--foreground))]">Sentiment:</span> {selectedSnap?.sentiment ?? selectedRel.sentiment}</p>
                    {(selectedSnap?.description || selectedRel.description) && (
                      <p className="pt-1 text-[hsl(var(--foreground))]">{selectedSnap?.description || selectedRel.description}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditingBase(true)}>
                    Edit relationship
                  </Button>
                </>
              )
            )}

            {/* Event snapshot editor */}
            {activeEventId && editingSnapshot && worldId && (
              <SnapshotEditor
                worldId={worldId}
                relationshipId={selectedRel.id}
                eventId={activeEventId}
                base={selectedRel}
                existing={isSnapInherited ? undefined : selectedSnap}
                onSaved={() => setEditingSnapshot(false)}
              />
            )}

            {activeEventId && !editingSnapshot && (
              <Button size="sm" variant="outline" onClick={() => setEditingSnapshot(true)}>
                {!selectedSnap ? 'Set for this event' : isSnapInherited ? 'Override for this event' : 'Edit event state'}
              </Button>
            )}

            {/* Evolution — how this relationship changes across the story */}
            {!editingSnapshot && (() => {
              const points = computeRelationshipTimeline({ relationship: selectedRel, snapshots: allRelSnapshots, events: allEvents, chapters: allChapters })
              if (points.length < 2) return null
              return (
                <div className="border-t border-[hsl(var(--border))] pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Evolution</p>
                  <div className="flex flex-col">
                    {points.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex flex-col items-center self-stretch">
                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SENTIMENT_COLORS[p.sentiment] }} />
                          {i < points.length - 1 && <span className="w-px flex-1 bg-[hsl(var(--border))]" />}
                        </div>
                        <div className="min-w-0 flex-1 pb-2">
                          <p className={cn('truncate text-xs', p.isActive ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] line-through')}>
                            {p.label}
                            <span className="ml-1 text-[10px] text-[hsl(var(--muted-foreground))]">· {p.sentiment}</span>
                          </p>
                          <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                            {p.isBase ? 'from the start' : p.chapterNumber !== null ? `Ch. ${p.chapterNumber}${p.eventTitle ? ` — ${p.eventTitle}` : ''}` : p.eventTitle ?? ''}
                            {!p.isActive && ' · ended'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="border-t border-[hsl(var(--border))] p-3 flex flex-col gap-2">
            {activeEventId && worldId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-white border-[hsl(var(--destructive))]/40"
                onClick={async () => {
                  await upsertRelationshipSnapshot({
                    worldId,
                    relationshipId: selectedRel.id,
                    eventId: activeEventId,
                    label:       selectedSnap?.label       ?? selectedRel.label,
                    strength:    selectedSnap?.strength    ?? selectedRel.strength,
                    sentiment:   selectedSnap?.sentiment   ?? selectedRel.sentiment,
                    description: selectedSnap?.description ?? selectedRel.description,
                    isActive: false,
                  })
                  setSelectedRelId(null)
                  setEditingSnapshot(false)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> End in this event
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5"
              onClick={async () => {
                await deleteRelationship(selectedRel.id)
                setSelectedRelId(null)
                setEditingBase(false)
                setEditingSnapshot(false)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete permanently
            </Button>
          </div>
        </div>
      )}

      {worldId && (
        <CreateRelationshipDialog
          key={creating ? `${pendingConn?.a ?? ''}-${pendingConn?.b ?? ''}` : 'closed'}
          open={creating}
          onOpenChange={(o) => { setCreating(o); if (!o) setPendingConn(null) }}
          worldId={worldId}
          characters={characters}
          startEventId={activeEventId}
          startChapterLabel={startChapterLabel}
          initialA={pendingConn?.a ?? ''}
          initialB={pendingConn?.b ?? ''}
        />
      )}
    </div>
  )
}
