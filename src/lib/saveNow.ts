import { useEffect, useRef } from 'react'

/*
  Telling the open editors to save what they hold, now (issue #706,
  sprints-plan.md, D-5). The Page, Focus mode and a scene's text box save a
  second after the last key, so a writer typing through the end of a sprint
  has not saved its last words when the time runs out. A sprint ends, pauses
  or stops only once they are saved.
*/

const EVENT = 'kathala:save-now'

/** Ask every open editor to save, and wait until each has. */
export async function saveEverythingNow(): Promise<void> {
  const waits: Array<Promise<unknown>> = []
  window.dispatchEvent(new CustomEvent<Array<Promise<unknown>>>(EVENT, { detail: waits }))
  await Promise.all(waits.map((w) => w.catch(() => undefined)))
}

/** An editor's part: `save` writes what it holds and has not saved, and says when it has. */
export function useSaveNow(save: () => Promise<unknown> | void): void {
  const ref = useRef(save)
  useEffect(() => { ref.current = save })
  useEffect(() => {
    const on = (e: Event) => {
      const waits = (e as CustomEvent<Array<Promise<unknown>>>).detail
      waits.push(Promise.resolve(ref.current()))
    }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
}
