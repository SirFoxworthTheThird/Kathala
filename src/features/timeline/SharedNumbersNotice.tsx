import { useState } from 'react'
import { numberChaptersAsOneBook } from '@/db/hooks/useTimeline'
import { listChapterNumbers, planNumberAsOneBook, sharedChapterNumbers } from '@/lib/chapterNumbering'
import type { Chapter, Timeline } from '@/types'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'

/**
 * Said on All timelines where two timelines use one chapter number: the book
 * is read in one order, and between those chapters the order is a guess. A
 * book numbered per timeline — as every one was, before numbering was the
 * book's (docs/records/chapter-numbering-plan.md) — is offered one numbering,
 * never given it: the order "last known state" is read along moves with it.
 */
export function SharedNumbersNotice({ worldId, chapters, timelines }: {
  worldId: string
  chapters: readonly Chapter[]
  timelines: readonly Timeline[]
}) {
  const [busy, setBusy] = useState(false)
  const shared = sharedChapterNumbers(chapters)
  if (shared.length === 0) return null
  const moving = planNumberAsOneBook(chapters, timelines.map((t) => t.id)).length
  const listed = listChapterNumbers(shared)
  return (
    <div role="status" className="border-b border-[hsl(var(--border))] bg-amber-500/10 px-4 py-2 text-xs text-[hsl(var(--foreground))]">
      <p>
        {shared.length === 1 ? `Chapter ${listed} is` : `Chapters ${listed} are`} numbered in more than one timeline, so the book’s
        order between them is a guess. Numbered as one book, in the order it reads now, {plural(moving, 'chapter')} {moving === 1 ? 'is' : 'are'} renumbered;
        Undo puts them back.
      </p>
      <Button
        size="sm" variant="outline" className="mt-1.5 h-7 text-xs" disabled={busy}
        onClick={async () => { setBusy(true); await numberChaptersAsOneBook(worldId); setBusy(false) }}
      >
        Number the chapters as one book
      </Button>
    </div>
  )
}
