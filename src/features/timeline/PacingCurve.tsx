import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import type { WorldEvent, Chapter } from '@/types'
import { computePacingCurve, tensionColor, tensionLabel, TENSION_LEVELS } from '@/lib/tension'
import type { PacingPoint } from '@/lib/tension'
import { beatById, beatActColor } from '@/lib/storyBeats'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'
import { plural } from '@/lib/plural'

interface PacingCurveProps {
  worldId: string
  events: WorldEvent[]
  chapters: Chapter[]
  order: 'narrative' | 'chronological'
  activeEventId: string | null
  onSelect: (id: string) => void
}

const HEIGHT = 112
const PAD_TOP = 22
const PAD_BOTTOM = 26
const STEP = 46 // horizontal px per event
const AXIS_W = 58 // gutter for the tension scale

/**
 * A dramatic-tension sparkline over the events, in the current reading order.
 * Rated scenes plot as points on a 1–5 curve; unrated scenes sit on the
 * baseline as hollow markers. Clicking a point moves the time cursor there.
 */
export function PacingCurve({ worldId, events, chapters, order, activeEventId, onSelect }: PacingCurveProps) {
  const sceneTexts = useWorldSceneTexts(worldId)

  const points = useMemo(() => {
    const inWorldDayByEvent = order === 'chronological'
      ? computeInWorldDays(events, chapters)
      : undefined
    const wordCountByEvent = new Map(sceneTexts.map((s) => [s.eventId, s.wordCount]))
    return computePacingCurve({ events, chapters, order, inWorldDayByEvent, wordCountByEvent })
  }, [events, chapters, order, sceneTexts])

  const ratedCount = points.filter((p) => p.tension !== null).length
  const maxWords = points.reduce((m, p) => Math.max(m, p.wordCount), 0)
  // Radius grows with scene length so longer scenes read as heavier points.
  const radiusFor = (wc: number) => (maxWords > 0 ? 4 + 5 * (wc / maxWords) : 5)
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
    /*
      WRUN-14: as wide as it has to be, and no wider.

      The chart is `AXIS_W + scenes × STEP`, so a three-chapter draft — the
      state this app's target user is in — draws 334px of it. The panel was a
      plain block, so it stretched to the content column (~1354px) and framed
      about a thousand pixels of nothing. `w-fit` sizes the panel to its widest
      child instead; `max-w-full` caps it on a long book, where the chart is
      thousands of pixels wide and the inner `overflow-x-auto` scrolls it.
    */
    <div className="w-fit max-w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
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
        {ratedCount > 0 && maxWords > 0 && (
          <span className="text-[10px] italic text-[hsl(var(--muted-foreground))]">
            point size = scene length
          </span>
        )}
      </div>
      {/*
        Nothing is rated yet, so there is no curve — only a row of grey dots on
        the baseline and about 150px of empty plot, on the screen a writer opens
        most. The header above already says what the chart is and how to fill
        it, which is the whole of what an unrated world can learn here; the plot
        appears the moment the first scene is rated.

        `ratedCount`, not `points.length`: a world with scenes but no ratings is
        the ordinary state of every new world, and it is the one this is for.
      */}
      {ratedCount > 0 && (
      <div className="flex items-start pb-2">
        {/*
          The scale, outside the scrolling area so it stays visible while you
          pan. The chart already drew gridlines for levels 1..5 and said what
          point size meant, but nothing said what *height* meant — the one thing
          the curve is actually plotting.
        */}
        <svg
          width={AXIS_W}
          height={HEIGHT}
          viewBox={`0 0 ${AXIS_W} ${HEIGHT}`}
          className="block shrink-0"
          aria-hidden="true"
        >
          {TENSION_LEVELS.map((lvl) => (
            <text
              key={lvl}
              x={AXIS_W - 6}
              y={yFor(lvl) + 3}
              textAnchor="end"
              fontSize={8}
              fill="hsl(var(--muted-foreground))"
              opacity={lvl === 1 || lvl === 5 ? 0.9 : 0.55}
            >
              {tensionLabel(lvl)}
            </text>
          ))}
        </svg>
        <div className="min-w-0 flex-1 overflow-x-auto px-2">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block"
          role="img"
          aria-label="Dramatic tension across the story"
        >
          {/*
            Chapter boundaries. The curve plotted 58 events in a row with no way
            to tell which chapter a peak belonged to — the question you ask a
            pacing chart. A faint rule where each chapter starts, numbered, is
            enough to place a spike without crowding the plot.
          */}
          {points.map((p, i) => {
            const prev = i > 0 ? points[i - 1].chapterNumber : null
            if (p.chapterNumber === null || p.chapterNumber === prev) return null
            const x = xFor(i) - STEP / 2
            return (
              <g key={`ch-${p.chapterNumber}-${i}`}>
                <line
                  x1={x} x2={x} y1={PAD_TOP - 6} y2={baselineY}
                  stroke="hsl(var(--border))" strokeWidth={1} opacity={0.7}
                />
                <text
                  x={x + 3} y={PAD_TOP - 1}
                  fontSize={8} fill="hsl(var(--muted-foreground))" opacity={0.75}
                >
                  Ch.{p.chapterNumber}
                </text>
              </g>
            )
          })}

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

          {/* Story-beat markers — vertical guides with a short label in the bottom band */}
          {points.map((p, i) => {
            const beat = beatById(p.structureBeat)
            if (!beat) return null
            const cx = xFor(i)
            const color = beatActColor(beat.act)
            return (
              <g key={`beat-${p.eventId}`} className="cursor-pointer" onClick={() => onSelect(p.eventId)}>
                <title>{`${beat.label} — ${p.title || 'Untitled'}`}</title>
                <line x1={cx} x2={cx} y1={PAD_TOP} y2={baselineY} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
                <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={9} fontWeight={600} fill={color}>
                  {beat.short}
                </text>
              </g>
            )
          })}

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
            const r = radiusFor(p.wordCount)
            const wordsLabel = p.wordCount > 0 ? ` — ${plural(p.wordCount, 'word')}` : ''
            return (
              <g key={p.eventId} className="cursor-pointer" onClick={() => onSelect(p.eventId)}>
                <title>{`${p.title || 'Untitled'} — ${tensionLabel(p.tension)} (${p.tension}/5)${wordsLabel}`}</title>
                {isActive && (
                  <circle cx={cx} cy={yFor(p.tension)} r={r + 3} fill="none" stroke="hsl(var(--ring))" strokeWidth={2} />
                )}
                <circle
                  cx={cx}
                  cy={yFor(p.tension)}
                  r={r}
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
      )}

      <PacingTable points={points} />
    </div>
  )
}

/**
 * The curve's data, for anyone not reading it as a picture. 117 focusable SVG
 * points would be a worse answer than this: a chart's accessible equivalent is
 * the numbers behind it, and a table can be read, sorted by eye and searched,
 * which a row of circles cannot.
 *
 * Kept in the accessibility tree and out of the visual one, so it costs sighted
 * readers nothing.
 */
function PacingTable({ points }: { points: PacingPoint[] }) {
  // Wrapped rather than carrying `sr-only` itself: a table's used width is at
  // least its min-content width, so `width: 1px` does nothing to it. The
  // wrapper shrinks and clips; the table inside keeps its table semantics.
  return (
    <div className="sr-only">
    <table>
      <caption>Dramatic tension by scene, in the order shown</caption>
      <thead>
        <tr>
          <th scope="col">Chapter</th>
          <th scope="col">Scene</th>
          <th scope="col">Tension</th>
          <th scope="col">Words</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.eventId}>
            <td>{p.chapterNumber ?? '—'}</td>
            <td>{p.title || 'Untitled'}</td>
            <td>{p.tension === null ? 'Unrated' : `${tensionLabel(p.tension)} (${p.tension} of 5)`}</td>
            <td>{p.wordCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
