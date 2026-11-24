import { useEffect, useId, useRef, useState } from 'react'
import { Timer, Pause, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOpenSprint, startSprint, pauseSprint, resumeSprint, stopSprint } from '@/db/hooks/useSprints'
import { SPRINT_MINUTES, MAX_SPRINT_MINUTES, chosenMinutes, clock, remainingMs } from '@/lib/sprints'
import { saveEverythingNow } from '@/lib/saveNow'
import { useKeepOnScreen } from '@/lib/onScreen'
import { cn } from '@/lib/utils'
import { keepMinutes, lastMinutes, setSound, soundOn } from './sprintSettings'
import { useNow } from './useNow'

/*
  A writing sprint, started from the Page or Focus mode (issue #706,
  sprints-plan.md, D-7): a length, then a countdown with pause, resume and
  stop, in the same place, beside the text and never over it. The end, and
  what it was, is the watcher's (`SprintWatcher`), on whatever screen is open.
*/

export function SprintControl({ worldId, className }: { worldId: string; className?: string }) {
  const sprint = useOpenSprint(worldId)
  const now = useNow(sprint !== null && sprint.pausedAt === null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function act(fn: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  if (!sprint) {
    return (
      <div className={cn('relative', className)}>
        <Button
          size="sm"
          variant="outline"
          className="h-6 shrink-0 gap-1 px-2 text-[11px] pointer-coarse:h-11 pointer-coarse:px-3"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          title="Write for a set time and see the words added and cut in it"
        >
          <Timer className="h-3 w-3" aria-hidden="true" /> Sprint
        </Button>
        {open && (
          <SprintChooser
            onClose={() => setOpen(false)}
            onStart={(minutes) => act(async () => {
              keepMinutes(minutes)
              await startSprint(worldId, minutes)
              setOpen(false)
            })}
          />
        )}
      </div>
    )
  }

  const paused = sprint.pausedAt !== null
  const left = clock(remainingMs(sprint, now))
  return (
    <div role="group" aria-label="Sprint" className={cn('flex shrink-0 items-center gap-1 text-[11px]', className)}>
      <span
        role="timer"
        aria-label={paused ? `Sprint paused, ${left} left` : `Sprint, ${left} left`}
        className={cn('rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-medium tabular-nums', paused ? 'text-[hsl(var(--muted-foreground))]' : 'text-emerald-400')}
      >
        <Timer className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
        {paused ? `Paused ${left}` : left}
      </span>
      {paused ? (
        <Button size="sm" variant="outline" className="h-6 px-1.5 pointer-coarse:h-11" aria-label="Resume sprint" title="Resume" disabled={busy}
          onClick={() => act(() => resumeSprint(sprint.id))}>
          <Play className="h-3 w-3" aria-hidden="true" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="h-6 px-1.5 pointer-coarse:h-11" aria-label="Pause sprint" title="Pause" disabled={busy}
          onClick={() => act(async () => { await saveEverythingNow(); await pauseSprint(sprint.id) })}>
          <Pause className="h-3 w-3" aria-hidden="true" />
        </Button>
      )}
      <Button size="sm" variant="outline" className="h-6 px-1.5 pointer-coarse:h-11" aria-label="Stop sprint" title="Stop" disabled={busy}
        onClick={() => act(async () => { await saveEverythingNow(); await stopSprint(sprint.id) })}>
        <Square className="h-3 w-3" aria-hidden="true" />
      </Button>
    </div>
  )
}

/** The lengths, a number of minutes, and the sound: a panel under the button, gone on Escape or a click away. */
function SprintChooser({ onStart, onClose }: { onStart: (minutes: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const [typed, setTyped] = useState(() => String(lastMinutes() ?? 25))
  const [sound, setSoundState] = useState(soundOn)
  const minutes = chosenMinutes(typed)
  // Anchored to the button's right edge, and kept on the screen (UX-1-3): under a phone's Book tools it ran 139px off.
  useKeepOnScreen(ref, true)

  useEffect(() => {
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', away)
    ref.current?.addEventListener('keydown', key)
    const el = ref.current
    el?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { document.removeEventListener('pointerdown', away); el?.removeEventListener('keydown', key) }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Start a sprint"
      className="absolute right-0 top-full z-50 mt-1 flex w-56 flex-col gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 text-xs shadow-lg"
    >
      <div className="flex gap-1">
        {SPRINT_MINUTES.map((m) => (
          <Button key={m} size="sm" variant="outline" className="h-7 flex-1 px-1 text-xs pointer-coarse:h-11" onClick={() => onStart(m)}>
            {m} min
          </Button>
        ))}
      </div>
      <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (minutes) onStart(minutes) }}>
        <label htmlFor={inputId} className="text-[hsl(var(--muted-foreground))]">Minutes</label>
        <input
          id={inputId}
          type="number"
          min={1}
          max={MAX_SPRINT_MINUTES}
          step={1}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="h-7 w-14 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 tabular-nums focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
        <Button type="submit" size="sm" className="ml-auto h-7 px-2 text-xs pointer-coarse:h-11" disabled={!minutes}>Start</Button>
      </form>
      <label className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
        <input type="checkbox" checked={sound} onChange={(e) => { setSound(e.target.checked); setSoundState(e.target.checked) }} />
        Sound at the end
      </label>
    </div>
  )
}
