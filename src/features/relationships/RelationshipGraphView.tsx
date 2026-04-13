import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
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
import { X, Trash2, Network, Plus, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships, deleteRelationship, updateRelationship } from '@/db/hooks/useRelationships'
import { useBestRelationshipSnapshots, upsertRelationshipSnapshot } from '@/db/hooks/useRelationshipSnapshots'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useActiveEventId } from '@/store'
import { PortraitImage } from '@/components/PortraitImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/EmptyState'
import type { RelationshipSentiment, RelationshipStrength, RelationshipSnapshot } from '@/types'

// ─── Custom Node ────────────────────────────────────────────────────────────

function CharacterNode({ data }: { data: { name: string; portraitImageId: string | null } }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 shadow-lg min-w-20">
      <Handle type="target" position={Position.Left} style={{ background: 'hsl(212,72%,59%)' }} />
      <PortraitImage
        imageId={data.portraitImageId}
        alt={data.name}
        className="h-10 w-10 rounded-full object-cover"
        fallbackClassName="h-10 w-10 rounded-full"
      />
      <span className="text-xs font-medium text-[hsl(var(--foreground))] max-w-24 text-center leading-tight">
        {data.name}
      </span>
      <Handle type="source" position={Position.Right} style={{ background: 'hsl(212,72%,59%)' }} />
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
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          className="pointer-events-all absolute rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-0.5 text-xs hover:bg-[hsl(var(--accent))] nodrag nopan"
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
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null)
  const [editingSnapshot, setEditingSnapshot] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const posKey = `wb-rel-pos-${worldId ?? ''}`
  const [persistedPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try { return JSON.parse(localStorage.getItem(posKey) ?? '{}') } catch { return {} }
  })
  const posRef = useRef(persistedPositions)

  // Sync nodes — preserve positions across renders and navigation
  useEffect(() => {
    setNodes((prev) => {
      const livePos = new Map(prev.map((n) => [n.id, n.position]))
      return characters.map((c, i) => ({
        id: c.id,
        type: 'character',
        position: livePos.get(c.id) ?? posRef.current[c.id] ?? { x: (i % 4) * 220, y: Math.floor(i / 4) * 160 },
        data: { name: c.name, portraitImageId: c.portraitImageId },
      }))
    })
  }, [characters, setNodes])

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

  if (characters.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No characters yet"
        description="Add characters first, then come back here to define their relationships."
        action={
          <Button onClick={() => navigate(`/worlds/${worldId}/characters`)}>
            <Plus className="h-4 w-4" /> Go to Characters
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
          fitView
          style={{ background: 'hsl(222,47%,9%)' }}
          onNodeDragStop={(_, node) => {
            posRef.current = { ...posRef.current, [node.id]: node.position }
            localStorage.setItem(posKey, JSON.stringify(posRef.current))
          }}
        >
          <Background color="#334155" gap={20} />
          <Controls style={{ background: 'hsl(222,47%,14%)', borderColor: 'hsl(217,33%,22%)' }} />
          <MiniMap
            nodeColor="hsl(222,47%,20%)"
            maskColor="rgba(0,0,0,0.4)"
            style={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(217,33%,22%)' }}
          />
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
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedRelId(null)}>
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
              </>
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
            {!activeEventId && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-1.5"
                onClick={async () => {
                  await deleteRelationship(selectedRel.id)
                  setSelectedRelId(null)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete permanently
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
