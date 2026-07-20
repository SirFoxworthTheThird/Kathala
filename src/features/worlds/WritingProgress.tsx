import { useMemo } from 'react'
import { Flame } from 'lucide-react'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'
import { useWritingLogs } from '@/db/hooks/useWritingLog'
import {
  localDayKey, wordsOnDay, computeStreak, lastNDays, progressSummary,
} from '@/lib/writingProgress'

interface WritingProgressProps {
  worldId: string
  /** Book-level word target, or null/undefined when none is set. */
  wordTarget: number | null | undefined
}

const fmt = (n: number) => n.toLocaleString()

/** Today's local day key. Wrapped so the clock read stays out of render/memo bodies. */
function currentDayKey(): string {
  return localDayKey(Date.now())
}

/**
 * Writing-progress panel for the dashboard: today's net words, the current
 * daily streak, a burndown against the book target, and a 14-day bar strip.
 */
export function WritingProgress({ worldId, wordTarget }: WritingProgressProps) {
  const scenes = useWorldSceneTexts(worldId)
  const logs = useWritingLogs(worldId)

  const { total, today, streak, series, summary, todayKey } = useMemo(() => {
    const todayKey = currentDayKey()
    const total = scenes.reduce((sum, s) => sum + s.wordCount, 0)
    return {
      total,
      today: wordsOnDay(logs, todayKey),
      streak: computeStreak(logs, todayKey),
      series: lastNDays(logs, 14, todayKey),
      summary: progressSummary(total, wordTarget),
      todayKey,
    }
  }, [scenes, logs, wordTarget])

  const maxDay = Math.max(1, ...series.map((d) => Math.abs(d.words)))

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      {/* Headline numbers */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{fmt(total)}</p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">total words</p>
        </div>
        <div>
          <p className={`text-2xl font-bold tabular-nums ${today > 0 ? 'text-emerald-400' : 'text-[hsl(var(--foreground))]'}`}>
            {today > 0 ? '+' : ''}{fmt(today)}
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">words today</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">
            {streak > 0 && <Flame className="h-4 w-4 text-orange-400" aria-hidden="true" />}
            {streak}
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">day streak</p>
        </div>
        {summary.target !== null && (
          <div className="min-w-[8rem] flex-1">
            <div className="flex items-baseline justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
              <span>{summary.percent}% of {fmt(summary.target)}</span>
              <span>{fmt(summary.remaining ?? 0)} to go</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${summary.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Last 14 days */}
      <div className="mt-4">
        <div className="flex h-16 items-end gap-1" role="img" aria-label="Words written over the last 14 days">
          {series.map((d) => {
            const h = d.words > 0 ? Math.max(6, Math.round((d.words / maxDay) * 100)) : 2
            const isToday = d.date === todayKey
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${fmt(d.words)} words`}>
                <div
                  className={`w-full rounded-sm ${d.words > 0 ? (isToday ? 'bg-emerald-400' : 'bg-emerald-500/60') : 'bg-[hsl(var(--muted))]'}`}
                  style={{ height: `${h}%` }}
                />
              </div>
            )
          })}
        </div>
        <p className="mt-1 text-right text-[10px] text-[hsl(var(--muted-foreground))]">last 14 days</p>
      </div>
    </div>
  )
}
