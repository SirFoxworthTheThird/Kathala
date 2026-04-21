import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Shield, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  useFactions, useMembershipsForCharacter,
  createFactionMembership, updateFactionMembership, deleteFactionMembership,
} from '@/db/hooks/useFactions'
import { useEvents, useChapters, useTimelines } from '@/db/hooks/useTimeline'
import type { Character, FactionMembership } from '@/types'

function MembershipCard({
  membership, factionName, factionColor, allEvents, onDelete, onNavigate,
}: {
  membership: FactionMembership
  factionName: string
  factionColor: string
  allEvents: ReturnType<typeof useEvents>
  onDelete: () => void
  onNavigate: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const startEv = allEvents.find((e) => e.id === membership.startEventId)
  const endEv = allEvents.find((e) => e.id === membership.endEventId)

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="h-3 w-3 rounded-full shrink-0" style={{ background: factionColor }} />
        <span className="flex-1 text-sm font-medium">{factionName}</span>
        {membership.role && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{membership.role}</span>
        )}
        <button
          onClick={onNavigate}
          title="Open in Factions"
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(false) }}
        title="Remove from faction"
        description={`Remove ${factionName} membership?`}
        onConfirm={onDelete}
      />

      {(startEv || endEv) && !expanded && (
        <p className="px-3 pb-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          {startEv ? startEv.title : 'From beginning'} → {endEv ? endEv.title : 'Ongoing'}
        </p>
      )}

      {expanded && (
        <div className="border-t border-[hsl(var(--border))] px-3 pb-3 pt-2 flex flex-col gap-2">
          <div>
            <Label className="text-xs">Role</Label>
            <Input
              className="mt-1 h-7 text-xs"
              value={membership.role ?? ''}
              placeholder="e.g. Leader, Spy…"
              onChange={(e) => updateFactionMembership(membership.id, { role: e.target.value || null })}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">From event</Label>
              <Select
                value={membership.startEventId ?? 'none'}
                onValueChange={(v) => updateFactionMembership(membership.id, { startEventId: v === 'none' ? null : v })}
              >
                <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Beginning</SelectItem>
                  {allEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title || e.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs">Until event</Label>
              <Select
                value={membership.endEventId ?? 'none'}
                onValueChange={(v) => updateFactionMembership(membership.id, { endEventId: v === 'none' ? null : v })}
              >
                <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ongoing</SelectItem>
                  {allEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title || e.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              className="mt-1 text-xs resize-none"
              rows={2}
              value={membership.notes}
              placeholder="Notes about this membership…"
              onChange={(e) => updateFactionMembership(membership.id, { notes: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="mt-1 h-7 text-xs"
            onClick={() => setConfirmDelete(true)}
          >
            Remove from faction
          </Button>
        </div>
      )}
    </div>
  )
}

export function FactionsTab({ character }: { character: Character }) {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const memberships = useMembershipsForCharacter(character.id)
  const allFactions = useFactions(worldId ?? null)
  const timelines = useTimelines(worldId ?? null)
  const firstTimelineId = timelines[0]?.id ?? null
  const chapters = useChapters(firstTimelineId)
  const firstChapterId = chapters[0]?.id ?? null
  const allEvents = useEvents(firstChapterId) ?? []

  const [adding, setAdding] = useState(false)

  const memberFactionIds = new Set(memberships.map((m) => m.factionId))
  const joinableFactions = allFactions.filter((f) => !memberFactionIds.has(f.id))
  const factionById = new Map(allFactions.map((f) => [f.id, f]))

  async function handleJoin(factionId: string) {
    if (!worldId) return
    await createFactionMembership({
      worldId,
      factionId,
      characterId: character.id,
      role: null,
      startEventId: null,
      endEventId: null,
      notes: '',
    })
    setAdding(false)
  }

  if (allFactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Shield className="h-10 w-10 text-[hsl(var(--muted-foreground)/0.3)]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No factions exist yet.</p>
        <Button size="sm" variant="outline" onClick={() => navigate(`/worlds/${worldId}/factions`)}>
          Go to Factions
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      {memberships.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {character.name} is not a member of any faction.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {memberships.map((m) => {
            const faction = factionById.get(m.factionId)
            if (!faction) return null
            return (
              <MembershipCard
                key={m.id}
                membership={m}
                factionName={faction.name}
                factionColor={faction.color}
                allEvents={allEvents}
                onDelete={() => deleteFactionMembership(m.id)}
                onNavigate={() => navigate(`/worlds/${worldId}/factions`)}
              />
            )
          })}
        </div>
      )}

      {adding ? (
        <Select onValueChange={handleJoin}>
          <SelectTrigger className="text-xs h-8">
            <SelectValue placeholder="Choose faction…" />
          </SelectTrigger>
          <SelectContent>
            {joinableFactions.length === 0 ? (
              <SelectItem value="__none__" disabled>Member of all factions</SelectItem>
            ) : (
              joinableFactions.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 self-start"
          onClick={() => setAdding(true)}
          disabled={joinableFactions.length === 0}
        >
          <Plus className="h-3.5 w-3.5" /> Add to faction
        </Button>
      )}
    </div>
  )
}
