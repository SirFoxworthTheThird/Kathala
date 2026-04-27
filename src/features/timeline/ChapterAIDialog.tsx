import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, Sparkles, ArrowRight, AlertCircle, Heart, Skull, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { useEvents } from '@/db/hooks/useTimeline'
import { useEventSnapshots } from '@/db/hooks/useSnapshots'
import { useEventRelationshipSnapshots } from '@/db/hooks/useRelationshipSnapshots'
import { useFactions, useFactionMemberships } from '@/db/hooks/useFactions'
import { db } from '@/db/database'
import type { Chapter, WorldEvent, CharacterSnapshot, RelationshipSnapshot, Faction, FactionMembership } from '@/types'

// ── Types for the LLM response ────────────────────────────────────────────────

interface ChapterAIResponse {
  chapter: Chapter
  events: WorldEvent[]
  characterSnapshots: CharacterSnapshot[]
  relationshipSnapshots: RelationshipSnapshot[]
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  worldId: string,
  worldName: string,
  timelineId: string,
  timelineName: string,
  nextNumber: number,
  existingChapters: Chapter[],
  characters: ReturnType<typeof useCharacters>,
  relationships: ReturnType<typeof useRelationships>,
  items: ReturnType<typeof useItems>,
  locationMarkers: ReturnType<typeof useAllLocationMarkers>,
  mapLayers: ReturnType<typeof useMapLayers>,
  factions: Faction[],
  memberships: FactionMembership[],
  chapterToUpdate?: {
    chapter: Chapter
    events: WorldEvent[]
    snapshots: CharacterSnapshot[]
    relSnapshots: RelationshipSnapshot[]
  },
): string {
  const ts = Date.now()
  const isUpdate = !!chapterToUpdate

  const contextChapters = isUpdate
    ? existingChapters.filter((c) => c.id !== chapterToUpdate!.chapter.id)
    : existingChapters
  const chapterList = contextChapters.length > 0
    ? contextChapters.map((c) => `  - Ch.${c.number} "${c.title}"${c.synopsis ? ` — ${c.synopsis}` : ''}`).join('\n')
    : '  (none yet)'

  const existingEventsText = isUpdate && chapterToUpdate!.events.length > 0
    ? chapterToUpdate!.events
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((e) => `  - [${e.sortOrder}] "${e.title}": ${e.description}`)
        .join('\n')
    : '  (none)'

  const existingSnapshotsText = isUpdate && chapterToUpdate!.snapshots.length > 0
    ? chapterToUpdate!.snapshots.map((s) => {
        const char = characters.find((c) => c.id === s.characterId)
        return `  - ${char?.name ?? s.characterId}: ${s.statusNotes || '(no notes)'}`
      }).join('\n')
    : '  (none)'

  const existingRelSnapsText = isUpdate && chapterToUpdate!.relSnapshots.length > 0
    ? chapterToUpdate!.relSnapshots.map((rs) => {
        const rel = relationships.find((r) => r.id === rs.relationshipId)
        const charA = characters.find((c) => c.id === rel?.characterAId)
        const charB = characters.find((c) => c.id === rel?.characterBId)
        const names = charA && charB ? `${charA.name} ↔ ${charB.name}` : rs.relationshipId
        return `  - ${names}: ${rs.isActive ? 'active' : 'ended'} · ${rs.sentiment} · ${rs.strength} — "${rs.label}"${rs.description ? ` — ${rs.description.slice(0, 80)}` : ''}`
      }).join('\n')
    : '  (none)'

  const characterList = characters.length > 0
    ? characters.map((c) => `  - "${c.name}" (id: "${c.id}")${c.description ? ` — ${c.description.slice(0, 120)}` : ''}${!c.isAlive ? ' [deceased]' : ''}`).join('\n')
    : '  (none)'

  const charById = new Map(characters.map((c) => [c.id, c]))
  const relationshipList = relationships.length > 0
    ? relationships.map((r) => {
        const a = charById.get(r.characterAId)?.name ?? r.characterAId
        const b = charById.get(r.characterBId)?.name ?? r.characterBId
        const dir = r.isBidirectional ? '↔' : '→'
        return `  - "${a} ${dir} ${b}" (id: "${r.id}") — "${r.label}" · ${r.sentiment} · ${r.strength}`
      }).join('\n')
    : '  (none — omit relationshipSnapshots array or leave it empty)'

  const hasRelationships = relationships.length > 0

  const itemList = items.length > 0
    ? items.map((it) => `  - "${it.name}" (id: "${it.id}")${it.description ? ` — ${it.description.slice(0, 100)}` : ''}`).join('\n')
    : '  (none)'

  const hasItems = items.length > 0

  const layerById = new Map(mapLayers.map((l) => [l.id, l]))
  const locationList = locationMarkers.length > 0
    ? locationMarkers.map((m) => {
        const layer = layerById.get(m.mapLayerId)
        const layerHint = layer ? ` [map: "${layer.name}", mapLayerId: "${m.mapLayerId}"]` : ''
        return `  - "${m.name}" (markerId: "${m.id}")${layerHint}${m.description ? ` — ${m.description.slice(0, 80)}` : ''}`
      }).join('\n')
    : '  (none — leave currentLocationMarkerId and currentMapLayerId as null)'

  const hasLocations = locationMarkers.length > 0

  const factionList = factions.length > 0
    ? factions.map((f: Faction) => {
        const memberNames = memberships
          .filter((m: FactionMembership) => m.factionId === f.id)
          .map((m: FactionMembership) => characters.find((c) => c.id === m.characterId)?.name)
          .filter(Boolean)
          .join(', ')
        return `  - "${f.name}" (id: "${f.id}")${f.description ? ` — ${f.description.slice(0, 100)}` : ''}${memberNames ? ` [members: ${memberNames}]` : ''}`
      }).join('\n')
    : '  (none)'

  return `You are helping me ${isUpdate ? 'rewrite an existing chapter' : 'add a new chapter'} in PlotWeave, a story-tracking app.
Read the ${isUpdate ? 'rewritten chapter content' : 'chapter content'} I provide, then output a single JSON object I can import directly.
Output ONLY the raw JSON — no explanation, no markdown fences.

═══════════════════════════════════════════════
WORLD CONTEXT  (copy these IDs exactly)
═══════════════════════════════════════════════

World:    "${worldName}"  (worldId: "${worldId}")
Timeline: "${timelineName}"  (timelineId: "${timelineId}")
${isUpdate
  ? `Chapter being rewritten: Ch.${chapterToUpdate!.chapter.number} — "${chapterToUpdate!.chapter.title}"
IMPORTANT: Use this exact chapter id: "${chapterToUpdate!.chapter.id}"`
  : `New chapter number: ${nextNumber}`}
Use this timestamp for all createdAt / updatedAt fields: ${ts}

── Other chapters (for narrative context only, do not recreate) ──
${chapterList}${isUpdate ? `

── Current chapter content (being replaced — use as context for what changes) ──
Current title: "${chapterToUpdate!.chapter.title}"
Current synopsis: ${chapterToUpdate!.chapter.synopsis || '(none)'}
Current events:
${existingEventsText}
Current character snapshots:
${existingSnapshotsText}
Current relationship snapshots:
${existingRelSnapsText}` : ''}

── Characters — USE THESE EXACT IDs ──
${characterList}

── Relationships — USE THESE EXACT IDs ──
${relationshipList}

── Items — USE THESE EXACT IDs ──
${itemList}

── Locations — USE THESE EXACT IDs to place characters on the map ──
${locationList}

── Factions — FOR CONTEXT ONLY (no faction output required) ──
${factionList}

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

{
  "chapter": {
    "id": "${isUpdate ? chapterToUpdate!.chapter.id : '<new uuid v4>'}",
    "worldId": "${worldId}",
    "timelineId": "${timelineId}",
    "number": ${isUpdate ? chapterToUpdate!.chapter.number : nextNumber},
    "title": "<chapter title>",
    "synopsis": "<2–4 sentence summary of what happens>",
    "notes": "",
    "createdAt": ${ts},
    "updatedAt": ${ts}
  },
  "events": [
    {
      "id": "<new uuid>",
      "worldId": "${worldId}",
      "chapterId": "<same as chapter.id above>",
      "timelineId": "${timelineId}",
      "title": "<short event title>",
      "description": "<detailed description of what happens>",
      "locationMarkerId": ${hasLocations ? '"<markerId from location list, or null>"' : 'null'},
      "involvedCharacterIds": ["<char id from list>"],
      "involvedItemIds": ${hasItems ? '["<item id if this event involves an item, otherwise []>"]' : '[]'},
      "tags": ["<thematic tag>"],
      "sortOrder": 0,
      "travelDays": null,
      "createdAt": ${ts},
      "updatedAt": ${ts}
    }
    // ... 2–5 events total, sortOrder increments by 1
  ],
  "characterSnapshots": [
    // One entry per character PER EVENT
    {
      "id": "<new uuid>",
      "worldId": "${worldId}",
      "characterId": "<char id from list>",
      "eventId": "<id of the specific event>",
      "isAlive": true,
${hasLocations
  ? `      "currentLocationMarkerId": "<markerId where this character is, or null>",
      "currentMapLayerId": "<mapLayerId matching the markerId, or null>",`
  : `      "currentLocationMarkerId": null,
      "currentMapLayerId": null,`}
      "inventoryItemIds": ${hasItems ? '["<item id if this character is carrying this item during this event, otherwise []>"]' : '[]'},
      "inventoryNotes": "",
      "statusNotes": "<1–2 sentences: what this character is doing or experiencing>",
      "travelModeId": null,
      "sortKey": null,
      "createdAt": ${ts},
      "updatedAt": ${ts}
    }
    // Repeat for every character × event combination
  ]${hasRelationships ? `,
  "relationshipSnapshots": [
    // One entry per relationship PER EVENT where the relationship is active or changes
    {
      "id": "<new uuid>",
      "worldId": "${worldId}",
      "relationshipId": "<id from relationship list>",
      "eventId": "<id of the specific event>",
      "isActive": true,
      "sentiment": "<positive|neutral|negative|complex>",
      "strength": "<weak|moderate|strong|bond>",
      "label": "<brief label for this relationship at this point>",
      "description": "<1–2 sentences: how this relationship stands during this event>",
      "sortKey": null,
      "createdAt": ${ts},
      "updatedAt": ${ts}
    }
    // Include for each relationship that is relevant to this chapter
  ]` : ''}
}

═══════════════════════════════════════════════
RULES
═══════════════════════════════════════════════

${isUpdate ? `1. The chapter.id MUST be exactly "${chapterToUpdate!.chapter.id}" — do not change it.` : '1. Use proper UUID v4 format for every new id (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).'}
   All event ids, snapshot ids and relationship snapshot ids must be new UUIDs (v4 format).
2. Every characterId in events and snapshots MUST be one of the ids listed above.
3. Every itemId in involvedItemIds and inventoryItemIds MUST be one of the item ids listed above.
4. Write a characterSnapshot for EVERY character × EVERY event combination. Carry forward last known state if a character is not present.
5. Set isAlive: false in any snapshot after the event where the character dies.
6. Set eventId in each snapshot to the id of the specific event it belongs to.
7. sortOrder in events starts at 0 and increments by 1.${hasLocations ? `
8. Character snapshots: set currentLocationMarkerId + currentMapLayerId to where the character is. Use null if unknown.
9. Events: set locationMarkerId to where the event takes place, or null.
10. Do NOT invent new location IDs — only use the markerId values listed above.` : `
8. No locations defined yet — leave currentLocationMarkerId and currentMapLayerId as null.`}${hasItems ? `
${hasLocations ? '11' : '9'}. Set inventoryItemIds on character snapshots to the items each character is carrying at that event. Use only item ids from the list above.` : ''}${hasRelationships ? `
${hasLocations ? (hasItems ? '12' : '11') : (hasItems ? '10' : '9')}. Every relationshipId in relationshipSnapshots MUST be one of the ids listed above.
${hasLocations ? (hasItems ? '13' : '12') : (hasItems ? '11' : '10')}. Include a relationshipSnapshot for each relationship that plays a role in this chapter, for each relevant event. Omit relationships with no bearing on this chapter.` : ''}
${hasLocations ? (hasItems ? (hasRelationships ? '14' : '12') : (hasRelationships ? '12' : '11')) : (hasItems ? (hasRelationships ? '11' : '10') : (hasRelationships ? '10' : '9'))}. Output ONLY the JSON object, starting with { and ending with }.

═══════════════════════════════════════════════
MY CHAPTER CONTENT
═══════════════════════════════════════════════

[PASTE YOUR CHAPTER / SCENE TEXT HERE]`
}

// ── Validation + import ───────────────────────────────────────────────────────

function validateResponse(
  raw: string,
  worldId: string,
  timelineId: string,
  characterIds: Set<string>,
  itemIds: Set<string>,
  markerIds: Set<string>,
  relationshipIds: Set<string>,
): ChapterAIResponse {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('Could not parse JSON. Make sure you copied the full response.') }

  if (typeof parsed !== 'object' || parsed === null) throw new Error('Response is not a JSON object.')
  const d = parsed as Record<string, unknown>

  if (typeof d.chapter !== 'object' || d.chapter === null) throw new Error('Missing "chapter" field.')
  const ch = d.chapter as Record<string, unknown>
  if (typeof ch.id !== 'string') throw new Error('chapter.id must be a string.')
  if (ch.worldId !== worldId) throw new Error(`chapter.worldId mismatch. Expected "${worldId}", got "${ch.worldId}".`)
  if (ch.timelineId !== timelineId) throw new Error(`chapter.timelineId mismatch. Expected "${timelineId}".`)
  if (typeof ch.number !== 'number') throw new Error('chapter.number must be a number.')
  if (typeof ch.title !== 'string' || !ch.title.trim()) throw new Error('chapter.title is required.')

  if (!Array.isArray(d.events)) throw new Error('Missing "events" array.')
  for (const ev of d.events as Record<string, unknown>[]) {
    if (typeof ev.id !== 'string') throw new Error('Each event must have an id string.')
    if (ev.worldId !== worldId) throw new Error(`Event "${ev.title}" has wrong worldId.`)
    if (ev.chapterId !== ch.id) throw new Error(`Event "${ev.title}" chapterId must match chapter.id.`)
    if (ev.locationMarkerId != null && !markerIds.has(ev.locationMarkerId as string)) {
      throw new Error(`Event "${ev.title}" references unknown locationMarkerId "${ev.locationMarkerId}".`)
    }
    if (Array.isArray(ev.involvedCharacterIds)) {
      for (const cid of ev.involvedCharacterIds as string[]) {
        if (!characterIds.has(cid)) throw new Error(`Event "${ev.title}" references unknown characterId "${cid}".`)
      }
    }
    if (Array.isArray(ev.involvedItemIds)) {
      for (const iid of ev.involvedItemIds as string[]) {
        if (!itemIds.has(iid)) throw new Error(`Event "${ev.title}" references unknown itemId "${iid}".`)
      }
    }
  }

  const responseEventIds = new Set((d.events as Record<string, unknown>[]).map((ev) => ev.id as string))

  if (!Array.isArray(d.characterSnapshots)) throw new Error('Missing "characterSnapshots" array.')
  for (const snap of d.characterSnapshots as Record<string, unknown>[]) {
    if (typeof snap.id !== 'string') throw new Error('Each snapshot must have an id string.')
    if (snap.worldId !== worldId) throw new Error('A snapshot has the wrong worldId.')
    if (typeof snap.eventId !== 'string' || !responseEventIds.has(snap.eventId as string)) {
      throw new Error(`A snapshot eventId must match one of the event ids in the response.`)
    }
    if (typeof snap.characterId !== 'string' || !characterIds.has(snap.characterId as string)) {
      throw new Error(`Snapshot references unknown characterId "${snap.characterId}".`)
    }
    if (snap.currentLocationMarkerId != null && !markerIds.has(snap.currentLocationMarkerId as string)) {
      throw new Error(`Snapshot for character "${snap.characterId}" references unknown locationMarkerId "${snap.currentLocationMarkerId}".`)
    }
  }

  // Validate relationshipSnapshots (optional — only present when relationships exist)
  if (d.relationshipSnapshots !== undefined) {
    if (!Array.isArray(d.relationshipSnapshots)) throw new Error('"relationshipSnapshots" must be an array.')
    for (const rs of d.relationshipSnapshots as Record<string, unknown>[]) {
      if (typeof rs.id !== 'string') throw new Error('Each relationshipSnapshot must have an id string.')
      if (rs.worldId !== worldId) throw new Error('A relationshipSnapshot has the wrong worldId.')
      if (typeof rs.relationshipId !== 'string' || !relationshipIds.has(rs.relationshipId as string)) {
        throw new Error(`RelationshipSnapshot references unknown relationshipId "${rs.relationshipId}".`)
      }
      if (typeof rs.eventId !== 'string' || !responseEventIds.has(rs.eventId as string)) {
        throw new Error('A relationshipSnapshot eventId must match one of the event ids in the response.')
      }
    }
  } else {
    // Ensure the field is always present on the parsed result
    ;(d as Record<string, unknown>).relationshipSnapshots = []
  }

  return parsed as unknown as ChapterAIResponse
}

async function importChapter(data: ChapterAIResponse, replacing: boolean): Promise<string> {
  await db.transaction('rw', [db.chapters, db.events, db.characterSnapshots, db.relationshipSnapshots], async () => {
    if (replacing) {
      // Get existing event IDs for this chapter before deleting them
      const existingEventIds = (await db.events.where('chapterId').equals(data.chapter.id).toArray()).map((e) => e.id)
      await db.events.where('chapterId').equals(data.chapter.id).delete()
      // Delete snapshots by eventId — chapterId is no longer indexed on characterSnapshots
      if (existingEventIds.length > 0) {
        await db.characterSnapshots.where('eventId').anyOf(existingEventIds).delete()
        await db.relationshipSnapshots.where('eventId').anyOf(existingEventIds).delete()
      }
    }
    await db.chapters.put(data.chapter)
    if (data.events.length) {
      // Ensure status and povCharacterId are always present — AI JSON may omit fields predating their schema versions
      const normalised = data.events.map((ev) => {
        const p = ev as Partial<WorldEvent>
        return { ...ev, status: p.status ?? ('draft' as const), povCharacterId: p.povCharacterId ?? null }
      })
      await db.events.bulkPut(normalised)
    }
    if (data.characterSnapshots.length) await db.characterSnapshots.bulkPut(data.characterSnapshots)
    if (data.relationshipSnapshots?.length) await db.relationshipSnapshots.bulkPut(data.relationshipSnapshots)
  })
  return data.chapter.id
}

// ── Review step ───────────────────────────────────────────────────────────────

interface ReviewStepProps {
  preview: ChapterAIResponse
  characters: ReturnType<typeof useCharacters>
  relationships: ReturnType<typeof useRelationships>
  locationMarkers: ReturnType<typeof useAllLocationMarkers>
  isUpdate: boolean
  importing: boolean
  error: string | null
  onBack: () => void
  onImport: () => void
}

function ReviewStep({ preview, characters, relationships, locationMarkers, isUpdate, importing, error, onBack, onImport }: ReviewStepProps) {
  const charById = new Map(characters.map((c) => [c.id, c]))
  const relById = new Map(relationships.map((r) => [r.id, r]))
  const markerById = new Map(locationMarkers.map((m) => [m.id, m]))
  const sortedEvents = [...preview.events].sort((a, b) => a.sortOrder - b.sortOrder)
  const relSnapshots = preview.relationshipSnapshots ?? []

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
        {/* Chapter summary */}
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">Chapter</p>
          <p className="text-sm font-semibold">Ch. {preview.chapter.number} — {preview.chapter.title}</p>
          {preview.chapter.synopsis && (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{preview.chapter.synopsis}</p>
          )}
          <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            {preview.events.length} event{preview.events.length !== 1 ? 's' : ''} · {preview.characterSnapshots.length} character snapshot{preview.characterSnapshots.length !== 1 ? 's' : ''}{relSnapshots.length > 0 ? ` · ${relSnapshots.length} relationship snapshot${relSnapshots.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>

        {/* Events + snapshots */}
        {sortedEvents.map((ev) => {
          const evSnapshots = preview.characterSnapshots.filter((s) => s.eventId === ev.id)
          const evRelSnapshots = relSnapshots.filter((rs) => rs.eventId === ev.id)
          const location = ev.locationMarkerId ? markerById.get(ev.locationMarkerId) : null
          return (
            <div key={ev.id} className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              {/* Event header */}
              <div className="bg-[hsl(var(--muted)/0.4)] px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold">{ev.title}</p>
                  {location && (
                    <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                      <MapPin className="h-2.5 w-2.5" />{location.name}
                    </span>
                  )}
                </div>
                {ev.description && (
                  <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))] line-clamp-2">{ev.description}</p>
                )}
              </div>

              {/* Character snapshots for this event */}
              {evSnapshots.length > 0 && (
                <div className="divide-y divide-[hsl(var(--border))]">
                  {evSnapshots.map((snap) => {
                    const char = charById.get(snap.characterId)
                    const loc = snap.currentLocationMarkerId ? markerById.get(snap.currentLocationMarkerId) : null
                    return (
                      <div key={snap.id} className="flex items-start gap-3 px-4 py-2">
                        <div className="flex items-center gap-1.5 w-28 shrink-0">
                          {snap.isAlive
                            ? <Heart className="h-2.5 w-2.5 text-green-400 shrink-0" />
                            : <Skull className="h-2.5 w-2.5 text-red-400 shrink-0" />}
                          <span className="text-xs font-medium truncate">{char?.name ?? snap.characterId}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {loc && (
                            <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">
                              <MapPin className="h-2.5 w-2.5" />{loc.name}
                            </span>
                          )}
                          {snap.statusNotes && (
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))] line-clamp-2">{snap.statusNotes}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Relationship snapshots for this event */}
              {evRelSnapshots.length > 0 && (
                <div className="border-t border-[hsl(var(--border))] divide-y divide-[hsl(var(--border)/0.5)]">
                  {evRelSnapshots.map((rs) => {
                    const rel = relById.get(rs.relationshipId)
                    const nameA = rel ? (charById.get(rel.characterAId)?.name ?? rel.characterAId) : rs.relationshipId
                    const nameB = rel ? (charById.get(rel.characterBId)?.name ?? rel.characterBId) : ''
                    return (
                      <div key={rs.id} className="flex items-start gap-3 px-4 py-2 bg-[hsl(var(--muted)/0.15)]">
                        <div className="w-28 shrink-0">
                          <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] truncate">
                            {nameA}{nameB ? ` ↔ ${nameB}` : ''}
                          </p>
                          <p className="text-[9px] text-[hsl(var(--muted-foreground)/0.7)]">
                            {rs.isActive ? 'active' : 'ended'} · {rs.sentiment} · {rs.strength}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-[hsl(var(--foreground)/0.8)]">{rs.label}</p>
                          {rs.description && (
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2">{rs.description}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mx-6 mb-3 flex items-start gap-2 rounded-md bg-red-950/30 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="shrink-0 flex gap-2 border-t border-[hsl(var(--border))] px-6 py-3">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button className="flex-1 gap-2" disabled={importing} onClick={onImport}>
          <Sparkles className="h-4 w-4" />
          {importing ? (isUpdate ? 'Updating...' : 'Importing...') : (isUpdate ? 'Update Chapter' : 'Import Chapter')}
        </Button>
      </div>
    </>
  )
}

// ── Dialog ────────────────────────────────────────────────────────────────────

interface ChapterAIDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  worldName: string
  timelineId: string
  timelineName: string
  nextNumber: number
  existingChapters: Chapter[]
}

export function ChapterAIDialog({
  open, onOpenChange,
  worldId, worldName, timelineId, timelineName,
  nextNumber, existingChapters,
}: ChapterAIDialogProps) {
  const navigate = useNavigate()
  const characters = useCharacters(worldId)
  const relationships = useRelationships(worldId)
  const items = useItems(worldId)
  const locationMarkers = useAllLocationMarkers(worldId)
  const mapLayers = useMapLayers(worldId)
  const factions = useFactions(worldId)
  const memberships = useFactionMemberships(worldId)

  const [mode, setMode] = useState<'create' | 'update'>('create')
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [step, setStep] = useState<'prompt' | 'paste' | 'review'>('prompt')
  const [copied, setCopied] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [preview, setPreview] = useState<ChapterAIResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  // Always call hooks unconditionally; data is only used when mode === 'update'
  const selectedChapterEvents = useEvents(selectedChapterId)
  // Load snapshots from the last event of the selected chapter (end-of-chapter state)
  const sortedSelectedEvents = [...selectedChapterEvents].sort((a, b) => a.sortOrder - b.sortOrder)
  const lastSelectedEventId = sortedSelectedEvents.length > 0 ? sortedSelectedEvents[sortedSelectedEvents.length - 1].id : null
  const selectedChapterSnapshots = useEventSnapshots(lastSelectedEventId)
  const selectedChapterRelSnapshots = useEventRelationshipSnapshots(lastSelectedEventId)

  const selectedChapter = existingChapters.find((c) => c.id === selectedChapterId) ?? null

  const chapterToUpdate = mode === 'update' && selectedChapter
    ? { chapter: selectedChapter, events: selectedChapterEvents, snapshots: selectedChapterSnapshots, relSnapshots: selectedChapterRelSnapshots }
    : undefined

  const isUpdate = mode === 'update'
  const canProceed = mode === 'create' || selectedChapter !== null

  const prompt = canProceed
    ? buildPrompt(worldId, worldName, timelineId, timelineName, nextNumber, existingChapters, characters, relationships, items, locationMarkers, mapLayers, factions, memberships, chapterToUpdate)
    : ''

  const characterIds = new Set(characters.map((c) => c.id))
  const itemIds = new Set(items.map((it) => it.id))
  const markerIds = new Set(locationMarkers.map((m) => m.id))
  const relationshipIds = new Set(relationships.map((r) => r.id))

  function handleClose(v: boolean) {
    if (!v) {
      setMode('create')
      setSelectedChapterId(null)
      setStep('prompt')
      setPasteValue('')
      setPreview(null)
      setError(null)
      setCopied(false)
    }
    onOpenChange(v)
  }

  function handleModeChange(newMode: 'create' | 'update') {
    setMode(newMode)
    setSelectedChapterId(null)
    setStep('prompt')
    setPasteValue('')
    setPreview(null)
    setError(null)
    setCopied(false)
  }

  function handlePreview() {
    setError(null)
    try {
      const data = validateResponse(pasteValue.trim(), worldId, timelineId, characterIds, itemIds, markerIds, relationshipIds)
      setPreview(data)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed.')
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleImport() {
    setError(null)
    setImporting(true)
    try {
      const data = validateResponse(pasteValue.trim(), worldId, timelineId, characterIds, itemIds, markerIds, relationshipIds)
      const chapterId = await importChapter(data, isUpdate)
      handleClose(false)
      navigate(`/worlds/${worldId}/timeline/${chapterId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-[hsl(var(--border))] px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--ring))]" />
            Generate with AI
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] px-6 py-3">
          <div className="flex rounded-md border border-[hsl(var(--border))] p-0.5">
            <button
              onClick={() => handleModeChange('create')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                mode === 'create'
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              New Chapter
            </button>
            <button
              onClick={() => handleModeChange('update')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                mode === 'update'
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              Update Existing
            </button>
          </div>
          {mode === 'update' && (
            <Select
              value={selectedChapterId ?? ''}
              onValueChange={(v) => { setSelectedChapterId(v || null); setStep('prompt'); setPasteValue(''); setError(null) }}
            >
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue placeholder="Select chapter to rewrite…" />
              </SelectTrigger>
              <SelectContent>
                {existingChapters.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    Ch. {c.number} — {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Step tabs — only shown once ready to proceed */}
        {canProceed && (
          <div className="flex shrink-0 items-center gap-0 border-b border-[hsl(var(--border))]">
            {(['prompt', 'paste', 'review'] as const).map((s, i) => {
              const labels = { prompt: 'Copy prompt', paste: 'Paste response', review: 'Review' }
              const canClick = s !== 'review' || preview !== null
              return (
                <button
                  key={s}
                  onClick={() => canClick && setStep(s)}
                  disabled={!canClick}
                  className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                    step === s
                      ? 'border-b-2 border-[hsl(var(--ring))] text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[10px]">{i + 1}</span>
                  {labels[s]}
                </button>
              )
            })}
          </div>
        )}

        {!canProceed && (
          <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
            Select a chapter above to continue.
          </div>
        )}

        {canProceed && step === 'prompt' && (
          <>
            <div className="shrink-0 px-6 py-3 text-xs text-[hsl(var(--muted-foreground))]">
              {isUpdate
                ? 'This prompt includes the current chapter content and your world\'s IDs. Paste it into any AI assistant along with your rewritten chapter text.'
                : 'This prompt includes your world\'s real character and item IDs so the AI can reference them correctly. Copy it, paste into any AI assistant, then add your chapter text at the end.'}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <pre className="h-full overflow-y-auto px-6 py-2 font-mono text-[10.5px] leading-relaxed text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">
                {prompt}
              </pre>
            </div>
            <div className="shrink-0 flex gap-2 border-t border-[hsl(var(--border))] px-6 py-3">
              <Button className="flex-1 gap-2" onClick={handleCopy}>
                {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Prompt</>}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setStep('paste')}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {canProceed && step === 'paste' && (
          <>
            <div className="shrink-0 px-6 py-3 text-xs text-[hsl(var(--muted-foreground))]">
              Paste the AI's JSON response below, then click Preview to review before saving.
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-6 pb-3">
              <textarea
                className="h-full w-full resize-none rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 font-mono text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                placeholder={'{\n  "chapter": { ... },\n  "events": [ ... ],\n  "characterSnapshots": [ ... ]\n}'}
                value={pasteValue}
                onChange={(e) => { setPasteValue(e.target.value); setError(null); setPreview(null) }}
                spellCheck={false}
              />
            </div>
            {error && (
              <div className="mx-6 mb-3 flex items-start gap-2 rounded-md bg-red-950/30 px-3 py-2 text-xs text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="shrink-0 flex gap-2 border-t border-[hsl(var(--border))] px-6 py-3">
              <Button variant="outline" onClick={() => setStep('prompt')}>
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={!pasteValue.trim()}
                onClick={handlePreview}
              >
                <ArrowRight className="h-4 w-4" />
                Preview
              </Button>
            </div>
          </>
        )}

        {canProceed && step === 'review' && preview && (
          <ReviewStep
            preview={preview}
            characters={characters}
            relationships={relationships}
            locationMarkers={locationMarkers}
            isUpdate={isUpdate}
            importing={importing}
            error={error}
            onBack={() => setStep('paste')}
            onImport={handleImport}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
