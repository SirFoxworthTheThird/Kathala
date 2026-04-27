import { useState, useRef, type KeyboardEvent } from 'react'
import { Trash2, ChevronDown, ChevronUp, Check, X, UserMinus, PackageMinus, MapPin, Tag, ArrowUp, ArrowDown, Package, Eye, History } from 'lucide-react'
import type { WorldEvent, EventStatus } from '@/types'
import { EVENT_STATUSES, EVENT_STATUS_CONFIG } from '@/lib/eventStatus'
import { charColor } from '@/lib/characterColor'
import { deleteEvent, updateEvent } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PortraitImage } from '@/components/PortraitImage'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface EventCardProps {
  event: WorldEvent
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

export function EventCard({ event, isFirst, isLast, onMoveUp, onMoveDown }: EventCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description)
  const [involvedIds, setInvolvedIds] = useState<string[]>(event.involvedCharacterIds)
  const [involvedItemIds, setInvolvedItemIds] = useState<string[]>(event.involvedItemIds)
  const [locationMarkerId, setLocationMarkerId] = useState<string | null>(event.locationMarkerId)
  const [tags, setTags] = useState<string[]>(event.tags)
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState<EventStatus>(event.status ?? 'draft')
  const [povCharacterId, setPovCharacterId] = useState<string | null>(event.povCharacterId ?? null)
  const [isFlashback, setIsFlashback] = useState(event.isFlashback ?? false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const characters = useCharacters(event.worldId)
  const items = useItems(event.worldId)
  const locationMarkers = useAllLocationMarkers(event.worldId)

  const involvedChars = characters.filter((c) => involvedIds.includes(c.id))
  const availableChars = characters.filter((c) => !involvedIds.includes(c.id))
  const involvedItems = items.filter((it) => involvedItemIds.includes(it.id))
  const availableItems = items.filter((it) => !involvedItemIds.includes(it.id))
  const currentLocation = locationMarkers.find((m) => m.id === locationMarkerId) ?? null
  const povChar = characters.find((c) => c.id === povCharacterId) ?? null
  const nonInvolvedChars = characters.filter((c) => !involvedIds.includes(c.id))

  async function saveEdit() {
    await updateEvent(event.id, {
      title: title.trim(),
      description: description.trim(),
      involvedCharacterIds: involvedIds,
      involvedItemIds,
      locationMarkerId,
      tags,
    })
    setEditing(false)
  }

  function cancelEdit() {
    setTitle(event.title)
    setDescription(event.description)
    setInvolvedIds(event.involvedCharacterIds)
    setInvolvedItemIds(event.involvedItemIds)
    setLocationMarkerId(event.locationMarkerId)
    setTags(event.tags)
    setStatus(event.status ?? 'draft')
    setPovCharacterId(event.povCharacterId ?? null)
    setTagInput('')
    setEditing(false)
  }

  async function changeStatus(s: EventStatus) {
    setStatus(s)
    await updateEvent(event.id, { status: s })
  }

  async function changePov(id: string | null) {
    setPovCharacterId(id)
    await updateEvent(event.id, { povCharacterId: id })
  }

  async function toggleFlashback() {
    const next = !isFlashback
    setIsFlashback(next)
    await updateEvent(event.id, { isFlashback: next })
  }

  function startEdit() {
    setTitle(event.title)
    setDescription(event.description)
    setInvolvedIds(event.involvedCharacterIds)
    setInvolvedItemIds(event.involvedItemIds)
    setLocationMarkerId(event.locationMarkerId)
    setTags(event.tags)
    setEditing(true)
    setExpanded(true)
  }

  // ── Character helpers ──────────────────────────────────────────────────────
  async function addCharacter(characterId: string) {
    if (involvedIds.includes(characterId)) return
    const newIds = [...involvedIds, characterId]
    setInvolvedIds(newIds)
    if (!editing) await updateEvent(event.id, { involvedCharacterIds: newIds })
  }

  async function removeCharacter(characterId: string) {
    const newIds = involvedIds.filter((id) => id !== characterId)
    setInvolvedIds(newIds)
    if (!editing) await updateEvent(event.id, { involvedCharacterIds: newIds })
  }

  // ── Item helpers ───────────────────────────────────────────────────────────
  async function addItem(itemId: string) {
    if (involvedItemIds.includes(itemId)) return
    const newIds = [...involvedItemIds, itemId]
    setInvolvedItemIds(newIds)
    if (!editing) await updateEvent(event.id, { involvedItemIds: newIds })
  }

  async function removeItem(itemId: string) {
    const newIds = involvedItemIds.filter((id) => id !== itemId)
    setInvolvedItemIds(newIds)
    if (!editing) await updateEvent(event.id, { involvedItemIds: newIds })
  }

  // ── Location helpers ───────────────────────────────────────────────────────
  async function changeLocation(markerId: string) {
    const val = markerId === '__none__' ? null : markerId
    setLocationMarkerId(val)
    if (!editing) await updateEvent(event.id, { locationMarkerId: val })
  }

  // ── Tag helpers ────────────────────────────────────────────────────────────
  function commitTag() {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !tags.includes(tag)) {
      const newTags = [...tags, tag]
      setTags(newTags)
      if (!editing) updateEvent(event.id, { tags: newTags })
    }
    setTagInput('')
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitTag() }
    else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      const newTags = tags.slice(0, -1)
      setTags(newTags)
      if (!editing) updateEvent(event.id, { tags: newTags })
    }
  }

  async function removeTag(tag: string) {
    const newTags = tags.filter((t) => t !== tag)
    setTags(newTags)
    if (!editing) await updateEvent(event.id, { tags: newTags })
  }

  // ── Summary line visibility ────────────────────────────────────────────────
  const hasSummary = involvedChars.length > 0 || currentLocation !== null || tags.length > 0

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Header row */}
      <div className="flex items-center gap-1 px-3 py-2">
        <button className="flex-1 min-w-0 text-left" onClick={() => !editing && setExpanded((v) => !v)}>
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-7 text-sm"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate block">{event.title}</span>
          )}
        </button>

        {/* Status badge — always visible, click to cycle */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            const idx = EVENT_STATUSES.indexOf(status)
            changeStatus(EVENT_STATUSES[(idx + 1) % EVENT_STATUSES.length])
          }}
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80"
          style={{ background: EVENT_STATUS_CONFIG[status].color, color: EVENT_STATUS_CONFIG[status].textColor }}
          title={`Status: ${EVENT_STATUS_CONFIG[status].label} — click to advance`}
          aria-label={`Event status: ${EVENT_STATUS_CONFIG[status].label}`}
        >
          {EVENT_STATUS_CONFIG[status].label}
        </button>

        {/* Flashback badge — visible when set */}
        {isFlashback && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFlashback() }}
            className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-[hsl(var(--accent))] hover:opacity-80"
            title="Flashback / retrospective — click to remove"
          >
            <History className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />
            <span className="text-[hsl(var(--muted-foreground))]">Flashback</span>
          </button>
        )}

        {/* POV badge — visible when set */}
        {povChar && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
            className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-[hsl(var(--muted))] hover:opacity-80"
            title={`POV: ${povChar.name} — click to change`}
            aria-label={`POV: ${povChar.name}`}
          >
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: charColor(povChar) }} />
            <Eye className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />
            <span className="text-[hsl(var(--foreground))]">{povChar.name}</span>
          </button>
        )}

        {editing ? (
          <>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-green-400" onClick={saveEdit} disabled={!title.trim()}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-[hsl(var(--foreground))]"
              disabled={isFirst} onClick={(e) => { e.stopPropagation(); onMoveUp() }}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-[hsl(var(--foreground))]"
              disabled={isLast} onClick={(e) => { e.stopPropagation(); onMoveDown() }}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-red-400" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={`Delete "${event.title || 'this event'}"?`}
              onConfirm={() => deleteEvent(event.id)}
            />
          </>
        )}
      </div>

      {/* Summary chips (collapsed, non-editing) */}
      {!expanded && !editing && hasSummary && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
          {/* Character portraits */}
          {involvedChars.slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] pl-0.5 pr-2 py-0.5">
              <PortraitImage
                imageId={c.portraitImageId}
                className="h-4 w-4 rounded-full object-cover"
                fallbackClassName="h-4 w-4 rounded-full"
              />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{c.name}</span>
            </div>
          ))}
          {involvedChars.length > 3 && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">+{involvedChars.length - 3} more</span>
          )}
          {/* Location */}
          {currentLocation && (
            <div className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5">
              <MapPin className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{currentLocation.name}</span>
            </div>
          )}
          {/* Tags */}
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[10px] text-[hsl(var(--foreground))]">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] px-3 py-3 flex flex-col gap-4">

          {/* Description */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Description</span>
            {editing ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened..."
                rows={3}
                className="text-sm"
              />
            ) : (
              event.description
                ? <p className="text-sm text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">{event.description}</p>
                : <p className="text-xs italic text-[hsl(var(--muted-foreground))]">No description.</p>
            )}
          </div>

          {/* Location */}
          {locationMarkers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Location
              </span>
              <Select value={locationMarkerId ?? '__none__'} onValueChange={changeLocation}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select location…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs italic text-[hsl(var(--muted-foreground))]">No location</SelectItem>
                  {locationMarkers.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
              <Tag className="h-3 w-3" /> Tags
            </span>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 min-h-[2rem] cursor-text"
              onClick={() => tagInputRef.current?.focus()}>
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-0.5 rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[10px]">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-red-400">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={commitTag}
                placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
                className="flex-1 min-w-[8rem] bg-transparent text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
              />
            </div>
          </div>

          {/* Involved Characters */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Characters</span>
            {involvedChars.length > 0 ? (
              <div className="flex flex-col gap-1">
                {involvedChars.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
                    <PortraitImage
                      imageId={c.portraitImageId}
                      className="h-5 w-5 rounded-full object-cover"
                      fallbackClassName="h-5 w-5 rounded-full"
                    />
                    <span className="flex-1 text-xs">{c.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-red-400" onClick={() => removeCharacter(c.id)}>
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-[hsl(var(--muted-foreground))]">No characters assigned.</p>
            )}
            {availableChars.length > 0 && (
              <Select onValueChange={addCharacter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Add character…" />
                </SelectTrigger>
                <SelectContent>
                  {availableChars.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Involved Items */}
          {(involvedItems.length > 0 || availableItems.length > 0) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Items</span>
              {involvedItems.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {involvedItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
                      <PortraitImage
                        imageId={it.imageId}
                        className="h-5 w-5 rounded object-cover"
                        fallbackClassName="h-5 w-5 rounded"
                        fallbackIcon={Package}
                      />
                      <span className="flex-1 text-xs">{it.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-red-400" onClick={() => removeItem(it.id)}>
                        <PackageMinus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-[hsl(var(--muted-foreground))]">No items assigned.</p>
              )}
              {availableItems.length > 0 && (
                <Select onValueChange={addItem}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Add item…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map((it) => (
                      <SelectItem key={it.id} value={it.id} className="text-xs">{it.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* POV picker */}
          {characters.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                <Eye className="h-3 w-3" /> Point of View
              </span>
              <Select
                value={povCharacterId ?? '__none__'}
                onValueChange={(v) => changePov(v === '__none__' ? null : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="No POV character…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs italic text-[hsl(var(--muted-foreground))]">No POV character</SelectItem>
                  {involvedChars.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wide">In this event</SelectLabel>
                      {involvedChars.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: charColor(c) }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {nonInvolvedChars.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wide">All characters</SelectLabel>
                      {nonInvolvedChars.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: charColor(c) }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Flashback toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFlashback}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                isFlashback
                  ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
              title="Mark as flashback or retrospective — suppresses present-state continuity checks for this event"
            >
              <History className="h-3 w-3" />
              Flashback / Retrospective
            </button>
          </div>

          {/* Status picker */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Status</span>
            <div className="flex gap-1">
              {EVENT_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className="flex-1 rounded py-1 text-[10px] font-medium transition-opacity hover:opacity-90"
                  style={
                    status === s
                      ? { background: EVENT_STATUS_CONFIG[s].color, color: EVENT_STATUS_CONFIG[s].textColor }
                      : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
                  }
                  aria-pressed={status === s}
                >
                  {EVENT_STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Edit / save */}
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={!title.trim()}>Save</Button>
              <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs self-start" onClick={startEdit}>
              Edit title &amp; description
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
