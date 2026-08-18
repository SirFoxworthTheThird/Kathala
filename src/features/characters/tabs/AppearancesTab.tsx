import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Users, AtSign, History as HistoryIcon, Eye } from 'lucide-react'
import type { Character } from '@/types'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useAppStore } from '@/store'
import { useShowMoment } from '@/db/hooks/useShowMoment'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { computeCharacterAppearances, type CharacterAppearance } from '@/lib/characterAppearances'

interface AppearancesTabProps {
  character: Character
}

function AppearanceRow({ appearance, isActive, onClick }: {
  appearance: CharacterAppearance
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--accent))]',
        isActive
          ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
      )}
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate block">
          {appearance.eventTitle || 'Untitled event'}
        </span>
        <span className="text-xs text-[hsl(var(--muted-foreground))] truncate block">
          Ch. {appearance.chapterNumber ?? '?'}{appearance.chapterTitle ? ` — ${appearance.chapterTitle}` : ''}
        </span>
      </div>
      {appearance.isPov && (
        <span title="Point of view" className="shrink-0">
          <Eye className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        </span>
      )}
      {appearance.isFlashback && (
        <span title="Flashback" className="shrink-0">
          <HistoryIcon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        </span>
      )}
    </button>
  )
}

export function AppearancesTab({ character }: AppearancesTabProps) {
  const events = useWorldEvents(character.worldId)
  const chapters = useWorldChapters(character.worldId)
  const { activeEventId } = useAppStore()
  const showMoment = useShowMoment()
  const navigate = useNavigate()

  const { present, mentioned } = useMemo(
    () => computeCharacterAppearances({ characterId: character.id, events, chapters }),
    [character.id, events, chapters]
  )

  function go(a: CharacterAppearance) {
    // Navigates either way; only a writer's cursor follows.
    showMoment(a.eventId)
    navigate(`/worlds/${character.worldId}/timeline/${a.chapterId}`)
  }

  if (present.length === 0 && mentioned.length === 0) {
    return (
      /* X-4 rule 2: a heading and an explanation, and now the control that goes
         where the act happens — a character joins a scene from the scene, not
         from here. The Arc grid and Calendar (CAL-1) are the model. */
      <EmptyState
        icon={Users}
        title="No appearances yet"
        description="Add this character to a scene's cast, or mention them in a scene draft with @."
        action={(
          <Button size="sm" variant="outline" onClick={() => navigate(`/worlds/${character.worldId}/timeline`)}>
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Open Timeline
          </Button>
        )}
        className="py-8"
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Present in</span>
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{present.length}</span>
        </div>
        {present.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {present.map((a) => (
              <AppearanceRow key={a.eventId} appearance={a} isActive={a.eventId === activeEventId} onClick={() => go(a)} />
            ))}
          </div>
        ) : (
          /* X-4 rule 2: a character joins a scene from the scene, not from
             here, so this names the screen that does it and goes there. */
          <div className="flex flex-col items-start gap-1.5">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Not on stage in any scene yet. Add {character.name} to a scene's cast
              and it will show here.
            </p>
            <button
              onClick={() => navigate(`/worlds/${character.worldId}/timeline`)}
              className="pw-tap inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--foreground))] hover:border-[hsl(var(--ring))]"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Open Timeline
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <AtSign className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Mentioned in</span>
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{mentioned.length}</span>
        </div>
        {mentioned.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {mentioned.map((a) => (
              <AppearanceRow key={a.eventId} appearance={a} isActive={a.eventId === activeEventId} onClick={() => go(a)} />
            ))}
          </div>
        ) : (
          /* "Referenced but not present in no events yet" — the old copy read
             as a mistake because it was one sentence doing two jobs. */
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Not mentioned in any scene yet. Type <span className="font-medium">@</span> in
            a scene's draft to refer to {character.name} without putting them in the room.
          </p>
        )}
      </section>
    </div>
  )
}
