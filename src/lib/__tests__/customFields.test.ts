import { describe, it, expect } from 'vitest'
import { checkValue, fieldKey, fieldMatches, fieldValueId, shapeProblem, showValue, TEMPLATES, templateFields } from '@/lib/customFields'
import { fieldCarries, fieldsAt, stateAt } from '@/lib/stateAt'
import { storyOf } from '@/lib/stateEngine'
import type { CustomFieldDef, FieldValue, WorldCalendar } from '@/types'

/**
 * Custom fields (issue #699, custom-fields-plan.md): a value is checked
 * against its field's type and refused otherwise (D-6); it is shown as the
 * writer reads it; and a value over time is read at a scene as its entity's
 * state is, carried by its entity's rule (D-4).
 */

const def = (over: Partial<CustomFieldDef>): CustomFieldDef => ({
  id: 'd', worldId: 'w', kind: 'character', name: 'Field', type: 'text', overTime: false, order: 0, createdAt: 0, updatedAt: 0, ...over,
})

const calendar: WorldCalendar = {
  startYear: 300, yearSuffix: 'AL',
  months: [{ name: 'Thaw', days: 30 }, { name: 'Yield', days: 28 }],
}

describe('a value is checked against its field’s type', () => {
  it('text is one line, long text is any; either empty is no value', () => {
    expect(checkValue(def({ type: 'text' }), '  Fire  ')).toEqual({ ok: true, value: 'Fire' })
    expect(checkValue(def({ type: 'text', name: 'Magic' }), 'Fire\nand ice')).toEqual({ ok: false, reason: 'Magic: this field takes one line.' })
    expect(checkValue(def({ type: 'longText' }), 'At the inn\nall night.  ')).toEqual({ ok: true, value: 'At the inn\nall night.' })
    expect(checkValue(def({ type: 'text' }), '   ')).toEqual({ ok: true, value: null })
    expect(checkValue(def({ type: 'longText' }), '\n\n')).toEqual({ ok: true, value: null })
    expect(checkValue(def({ type: 'text' }), 12).ok).toBe(false)
  })

  it('a number is finite', () => {
    expect(checkValue(def({ type: 'number' }), 120)).toEqual({ ok: true, value: 120 })
    expect(checkValue(def({ type: 'number' }), -0.5)).toEqual({ ok: true, value: -0.5 })
    for (const bad of [NaN, Infinity, '120', true]) expect(checkValue(def({ type: 'number' }), bad).ok, String(bad)).toBe(false)
  })

  it('a choice is one of its options, by id; several are without repeats', () => {
    const options = [{ id: 'o1', label: 'Elf' }, { id: 'o2', label: 'Dwarf' }]
    expect(checkValue(def({ type: 'choice', options }), 'o2')).toEqual({ ok: true, value: 'o2' })
    expect(checkValue(def({ type: 'choice', options }), 'Dwarf').ok).toBe(false)
    expect(checkValue(def({ type: 'choice', options }), '')).toEqual({ ok: true, value: null })
    expect(checkValue(def({ type: 'choices', options }), ['o1', 'o2'])).toEqual({ ok: true, value: ['o1', 'o2'] })
    expect(checkValue(def({ type: 'choices', options }), [])).toEqual({ ok: true, value: null })
    expect(checkValue(def({ type: 'choices', options, name: 'Race' }), ['o1', 'o1'])).toEqual({ ok: false, reason: 'Race: a choice is picked twice.' })
    expect(checkValue(def({ type: 'choices', options }), ['o3']).ok).toBe(false)
    expect(checkValue(def({ type: 'choices', options }), 'o1').ok).toBe(false)
  })

  it('yes or no is a boolean; a link is an id', () => {
    expect(checkValue(def({ type: 'yesNo' }), false)).toEqual({ ok: true, value: false })
    expect(checkValue(def({ type: 'yesNo' }), 'no').ok).toBe(false)
    expect(checkValue(def({ type: 'link', linkKind: 'faction' }), 'f1')).toEqual({ ok: true, value: 'f1' })
    expect(checkValue(def({ type: 'link', linkKind: 'faction' }), 'the Compact').ok).toBe(false)
    expect(checkValue(def({ type: 'link', linkKind: 'faction' }), 3).ok).toBe(false)
  })

  it('a date is in the world’s calendar where it has one, and a real ISO day where it has none', () => {
    expect(checkValue(def({ type: 'date' }), { year: 310, month: 1, day: 28 }, calendar)).toEqual({ ok: true, value: { year: 310, month: 1, day: 28 } })
    expect(checkValue(def({ type: 'date', name: 'Founded' }), { year: 310, month: 1, day: 29 }, calendar)).toEqual({ ok: false, reason: 'Founded: Yield has no day 29 that year.' })
    expect(checkValue(def({ type: 'date' }), { year: 310, month: 2, day: 1 }, calendar).ok).toBe(false)
    expect(checkValue(def({ type: 'date' }), '0310-02-01', calendar).ok).toBe(false)
    expect(checkValue(def({ type: 'date' }), '1847-03-12')).toEqual({ ok: true, value: '1847-03-12' })
    expect(checkValue(def({ type: 'date' }), '1847-02-30').ok).toBe(false)
    expect(checkValue(def({ type: 'date' }), { year: 1847, month: 2, day: 12 }).ok).toBe(false)
  })

  it('no value is always allowed: it clears', () => {
    for (const type of ['text', 'number', 'choice', 'date', 'link', 'yesNo'] as const) expect(checkValue(def({ type }), null)).toEqual({ ok: true, value: null })
  })
})

describe('a value as the writer reads it', () => {
  it('a number with its unit, a choice by its label, a link by its name, a date in the calendar', () => {
    expect(showValue(def({ type: 'number', unit: 'souls' }), 1240)).toBe('1,240 souls')
    expect(showValue(def({ type: 'number' }), 3.5)).toBe('3.5')
    const options = [{ id: 'o1', label: 'Elf' }, { id: 'o2', label: 'Dwarf' }]
    expect(showValue(def({ type: 'choice', options }), 'o2')).toBe('Dwarf')
    expect(showValue(def({ type: 'choices', options }), ['o2', 'o1'])).toBe('Dwarf, Elf')
    expect(showValue(def({ type: 'yesNo' }), false)).toBe('No')
    const names = { f1: 'The Compact' } as Record<string, string>
    expect(showValue(def({ type: 'link', linkKind: 'faction' }), 'f1', { nameOf: (_k, id) => names[id] })).toBe('The Compact')
    expect(showValue(def({ type: 'date' }), { year: 310, month: 1, day: 3 }, { calendar })).toBe('3 Yield, 310 AL')
    expect(showValue(def({ type: 'date' }), '1847-03-12')).toBe('12 March 1847')
  })

  it('says nothing for an option taken out, a link to what is gone, or no value', () => {
    const options = [{ id: 'o1', label: 'Elf' }]
    expect(showValue(def({ type: 'choice', options }), 'gone')).toBeNull()
    expect(showValue(def({ type: 'choices', options }), ['gone'])).toBeNull()
    expect(showValue(def({ type: 'link', linkKind: 'character' }), 'nobody', { nameOf: () => undefined })).toBeNull()
    expect(showValue(def({ type: 'text' }), null)).toBeNull()
    expect(showValue(def({ type: 'text' }), undefined)).toBeNull()
  })
})

describe('a field’s shape', () => {
  it('needs a name, choices for a choice, and a kind for a link', () => {
    expect(shapeProblem({ name: ' ', type: 'text' })).toBe('A field needs a name.')
    expect(shapeProblem({ name: 'Race', type: 'choice', options: [] })).toBe('A choice field needs its choices, each with a name.')
    expect(shapeProblem({ name: 'Race', type: 'choice', options: ['Elf', ' elf '] })).toBe('Two choices have the same name.')
    expect(shapeProblem({ name: 'Captain', type: 'link' })).toBe('A link field needs the kind of record it links to.')
    expect(shapeProblem({ name: 'Captain', type: 'link', linkKind: 'character' })).toBeNull()
    expect(shapeProblem({ name: 'Race', type: 'choice', options: ['Elf', 'Dwarf'] })).toBeNull()
  })

  it('an id per field, entity and scene', () => {
    expect(fieldValueId('d', 'e', 's')).toBe('fv:d:e:s')
  })
})

describe('the templates', () => {
  it('are the four of D-2, each on its kind', () => {
    expect(TEMPLATES.map((t) => [t.label, t.kind, t.fields.map((f) => `${f.name}:${f.type}${f.overTime ? '*' : ''}`).join(' ')])).toEqual([
      ['Fantasy characters', 'character', 'Race:choice Magic:text Allegiance:link*'],
      ['Mystery suspects', 'character', 'Alibi:longText Motive:longText Means:text Suspicion:choice*'],
      ['Ships', 'item', 'Class:choice Crew:number Captain:link*'],
      ['Settlements', 'place', 'Population:number Ruler:link* Founded:date'],
    ])
    for (const t of TEMPLATES) for (const f of t.fields) expect(shapeProblem(f), `${t.label}: ${f.name}`).toBeNull()
  })

  it('add only the names their kind has not got', () => {
    const ships = TEMPLATES.find((t) => t.id === 'ships')!
    expect(templateFields(ships, []).map((f) => f.name)).toEqual(['Class', 'Crew', 'Captain'])
    // A character's Captain is not an item's.
    expect(templateFields(ships, [{ name: ' crew ', kind: 'item' }, { name: 'Captain', kind: 'character' }]).map((f) => f.name)).toEqual(['Class', 'Captain'])
    expect(fieldKey('  Prime   Suspect ')).toBe('prime suspect')
  })
})

describe('a value over time, read at a scene', () => {
  // Ch. 1 and 2 are 1 BL (the Mercy); ch. 3 is 311 AL (the Compact).
  const scenes = [
    { id: 'a1', chapterId: 'c1', sortOrder: 0, timelineId: 'mercy', travelDays: 1, inWorldTime: null },
    { id: 'a2', chapterId: 'c2', sortOrder: 0, timelineId: 'mercy', travelDays: 1, inWorldTime: null },
    { id: 'b1', chapterId: 'c3', sortOrder: 0, timelineId: 'compact', travelDays: 1, inWorldTime: null },
  ]
  const story = storyOf(scenes, [{ id: 'c1', number: 1 }, { id: 'c2', number: 2 }, { id: 'c3', number: 3 }], [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 113_000 }])
  const row = (defId: string, entityId: string, eventId: string, value: FieldValue['value']): FieldValue => ({
    id: fieldValueId(defId, entityId, eventId), worldId: 'w', defId, entityId, eventId, sortKey: null, value, createdAt: 0, updatedAt: 0,
  })
  const kindOf = new Map([['allegiance', 'character'], ['ruler', 'place'], ['captain', 'item']] as const)
  const at = (rows: FieldValue[], scene: string | null, keptInEra = new Set<string>()) =>
    Object.fromEntries(fieldsAt({ rows, kindOf, keptInEra }, scene, story).map((v) => [`${v.defId}|${v.entityId}`, v.value]))

  it('is the last said by then: an earlier value changes no later scene that says its own, and null is said', () => {
    const rows = [row('allegiance', 'ilse', 'a1', 'mercy-guard'), row('allegiance', 'ilse', 'a2', null)]
    expect(at(rows, 'a1')).toEqual({ 'allegiance|ilse': 'mercy-guard' })
    // Cleared at a2: no longer, which is not the same as nothing said.
    expect(at(rows, 'a2')).toEqual({ 'allegiance|ilse': null })
    expect(at([row('allegiance', 'ilse', 'a1', 'mercy-guard')], 'a2')).toEqual({ 'allegiance|ilse': 'mercy-guard' })
    // A correction at a1 does not reach a2's own word.
    expect(at([row('allegiance', 'ilse', 'a1', 'compact'), row('allegiance', 'ilse', 'a2', 'mercy-guard')], 'a2')).toEqual({ 'allegiance|ilse': 'mercy-guard' })
    // Nothing before it is said.
    expect(at(rows, null)).toEqual({ 'allegiance|ilse': null })
  })

  it('carries by its entity’s rule: a person’s in their era, a place’s across eras, an item’s unless kept in its era', () => {
    const rows = [row('allegiance', 'ilse', 'a1', 'f1'), row('ruler', 'hall', 'a1', 'ilse'), row('captain', 'ship', 'a1', 'rhee')]
    expect(at(rows, 'b1')).toEqual({ 'ruler|hall': 'ilse', 'captain|ship': 'rhee' })
    expect(at(rows, 'b1', new Set(['ship']))).toEqual({ 'ruler|hall': 'ilse' })
    expect([fieldCarries('character'), fieldCarries('place'), fieldCarries('item'), fieldCarries('item', true)]).toEqual(['person', 'thing', 'thing', 'person'])
  })

  it('a row whose field is gone is not read, and stateAt reads them with the rest', () => {
    const rows = [row('deleted', 'ilse', 'a1', 'x'), row('allegiance', 'ilse', 'a1', 'f1')]
    expect(at(rows, 'a1')).toEqual({ 'allegiance|ilse': 'f1' })
    expect(stateAt({ fields: { rows, kindOf, keptInEra: new Set() } }, 'a1', story).fields.map((f) => f.value)).toEqual(['f1'])
    expect(stateAt({}, 'a1', story).fields).toEqual([])
  })
})

describe('a search through the values', () => {
  it('finds a fixed value and one over time as they read, a choice by its label and a link by its name, and nothing a value does not show', () => {
    const race = def({ id: 'race', type: 'choice', name: 'Race', options: [{ id: 'o1', label: 'Wood elf' }] })
    const rank = def({ id: 'rank', type: 'text', name: 'Rank', overTime: true })
    const captain = def({ id: 'captain', kind: 'item', type: 'link', name: 'Captain', overTime: true, linkKind: 'character' })
    const entities = [
      { kind: 'character' as const, id: 'anna', customValues: { race: 'o1', rank: 'not this: fixed is not read for a field over time' } },
      { kind: 'item' as const, id: 'gull' },
    ]
    const overTime = new Map([['rank|anna', { value: 'Elf-friend' }], ['captain|gull', { value: 'bo' }]])
    const names = { bo: 'Bo Marren' } as Record<string, string>
    const ctx = { nameOf: (_k: string, id: string) => names[id] }
    const find = (q: string) => fieldMatches([race, rank, captain], entities, overTime, ctx, (t) => t.toLowerCase().includes(q))
      .map((m) => `${m.entityId} ${m.def.name}: ${m.text}`)
    expect(find('elf')).toEqual(['anna Race: Wood elf', 'anna Rank: Elf-friend'])
    expect(find('marren')).toEqual(['gull Captain: Bo Marren'])
    // An option id, a link id and a fixed value under a field over time are not what the writer reads.
    expect(find('o1')).toEqual([])
    expect(find('fixed is not read')).toEqual([])
    // A link that shows nothing — to someone not met yet — finds nothing.
    expect(fieldMatches([captain], entities, overTime, { nameOf: () => undefined }, () => true)).toEqual([])
  })
})
