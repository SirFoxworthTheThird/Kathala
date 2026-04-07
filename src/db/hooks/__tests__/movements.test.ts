import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { appendWaypoint, clearMovement, removeLastWaypoint } from '@/db/hooks/useMovements'

const W  = 'world-1'
const C  = 'char-1'
const EV = 'ev-1'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function getWaypoints() {
  const m = await db.characterMovements
    .where('[characterId+eventId]')
    .equals([C, EV])
    .first()
  return m?.waypoints ?? null
}

// ── appendWaypoint ────────────────────────────────────────────────────────────

describe('appendWaypoint', () => {
  it('creates a new movement record on first call', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    expect(await getWaypoints()).toEqual(['loc-1'])
  })

  it('appends subsequent waypoints to the existing movement', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await appendWaypoint(W, C, EV, 'loc-2')
    await appendWaypoint(W, C, EV, 'loc-3')
    expect(await getWaypoints()).toEqual(['loc-1', 'loc-2', 'loc-3'])
  })

  it('ignores a duplicate of the last waypoint', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await appendWaypoint(W, C, EV, 'loc-1')
    expect(await getWaypoints()).toEqual(['loc-1'])
  })

  it('allows the same marker if it is not the immediate last', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await appendWaypoint(W, C, EV, 'loc-2')
    await appendWaypoint(W, C, EV, 'loc-1')
    expect(await getWaypoints()).toEqual(['loc-1', 'loc-2', 'loc-1'])
  })

  it('keeps movements isolated by event', async () => {
    await appendWaypoint(W, C, 'ev-1', 'loc-A')
    await appendWaypoint(W, C, 'ev-2', 'loc-B')

    const ev1 = await db.characterMovements.where('[characterId+eventId]').equals([C, 'ev-1']).first()
    const ev2 = await db.characterMovements.where('[characterId+eventId]').equals([C, 'ev-2']).first()

    expect(ev1!.waypoints).toEqual(['loc-A'])
    expect(ev2!.waypoints).toEqual(['loc-B'])
  })

  it('stores worldId, characterId and eventId correctly', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    const m = await db.characterMovements.where('[characterId+eventId]').equals([C, EV]).first()
    expect(m!.worldId).toBe(W)
    expect(m!.characterId).toBe(C)
    expect(m!.eventId).toBe(EV)
  })
})

// ── appendWaypoint — fromMarkerId seeding ────────────────────────────────────

describe('appendWaypoint — fromMarkerId', () => {
  it('seeds [fromMarkerId, markerId] when no movement exists and markers differ', async () => {
    await appendWaypoint(W, C, EV, 'loc-2', 'loc-1')
    expect(await getWaypoints()).toEqual(['loc-1', 'loc-2'])
  })

  it('creates [markerId] only when fromMarkerId equals markerId', async () => {
    await appendWaypoint(W, C, EV, 'loc-1', 'loc-1')
    expect(await getWaypoints()).toEqual(['loc-1'])
  })

  it('ignores fromMarkerId when a movement record already exists', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await appendWaypoint(W, C, EV, 'loc-3', 'loc-2')
    expect(await getWaypoints()).toEqual(['loc-1', 'loc-3'])
  })

  it('allows subsequent waypoints to be appended after a seeded movement', async () => {
    await appendWaypoint(W, C, EV, 'loc-2', 'loc-1')
    await appendWaypoint(W, C, EV, 'loc-3')
    expect(await getWaypoints()).toEqual(['loc-1', 'loc-2', 'loc-3'])
  })

  it('does not duplicate fromMarkerId if it matches the appended waypoint', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await appendWaypoint(W, C, EV, 'loc-1', 'loc-1')
    expect(await getWaypoints()).toEqual(['loc-1'])
  })
})

// ── clearMovement ─────────────────────────────────────────────────────────────

describe('clearMovement', () => {
  it('removes the movement record', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await clearMovement(C, EV)
    expect(await getWaypoints()).toBeNull()
  })

  it('is a no-op when no movement exists', async () => {
    await expect(clearMovement(C, EV)).resolves.toBeUndefined()
  })

  it('only clears the targeted event movement', async () => {
    await appendWaypoint(W, C, 'ev-1', 'loc-A')
    await appendWaypoint(W, C, 'ev-2', 'loc-B')
    await clearMovement(C, 'ev-1')

    const ev1 = await db.characterMovements.where('[characterId+eventId]').equals([C, 'ev-1']).first()
    const ev2 = await db.characterMovements.where('[characterId+eventId]').equals([C, 'ev-2']).first()

    expect(ev1).toBeUndefined()
    expect(ev2!.waypoints).toEqual(['loc-B'])
  })
})

// ── removeLastWaypoint ────────────────────────────────────────────────────────

describe('removeLastWaypoint', () => {
  it('removes the last waypoint from a multi-waypoint movement', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await appendWaypoint(W, C, EV, 'loc-2')
    await appendWaypoint(W, C, EV, 'loc-3')
    await removeLastWaypoint(C, EV)
    expect(await getWaypoints()).toEqual(['loc-1', 'loc-2'])
  })

  it('deletes the movement record when only one waypoint remains', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await removeLastWaypoint(C, EV)
    expect(await getWaypoints()).toBeNull()
  })

  it('is a no-op when no movement exists', async () => {
    await expect(removeLastWaypoint(C, EV)).resolves.toBeUndefined()
    expect(await getWaypoints()).toBeNull()
  })

  it('can be called repeatedly to walk back the full path', async () => {
    await appendWaypoint(W, C, EV, 'loc-1')
    await appendWaypoint(W, C, EV, 'loc-2')
    await appendWaypoint(W, C, EV, 'loc-3')

    await removeLastWaypoint(C, EV)
    expect(await getWaypoints()).toEqual(['loc-1', 'loc-2'])

    await removeLastWaypoint(C, EV)
    expect(await getWaypoints()).toEqual(['loc-1'])

    await removeLastWaypoint(C, EV)
    expect(await getWaypoints()).toBeNull()
  })
})
