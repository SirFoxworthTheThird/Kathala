import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Library, Plus, Trash2 } from 'lucide-react'
import type { World } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { addBook, deleteSeries, makeSeries, useSeriesBooks } from '@/db/hooks/useSeries'

/*
  A series on the shelf (issue #698): one card for the series, its books in
  reading order inside it. A book of a series is not a card of its own as well:
  two cards for one book is one book in two places.
*/

/** Make a series of a book: its cast, items, places and maps, factions and lore become the series'. */
export function MakeSeriesDialog({ open, onOpenChange, book }: { open: boolean; onOpenChange: (open: boolean) => void; book: World }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await makeSeries(book.id, name.trim() || `${book.name} series`)
      setName('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The series could not be made.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make a series</DialogTitle>
          <DialogDescription>
            “{book.name}” becomes the first book of a series. Its cast, items, places and maps, factions and lore become
            the series’ own, shared by every book you add to it: a change made in one book is in all of them. Its chapters,
            scenes and prose stay its own.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="series-name">Series name</Label>
            <Input id="series-name" placeholder={`${book.name} series`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Making…' : 'Make the series'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddBookDialog({ open, onOpenChange, series, next, onAdded }: {
  open: boolean; onOpenChange: (open: boolean) => void; series: World; next: number; onAdded: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const book = await addBook(series.id, name.trim() || `Book ${next}`)
      setName('')
      onOpenChange(false)
      onAdded(book.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The book could not be added.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add book {next} to {series.name}</DialogTitle>
          <DialogDescription>A new book, after the others, with the series’ cast, places and lore from its first page.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="book-name">Title</Label>
            <Input id="book-name" placeholder={`Book ${next}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add the book'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SeriesCard({ series }: { series: World }) {
  const navigate = useNavigate()
  const books = useSeriesBooks(series.id)
  const [adding, setAdding] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const next = books.length + 1
  const titles = books.map((b) => `“${b.name}”`).join(', ')

  return (
    <section
      aria-label={`Series: ${series.name}`}
      className="group relative flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
            <Library className="h-4 w-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold text-[hsl(var(--foreground))]">{series.name}</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Series · {books.length} {books.length === 1 ? 'book' : 'books'}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => setConfirmOpen(true)}
          title="Delete series"
          aria-label={`Delete the series ${series.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ol className="flex flex-col gap-1">
        {books.map((book, k) => (
          <li key={book.id}>
            <button
              type="button"
              onClick={() => navigate(`/worlds/${book.id}`)}
              className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[hsl(var(--accent))]"
            >
              <span className="tabular-nums text-xs text-[hsl(var(--muted-foreground))]">{k + 1}.</span>
              <span className="truncate text-[hsl(var(--foreground))]">{book.name}</span>
            </button>
          </li>
        ))}
      </ol>

      <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add a book
      </Button>

      <AddBookDialog open={adding} onOpenChange={setAdding} series={series} next={next} onAdded={(id) => navigate(`/worlds/${id}`)} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete the series "${series.name}"?`}
        description={`This permanently deletes ${books.length ? `its ${books.length === 1 ? 'book' : `${books.length} books`}, ${titles}, and ` : ''}the cast, places and lore they share. This cannot be undone.`}
        onConfirm={() => deleteSeries(series.id)}
      />
    </section>
  )
}
