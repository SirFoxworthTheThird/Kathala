import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Eye, EyeOff, X, Tag, Link, Clock, Users, Package, MapPin, ChevronDown } from 'lucide-react'
import {
  useLorePage, useLoreCategories,
  updateLorePage, deleteLorePage,
} from '@/db/hooks/useLore'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function MarkdownPreview({ body }: { body: string }) {
  const lines = body.split('\n')
  return (
    <div className="prose prose-sm max-w-none text-[hsl(var(--foreground))] space-y-2 p-4">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-4 first:mt-0">{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold mt-3">{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-2">{line.slice(4)}</h3>
        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-[hsl(var(--border))] pl-3 text-[hsl(var(--muted-foreground))] italic">{line.slice(2)}</blockquote>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>
        if (line === '') return <div key={i} className="h-2" />
        return <p key={i} className="leading-relaxed">{line}</p>
      })}
    </div>
  )
}

// ── Entity picker dropdown ────────────────────────────────────────────────────
type EntityEntry = { id: string; label: string; type: 'character' | 'item' | 'location' }

function EntityPicker({
  worldId,
  linkedEntityIds,
  onChange,
}: {
  worldId: string
  linkedEntityIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const characters = useCharacters(worldId)
  const items = useItems(worldId)
  const markers = useAllLocationMarkers(worldId)

  const allEntities: EntityEntry[] = [
    ...characters.map((c) => ({ id: c.id, label: c.name, type: 'character' as const })),
    ...items.map((i) => ({ id: i.id, label: i.name, type: 'item' as const })),
    ...markers.map((m) => ({ id: m.id, label: m.name, type: 'location' as const })),
  ]

  const filtered = search
    ? allEntities.filter((e) => e.label.toLowerCase().includes(search.toLowerCase()))
    : allEntities

  const linkedCount = linkedEntityIds.length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle(id: string) {
    onChange(linkedEntityIds.includes(id)
      ? linkedEntityIds.filter((x) => x !== id)
      : [...linkedEntityIds, id]
    )
  }

  const typeIcon = { character: Users, item: Package, location: MapPin }
  const typeColor = { character: 'text-blue-400', item: 'text-amber-400', location: 'text-green-400' }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-7 items-center gap-1.5 rounded border px-2 text-xs transition-colors ${
          open
            ? 'border-[hsl(var(--ring)/0.4)] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
        }`}
      >
        <Link className="h-3 w-3" />
        {linkedCount > 0 ? `${linkedCount} linked` : 'Link entities'}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
          <div className="border-b border-[hsl(var(--border))] px-2 py-1.5">
            <Input
              className="h-6 text-xs"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">No entities found</p>
            ) : (
              filtered.map((e) => {
                const Icon = typeIcon[e.type]
                const checked = linkedEntityIds.includes(e.id)
                return (
                  <button
                    key={e.id}
                    onClick={() => toggle(e.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                      checked ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent)/0.5)]'
                    }`}
                  >
                    <Icon className={`h-3 w-3 shrink-0 ${typeColor[e.type]}`} />
                    <span className="flex-1 truncate">{e.label}</span>
                    {checked && <X className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Visibility picker ─────────────────────────────────────────────────────────
function VisibilityPicker({
  worldId,
  visibleFromEventId,
  onChange,
}: {
  worldId: string
  visibleFromEventId: string | null
  onChange: (eventId: string | null) => void
}) {
  const chapters = useWorldChapters(worldId)
  const events = useWorldEvents(worldId)

  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const activeEvent = visibleFromEventId ? events.find((e) => e.id === visibleFromEventId) : null
  const activeChapter = activeEvent ? chapterById.get(activeEvent.chapterId) : null

  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number)
  const eventsByChapter = new Map<string, typeof events>()
  for (const ev of events) {
    const arr = eventsByChapter.get(ev.chapterId) ?? []
    arr.push(ev)
    eventsByChapter.set(ev.chapterId, arr)
  }

  return (
    <Select
      value={visibleFromEventId ?? '__always__'}
      onValueChange={(v) => onChange(v === '__always__' ? null : v)}
    >
      <SelectTrigger className="h-7 w-52 text-xs">
        <Clock className="mr-1 h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <SelectValue
          placeholder={
            visibleFromEventId
              ? activeEvent
                ? `Ch. ${activeChapter?.number ?? '?'} · ${activeEvent.title.slice(0, 22)}`
                : 'Unknown event'
              : 'Always visible'
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__always__">Always visible</SelectItem>
        {sortedChapters.map((ch) => {
          const chEvts = [...(eventsByChapter.get(ch.id) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
          return chEvts.map((ev) => (
            <SelectItem key={ev.id} value={ev.id} className="text-xs">
              Ch. {ch.number} · {ev.title}
            </SelectItem>
          ))
        })}
      </SelectContent>
    </Select>
  )
}

export default function LorePageEditor() {
  const { worldId, pageId } = useParams<{ worldId: string; pageId: string }>()
  const navigate = useNavigate()
  const page = useLorePage(pageId ?? null)
  const categories = useLoreCategories(worldId ?? null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [linkedEntityIds, setLinkedEntityIds] = useState<string[]>([])
  const [visibleFromEventId, setVisibleFromEventId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dirty, setDirty] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!page) return
    setTitle(page.title)
    setBody(page.body)
    setTags(page.tags)
    setCategoryId(page.categoryId)
    setLinkedEntityIds(page.linkedEntityIds ?? [])
    setVisibleFromEventId(page.visibleFromEventId ?? null)
    setDirty(false)
  }, [page?.id])

  useEffect(() => {
    if (!dirty || !pageId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await updateLorePage(pageId, { title: title.trim() || 'Untitled', body, tags, categoryId, linkedEntityIds, visibleFromEventId })
      setDirty(false)
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [title, body, tags, categoryId, linkedEntityIds, visibleFromEventId, dirty])

  function markDirty() { setDirty(true) }

  async function flushSave() {
    if (!pageId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await updateLorePage(pageId, { title: title.trim() || 'Untitled', body, tags, categoryId, linkedEntityIds, visibleFromEventId })
    setDirty(false)
  }

  async function handleDelete() {
    if (!pageId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await deleteLorePage(pageId)
    navigate(`/worlds/${worldId}/lore`)
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) { setTagInput(''); return }
    setTags([...tags, t])
    setTagInput('')
    setDirty(true)
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t))
    setDirty(true)
  }

  if (page === undefined) return null

  if (page === null) {
    return (
      <div className="flex h-full items-center justify-center text-[hsl(var(--muted-foreground))]">
        Page not found.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2">
        <Button
          variant="ghost" size="sm" className="gap-1.5"
          onClick={async () => { await flushSave(); navigate(`/worlds/${worldId}/lore`) }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
          {dirty ? 'Saving…' : 'Saved'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Visibility */}
          {worldId && (
            <VisibilityPicker
              worldId={worldId}
              visibleFromEventId={visibleFromEventId}
              onChange={(id) => { setVisibleFromEventId(id); setDirty(true) }}
            />
          )}

          {/* Entity linker */}
          {worldId && (
            <EntityPicker
              worldId={worldId}
              linkedEntityIds={linkedEntityIds}
              onChange={(ids) => { setLinkedEntityIds(ids); setDirty(true) }}
            />
          )}

          <div className="mx-0.5 h-4 w-px bg-[hsl(var(--border))]" />

          {/* Category picker */}
          <Select
            value={categoryId ?? '__none__'}
            onValueChange={(v) => { setCategoryId(v === '__none__' ? null : v); setDirty(true) }}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Uncategorised</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color ?? '#94a3b8' }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost" size="sm"
            onClick={() => setPreview((p) => !p)}
            className="gap-1.5 text-xs"
          >
            {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? 'Edit' : 'Preview'}
          </Button>

          <Button
            variant="ghost" size="sm"
            className="text-[hsl(var(--muted-foreground))] hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-3">
        <input
          className="w-full bg-transparent text-2xl font-bold text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
          placeholder="Untitled"
          value={title}
          onChange={(e) => { setTitle(e.target.value); markDirty() }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {preview ? (
          <MarkdownPreview body={body} />
        ) : (
          <Textarea
            className="h-full min-h-full resize-none rounded-none border-0 bg-transparent px-6 py-4 text-sm font-mono leading-relaxed text-[hsl(var(--foreground))] outline-none focus-visible:ring-0"
            placeholder="Write your lore here… (Markdown supported)"
            value={body}
            onChange={(e) => { setBody(e.target.value); markDirty() }}
          />
        )}
      </div>

      {/* Footer bar: tags only */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        <Tag className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded bg-[hsl(var(--border))] px-2 py-0.5 text-xs text-[hsl(var(--foreground))]">
            {t}
            <button onClick={() => removeTag(t)} className="text-[hsl(var(--muted-foreground))] hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          className="h-6 w-28 text-xs"
          placeholder="Add tag…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
            if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1])
          }}
          onBlur={addTag}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete page?"
        description="This will permanently delete the lore page. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(false) }}
      />
    </div>
  )
}
