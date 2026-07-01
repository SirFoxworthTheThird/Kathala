import { useMemo } from 'react'
import type { Character, Chapter, WorldEvent } from '@/types'
import { PortraitImage } from '@/components/PortraitImage'
import { cn } from '@/lib/utils'

/**
 * "Who did I forget?" — derives each character's presence across the story from
 * event involvement (and POV), so underused characters and long absences are
 * visible at a glance. Purely computed from existing data; nothing stored.
 */
export function CastBalance({ characters, chapters, events }: {
  characters: Character[]
  chapters: Chapter[]
  events: WorldEvent[]
}) {
  const rows = useMemo(() => {
    const sortedChapters = [...chapters].sort((a, b) => a.number - b.number)
    const eventsByChapter = new Map<string, WorldEvent[]>()
    for (const e of events) {
      const arr = eventsByChapter.get(e.chapterId)
      if (arr) arr.push(e)
      else eventsByChapter.set(e.chapterId, [e])
    }
    const presentIn = (charId: string, chapterId: string) =>
      (eventsByChapter.get(chapterId) ?? []).some(
        (e) => e.involvedCharacterIds.includes(charId) || e.povCharacterId === charId,
      )

    return characters
      .map((char) => {
        const presence = sortedChapters.map((ch) => presentIn(char.id, ch.id))
        const appearances = presence.filter(Boolean).length
        const lastIdx = presence.lastIndexOf(true)
        const trailingGap = lastIdx === -1 ? sortedChapters.length : sortedChapters.length - 1 - lastIdx
        const lastChapterNumber = lastIdx >= 0 ? sortedChapters[lastIdx].number : null
        return { char, presence, appearances, trailingGap, lastChapterNumber }
      })
      // Surface the most likely-forgotten first: longest trailing absence, then fewest appearances.
      .sort((a, b) => b.trailingGap - a.trailingGap || a.appearances - b.appearances)
  }, [characters, chapters, events])

  const totalChapters = chapters.length
  if (characters.length === 0 || totalChapters === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(({ char, presence, appearances, trailingGap, lastChapterNumber }) => {
        const stale = trailingGap >= 3 || appearances === 0
        return (
          <div
            key={char.id}
            className={cn(
              'flex items-center gap-3 rounded-md border bg-[hsl(var(--card))] px-3 py-2',
              stale ? 'border-amber-500/40' : 'border-[hsl(var(--border))]',
            )}
          >
            <PortraitImage
              imageId={char.portraitImageId}
              alt={char.name}
              className="h-6 w-6 rounded-full object-cover shrink-0"
              fallbackClassName="h-6 w-6 rounded-full shrink-0"
            />
            <span className="w-28 shrink-0 truncate text-sm font-medium text-[hsl(var(--foreground))]">{char.name}</span>

            {/* Per-chapter presence strip */}
            <div className="flex flex-1 items-center gap-px overflow-hidden" aria-hidden="true">
              {presence.map((present, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-3 min-w-[3px] flex-1 rounded-[1px]',
                    present ? 'bg-[hsl(var(--ring))]' : 'bg-[hsl(var(--muted))]',
                  )}
                />
              ))}
            </div>

            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
              {appearances}/{totalChapters}
            </span>
            <span
              className={cn(
                'w-32 shrink-0 text-right text-[11px]',
                stale ? 'text-amber-500' : 'text-[hsl(var(--muted-foreground))]',
              )}
            >
              {appearances === 0
                ? 'never appears'
                : trailingGap === 0
                ? 'in the latest chapter'
                : `last seen Ch. ${lastChapterNumber} · ${trailingGap} ago`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
