import { useCallback, useState } from 'react'
import { useSeriesAppearances, inSeries } from '@/db/hooks/useSeries'
import { updateCharacter } from '@/db/hooks/useCharacters'
import { updateItem } from '@/db/hooks/useItems'
import { updateLocationMarker } from '@/db/hooks/useLocationMarkers'
import { useWorld } from '@/db/hooks/useWorlds'
import { deleteInSeriesLine, firstElsewhere } from '@/lib/seriesAppearances'

/*
  What a series' book says about the people, items and places it shares with the
  others (issue #698, part 4): which books a delete reaches, where something
  first appears when it is not in this book, and the *in this book only* mark.
*/

export type ScopedKind = 'character' | 'item' | 'place'

interface Scoped {
  id: string
  name: string
  onlyInBook?: string | null
}

/** What a delete says: outside a series, `plain`; in one, the books it takes the entity from. */
export function useDeleteWords(bookId: string | null | undefined, entity: Scoped | undefined, kind: ScopedKind, plain: string): string {
  const appearances = useSeriesAppearances(bookId)
  if (!bookId || !entity || !inSeries(bookId)) return plain
  return deleteInSeriesLine(entity.name, kind, appearances.get(entity.id) ?? [])
}

/**
 * For a list in a book of a series: the book each entity first appears in,
 * where this book does not tell of it, so a character from book three does not
 * read as one book one forgot. Read once for the whole list, not once a card.
 */
export function useFirstElsewhere(bookId: string | null | undefined): (entityId: string) => string | null {
  const appearances = useSeriesAppearances(bookId)
  return useCallback((entityId: string) => (bookId ? firstElsewhere(appearances.get(entityId), bookId)?.bookName ?? null : null), [appearances, bookId])
}

const write: Record<ScopedKind, (id: string, onlyInBook: string | null) => Promise<void>> = {
  character: (id, onlyInBook) => updateCharacter(id, { onlyInBook }),
  item: (id, onlyInBook) => updateItem(id, { onlyInBook }),
  place: (id, onlyInBook) => updateLocationMarker(id, { onlyInBook }),
}

/**
 * The *in this book only* mark (D-4): a person, item or place made for one book
 * of a series, kept out of the others' lists. Offered only in a series, and
 * refused while another book tells of them, since it would hide them from scenes
 * that name them.
 */
export function OnlyInThisBook({ bookId, entity, kind }: { bookId: string | null | undefined; entity: Scoped; kind: ScopedKind }) {
  const appearances = useSeriesAppearances(bookId)
  const book = useWorld(bookId ?? null)
  // What was just ticked, shown at once: the record says so only once the write has come back.
  const [pending, setPending] = useState<boolean | null>(null)
  if (!bookId || !inSeries(bookId)) return null
  const elsewhere = (appearances.get(entity.id) ?? []).filter((a) => a.bookId !== bookId)
  const stored = entity.onlyInBook === bookId
  const marked = pending ?? stored
  const id = `only-in-book-${entity.id}`
  const hint = `only-in-book-hint-${entity.id}`
  return (
    <div className="flex items-start gap-2 text-xs">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5"
        checked={marked}
        disabled={pending !== null || (!marked && elsewhere.length > 0)}
        aria-describedby={hint}
        onChange={async (e) => {
          const to = e.target.checked
          setPending(to)
          try {
            await write[kind](entity.id, to ? bookId : null)
          } finally {
            setPending(null)
          }
        }}
      />
      <div className="flex flex-col">
        <label htmlFor={id}>In this book only</label>
        <span id={hint} className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {!marked && elsewhere.length > 0
            ? `Also in ${elsewhere.map((a) => a.bookName).join(', ')}: they would lose ${kind === 'character' ? 'them' : 'it'} from their lists.`
            : marked
              ? `Kept out of the other books' lists. Only ${book?.name ?? 'this book'} shows ${kind === 'character' ? 'them' : 'it'}.`
              : 'Shared by every book in the series.'}
        </span>
      </div>
    </div>
  )
}
