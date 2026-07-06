import { useMemo } from 'react'
import { Eye, AtSign, AlertTriangle } from 'lucide-react'
import type { Character, Chapter, WorldEvent } from '@/types'
import { PortraitImage } from '@/components/PortraitImage'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'
import { computeCastBalance, type CastMember } from '@/lib/castBalance'
import { cn } from '@/lib/utils'

/**
 * "Who did I forget — and who's carrying the book?" Derives each character's
 * footprint across the story: word-weighted screen time, POV and mention
 * counts, and where they go quiet. Purely computed; nothing stored.
 */
export function CastBalance({ worldId, characters, chapters, events }: {
  worldId: string
  characters: Character[]
  chapters: Chapter[]
  events: WorldEvent[]
}) {
  const sceneTexts = useWorldSceneTexts(worldId)

  const { members, totalWords } = useMemo(() => {
    const wordCountByEvent = new Map(sceneTexts.map((s) => [s.eventId, s.wordCount]))
    return computeCastBalance({ characters, chapters, events, wordCountByEvent })
  }, [characters, chapters, events, sceneTexts])

  // Bar is scaled to the busiest character so the ensemble reads relatively.
  const maxWords = members.reduce((m, x) => Math.max(m, x.wordCount), 0)
  const maxScenes = members.reduce((m, x) => Math.max(m, x.sceneCount), 0)
  const usesWords = totalWords > 0 && maxWords > 0

  if (characters.length === 0 || chapters.length === 0) return null

  function barFraction(m: CastMember): number {
    if (usesWords) return maxWords > 0 ? m.wordCount / maxWords : 0
    return maxScenes > 0 ? m.sceneCount / maxScenes : 0
  }

  function warning(m: CastMember): string | null {
    if (m.sceneCount === 0) return m.mentionCount > 0 ? 'only mentioned, never on-stage' : 'never appears'
    if (m.trailingGap >= 3) return `last on-stage Ch. ${m.lastChapterNumber} · quiet ${m.trailingGap} chapters`
    if (m.longestDormancy >= 3) return `drops out for ${m.longestDormancy} chapters mid-story`
    return null
  }

  return (
    <div className="flex flex-col gap-1.5">
      {members.map((m) => {
        const warn = warning(m)
        return (
          <div
            key={m.character.id}
            className={cn(
              'flex items-center gap-3 rounded-md border bg-[hsl(var(--card))] px-3 py-2',
              warn ? 'border-amber-500/40' : 'border-[hsl(var(--border))]',
            )}
          >
            <PortraitImage
              imageId={m.character.portraitImageId}
              alt={m.character.name}
              className="h-6 w-6 rounded-full object-cover shrink-0"
              fallbackClassName="h-6 w-6 rounded-full shrink-0"
            />
            <span className="w-24 shrink-0 truncate text-sm font-medium text-[hsl(var(--foreground))]">{m.character.name}</span>

            {/* Screen-time bar (word-weighted when prose exists, else scene count) */}
            <div className="flex-1 min-w-0">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div
                  className="h-full rounded-full bg-[hsl(var(--ring))]"
                  style={{ width: `${Math.round(barFraction(m) * 100)}%` }}
                />
              </div>
              {warn && (
                <span className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-500">
                  <AlertTriangle className="h-2.5 w-2.5" /> {warn}
                </span>
              )}
            </div>

            {/* Stats */}
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]"
              title={usesWords ? `${m.wordCount} words on-stage` : `${m.sceneCount} scenes`}>
              {usesWords
                ? (m.wordCount >= 1000 ? `${(m.wordCount / 1000).toFixed(1)}k w` : `${m.wordCount} w`)
                : `${m.sceneCount} sc`}
            </span>
            <span className="hidden sm:flex w-24 shrink-0 items-center justify-end gap-2 text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
              {m.povCount > 0 && (
                <span className="flex items-center gap-0.5" title={`POV in ${m.povCount} scene${m.povCount === 1 ? '' : 's'}`}>
                  <Eye className="h-2.5 w-2.5" /> {m.povCount}
                </span>
              )}
              {m.mentionCount > 0 && (
                <span className="flex items-center gap-0.5" title={`mentioned in ${m.mentionCount} scene${m.mentionCount === 1 ? '' : 's'}`}>
                  <AtSign className="h-2.5 w-2.5" /> {m.mentionCount}
                </span>
              )}
            </span>

            {/* Per-chapter presence strip */}
            <div className="hidden md:flex w-24 shrink-0 items-center gap-px overflow-hidden" aria-hidden="true">
              {m.presenceByChapter.map((present, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-3 min-w-[2px] flex-1 rounded-[1px]',
                    present ? 'bg-[hsl(var(--ring))]' : 'bg-[hsl(var(--muted))]',
                  )}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
