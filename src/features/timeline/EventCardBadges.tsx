import { History, Milestone, Flame, Eye, PenLine } from 'lucide-react'
import { EVENT_STATUSES, EVENT_STATUS_CONFIG } from '@/lib/eventStatus'
import { beatById, beatActColor } from '@/lib/storyBeats'
import { tensionColor, tensionLabel } from '@/lib/tension'
import { charColor } from '@/lib/characterColor'
import type { Character, EventStatus } from '@/types'

interface EventCardBadgesProps {
  sceneWords: number
  inWorldDay?: number
  isFlashback: boolean
  status: EventStatus
  structureBeat: string | null
  tension: number | null
  povChar: Character | null
  onChangeStatus: (status: EventStatus) => void
  onToggleFlashback: () => void
  /** Expand the card (the "click to change" badges open the editor body). */
  onExpand: () => void
}

/**
 * The chip row in an event-card header: scene word count, in-world day, and the
 * status / flashback / story-beat / tension / POV badges. Purely presentational
 * — every value and action comes from EventCard.
 */
export function EventCardBadges({
  sceneWords, inWorldDay, isFlashback, status, structureBeat, tension, povChar,
  onChangeStatus, onToggleFlashback, onExpand,
}: EventCardBadgesProps) {
  const beat = beatById(structureBeat)
  return (
    <>
      {/* Scene word-count chip — only when this scene has prose */}
      {sceneWords > 0 && (
        <span
          className="shrink-0 flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[hsl(var(--muted-foreground))]"
          title={`${sceneWords} words of scene draft`}
        >
          <PenLine className="h-2.5 w-2.5" />
          {sceneWords >= 1000 ? `${(sceneWords / 1000).toFixed(1)}k` : sceneWords}
        </span>
      )}

      {/* In-world day chip — only when the story tracks elapsed time */}
      {inWorldDay !== undefined && inWorldDay > 0 && !isFlashback && (
        <span
          className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[hsl(var(--muted-foreground))]"
          title={`In-world day ${inWorldDay} — ${inWorldDay} day${inWorldDay === 1 ? '' : 's'} after the story's start`}
        >
          Day {inWorldDay}
        </span>
      )}

      {/* Status badge — always visible, click to cycle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          const idx = EVENT_STATUSES.indexOf(status)
          onChangeStatus(EVENT_STATUSES[(idx + 1) % EVENT_STATUSES.length])
        }}
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80"
        style={{ background: EVENT_STATUS_CONFIG[status].color, color: EVENT_STATUS_CONFIG[status].textColor }}
        title={`Status: ${EVENT_STATUS_CONFIG[status].label} — click to advance`}
        aria-label={`Event status: ${EVENT_STATUS_CONFIG[status].label}`}
      >
        {EVENT_STATUS_CONFIG[status].label}
      </button>

      {/* Flashback badge — visible when set */}
      {isFlashback && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFlashback() }}
          className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-[hsl(var(--accent))] hover:opacity-80"
          title="Flashback / retrospective — click to remove"
        >
          <History className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-[hsl(var(--muted-foreground))]">Flashback</span>
        </button>
      )}

      {/* Story-beat badge — visible when set */}
      {beat && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand() }}
          className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-[hsl(var(--muted))] hover:opacity-80"
          title={`Story beat: ${beat.label} — click to change`}
          aria-label={`Story beat: ${beat.label}`}
        >
          <Milestone className="h-2.5 w-2.5" style={{ color: beatActColor(beat.act) }} />
          <span className="text-[hsl(var(--foreground))]">{beat.label}</span>
        </button>
      )}

      {/* Tension badge — visible when rated, click to expand and adjust */}
      {tension !== null && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand() }}
          className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-[hsl(var(--muted))] hover:opacity-80"
          title={`Tension: ${tensionLabel(tension)} (${tension}/5) — click to adjust`}
          aria-label={`Tension: ${tensionLabel(tension)}`}
        >
          <Flame className="h-2.5 w-2.5" style={{ color: tensionColor(tension) }} />
          <span className="tabular-nums text-[hsl(var(--foreground))]">{tension}/5</span>
        </button>
      )}

      {/* POV badge — visible when set */}
      {povChar && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand() }}
          className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-[hsl(var(--muted))] hover:opacity-80"
          title={`POV: ${povChar.name} — click to change`}
          aria-label={`POV: ${povChar.name}`}
        >
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: charColor(povChar) }} />
          <Eye className="h-2.5 w-2.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-[hsl(var(--foreground))]">{povChar.name}</span>
        </button>
      )}
    </>
  )
}
