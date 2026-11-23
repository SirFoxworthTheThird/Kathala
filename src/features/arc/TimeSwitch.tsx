import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LaneKind } from '@/lib/storyTime'

/*
  The Arc screen's two modes (issue #703, D-3): its grid in telling order, and
  story time. Kept in the address (`?time=story`), as the lane kind is
  (`?lanes=`), so a link or a reload keeps both and the kind carries over.
*/

export type ArcTime = 'telling' | 'story'

export function arcTimeOf(value: string | null): ArcTime {
  return value === 'story' ? 'story' : 'telling'
}

/** The lane kind in the address, for story time: a grid's factions or fields are characters there. */
export function laneKindOf(value: string | null): LaneKind {
  return value === 'threads' || value === 'pov' ? value : 'characters'
}

export function TimeSwitch() {
  const [params, setParams] = useSearchParams()
  const time = arcTimeOf(params.get('time'))
  const set = (t: ArcTime) => setParams((p) => {
    if (t === 'story') p.set('time', 'story')
    else p.delete('time')
    return p
  }, { replace: true })
  return (
    <div role="group" aria-label="Lay out in" className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs">
      {(['telling', 'story'] as const).map((t, i) => (
        <button
          key={t}
          aria-pressed={time === t}
          onClick={() => set(t)}
          title={t === 'telling' ? 'Chapters and scenes in the order the book tells them' : 'Scenes at the day they happen, numbered in telling order'}
          className={cn(
            'px-2.5 py-1 transition-colors',
            i > 0 && 'border-l border-[hsl(var(--border))]',
            time === t ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]',
          )}
        >
          {t === 'telling' ? 'Telling order' : 'Story time'}
        </button>
      ))}
    </div>
  )
}
