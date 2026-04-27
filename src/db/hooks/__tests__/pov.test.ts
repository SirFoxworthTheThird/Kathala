/**
 * QA test suite — POV Tracking feature
 *
 * Covers:
 *  - charColor helper: explicit color, deterministic HSL fallback, idempotency
 *  - Data layer: createEvent default, explicit POV, updateEvent set/clear, updatedAt bump
 *  - Post-migration invariant: all events carry povCharacterId after DB open
 *  - Continuity check mirror — POV not in involvedCharacterIds
 *  - Continuity check mirror — consecutive POV runs (threshold = 3)
 *  - Edge cases: null-POV events skip (don't break) consecutive runs; empty arrays;
 *    unknown char id; single event; all same POV; two interspersed chars
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createEvent, updateEvent } from '@/db/hooks/useTimeline'
import { charColor } from '@/lib/characterColor'

// ── Fixture helpers ───────────────────────────────────────────────────────────

const BASE_EVENT = {
  worldId: 'w',
  chapterId: 'ch',
  timelineId: 'tl',
  description: '',
  locationMarkerId: null as null,
  involvedCharacterIds: [] as string[],
  involvedItemIds: [] as string[],
  tags: [] as string[],
  sortOrder: 0,
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── charColor helper ──────────────────────────────────────────────────────────

describe('charColor', () => {
  it('returns the explicit color when set', () => {
    expect(charColor({ id: 'abc', color: '#ff0000' })).toBe('#ff0000')
  })

  it('returns an hsl string when color is null', () => {
    const result = charColor({ id: 'abc', color: null })
    expect(result).toMatch(/^hsl\(\d+,\s*60%,\s*55%\)$/)
  })

  it('returns an hsl string when color is undefined', () => {
    const result = charColor({ id: 'abc', color: undefined as unknown as null })
    expect(result).toMatch(/^hsl\(\d+,\s*60%,\s*55%\)$/)
  })

  it('is deterministic — same id always produces the same color', () => {
    const a = charColor({ id: 'same-id', color: null })
    const b = charColor({ id: 'same-id', color: null })
    expect(a).toBe(b)
  })

  it('different ids produce different hues (with high probability)', () => {
    const results = new Set(
      ['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-abc', 'id-xyz', 'hello', 'world', 'foo']
        .map((id) => charColor({ id, color: null }))
    )
    // Not all 10 should collapse to the same value
    expect(results.size).toBeGreaterThan(3)
  })

  it('explicit color takes priority over id-derived hue', () => {
    const withColor = charColor({ id: 'x', color: '#123456' })
    const withNull  = charColor({ id: 'x', color: null })
    expect(withColor).toBe('#123456')
    expect(withNull).not.toBe('#123456')
  })

  it('handles an empty-string id without throwing', () => {
    expect(() => charColor({ id: '', color: null })).not.toThrow()
  })
})

// ── createEvent — POV defaults ────────────────────────────────────────────────

describe('createEvent — POV defaults', () => {
  it('defaults povCharacterId to null when omitted', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T' })
    expect(ev.povCharacterId).toBeNull()
    const stored = await db.events.get(ev.id)
    expect(stored!.povCharacterId).toBeNull()
  })

  it('persists an explicitly supplied povCharacterId', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T', povCharacterId: 'char-1' })
    expect(ev.povCharacterId).toBe('char-1')
    const stored = await db.events.get(ev.id)
    expect(stored!.povCharacterId).toBe('char-1')
  })

  it('returned object matches what is stored in DB', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T', povCharacterId: 'char-2' })
    const stored = await db.events.get(ev.id)
    expect(stored!.povCharacterId).toBe(ev.povCharacterId)
  })

  it('two events can have independent POV characters', async () => {
    const e1 = await createEvent({ ...BASE_EVENT, title: 'E1', povCharacterId: 'char-a' })
    const e2 = await createEvent({ ...BASE_EVENT, title: 'E2', povCharacterId: 'char-b' })
    expect((await db.events.get(e1.id))!.povCharacterId).toBe('char-a')
    expect((await db.events.get(e2.id))!.povCharacterId).toBe('char-b')
  })

  it('null and omitted povCharacterId both store null', async () => {
    const e1 = await createEvent({ ...BASE_EVENT, title: 'E1' })
    const e2 = await createEvent({ ...BASE_EVENT, title: 'E2', povCharacterId: null })
    expect((await db.events.get(e1.id))!.povCharacterId).toBeNull()
    expect((await db.events.get(e2.id))!.povCharacterId).toBeNull()
  })
})

// ── updateEvent — POV changes ─────────────────────────────────────────────────

describe('updateEvent — POV changes', () => {
  it('sets povCharacterId from null to a char id', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T' })
    expect(ev.povCharacterId).toBeNull()
    await updateEvent(ev.id, { povCharacterId: 'char-1' })
    const stored = await db.events.get(ev.id)
    expect(stored!.povCharacterId).toBe('char-1')
  })

  it('clears povCharacterId back to null', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T', povCharacterId: 'char-1' })
    await updateEvent(ev.id, { povCharacterId: null })
    const stored = await db.events.get(ev.id)
    expect(stored!.povCharacterId).toBeNull()
  })

  it('replaces one POV character with another', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T', povCharacterId: 'char-a' })
    await updateEvent(ev.id, { povCharacterId: 'char-b' })
    const stored = await db.events.get(ev.id)
    expect(stored!.povCharacterId).toBe('char-b')
  })

  it('bumps updatedAt when POV changes', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T' })
    await new Promise((r) => setTimeout(r, 5))
    await updateEvent(ev.id, { povCharacterId: 'char-1' })
    const stored = await db.events.get(ev.id)
    expect(stored!.updatedAt).toBeGreaterThan(ev.updatedAt)
  })

  it('does not clobber other fields when only POV changes', async () => {
    const ev = await createEvent({
      ...BASE_EVENT, title: 'Keep Me', status: 'final',
      tags: ['action'], involvedCharacterIds: ['c1', 'c2'],
    })
    await updateEvent(ev.id, { povCharacterId: 'c1' })
    const stored = await db.events.get(ev.id)
    expect(stored!.title).toBe('Keep Me')
    expect(stored!.status).toBe('final')
    expect(stored!.tags).toEqual(['action'])
    expect(stored!.involvedCharacterIds).toEqual(['c1', 'c2'])
  })
})

// ── Post-migration invariant ──────────────────────────────────────────────────

describe('post-migration invariant', () => {
  it('every event created via createEvent has a povCharacterId field', async () => {
    await createEvent({ ...BASE_EVENT, title: 'E1' })
    await createEvent({ ...BASE_EVENT, title: 'E2', povCharacterId: 'char-x' })
    const all = await db.events.toArray()
    for (const ev of all) {
      expect(ev).toHaveProperty('povCharacterId')
      expect(ev.povCharacterId === null || typeof ev.povCharacterId === 'string').toBe(true)
    }
  })

  it('bulkPut with explicit povCharacterId round-trips correctly', async () => {
    const now = Date.now()
    await db.events.bulkPut([{
      id: 'bulk-1',
      worldId: 'w', chapterId: 'ch', timelineId: 'tl',
      title: 'Bulk', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [],
      tags: [], sortOrder: 0, travelDays: null,
      status: 'draft', povCharacterId: 'char-z', isFlashback: false,
      createdAt: now, updatedAt: now,
    }])
    const stored = await db.events.get('bulk-1')
    expect(stored!.povCharacterId).toBe('char-z')
  })
})

// ── Continuity check — POV not in involved cast ───────────────────────────────
// Mirror the ContinuityChecker POV-not-in-cast check without React.

interface PovEvent {
  id: string
  chapterId: string
  title: string
  povCharacterId: string | null
  involvedCharacterIds: string[]
}

function checkPovNotInCast(events: PovEvent[]): Array<{ eventId: string; charId: string }> {
  const issues: Array<{ eventId: string; charId: string }> = []
  for (const ev of events) {
    if (!ev.povCharacterId) continue
    if (!ev.involvedCharacterIds.includes(ev.povCharacterId)) {
      issues.push({ eventId: ev.id, charId: ev.povCharacterId })
    }
  }
  return issues
}

describe('checkPovNotInCast — POV not in involved cast', () => {
  it('returns no issues for an empty event list', () => {
    expect(checkPovNotInCast([])).toHaveLength(0)
  })

  it('returns no issue when event has no POV', () => {
    const ev: PovEvent = { id: 'e1', chapterId: 'ch1', title: 'T', povCharacterId: null, involvedCharacterIds: ['c1'] }
    expect(checkPovNotInCast([ev])).toHaveLength(0)
  })

  it('returns no issue when POV char is in the involved cast', () => {
    const ev: PovEvent = { id: 'e1', chapterId: 'ch1', title: 'T', povCharacterId: 'c1', involvedCharacterIds: ['c1', 'c2'] }
    expect(checkPovNotInCast([ev])).toHaveLength(0)
  })

  it('returns no issue when POV char is the only involved character', () => {
    const ev: PovEvent = { id: 'e1', chapterId: 'ch1', title: 'T', povCharacterId: 'c1', involvedCharacterIds: ['c1'] }
    expect(checkPovNotInCast([ev])).toHaveLength(0)
  })

  it('flags when POV char is absent from involvedCharacterIds', () => {
    const ev: PovEvent = { id: 'e1', chapterId: 'ch1', title: 'T', povCharacterId: 'c-absent', involvedCharacterIds: ['c1', 'c2'] }
    const issues = checkPovNotInCast([ev])
    expect(issues).toHaveLength(1)
    expect(issues[0].eventId).toBe('e1')
    expect(issues[0].charId).toBe('c-absent')
  })

  it('flags when involvedCharacterIds is empty but POV is set', () => {
    const ev: PovEvent = { id: 'e1', chapterId: 'ch1', title: 'T', povCharacterId: 'c1', involvedCharacterIds: [] }
    expect(checkPovNotInCast([ev])).toHaveLength(1)
  })

  it('reports one issue per offending event (not one per event list)', () => {
    const events: PovEvent[] = [
      { id: 'e1', chapterId: 'ch1', title: 'T', povCharacterId: 'cx', involvedCharacterIds: ['c1'] },
      { id: 'e2', chapterId: 'ch1', title: 'T', povCharacterId: 'cy', involvedCharacterIds: ['c2'] },
      { id: 'e3', chapterId: 'ch1', title: 'T', povCharacterId: 'c1', involvedCharacterIds: ['c1'] }, // OK
    ]
    expect(checkPovNotInCast(events)).toHaveLength(2)
  })

  it('handles an unknown (deleted) char id gracefully — still flags', () => {
    // A POV pointing to a character that no longer exists → still not in involvedCharacterIds
    const ev: PovEvent = { id: 'e1', chapterId: 'ch1', title: 'T', povCharacterId: 'deleted-char', involvedCharacterIds: [] }
    expect(checkPovNotInCast([ev])).toHaveLength(1)
  })
})

// ── Continuity check — consecutive POV runs ───────────────────────────────────
// Mirror the ContinuityChecker consecutive-run check without React.

interface OrderedPovEvent {
  id: string
  chapterId: string
  sortOrder: number
  povCharacterId: string | null
}

interface PovRun {
  charId: string
  runLength: number
  firstEventId: string
}

function findConsecutivePovRuns(events: OrderedPovEvent[]): PovRun[] {
  const ordered = events
    .filter((ev) => !!ev.povCharacterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const warnings: PovRun[] = []
  let runStart = 0
  while (runStart < ordered.length) {
    const charId = ordered[runStart].povCharacterId!
    let runEnd = runStart + 1
    while (runEnd < ordered.length && ordered[runEnd].povCharacterId === charId) runEnd++
    const runLen = runEnd - runStart
    if (runLen >= 3) {
      warnings.push({ charId, runLength: runLen, firstEventId: ordered[runStart].id })
    }
    runStart = runEnd
  }
  return warnings
}

function ev(id: string, sortOrder: number, povCharacterId: string | null): OrderedPovEvent {
  return { id, chapterId: 'ch1', sortOrder, povCharacterId }
}

describe('findConsecutivePovRuns — consecutive POV runs', () => {
  it('returns no warnings for empty events', () => {
    expect(findConsecutivePovRuns([])).toHaveLength(0)
  })

  it('returns no warnings for a single POV event', () => {
    expect(findConsecutivePovRuns([ev('e1', 0, 'char-a')])).toHaveLength(0)
  })

  it('returns no warnings for exactly 2 consecutive same-POV events', () => {
    const events = [ev('e1', 0, 'char-a'), ev('e2', 1, 'char-a')]
    expect(findConsecutivePovRuns(events)).toHaveLength(0)
  })

  it('returns one warning for exactly 3 consecutive same-POV events', () => {
    const events = [ev('e1', 0, 'char-a'), ev('e2', 1, 'char-a'), ev('e3', 2, 'char-a')]
    const warnings = findConsecutivePovRuns(events)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].charId).toBe('char-a')
    expect(warnings[0].runLength).toBe(3)
    expect(warnings[0].firstEventId).toBe('e1')
  })

  it('reports run length correctly for runs longer than 3', () => {
    const events = [
      ev('e1', 0, 'char-a'), ev('e2', 1, 'char-a'), ev('e3', 2, 'char-a'),
      ev('e4', 3, 'char-a'), ev('e5', 4, 'char-a'),
    ]
    const warnings = findConsecutivePovRuns(events)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].runLength).toBe(5)
  })

  it('returns no warning when two chars alternate', () => {
    const events = [
      ev('e1', 0, 'char-a'), ev('e2', 1, 'char-b'), ev('e3', 2, 'char-a'),
      ev('e4', 3, 'char-b'), ev('e5', 4, 'char-a'),
    ]
    expect(findConsecutivePovRuns(events)).toHaveLength(0)
  })

  it('reports separate warnings for two distinct runs of 3+', () => {
    const events = [
      ev('e1', 0, 'char-a'), ev('e2', 1, 'char-a'), ev('e3', 2, 'char-a'), // run A
      ev('e4', 3, 'char-b'),                                                 // break
      ev('e5', 4, 'char-b'), ev('e6', 5, 'char-b'), ev('e7', 6, 'char-b'), // run B
    ]
    const warnings = findConsecutivePovRuns(events)
    expect(warnings).toHaveLength(2)
    const charIds = warnings.map((w) => w.charId).sort()
    expect(charIds).toEqual(['char-a', 'char-b'])
  })

  it('null-POV events are skipped — they do NOT break consecutive runs', () => {
    // Sequence: A, null, A, A — only 3 POV-set events all char-a → warning
    const events = [
      ev('e1', 0, 'char-a'),
      ev('e2', 1, null),      // no POV — filtered out before run detection
      ev('e3', 2, 'char-a'),
      ev('e4', 3, 'char-a'),
    ]
    const warnings = findConsecutivePovRuns(events)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].runLength).toBe(3)
  })

  it('null-POV events between different chars do not create a phantom run', () => {
    // A, null, B, null — only 1 each, no run
    const events = [
      ev('e1', 0, 'char-a'), ev('e2', 1, null),
      ev('e3', 2, 'char-b'), ev('e4', 3, null),
    ]
    expect(findConsecutivePovRuns(events)).toHaveLength(0)
  })

  it('a run interrupted by a different character restarts the count', () => {
    // A, A, B, A, A — max run for A is 2 → no warning
    const events = [
      ev('e1', 0, 'char-a'), ev('e2', 1, 'char-a'),
      ev('e3', 2, 'char-b'),
      ev('e4', 3, 'char-a'), ev('e5', 4, 'char-a'),
    ]
    expect(findConsecutivePovRuns(events)).toHaveLength(0)
  })

  it('processes events in sortOrder, not insertion order', () => {
    // Inserted in reverse order; sorted they form a run of 3 for char-a
    const events = [
      ev('e3', 20, 'char-a'),
      ev('e1', 0,  'char-a'),
      ev('e2', 10, 'char-a'),
    ]
    const warnings = findConsecutivePovRuns(events)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].firstEventId).toBe('e1') // lowest sortOrder
  })

  it('all events with same POV produces exactly one warning', () => {
    const events = Array.from({ length: 10 }, (_, i) => ev(`e${i}`, i, 'char-a'))
    const warnings = findConsecutivePovRuns(events)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].runLength).toBe(10)
  })

  it('a run of exactly 2 followed immediately by a run of exactly 3 for a different char', () => {
    const events = [
      ev('e1', 0, 'char-a'), ev('e2', 1, 'char-a'),                         // 2 — no warning
      ev('e3', 2, 'char-b'), ev('e4', 3, 'char-b'), ev('e5', 4, 'char-b'), // 3 — warning
    ]
    const warnings = findConsecutivePovRuns(events)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].charId).toBe('char-b')
  })
})
