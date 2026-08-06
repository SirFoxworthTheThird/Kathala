import { describe, it, expect } from 'vitest'
import { eventStatusConfig, EVENT_STATUS_CONFIG, EVENT_STATUSES } from '@/lib/eventStatus'
import { goalTypeConfig, GOAL_TYPE_CONFIG, GOAL_TYPES } from '@/lib/characterGoals'

/**
 * Reading a `.pwk` we did not write.
 *
 * `validateImport` checks that arrays are arrays and that the world has an id.
 * It never inspects an enum value, so every `status`, `type` and `sentiment` in
 * an imported world is whatever the file said — and the types claiming
 * otherwise are what made this easy to miss. The shipped Dracula example
 * carried a goal typed "escape" for months; `GOAL_TYPE_CONFIG[goal.type].label`
 * threw on it and took the Goals tab down.
 */

describe('eventStatusConfig', () => {
  it('returns the real config for a status the app knows', () => {
    for (const s of EVENT_STATUSES) {
      expect(eventStatusConfig(s)).toBe(EVENT_STATUS_CONFIG[s])
    }
  })

  it('survives anything a file might carry, and never returns undefined', () => {
    for (const bad of ['published', '', '   ', 'DRAFT', null, undefined, 42, {}, [], true]) {
      const cfg = eventStatusConfig(bad)
      expect(cfg, String(bad)).toBeDefined()
      expect(typeof cfg.label).toBe('string')
      expect(typeof cfg.color).toBe('string')
      expect(typeof cfg.textColor).toBe('string')
    }
  })

  it('shows an unknown status as itself rather than relabelling it', () => {
    // Calling someone's "published" a "Draft" is a lie they cannot see through.
    expect(eventStatusConfig('published').label).toBe('published')
    expect(eventStatusConfig('  spaced  ').label).toBe('spaced')
    expect(eventStatusConfig(null).label).toBe('Unknown')
  })

  it('is not fooled by inherited keys', () => {
    // `'toString' in EVENT_STATUS_CONFIG` is true through the prototype chain,
    // so a membership test written that way hands back a function to read
    // `.label` off — a crash from a status of "toString".
    for (const key of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
      const cfg = eventStatusConfig(key)
      expect(typeof cfg.label, key).toBe('string')
      expect(cfg.label, key).toBe(key === '__proto__' ? '__proto__' : key)
    }
  })
})

describe('goalTypeConfig', () => {
  it('returns the real config for a type the app knows', () => {
    for (const t of GOAL_TYPES) {
      expect(goalTypeConfig(t)).toBe(GOAL_TYPE_CONFIG[t])
    }
  })

  it('survives the value that actually shipped, and anything else', () => {
    // "escape" is what was in Dracula.pwk.
    expect(goalTypeConfig('escape').label).toBe('escape')
    for (const bad of ['escape', '', null, undefined, 7, {}, 'toString']) {
      const cfg = goalTypeConfig(bad)
      expect(cfg, String(bad)).toBeDefined()
      expect(typeof cfg.label).toBe('string')
      expect(typeof cfg.color).toBe('string')
      expect(typeof cfg.hint).toBe('string')
    }
  })
})
