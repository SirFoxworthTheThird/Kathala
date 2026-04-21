import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, BookMarked, Pencil, Trash2, Check, X, Eye } from 'lucide-react'
import {
  useLoreCategories, useLorePages,
  createLoreCategory, updateLoreCategory, deleteLoreCategory,
  createLorePage, deleteLorePage,
} from '@/db/hooks/useLore'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'

// ── Colour palette for categories ─────────────────────────────────────────────
const CATEGORY_COLORS = [
  '#6366f1', '#22d3ee', '#34d399', '#fbbf24',
  '#f87171', '#f472b6', '#a78bfa', '#94a3b8',
]

function relativeDate(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}

// ── Category row ──────────────────────────────────────────────────────────────
function CategoryRow({
  name, color, count, active, onClick,
}: { id: string | null; name: string; color: string | null; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
        active
          ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
          : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
      }`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: color ?? '#94a3b8' }}
      />
      <span className="flex-1 truncate font-medium">{name}</span>
      <span className="shrink-0 tabular-nums opacity-60">{count}</span>
    </button>
  )
}

// ── Add category inline form ──────────────────────────────────────────────────
function AddCategoryForm({ worldId, onDone }: { worldId: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])

  async function handleAdd() {
    if (!name.trim()) return
    await createLoreCategory({ worldId, name: name.trim(), color })
    onDone()
  }

  return (
    <div className="space-y-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
      <Input
        className="h-7 text-xs"
        placeholder="Category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onDone() }}
        autoFocus
      />
      <div className="flex flex-wrap gap-1">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="h-4 w-4 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              background: c,
              borderColor: color === c ? 'hsl(var(--foreground))' : 'transparent',
            }}
          />
        ))}
      </div>
      <div className="flex gap-1">
        <Button size="sm" className="h-6 flex-1 text-xs" onClick={handleAdd} disabled={!name.trim()}>
          <Check className="h-3 w-3" /> Add
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onDone}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ── Page card ─────────────────────────────────────────────────────────────────
function PageCard({
  page, categoryColor, onOpen, onDelete,
}: {
  page: { id: string; title: string; body: string; tags: string[]; updatedAt: number }
  categoryColor: string | null
  onOpen: () => void
  onDelete: () => void
}) {
  const preview = page.body.slice(0, 120).replace(/[#*`_>\-]/g, '').trim()

  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 hover:border-[hsl(var(--ring)/0.4)] transition-colors"
      onClick={onOpen}
    >
      {categoryColor && (
        <div className="absolute left-0 top-0 h-full w-1 rounded-l-lg" style={{ background: categoryColor }} />
      )}
      <div className="flex items-start justify-between gap-2 pl-2">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] leading-snug">{page.title}</h3>
        <button
          className="shrink-0 opacity-0 group-hover:opacity-100 text-[hsl(var(--muted-foreground))] hover:text-destructive transition-all"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {preview && (
        <p className="pl-2 text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 leading-relaxed">{preview}</p>
      )}
      <div className="flex items-center gap-2 pl-2">
        {page.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded bg-[hsl(var(--border))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{t}</span>
        ))}
        {page.tags.length > 3 && (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">+{page.tags.length - 3}</span>
        )}
        <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">{relativeDate(page.updatedAt)}</span>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function LoreView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const categories = useLoreCategories(worldId ?? null)
  const allPages = useLorePages(worldId ?? null)
  const { activeEventId } = useAppStore()

  // For timeline filter
  const worldEvents = useWorldEvents(worldId ?? null)
  const worldChapters = useWorldChapters(worldId ?? null)

  const [activeCategoryId, setActiveCategoryId] = useState<string | null | 'all'>('all')
  const [search, setSearch] = useState('')
  const [timelineFilter, setTimelineFilter] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [deletePageId, setDeletePageId] = useState<string | null>(null)
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null)

  const categoryColorMap = new Map(categories.map((c) => [c.id, c.color]))

  // Build sortKey map for visibility filtering
  const chapterNumberById = new Map(worldChapters.map((c) => [c.id, c.number]))
  const eventSortKeyById = new Map(
    worldEvents.map((ev) => [ev.id, (chapterNumberById.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder])
  )
  const activeEventSortKey = activeEventId ? (eventSortKeyById.get(activeEventId) ?? Infinity) : Infinity

  const filteredPages = allPages.filter((p) => {
    if (activeCategoryId !== 'all' && p.categoryId !== activeCategoryId) return false
    if (timelineFilter && activeEventId) {
      if (p.visibleFromEventId) {
        const revealedAt = eventSortKeyById.get(p.visibleFromEventId) ?? 0
        if (revealedAt > activeEventSortKey) return false
      }
    }
    if (search) {
      const q = search.toLowerCase()
      return p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))
    }
    return true
  })

  function countForCategory(id: string | null) {
    return allPages.filter((p) => p.categoryId === id).length
  }

  async function handleNewPage() {
    if (!worldId) return
    const catId = activeCategoryId === 'all' ? null : activeCategoryId
    const page = await createLorePage({ worldId, categoryId: catId, title: 'Untitled' })
    navigate(`/worlds/${worldId}/lore/${page.id}`)
  }

  async function handleSaveCategoryEdit(id: string) {
    if (editingCategoryName.trim()) {
      await updateLoreCategory(id, { name: editingCategoryName.trim() })
    }
    setEditingCategoryId(null)
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-52 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-y-auto">
        <div className="p-3 space-y-0.5">
          <CategoryRow
            id="all" name="All pages" color={null}
            count={allPages.length}
            active={activeCategoryId === 'all'}
            onClick={() => setActiveCategoryId('all')}
          />
          <CategoryRow
            id={null} name="Uncategorised" color={null}
            count={countForCategory(null)}
            active={activeCategoryId === null}
            onClick={() => setActiveCategoryId(null)}
          />
        </div>

        {categories.length > 0 && (
          <div className="px-3 pb-1">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Categories
            </div>
            <div className="space-y-0.5">
              {categories.map((cat) => (
                <div key={cat.id} className="group flex items-center gap-1">
                  {editingCategoryId === cat.id ? (
                    <Input
                      className="h-6 flex-1 text-xs"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveCategoryEdit(cat.id)
                        if (e.key === 'Escape') setEditingCategoryId(null)
                      }}
                      onBlur={() => handleSaveCategoryEdit(cat.id)}
                      autoFocus
                    />
                  ) : (
                    <CategoryRow
                      id={cat.id} name={cat.name} color={cat.color}
                      count={countForCategory(cat.id)}
                      active={activeCategoryId === cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                    />
                  )}
                  {editingCategoryId !== cat.id && (
                    <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-0.5"
                        onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        className="text-[hsl(var(--muted-foreground))] hover:text-destructive p-0.5"
                        onClick={() => setDeleteCatId(cat.id)}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 mt-auto border-t border-[hsl(var(--border))]">
          {addingCategory ? (
            <AddCategoryForm worldId={worldId ?? ''} onDone={() => setAddingCategory(false)} />
          ) : (
            <button
              onClick={() => setAddingCategory(true)}
              className="flex w-full items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <Plus className="h-3 w-3" /> New category
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
          <Input
            placeholder="Search lore…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs text-sm"
          />
          {activeEventId && (
            <button
              onClick={() => setTimelineFilter((v) => !v)}
              title={timelineFilter ? 'Showing lore revealed up to this event' : 'Show all lore'}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
                timelineFilter
                  ? 'border-[hsl(var(--ring)/0.4)] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Revealed
            </button>
          )}
          <Button size="sm" className="ml-auto gap-1.5" onClick={handleNewPage}>
            <Plus className="h-4 w-4" /> New Page
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {filteredPages.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title={allPages.length === 0 ? 'No lore pages yet' : 'No matches'}
              description={
                allPages.length === 0
                  ? 'Document your world\'s magic systems, history, factions, and more.'
                  : 'Try a different search or category.'
              }
              action={
                allPages.length === 0 ? (
                  <Button onClick={handleNewPage}>
                    <Plus className="h-4 w-4" /> New Page
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPages.map((page) => (
                <PageCard
                  key={page.id}
                  page={page}
                  categoryColor={page.categoryId ? categoryColorMap.get(page.categoryId) ?? null : null}
                  onOpen={() => navigate(`/worlds/${worldId}/lore/${page.id}`)}
                  onDelete={() => setDeletePageId(page.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete page */}
      <ConfirmDialog
        open={deletePageId !== null}
        title="Delete page?"
        description="This will permanently delete the lore page. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => { await deleteLorePage(deletePageId!); setDeletePageId(null) }}
        onOpenChange={(v) => { if (!v) setDeletePageId(null) }}
      />

      {/* Confirm delete category */}
      <ConfirmDialog
        open={deleteCatId !== null}
        title="Delete category?"
        description="Pages in this category will move to Uncategorised. The pages themselves are not deleted."
        confirmLabel="Delete"
        onConfirm={async () => { await deleteLoreCategory(deleteCatId!); setDeleteCatId(null) }}
        onOpenChange={(v) => { if (!v) setDeleteCatId(null) }}
      />
    </div>
  )
}
