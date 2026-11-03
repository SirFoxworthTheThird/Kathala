import { expect, type Page } from '@playwright/test'
import { settle } from './settle'

/**
 * Put the time cursor at `eventId` and reload, the way a reader returning to a
 * book finds it.
 *
 * Eleven specs did this by writing `kathala-ui` into the running page and
 * reloading, and sometimes lost the cursor: `validate-library-names` failed
 * once in 24 runs with `--repeat-each=8`. The running page was still opening
 * the book: `AppShell` puts a reading world with no
 * remembered place at its first scene, after reading the scenes, and the store
 * writes itself to `localStorage` when it does. If that landed after the
 * spec's write, it overwrote it. If it had not landed yet, the world had no
 * `eventByWorld` entry for the spec to update. Either way the reload opened at
 * the first scene. `readingLoreGate` retried up to three times against the
 * same thing ("the store kept overwriting it").
 *
 * So the cursor is written by the next document, before the app starts: an
 * init script, armed for one load by a token in `sessionStorage`. The page
 * that could overwrite it is gone by then, and the world being opened gets
 * its own `eventByWorld` entry rather than only the ones already there.
 */
export async function parkCursor(page: Page, eventId: string) {
  const token = `${eventId}:${Math.random()}`
  await page.addInitScript(({ eid, token: armed }: { eid: string; token: string }) => {
    if (sessionStorage.getItem('pw-park-cursor') !== armed) return
    sessionStorage.removeItem('pw-park-cursor')
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state = st.state ?? {}
    st.state.activeEventId = eid
    const byWorld: Record<string, string | null> = st.state.eventByWorld ?? {}
    for (const k of Object.keys(byWorld)) byWorld[k] = eid
    const worldId = location.hash.match(/^#\/worlds\/([^/?]+)/)?.[1]
    if (worldId) byWorld[worldId] = eid
    st.state.eventByWorld = byWorld
    localStorage.setItem('kathala-ui', JSON.stringify(st))
  }, { eid: eventId, token })
  await page.evaluate((t: string) => sessionStorage.setItem('pw-park-cursor', t), token)
  await page.reload({ waitUntil: 'load' })
}

/** `parkCursor`, then the screen settled and the cursor checked: still there after the app has opened. */
export async function readAt(page: Page, eventId: string) {
  await parkCursor(page, eventId)
  await settle(page)
  const landed = await page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)
  expect(landed, 'the cursor was actually parked').toBe(eventId)
}
