import { useEffect, useState } from 'react'
import type { World } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { joinSeries, useAllSeries, useJoinOffers } from '@/db/hooks/useSeries'
import { OFFERED, pairsProblem, suggestedPairs, type Offer } from '@/lib/seriesJoin'

/*
  Join a series (issue #698, part 3): a book written on its own, or made with
  Start a sequel, becomes the last book of a series. Each of its people, items,
  places and maps, factions and lore that the series has already is offered as
  the series' own, and the writer says, for each, whether it is.
*/

const NEW = ''

const selectClass =
  'h-8 min-w-0 max-w-[60%] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]'

export function JoinSeriesDialog({ open, onOpenChange, book }: { open: boolean; onOpenChange: (open: boolean) => void; book: World }) {
  const allSeries = useAllSeries()
  const [seriesId, setSeriesId] = useState<string | null>(null)
  const chosen = seriesId ?? allSeries[0]?.id ?? null
  const read = useJoinOffers(open ? book.id : null, open ? chosen : null)
  const offers = read && read.for === `${book.id}|${chosen}` ? read.offers : undefined
  const [pairs, setPairs] = useState<Map<string, string>>(new Map())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The suggestions, once for each series chosen: a live read again must not undo what the writer has picked.
  const [suggestedFor, setSuggestedFor] = useState<string | null>(null)
  useEffect(() => {
    if (offers && chosen && suggestedFor !== chosen) {
      setPairs(suggestedPairs(offers))
      setSuggestedFor(chosen)
    }
  }, [offers, chosen, suggestedFor])
  useEffect(() => {
    if (!open) setSuggestedFor(null)
  }, [open])

  const offered = (offers ?? []).filter((o) => o.candidates.length > 0)
  const alone = (offers ?? []).filter((o) => o.candidates.length === 0)
  const problem = offers ? pairsProblem(offers, pairs) : null
  const series = allSeries.find((s) => s.id === chosen)
  const groups = OFFERED.map((k) => ({ ...k, offers: offered.filter((o) => o.table === k.table) })).filter((g) => g.offers.length)

  function choose(offer: Offer, to: string) {
    setPairs((before) => {
      const next = new Map(before)
      if (to === NEW) next.delete(offer.copy.id)
      else next.set(offer.copy.id, to)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!chosen) return
    setSaving(true)
    setError(null)
    try {
      await joinSeries(book.id, chosen, pairs)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The book could not join the series.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Join a series</DialogTitle>
          <DialogDescription>
            “{book.name}” becomes the last book of a series. Where it has its own copy of someone or something the series
            has already, say whether they are the same: a match is removed from this book, and every scene, state and note
            that named it names the series’ own instead. What is not a match joins the series as it is. This cannot be
            undone with Undo.
          </DialogDescription>
        </DialogHeader>
        {allSeries.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">There is no series to join yet. Make one from another book’s menu first.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {allSeries.length > 1 && (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="join-series">Series</Label>
                <select id="join-series" className={selectClass} value={chosen ?? ''} onChange={(e) => setSeriesId(e.target.value)}>
                  {allSeries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {!offers ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Reading the series…</p>
            ) : (
              <>
                {groups.length === 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Nothing in “{book.name}” has the name of anything in {series?.name ?? 'the series'}: it all joins as new.
                  </p>
                )}
                {groups.map((g) => (
                  <section key={g.table} aria-label={g.label} className="flex flex-col gap-1.5">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{g.label}</h3>
                    {g.offers.map((o) => {
                      const id = `join-${o.copy.id}`
                      return (
                        <div key={o.copy.id} className="flex items-center justify-between gap-3">
                          <Label htmlFor={id} className="min-w-0 truncate text-xs">{o.copy.name}</Label>
                          <select id={id} className={selectClass} value={pairs.get(o.copy.id) ?? NEW} onChange={(e) => choose(o, e.target.value)}>
                            {o.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.by === 'name' ? `Is the series’ ${c.name}` : `Is ${c.name}, by another name`}
                              </option>
                            ))}
                            <option value={NEW}>Not a match: joins as new</option>
                          </select>
                        </div>
                      )
                    })}
                  </section>
                ))}
                {alone.length > 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Joining as new, with no match in the series: {alone.map((o) => o.copy.name).join(', ')}.
                  </p>
                )}
              </>
            )}
            {(problem || error) && <p className="text-xs text-red-400" role="alert">{problem ?? error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !offers || suggestedFor !== chosen || !!problem}>{saving ? 'Joining…' : 'Join the series'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
