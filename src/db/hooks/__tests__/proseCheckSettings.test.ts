import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { setProseCheckSettings, setProseFindingDismissed } from '@/db/hooks/useProseChecks'
import { importWorldFromJson, serializeWorldForSync } from '@/lib/exportImport'
import { proseSettings, PROSE_CHECK_DEFAULTS } from '@/lib/proseChecks'

/** The prose checks' settings and dismissals (editorial-plan.md, R6): on the world, written without a stale copy, and in its backup. */

beforeEach(async () => { await db.delete(); await db.open() })
afterAll(async () => { await db.delete() })

describe('prose check settings and dismissals', () => {
  it('two changes made together both land; null is the defaults again', async () => {
    const world = await createWorld({ name: 'Ferry', description: '' })
    await Promise.all([setProseCheckSettings(world.id, { echoSpan: 10 }), setProseCheckSettings(world.id, { tags: false })])
    expect(proseSettings((await db.worlds.get(world.id))!.proseChecks)).toEqual({ ...PROSE_CHECK_DEFAULTS, echoSpan: 10, tags: false })
    await setProseCheckSettings(world.id, null)
    expect(proseSettings((await db.worlds.get(world.id))!.proseChecks)).toEqual(PROSE_CHECK_DEFAULTS)
  })

  it('a finding dismissed and brought back; both travel in the backup', async () => {
    const world = await createWorld({ name: 'Ferry', description: '' })
    await Promise.all([setProseFindingDismissed(world.id, 'echo:a:lantern:0', true), setProseFindingDismissed(world.id, 'tag:b:said softly:0', true)])
    await setProseFindingDismissed(world.id, 'echo:a:lantern:0', false)
    await setProseCheckSettings(world.id, { petRatio: 5 })
    expect((await db.worlds.get(world.id))!.proseDismissed).toEqual(['tag:b:said softly:0'])
    const file = await serializeWorldForSync(world.id)
    await deleteWorld(world.id)
    await importWorldFromJson(file)
    const back = (await db.worlds.get(world.id))!
    expect([back.proseDismissed, back.proseChecks]).toEqual([['tag:b:said softly:0'], { petRatio: 5 }])
  })
})
