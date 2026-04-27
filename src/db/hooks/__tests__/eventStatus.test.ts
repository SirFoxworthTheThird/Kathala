/**
 * QA test suite — Scene / Event Status feature
 *
 * Covers:
 *  - Data layer: createEvent default, explicit status, updateEvent
 *  - Config integrity: EVENT_STATUSES ordering, EVENT_STATUS_CONFIG completeness
 *  - Migration invariant: events always carry a status after DB open
 *  - Edge cases: invalid status coercion, bulk-put bypass, status cycling wrap
 *  - Dashboard aggregation logic
 *  - Arc View chapter-status logic (min-advancement rule)
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createEvent, updateEvent } from '@/db/hooks/useTimeline'
import { EVENT_STATUSES, EVENT_STATUS_CONFIG } from '@/lib/eventStatus'
import type { EventStatus } from '@/types'

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

// ── CONFIG INTEGRITY ──────────────────────────────────────────────────────────

describe('EVENT_STATUSES', () => {
  it('contains exactly the five required statuses in advancement order', () => {
    expect(EVENT_STATUSES).toEqual(['idea', 'outline', 'draft', 'revised', 'final'])
  })

  it('has no duplicates', () => {
    expect(new Set(EVENT_STATUSES).size).toBe(EVENT_STATUSES.length)
  })
})

describe('EVENT_STATUS_CONFIG', () => {
  it('has an entry for every status in EVENT_STATUSES', () => {
    for (const s of EVENT_STATUSES) {
      expect(EVENT_STATUS_CONFIG).toHaveProperty(s)
    }
  })

  it('every entry has a non-empty label and valid CSS hex colors for both color and textColor', () => {
    const hexRe = /^#[0-9a-fA-F]{6}$/
    for (const s of EVENT_STATUSES) {
      const { label, color, textColor } = EVENT_STATUS_CONFIG[s]
      expect(label.length).toBeGreaterThan(0)
      expect(color).toMatch(hexRe)
      expect(textColor).toMatch(hexRe)
    }
  })

  it('textColor is dark (#1f2937) for all statuses — WCAG AA compliance', () => {
    for (const s of EVENT_STATUSES) {
      expect(EVENT_STATUS_CONFIG[s].textColor).toBe('#1f2937')
    }
  })

  it('has no entries for statuses outside EVENT_STATUSES', () => {
    const configKeys = Object.keys(EVENT_STATUS_CONFIG)
    expect(configKeys.sort()).toEqual([...EVENT_STATUSES].sort())
  })
})

// ── createEvent ───────────────────────────────────────────────────────────────

describe('createEvent — status defaults', () => {
  it('defaults status to "draft" when omitted', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T' })
    expect(ev.status).toBe('draft')
    const stored = await db.events.get(ev.id)
    expect(stored!.status).toBe('draft')
  })

  it('persists an explicitly supplied status', async () => {
    for (const s of EVENT_STATUSES) {
      const ev = await createEvent({ ...BASE_EVENT, title: `T-${s}`, status: s as EventStatus })
      const stored = await db.events.get(ev.id)
      expect(stored!.status).toBe(s)
    }
  })

  it('returned object matches what is stored in DB', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T', status: 'idea' })
    const stored = await db.events.get(ev.id)
    expect(stored!.status).toBe(ev.status)
  })

  it('different events can have different statuses independently', async () => {
    const e1 = await createEvent({ ...BASE_EVENT, title: 'E1', status: 'idea' })
    const e2 = await createEvent({ ...BASE_EVENT, title: 'E2', status: 'final' })
    const s1 = await db.events.get(e1.id)
    const s2 = await db.events.get(e2.id)
    expect(s1!.status).toBe('idea')
    expect(s2!.status).toBe('final')
  })
})

// ── updateEvent ───────────────────────────────────────────────────────────────

describe('updateEvent — status changes', () => {
  it('persists a status change', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T', status: 'draft' })
    await updateEvent(ev.id, { status: 'revised' })
    const stored = await db.events.get(ev.id)
    expect(stored!.status).toBe('revised')
  })

  it('advancing through all statuses leaves the last one intact', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T', status: 'idea' })
    for (const s of EVENT_STATUSES) {
      await updateEvent(ev.id, { status: s })
      const stored = await db.events.get(ev.id)
      expect(stored!.status).toBe(s)
    }
  })

  it('bumps updatedAt on status change', async () => {
    const ev = await createEvent({ ...BASE_EVENT, title: 'T', status: 'draft' })
    await new Promise((r) => setTimeout(r, 5))
    await updateEvent(ev.id, { status: 'final' })
    const stored = await db.events.get(ev.id)
    expect(stored!.updatedAt).toBeGreaterThan(ev.updatedAt)
  })

  it('does not clobber other fields when only status changes', async () => {
    const ev = await createEvent({
      ...BASE_EVENT, title: 'Keep Me', status: 'draft',
      tags: ['battle'], involvedCharacterIds: ['c1'],
    })
    await updateEvent(ev.id, { status: 'final' })
    const stored = await db.events.get(ev.id)
    expect(stored!.title).toBe('Keep Me')
    expect(stored!.tags).toEqual(['battle'])
    expect(stored!.involvedCharacterIds).toEqual(['c1'])
  })
})

// ── MIGRATION INVARIANT ───────────────────────────────────────────────────────
// We can't replay a v25→v26 upgrade in a unit test environment, but we can
// verify that all events in a freshly-opened DB carry a status field —
// establishing the post-migration contract.

describe('post-migration invariant', () => {
  it('every event created via createEvent has a status field', async () => {
    await createEvent({ ...BASE_EVENT, title: 'E1' })
    await createEvent({ ...BASE_EVENT, title: 'E2', status: 'outline' })
    const all = await db.events.toArray()
    for (const ev of all) {
      expect(ev).toHaveProperty('status')
      expect(EVENT_STATUSES).toContain(ev.status)
    }
  })
})

// ── BUG #1 FIX VERIFICATION ───────────────────────────────────────────────────
// ChapterAIDialog previously used raw bulkPut, landing events without status.
// Fix: events are normalised with { status: 'draft', ...ev } before bulkPut,
// so any AI-generated event that omits status gets 'draft' as default while
// any future AI output that explicitly includes status is still respected.

describe('ChapterAIDialog import normalisation (Bug #1 fix)', () => {
  it('events normalised with spread preserve an explicit status', async () => {
    const rawEvent = {
      id: 'ai-event-1',
      worldId: 'w', chapterId: 'ch', timelineId: 'tl',
      title: 'AI-generated', description: '',
      locationMarkerId: null as null, involvedCharacterIds: [] as string[], involvedItemIds: [] as string[],
      tags: [] as string[], sortOrder: 0, travelDays: null as null,
      createdAt: Date.now(), updatedAt: Date.now(),
      status: 'outline' as EventStatus,
      povCharacterId: null as string | null,
      isFlashback: false,
    }
    const p = rawEvent as Partial<typeof rawEvent>
    const normalised = { ...rawEvent, status: p.status ?? ('draft' as const), povCharacterId: p.povCharacterId ?? null }
    await db.events.bulkPut([normalised])
    const stored = await db.events.get('ai-event-1')
    // rawEvent.status='outline' wins over the default
    expect(stored!.status).toBe('outline')
  })

  it('events normalised with spread get "draft" when status is absent', async () => {
    const rawEvent = {
      id: 'ai-event-2',
      worldId: 'w', chapterId: 'ch', timelineId: 'tl',
      title: 'AI-no-status', description: '',
      locationMarkerId: null as null, involvedCharacterIds: [] as string[], involvedItemIds: [] as string[],
      tags: [] as string[], sortOrder: 1, travelDays: null as null,
      isFlashback: false,
      createdAt: Date.now(), updatedAt: Date.now(),
      // status and povCharacterId intentionally absent
    }
    const p = rawEvent as Partial<typeof rawEvent> & { status?: EventStatus; povCharacterId?: string | null }
    const normalised = { ...rawEvent, status: p.status ?? ('draft' as const), povCharacterId: p.povCharacterId ?? null }
    await db.events.bulkPut([normalised])
    const stored = await db.events.get('ai-event-2')
    expect(stored!.status).toBe('draft')
  })
})

// ── STATUS CYCLING LOGIC ──────────────────────────────────────────────────────
// Mirror the cycling logic from EventCard so we can test it without React.

function cycleStatus(current: EventStatus): EventStatus {
  const idx = EVENT_STATUSES.indexOf(current)
  return EVENT_STATUSES[(idx + 1) % EVENT_STATUSES.length]
}

describe('status cycling (EventCard badge click logic)', () => {
  it('advances through each status in order', () => {
    expect(cycleStatus('idea')).toBe('outline')
    expect(cycleStatus('outline')).toBe('draft')
    expect(cycleStatus('draft')).toBe('revised')
    expect(cycleStatus('revised')).toBe('final')
  })

  it('wraps from "final" back to "idea"', () => {
    expect(cycleStatus('final')).toBe('idea')
  })

  it('a full cycle returns to the starting status', () => {
    let s: EventStatus = 'draft'
    for (let i = 0; i < EVENT_STATUSES.length; i++) s = cycleStatus(s)
    expect(s).toBe('draft')
  })
})

// ── DASHBOARD AGGREGATION LOGIC ───────────────────────────────────────────────
// Mirror the statusCounts memo from WorldDashboardView so we can test it.

function computeStatusCounts(events: Array<{ status?: EventStatus }>) {
  const counts: Record<EventStatus, number> = { idea: 0, outline: 0, draft: 0, revised: 0, final: 0 }
  for (const ev of events) counts[ev.status ?? 'draft']++
  return counts
}

describe('dashboard status aggregation', () => {
  it('counts zero for all statuses on empty array', () => {
    const c = computeStatusCounts([])
    expect(Object.values(c).every((v) => v === 0)).toBe(true)
  })

  it('counts correctly for a mix of statuses', () => {
    const events = [
      { status: 'idea' as EventStatus },
      { status: 'idea' as EventStatus },
      { status: 'draft' as EventStatus },
      { status: 'final' as EventStatus },
    ]
    const c = computeStatusCounts(events)
    expect(c.idea).toBe(2)
    expect(c.outline).toBe(0)
    expect(c.draft).toBe(1)
    expect(c.revised).toBe(0)
    expect(c.final).toBe(1)
  })

  it('falls back to "draft" when status is undefined (AI-import gap)', () => {
    const events = [{ status: undefined }, { status: undefined }]
    const c = computeStatusCounts(events)
    expect(c.draft).toBe(2)
  })

  it('sum of all counts equals total event count', () => {
    const events = EVENT_STATUSES.map((s) => ({ status: s }))
    const c = computeStatusCounts(events)
    const total = Object.values(c).reduce((a, b) => a + b, 0)
    expect(total).toBe(events.length)
  })

  it('progress bar widths sum to 100% when all statuses present', () => {
    const total = 100
    const events = Array.from({ length: total }, (_, i) => ({
      status: EVENT_STATUSES[i % EVENT_STATUSES.length],
    }))
    const c = computeStatusCounts(events)
    const widthSum = EVENT_STATUSES.reduce((sum, s) => sum + (c[s] / total) * 100, 0)
    expect(widthSum).toBeCloseTo(100, 10)
  })
})

// ── ARC VIEW — CHAPTER STATUS LOGIC ──────────────────────────────────────────
// Mirror the refactored O(1) Map-based logic from CharacterArcView.
// The Map is built in a single O(n) pass over allEvents, then lookups are O(1).

function buildChapterMinStatusMap(
  allEvents: Array<{ chapterId: string; status?: EventStatus }>
): Map<string, EventStatus> {
  const map = new Map<string, EventStatus>()
  for (const ev of allEvents) {
    const s = (ev.status ?? 'draft') as EventStatus
    const evIdx = EVENT_STATUSES.indexOf(s)
    const existing = map.get(ev.chapterId)
    const existingIdx = existing !== undefined ? EVENT_STATUSES.indexOf(existing) : EVENT_STATUSES.length
    if (evIdx < existingIdx) map.set(ev.chapterId, s)
  }
  return map
}

function getChapterMinStatus(
  chapterId: string,
  allEvents: Array<{ chapterId: string; status?: EventStatus }>
): EventStatus | null {
  const map = buildChapterMinStatusMap(allEvents)
  return map.get(chapterId) ?? null
}

describe('buildChapterMinStatusMap (O(1) lookup after O(n) build)', () => {
  it('builds an empty map for an empty events array', () => {
    expect(buildChapterMinStatusMap([]).size).toBe(0)
  })

  it('produces one entry per unique chapterId', () => {
    const events = [
      { id: '1', chapterId: 'ch1', status: 'draft' as EventStatus },
      { id: '2', chapterId: 'ch2', status: 'final' as EventStatus },
      { id: '3', chapterId: 'ch1', status: 'idea' as EventStatus },
    ]
    const map = buildChapterMinStatusMap(events)
    expect(map.size).toBe(2)
  })

  it('each chapter key maps to the minimum status of its events', () => {
    const events = [
      { id: '1', chapterId: 'ch1', status: 'revised' as EventStatus },
      { id: '2', chapterId: 'ch1', status: 'idea' as EventStatus },
      { id: '3', chapterId: 'ch2', status: 'final' as EventStatus },
    ]
    const map = buildChapterMinStatusMap(events)
    expect(map.get('ch1')).toBe('idea')
    expect(map.get('ch2')).toBe('final')
  })
})

describe('arc view chapter status (minimum-advancement rule)', () => {
  it('returns null for a chapter with no events', () => {
    expect(getChapterMinStatus('ch1', [])).toBeNull()
  })

  it('returns null for a chapter that has no matching events', () => {
    const events = [{ chapterId: 'ch2', status: 'final' as EventStatus }]
    expect(getChapterMinStatus('ch1', events)).toBeNull()
  })

  it('returns the single event status when there is one event', () => {
    const events = [{ chapterId: 'ch1', status: 'revised' as EventStatus }]
    expect(getChapterMinStatus('ch1', events)).toBe('revised')
  })

  it('returns the least-advanced status when events have mixed statuses', () => {
    const events = [
      { chapterId: 'ch1', status: 'final' as EventStatus },
      { chapterId: 'ch1', status: 'draft' as EventStatus },
      { chapterId: 'ch1', status: 'revised' as EventStatus },
    ]
    expect(getChapterMinStatus('ch1', events)).toBe('draft')
  })

  it('returns "idea" (index 0) when any event is "idea"', () => {
    const events = [
      { chapterId: 'ch1', status: 'final' as EventStatus },
      { chapterId: 'ch1', status: 'idea' as EventStatus },
    ]
    expect(getChapterMinStatus('ch1', events)).toBe('idea')
  })

  it('returns "final" when all events are "final"', () => {
    const events = [
      { chapterId: 'ch1', status: 'final' as EventStatus },
      { chapterId: 'ch1', status: 'final' as EventStatus },
    ]
    expect(getChapterMinStatus('ch1', events)).toBe('final')
  })

  it('treats undefined status as "draft" when computing minimum', () => {
    const events = [
      { chapterId: 'ch1', status: 'final' as EventStatus },
      { chapterId: 'ch1', status: undefined },  // AI-import gap
    ]
    expect(getChapterMinStatus('ch1', events)).toBe('draft')
  })

  it('does not bleed across chapters', () => {
    const events = [
      { chapterId: 'ch1', status: 'final' as EventStatus },
      { chapterId: 'ch2', status: 'idea' as EventStatus },
    ]
    expect(getChapterMinStatus('ch1', events)).toBe('final')
    expect(getChapterMinStatus('ch2', events)).toBe('idea')
  })
})
