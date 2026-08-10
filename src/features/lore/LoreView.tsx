import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, BookMarked, Pencil, Trash2, Check, X, Eye, Sparkles, PanelLeft } from 'lucide-react'
import {
  useLoreCategories, useLorePages,
  createLoreCategory, updateLoreCategory, deleteLoreCategory,
  createLorePage, deleteLorePage,
} from '@/db/hooks/useLore'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { GenerateLoreDialog } from './GenerateLoreDialog'
import { Menu, MenuItem } from '@/components/ui/menu'
import { relativeTime } from '@/lib/relativeTime'

// ── Colour palette for categories ─────────────────────────────────────────────
const CATEGORY_COLORS = [
  '#6366f1', '#22d3ee', '#34d399', '#fbbf24',
  '#f87171', '#f472b6', '#a78bfa', '#94a3b8',
]


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
            aria-label={`Color: ${c}`}
            aria-pressed={color === c}
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
  page, categoryColor, to, onDelete, revealedAt,
}: {
  page: { id: string; title: string; body: string; tags: string[]; updatedAt: number }
  categoryColor: string | null
  to: string
  onDelete: () => void
  /** Where this page becomes visible, when it is gated (LORE-2). */
  revealedAt?: string | null
}) {
  const preview = page.body.slice(0, 120).replace(/[#*`_>-]/g, '').trim()

  return (
    // The card carries a delete button, and a button inside an anchor is not
    // valid, so the title is the link and its ::after covers the card. The
    // whole card still opens the page on click, but there is one real link to
    // Tab to and announce, and the delete button sits above the overlay.
    <div
      className="group relative flex flex-col gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 hover:border-[hsl(var(--ring)/0.4)] transition-colors focus-within:border-[hsl(var(--ring))]"
    >
      {categoryColor && (
        <div className="absolute left-0 top-0 h-full w-1 rounded-l-lg" style={{ background: categoryColor }} />
      )}
      <div className="flex items-start justify-between gap-2 pl-2">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] leading-snug">
          <Link to={to} className="after:absolute after:inset-0 after:rounded-lg focus:outline-none">
            {page.title}
          </Link>
        </h3>
        {/* LORE-1 was filed as the pattern the other rosters should copy. It is
            not: at rest this was `opacity-0` with pointer events still live and
            hit-testing to itself, at 14x14px, with no accessible name at all —
            so on a phone, where there is no hover, a tap on apparently blank
            card deleted the page. See `src/components/ui/menu.tsx`. */}
        <Menu
          label={`More actions for ${page.title}`}
          className="relative z-10 shrink-0"
          triggerClassName="h-7 w-7"
        >
          <MenuItem icon={Trash2} label="Delete page" danger onClick={onDelete} />
        </Menu>
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
        {/*
          LORE-2: "Revealed at" is a headline feature and the card said nothing
          about it, so a page held back to chapter 17 looked exactly like one
          visible from the first page. Knowledge answers the same question with
          "known by 4 / 45"; this is the lore version of that.
        */}
        {revealedAt && (
          <span className="flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] text-indigo-300">
            <Eye className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
            {revealedAt}
          </span>
        )}
        <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">{relativeTime(page.updatedAt)}</span>
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
  const gate = useGate()

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
  const [aiOpen, setAiOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const categoryColorMap = new Map(categories.map((c) => [c.id, c.color]))

  // Build sortKey map for visibility filtering
  const chapterNumberById = new Map(worldChapters.map((c) => [c.id, c.number]))
  const eventSortKeyById = new Map(
    worldEvents.map((ev) => [ev.id, (chapterNumberById.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder])
  )
  const activeEventSortKey = activeEventId ? (eventSortKeyById.get(activeEventId) ?? Infinity) : Infinity

  /*
    LORE-2: which pages are held back, and until when. A gated page names the
    chapter it opens at rather than the scene, because a chapter is the unit a
    writer thinks in and a scene title on a card is one truncation too many.
  */
  const chapterById = new Map(worldChapters.map((c) => [c.id, c]))
  const revealLabelById = new Map<string, string>()
  for (const page of allPages) {
    if (!page.visibleFromEventId) continue
    const ev = worldEvents.find((e) => e.id === page.visibleFromEventId)
    const ch = ev ? chapterById.get(ev.chapterId) : null
    // A reveal point whose scene has been deleted is still a reveal point: the
    // page is gated, and saying so vaguely beats saying nothing.
    revealLabelById.set(page.id, ch ? `From ch. ${ch.number}` : 'Revealed later')
  }

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

  function pickCategory(id: string | null | 'all') {
    setActiveCategoryId(id)
    setSidebarOpen(false)
  }

  return (
    <div className="relative flex h-full">
      {/* Mobile backdrop when the category drawer is open */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      {/* Sidebar — a slide-in drawer on mobile, a fixed column on desktop */}
      <div className={`absolute inset-y-0 left-0 z-40 flex w-52 shrink-0 flex-col overflow-y-auto border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-transform lg:static lg:z-auto lg:translate-x-0 ${sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}>
        <div className="p-3 space-y-0.5">
          <CategoryRow
            id="all" name="All pages" color={null}
            count={allPages.length}
            active={activeCategoryId === 'all'}
            onClick={() => pickCategory('all')}
          />
          <CategoryRow
            id={null} name="Uncategorised" color={null}
            count={countForCategory(null)}
            active={activeCategoryId === null}
            onClick={() => pickCategory(null)}
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
                      onClick={() => pickCategory(cat.id)}
                    />
                  )}
                  {editingCategoryId !== cat.id && !gate.active && (
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

        {!gate.active && (
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
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader
          icon={BookMarked}
          title="Lore"
          count={allPages.length}
          description="Your world's history, rules, and mythology — things that don't change with time."
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAiOpen(true)} aria-label="Generate with AI">
                <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Generate with AI</span>
              </Button>
              <Button size="sm" className="gap-1.5" onClick={handleNewPage} aria-label="New page">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Page</span>
              </Button>
            </div>
          }
        >
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft className="h-3.5 w-3.5" /> Categories
          </Button>
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
        </PageHeader>

        <div className="flex-1 overflow-auto p-4">
          {filteredPages.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title={allPages.length === 0 ? 'No lore pages yet' : 'No matches'}
              description={
                allPages.length === 0
                  ? "Document your world's history, rules, and mythology — things that don't change with time."
                  : 'Try a different search or category.'
              }
              action={
                allPages.length === 0 ? (
                  <Button onClick={handleNewPage}>
                    <Plus className="h-4 w-4" /> Add Page
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
                  to={`/worlds/${worldId}/lore/${page.id}`}
                  onDelete={() => setDeletePageId(page.id)}
                  revealedAt={revealLabelById.get(page.id) ?? null}
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

      {worldId && (
        <GenerateLoreDialog open={aiOpen} onOpenChange={setAiOpen} worldId={worldId} />
      )}
    </div>
  )
}
