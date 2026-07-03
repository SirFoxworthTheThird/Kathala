import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import type { WorldEvent, Chapter } from '@/types'
import { computePacingCurve, tensionColor, tensionLabel } from '@/lib/tension'
import { computeInWorldDays } from '@/lib/inWorldTime'

interface PacingCurveProps {
  events: WorldEvent[]
  chapters: Chapter[]
  order: 'narrative' | 'chronological'
  activeEventId: string | null
  onSelect: (id: string) => void
}

const HEIGHT = 104
const PAD_TOP = 14
const PAD_BOTTOM = 26
const STEP = 46 // horizontal px per event

/**
 * A dramatic-tension sparkline over the events, in the current reading order.
 * Rated scenes plot as points on a 1–5 curve; unrated scenes sit on the
 * baseline as hollow markers. Clicking a point moves the time cursor there.
 */
export function PacingCurve({ events, chapters, order, activeEventId, onSelect }: PacingCurveProps) {
  const points = useMemo(() => {
    const inWorldDayByEvent = order === 'chronological'
      ? computeInWorldDays(events, chapters)
      : undefined
    return computePacingCurve({ events, chapters, order, inWorldDayByEvent })
  }, [events, chapters, order])

  const ratedCount = points.filter((p) => p.tension !== null).length
  const width = Math.max(points.length * STEP, STEP)
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM

  // y for a 1–5 tension level (5 near the top).
  const yFor = (t: number) => PAD_TOP + plotH * (1 - (t - 1) / 4)
  const xFor = (i: number) => STEP / 2 + i * STEP
  const baselineY = PAD_TOP + plotH

  // Connect consecutive rated points into a single path. Cheap enough to build
  // inline each render (the point list itself is already memoized).
  let linePath = ''
  {
    let started = false
    points.forEach((p, i) => {
      if (p.tension === null) return
      const cmd = started ? 'L' : 'M'
      linePath += `${cmd}${xFor(i).toFixed(1)},${yFor(p.tension).toFixed(1)} `
      started = true
    })
    linePath = linePath.trim()
  }

  if (points.length === 0) return null

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
        <Activity className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          Pacing — dramatic tension
        </span>
        {ratedCount === 0 && (
          <span className="text-[10px] italic text-[hsl(var(--muted-foreground))]">
            rate scenes on their cards to draw the curve
          </span>
        )}
      </div>
      <div className="overflow-x-auto px-2 pb-2">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block"
          role="img"
          aria-label="Dramatic tension across the story"
        >
          {/* Horizontal guide lines for levels 1..5 */}
          {[1, 2, 3, 4, 5].map((lvl) => (
            <line
              key={lvl}
              x1={0}
              x2={width}
              y1={yFor(lvl)}
              y2={yFor(lvl)}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray={lvl === 1 ? undefined : '2 4'}
              opacity={lvl === 1 ? 0.8 : 0.4}
            />
          ))}

          {/* Tension line */}
          {linePath && (
            <path d={linePath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={2} opacity={0.55} />
          )}

          {/* Points */}
          {points.map((p, i) => {
            const isActive = p.eventId === activeEventId
            const cx = xFor(i)
            if (p.tension === null) {
              return (
                <g key={p.eventId} className="cursor-pointer" onClick={() => onSelect(p.eventId)}>
                  <title>{`${p.title || 'Untitled'} — unrated`}</title>
                  <circle
                    cx={cx}
                    cy={baselineY}
                    r={isActive ? 4 : 3}
                    fill="hsl(var(--card))"
                    stroke={isActive ? 'hsl(var(--ring))' : 'hsl(var(--muted-foreground))'}
                    strokeWidth={1.5}
                    opacity={0.7}
                  />
                </g>
              )
            }
            return (
              <g key={p.eventId} className="cursor-pointer" onClick={() => onSelect(p.eventId)}>
                <title>{`${p.title || 'Untitled'} — ${tensionLabel(p.tension)} (${p.tension}/5)`}</title>
                {isActive && (
                  <circle cx={cx} cy={yFor(p.tension)} r={8} fill="none" stroke="hsl(var(--ring))" strokeWidth={2} />
                )}
                <circle
                  cx={cx}
                  cy={yFor(p.tension)}
                  r={5}
                  fill={tensionColor(p.tension)}
                  stroke={p.isFlashback ? 'hsl(var(--card))' : 'none'}
                  strokeWidth={p.isFlashback ? 2 : 0}
                  strokeDasharray={p.isFlashback ? '2 2' : undefined}
                />
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
