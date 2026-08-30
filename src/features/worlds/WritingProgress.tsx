import { useMemo, useState } from 'react'
import { Flame, CalendarClock, Target } from 'lucide-react'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'
import { useWritingLogs } from '@/db/hooks/useWritingLog'
import {
  localDayKey, wordsOnDay, computeStreak, lastNDays, progressSummary, writingForecast,
} from '@/lib/writingProgress'
import { plural } from '@/lib/plural'

interface WritingProgressProps {
  worldId: string
  /** Book-level word target, or null/undefined when none is set. */
  wordTarget: number | null | undefined
  /** Manuscript deadline (`YYYY-MM-DD`), or null/undefined when none is set. */
  targetDate: string | null | undefined
}

const fmt = (n: number) => n.toLocaleString()

/** Today's local day key. Wrapped so the clock read stays out of render/memo bodies. */
function currentDayKey(): string {
  return localDayKey(Date.now())
}

/** Format a `YYYY-MM-DD` key as e.g. "9 Aug 2026". */
function formatDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Small circular progress ring (0–100%). */
function Ring({ pct, label }: { pct: number; label: string }) {
  return (
    <svg viewBox="0 0 36 36" className="h-12 w-12 shrink-0" role="img" aria-label={label}>
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
      <circle
        cx="18" cy="18" r="15.9155" fill="none"
        stroke="rgb(52 211 153)" strokeWidth="3" strokeLinecap="round"
        pathLength={100} strokeDasharray={`${pct} 100`}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="19.5" textAnchor="middle" className="fill-[hsl(var(--foreground))] text-[9px] font-semibold tabular-nums">
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

/**
 * Writing-progress panel for the dashboard: today's net words, streak, a burndown
 * against the book target, a words/day + projected-finish forecast against the
 * deadline, a daily session-goal ring, and a 14-day bar strip.
 */
export function WritingProgress({ worldId, wordTarget, targetDate }: WritingProgressProps) {
  const scenes = useWorldSceneTexts(worldId)
  const logs = useWritingLogs(worldId)

  const goalKey = `plotweave-session-goal-${worldId}`
  const [sessionGoal, setSessionGoal] = useState<number>(() => Number(localStorage.getItem(goalKey)) || 0)
  function updateSessionGoal(v: number) {
    const g = Math.max(0, Math.floor(v) || 0)
    setSessionGoal(g)
    if (g > 0) localStorage.setItem(goalKey, String(g))
    else localStorage.removeItem(goalKey)
  }

  const { total, today, streak, series, summary, forecast, todayKey } = useMemo(() => {
    const todayKey = currentDayKey()
    const total = scenes.reduce((sum, s) => sum + s.wordCount, 0)
    return {
      total,
      today: wordsOnDay(logs, todayKey),
      streak: computeStreak(logs, todayKey),
      series: lastNDays(logs, 14, todayKey),
      summary: progressSummary(total, wordTarget),
      forecast: writingForecast({ total, target: wordTarget, targetDate, logs, todayKey }),
      todayKey,
    }
  }, [scenes, logs, wordTarget, targetDate])

  const maxDay = Math.max(1, ...series.map((d) => Math.abs(d.words)))
  const sessionPct = sessionGoal > 0 ? Math.min(100, (today / sessionGoal) * 100) : 0

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

        {/* Session goal ring */}
        <div className="flex items-center gap-2">
          {sessionGoal > 0 && <Ring pct={sessionPct} label={`Today's session: ${today} of ${sessionGoal} words`} />}
          <div>
            <label className="flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              <Target className="h-3 w-3" aria-hidden="true" /> daily goal
            </label>
            <input
              type="number"
              min={0}
              step={100}
              placeholder="e.g. 500"
              value={sessionGoal || ''}
              onChange={(e) => updateSessionGoal(Number(e.target.value))}
              className="mt-0.5 h-6 w-20 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 text-xs tabular-nums text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              aria-label="Daily session word goal"
            />
          </div>
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

      {/* Deadline forecast */}
      {targetDate && summary.target !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          {summary.remaining === 0 ? (
            <span className="font-medium text-emerald-400">Target reached — nicely done.</span>
          ) : (forecast.daysToDeadline ?? 0) < 0 ? (
            <span className="text-amber-400">Deadline {formatDate(targetDate)} has passed — {plural(forecast.remaining ?? 0, 'word')} still to go.</span>
          ) : (
            <>
              <span className="text-[hsl(var(--foreground))]">
                <span className="font-semibold tabular-nums">{fmt(forecast.wordsPerDayNeeded ?? 0)}</span> words/day to finish by {formatDate(targetDate)}
                <span className="text-[hsl(var(--muted-foreground))]"> ({forecast.daysToDeadline} {forecast.daysToDeadline === 1 ? 'day' : 'days'} left)</span>
              </span>
              {forecast.projectedFinish ? (
                <span className="text-[hsl(var(--muted-foreground))]">
                  · at ~{fmt(Math.round(forecast.recentPacePerDay))}/day you'll finish {formatDate(forecast.projectedFinish)}
                </span>
              ) : (
                <span className="text-[hsl(var(--muted-foreground))]">· write a little to project a finish date</span>
              )}
              {forecast.onTrack !== null && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${forecast.onTrack ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {forecast.onTrack ? 'on track' : 'behind pace'}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Last 14 days */}
      <div className="mt-4">
        <div className="flex h-16 items-end gap-1" role="img" aria-label="Words written over the last 14 days">
          {series.map((d) => {
            const h = d.words > 0 ? Math.max(6, Math.round((d.words / maxDay) * 100)) : 2
            const isToday = d.date === todayKey
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${plural(d.words, 'word')}`}>
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
