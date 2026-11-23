import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { useOpenSprint, finishSprint, closeOverdueSprints } from '@/db/hooks/useSprints'
import { minutesOf, ranMs, remainingMs } from '@/lib/sprints'
import { saveEverythingNow } from '@/lib/saveNow'
import { plural } from '@/lib/plural'
import type { WritingSprint } from '@/types'
import { chime, soundOn } from './sprintSettings'

/*
  The end of a sprint, on whatever screen is open (issue #706, sprints-plan.md,
  D-5 to D-7): when its time runs out the editors save what they hold, the
  sprint ends at its planned end, and a toast says what it was. A sprint whose
  page closed before its end is ended when the world next opens, and the toast
  says so. Mounted once, in the app shell.
*/

export function sprintSummary(s: WritingSprint): string {
  const minutes = minutesOf(ranMs(s, s.endedAt ?? Date.now()))
  return `${plural(s.wordsAdded, 'word')} added, ${s.wordsCut.toLocaleString()} cut in ${plural(minutes, 'minute')}`
}

export function SprintWatcher({ worldId }: { worldId: string }) {
  const sprint = useOpenSprint(worldId)
  const pushToast = useAppStore((s) => s.pushToast)

  // Opening the world: a sprint whose page closed is ended at its planned end. The notice is said even if the
  // watcher has gone by then: the run that ended the sprint is the only one that can say so, since ending it is one
  // transaction and another run finds nothing to end. Run twice on mounting (React's strict mode), a guard on
  // unmounting lost it.
  useEffect(() => {
    void closeOverdueSprints(worldId).then((closed) => {
      for (const s of closed) pushToast({ message: `A sprint ended while Kathala was closed: ${sprintSummary(s)}.` })
    })
  }, [worldId, pushToast])

  // Running: wait for its time, then end it.
  const ending = useRef<string | null>(null)
  useEffect(() => {
    if (!sprint || sprint.pausedAt !== null) return
    const id = sprint.id
    const end = async () => {
      if (ending.current === id) return
      ending.current = id
      await saveEverythingNow()
      const done = await finishSprint(id, 'done')
      if (!done) return
      pushToast({ message: `Sprint done: ${sprintSummary(done)}.` })
      if (soundOn()) chime()
    }
    const timer = window.setTimeout(() => { void end() }, remainingMs(sprint, Date.now()))
    // A tab put aside keeps its timers slow: looked at again, it ends what is due.
    const back = () => { if (document.visibilityState === 'visible' && remainingMs(sprint, Date.now()) === 0) void end() }
    document.addEventListener('visibilitychange', back)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', back) }
  }, [sprint, pushToast])

  return null
}
