import { describe, it, expect } from 'vitest'
import {
  SUGGESTION_RULES,
  MAX_SUGGESTIONS,
  evaluateSuggestions,
  type WorldSummaryData,
} from '../suggestionRules'

// ── Helpers ───────────────────────────────────────────────────────────────────

function world(overrides: Partial<WorldSummaryData> = {}): WorldSummaryData {
  return {
    characterCount:         0,
    eventCount:             0,
    hasCharacterAtAnyEvent: false,
    relationshipCount:      0,
    mapLayerCount:          0,
    lorePageCount:          0,
    factionCount:           0,
    ...overrides,
  }
}

function ids(suggestions: ReturnType<typeof evaluateSuggestions>) {
  return suggestions.map((r) => r.id)
}

// ── SUGG-01/02: add-character ─────────────────────────────────────────────────

describe('SUGG-01/02 — add-character rule', () => {
  it('fires when characterCount === 0', () => {
    const results = evaluateSuggestions(world({ characterCount: 0 }), [])
    expect(ids(results)).toContain('add-character')
  })

  it('does NOT fire when characterCount > 0', () => {
    const results = evaluateSuggestions(world({ characterCount: 1 }), [])
    expect(ids(results)).not.toContain('add-character')
  })
})

// ── SUGG-03: add-first-event ──────────────────────────────────────────────────

describe('SUGG-03 — add-first-event rule', () => {
  it('fires when chars > 0 AND events === 0', () => {
    const results = evaluateSuggestions(world({ characterCount: 1, eventCount: 0 }), [])
    expect(ids(results)).toContain('add-first-event')
  })

  it('does NOT fire when chars === 0', () => {
    const results = evaluateSuggestions(world({ characterCount: 0, eventCount: 0 }), [])
    expect(ids(results)).not.toContain('add-first-event')
  })

  it('does NOT fire when events > 0', () => {
    const results = evaluateSuggestions(world({ characterCount: 1, eventCount: 1 }), [])
    expect(ids(results)).not.toContain('add-first-event')
  })
})

// ── SUGG-04: place-character ──────────────────────────────────────────────────

describe('SUGG-04 — place-character rule', () => {
  it('fires when events > 0 AND no snapshots', () => {
    const results = evaluateSuggestions(
      world({ characterCount: 1, eventCount: 1, hasCharacterAtAnyEvent: false }),
      []
    )
    expect(ids(results)).toContain('place-character')
  })

  it('does NOT fire when hasCharacterAtAnyEvent is true', () => {
    const results = evaluateSuggestions(
      world({ eventCount: 1, hasCharacterAtAnyEvent: true }),
      []
    )
    expect(ids(results)).not.toContain('place-character')
  })

  it('does NOT fire when events === 0', () => {
    const results = evaluateSuggestions(
      world({ eventCount: 0, hasCharacterAtAnyEvent: false }),
      []
    )
    expect(ids(results)).not.toContain('place-character')
  })
})

// ── SUGG-05: add-relationships ────────────────────────────────────────────────

describe('SUGG-05 — add-relationships rule', () => {
  it('fires when chars >= 2 AND rels === 0', () => {
    const results = evaluateSuggestions(
      world({ characterCount: 2, relationshipCount: 0 }),
      []
    )
    expect(ids(results)).toContain('add-relationships')
  })

  it('does NOT fire when chars < 2', () => {
    const results = evaluateSuggestions(
      world({ characterCount: 1, relationshipCount: 0 }),
      []
    )
    expect(ids(results)).not.toContain('add-relationships')
  })

  it('does NOT fire when rels > 0', () => {
    const results = evaluateSuggestions(
      world({ characterCount: 3, relationshipCount: 1 }),
      []
    )
    expect(ids(results)).not.toContain('add-relationships')
  })
})

// ── SUGG-06: add-map ──────────────────────────────────────────────────────────

describe('SUGG-06 — add-map rule', () => {
  it('fires when events > 0 AND maps === 0', () => {
    const results = evaluateSuggestions(
      world({ characterCount: 1, eventCount: 1, mapLayerCount: 0 }),
      []
    )
    expect(ids(results)).toContain('add-map')
  })

  it('does NOT fire when maps > 0', () => {
    const results = evaluateSuggestions(
      world({ eventCount: 1, mapLayerCount: 1 }),
      []
    )
    expect(ids(results)).not.toContain('add-map')
  })

  it('does NOT fire when events === 0', () => {
    const results = evaluateSuggestions(
      world({ eventCount: 0, mapLayerCount: 0 }),
      []
    )
    expect(ids(results)).not.toContain('add-map')
  })
})

// ── SUGG-07: document-lore boundary ──────────────────────────────────────────

describe('SUGG-07 — document-lore boundary', () => {
  it('does NOT fire at exactly 4 events', () => {
    const results = evaluateSuggestions(
      world({ eventCount: 4, lorePageCount: 0 }),
      []
    )
    expect(ids(results)).not.toContain('document-lore')
  })

  it('fires at exactly 5 events (boundary)', () => {
    // Use a world where other higher-priority rules do NOT match so document-lore reaches the cap
    const results = evaluateSuggestions(
      world({
        characterCount: 1,            // avoids add-character
        eventCount: 5,
        hasCharacterAtAnyEvent: true, // avoids place-character
        mapLayerCount: 1,             // avoids add-map
        lorePageCount: 0,
      }),
      []
    )
    expect(ids(results)).toContain('document-lore')
  })

  it('does NOT fire when lore pages exist', () => {
    const results = evaluateSuggestions(
      world({ eventCount: 10, lorePageCount: 1 }),
      []
    )
    expect(ids(results)).not.toContain('document-lore')
  })
})

// ── SUGG-08: add-factions boundary ───────────────────────────────────────────

describe('SUGG-08 — add-factions boundary', () => {
  it('does NOT fire at 2 characters', () => {
    const results = evaluateSuggestions(
      world({ characterCount: 2, factionCount: 0 }),
      []
    )
    expect(ids(results)).not.toContain('add-factions')
  })

  it('fires at exactly 3 characters (boundary)', () => {
    // Need to dismiss other rules that would take the cap first
    const results = evaluateSuggestions(
      world({ characterCount: 3, eventCount: 1, hasCharacterAtAnyEvent: true, factionCount: 0 }),
      []
    )
    expect(ids(results)).toContain('add-factions')
  })

  it('does NOT fire when factions exist', () => {
    const results = evaluateSuggestions(
      world({ characterCount: 5, factionCount: 1 }),
      []
    )
    expect(ids(results)).not.toContain('add-factions')
  })
})

// ── SUGG-09: cap at MAX_SUGGESTIONS ──────────────────────────────────────────

describe('SUGG-09 — cap at MAX_SUGGESTIONS (3)', () => {
  it('MAX_SUGGESTIONS is 3', () => {
    expect(MAX_SUGGESTIONS).toBe(3)
  })

  it('never returns more than 3 suggestions', () => {
    // Empty world — add-character fires (1 rule).
    // With chars=2, events=0: add-first-event (char>0, events=0) fires, add-relationships fires
    // With chars=2, events=0, maps=0: add-map does NOT fire (events=0)
    // Simulate a world where many rules could fire: chars=3, events=5, hasSnap=false, rels=0, maps=0, lore=0, factions=0
    const results = evaluateSuggestions(
      world({ characterCount: 3, eventCount: 5, hasCharacterAtAnyEvent: false, relationshipCount: 0, mapLayerCount: 0, lorePageCount: 0, factionCount: 0 }),
      []
    )
    expect(results.length).toBeLessThanOrEqual(MAX_SUGGESTIONS)
  })

  it('returns exactly 3 when 4+ rules match', () => {
    // place-character (events>0, noSnap), add-relationships (chars>=2, rels=0), add-map (events>0, maps=0), document-lore (events>=5, lore=0)
    const results = evaluateSuggestions(
      world({ characterCount: 3, eventCount: 5, hasCharacterAtAnyEvent: false, relationshipCount: 0, mapLayerCount: 0, lorePageCount: 0, factionCount: 0 }),
      []
    )
    expect(results.length).toBe(3)
  })
})

// ── SUGG-10/11: Dismissal ─────────────────────────────────────────────────────

describe('SUGG-10/11 — dismissal', () => {
  it('SUGG-10: dismissed rule is excluded', () => {
    const results = evaluateSuggestions(
      world({ eventCount: 5, lorePageCount: 0 }),
      ['document-lore']
    )
    expect(ids(results)).not.toContain('document-lore')
  })

  it('SUGG-11: multiple dismissed rules are all excluded', () => {
    const results = evaluateSuggestions(
      world({ characterCount: 3, eventCount: 5, lorePageCount: 0, factionCount: 0 }),
      ['document-lore', 'add-factions']
    )
    expect(ids(results)).not.toContain('document-lore')
    expect(ids(results)).not.toContain('add-factions')
  })

  it('dismissed rules that do not match are harmless', () => {
    const results = evaluateSuggestions(world({ characterCount: 0 }), ['ghost-id'])
    expect(ids(results)).toContain('add-character')
  })
})

// ── SUGG-12: Priority order ───────────────────────────────────────────────────

describe('SUGG-12 — priority order preserved', () => {
  it('rules appear in array-definition order', () => {
    const ruleOrder = SUGGESTION_RULES.map((r) => r.id)
    expect(ruleOrder[0]).toBe('add-character')
    expect(ruleOrder[1]).toBe('add-first-event')
    expect(ruleOrder[2]).toBe('place-character')
    expect(ruleOrder[3]).toBe('add-relationships')
    expect(ruleOrder[4]).toBe('add-map')
    expect(ruleOrder[5]).toBe('document-lore')
    expect(ruleOrder[6]).toBe('add-factions')
  })

  it('add-character appears before add-first-event when both could apply (impossible, but order contract holds)', () => {
    const idx = (id: string) => SUGGESTION_RULES.findIndex((r) => r.id === id)
    expect(idx('add-character')).toBeLessThan(idx('add-first-event'))
    expect(idx('add-first-event')).toBeLessThan(idx('place-character'))
    expect(idx('place-character')).toBeLessThan(idx('add-relationships'))
  })

  it('high-priority rules take the cap slots over low-priority ones', () => {
    // chars=2, events=1, noSnap, rels=0, maps=0, lore=0 → 4 matching rules:
    // place-character, add-relationships, add-map, (document-lore needs 5 events)
    // Top 3 by priority should be: place-character, add-relationships, add-map
    const results = evaluateSuggestions(
      world({ characterCount: 2, eventCount: 1, hasCharacterAtAnyEvent: false, relationshipCount: 0, mapLayerCount: 0 }),
      []
    )
    expect(ids(results)).toEqual(['place-character', 'add-relationships', 'add-map'])
  })
})

// ── SUGG-13: Non-dismissible rules do not have dismissible: true ──────────────

describe('SUGG-13 — dismissible contract', () => {
  it('add-character is not dismissible', () => {
    const rule = SUGGESTION_RULES.find((r) => r.id === 'add-character')!
    expect(rule.dismissible).toBe(false)
  })

  it('add-first-event is not dismissible', () => {
    const rule = SUGGESTION_RULES.find((r) => r.id === 'add-first-event')!
    expect(rule.dismissible).toBe(false)
  })

  it('place-character is not dismissible', () => {
    const rule = SUGGESTION_RULES.find((r) => r.id === 'place-character')!
    expect(rule.dismissible).toBe(false)
  })

  it('add-relationships is not dismissible', () => {
    const rule = SUGGESTION_RULES.find((r) => r.id === 'add-relationships')!
    expect(rule.dismissible).toBe(false)
  })

  it('add-map is not dismissible', () => {
    const rule = SUGGESTION_RULES.find((r) => r.id === 'add-map')!
    expect(rule.dismissible).toBe(false)
  })

  it('document-lore is dismissible', () => {
    const rule = SUGGESTION_RULES.find((r) => r.id === 'document-lore')!
    expect(rule.dismissible).toBe(true)
  })

  it('add-factions is dismissible', () => {
    const rule = SUGGESTION_RULES.find((r) => r.id === 'add-factions')!
    expect(rule.dismissible).toBe(true)
  })
})

// ── SUGG-14: Empty world shows only add-character ────────────────────────────

describe('SUGG-14 — empty world', () => {
  it('shows only add-character for a brand-new world', () => {
    const results = evaluateSuggestions(world(), [])
    expect(ids(results)).toEqual(['add-character'])
  })
})

// ── SUGG-15: Fully built world shows 0 suggestions ───────────────────────────

describe('SUGG-15 — fully built world', () => {
  it('shows no suggestions when all conditions are satisfied', () => {
    const results = evaluateSuggestions(
      world({
        characterCount:         5,
        eventCount:             10,
        hasCharacterAtAnyEvent: true,
        relationshipCount:      3,
        mapLayerCount:          2,
        lorePageCount:          1,
        factionCount:           1,
      }),
      []
    )
    expect(results).toHaveLength(0)
  })
})

// ── Dismissal does not affect non-matching rules ──────────────────────────────

describe('cap-after-dismiss behaviour', () => {
  it('dismissing a rule frees a slot for the next matching rule', () => {
    // With chars=2, events=1, noSnap, rels=0, maps=0:
    // Matching (in order): place-character, add-relationships, add-map
    // Cap = 3, so all three appear. Dismiss place-character:
    // Now: add-relationships, add-map, … (no 4th rule matches)
    const results = evaluateSuggestions(
      world({ characterCount: 2, eventCount: 1, hasCharacterAtAnyEvent: false, relationshipCount: 0, mapLayerCount: 0 }),
      ['place-character']
    )
    expect(ids(results)).not.toContain('place-character')
    expect(ids(results)).toContain('add-relationships')
    expect(ids(results)).toContain('add-map')
  })
})
