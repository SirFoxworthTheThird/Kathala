import { describe, it, expect } from 'vitest'
import { HEADER_SYNTAX, HEADER_WORDS } from '@/lib/headerSyntax'
import { parseSceneHeader, type SceneHeader } from '@/lib/sceneHeader'
import { readWhen } from '@/lib/sceneTime'
import { defaultCalendar, earthWeek } from '@/lib/calendar'
import { ITEM_CONDITIONS } from '@/lib/itemCondition'
import { LOCATION_STATUSES } from '@/lib/locationStatus'

/**
 * The cheat sheet says what each example records. Here each example is parsed
 * and held to that, so a sheet that drifts from the parser goes red — and a row
 * added without a line here goes red too.
 */
const MEANS: Record<string, Partial<SceneHeader>> = {
  '#The Drowned Chapel': { place: 'The Drowned Chapel' },
  '#The Drowned Chapel:ruined': { place: 'The Drowned Chapel', placeStatus: 'ruined' },
  // The name and its map, as written: which place that is, `placeNames` decides (placeNames.test.ts).
  '#The Kitchen (Scaur House)': { place: 'The Kitchen (Scaur House)' },
  '@@Sabine Varro': { characters: ['Sabine Varro'] },
  '@@Corwen Dask:dead': { characters: ['Corwen Dask'], dead: ['Corwen Dask'] },
  '@@Jordan Kelly:dead elsewhere': { characters: ['Jordan Kelly'], dead: ['Jordan Kelly'], elsewhere: ['Jordan Kelly'] },
  '@@Pell Okonjo:alive': { characters: ['Pell Okonjo'], alive: ['Pell Okonjo'] },
  '@@Edmund Varley:phone': { characters: ['Edmund Varley'], remote: ['Edmund Varley'] },
  '@@Strider:called Aragorn': { characters: ['Strider'], called: [{ name: 'Strider', as: 'Aragorn' }] },
  '@@Edward Hyde:is Dr Henry Jekyll': { characters: ['Edward Hyde'], reveals: [{ name: 'Edward Hyde', as: 'Dr Henry Jekyll' }] },
  '^Ash Ledger': { items: [{ name: 'Ash Ledger' }] },
  '^Ash Ledger:@Sabine Varro': { items: [{ name: 'Ash Ledger', holder: 'Sabine Varro' }] },
  '^Ash Ledger:#The Drowned Chapel': { items: [{ name: 'Ash Ledger', place: 'The Drowned Chapel' }] },
  '^Ash Ledger:damaged': { items: [{ name: 'Ash Ledger', condition: 'damaged' }] },
  '?Dask is the Notary:@Sabine Varro': { facts: [{ title: 'Dask is the Notary', learner: 'Sabine Varro' }] },
  '?Dask is the Notary:@Sabine Varro:before': { facts: [{ title: 'Dask is the Notary', learner: 'Sabine Varro', before: true }] },
  '?Dask is the Notary:reader': { facts: [{ title: 'Dask is the Notary', reader: true }] },
  '?Dask is the Notary': { facts: [{ title: 'Dask is the Notary' }] },
  '~Sabine Varro/Idris Quell:Estranged': { relations: [{ a: 'Sabine Varro', b: 'Idris Quell', label: 'Estranged' }] },
  '~Sabine Varro/Idris Quell:ended': { relations: [{ a: 'Sabine Varro', b: 'Idris Quell', label: '', ended: true }] },
  '+3 days': { when: '+3 days' },
  'same day': { when: 'same day' },
  '16 October, 2025': { when: '16 October, 2025' },
  'Thursday 16 October': { when: 'Thursday 16 October' },
  'day 412': { when: 'day 412' },
}

describe('the header cheat sheet', () => {
  const rows = HEADER_SYNTAX.flatMap((l) => l.rows.map((r) => ({ label: l.label, ...r })))

  it.each(rows)('$label: "$example" records what the sheet says', ({ label, example }) => {
    expect(MEANS[example], `no expectation for ${example}`).toBeDefined()
    // Typed on its labelled line in a block, as a writer would.
    const parsed = parseSceneHeader(`[\n  ${label}: ${example}\n]`)
    expect(parsed).toMatchObject(MEANS[example])
  })

  it('has a row for every expectation here, so neither list drifts', () => {
    expect(Object.keys(MEANS).sort()).toEqual(rows.map((r) => r.example).sort())
  })

  it('every When example is a time an Earth book reads, and what its row says', () => {
    const earth = defaultCalendar()
    const from = { calendar: { ...earth, startYear: 2025, week: earthWeek(2025) }, previousDay: 280 }
    expect(readWhen('+3 days', from)).toEqual({ days: 3 })
    expect(readWhen('same day', from)).toEqual({ days: 0 })
    expect(readWhen('16 October, 2025', from)).toEqual({ day: 288, exact: false })
    // From 8 October 2025, with no year: this year's, and a Thursday.
    expect(readWhen('Thursday 16 October', from)).toEqual({ day: 288, exact: false })
    expect(readWhen('day 412', { ...from, calendar: null })).toEqual({ day: 412, exact: true })
    const when = HEADER_SYNTAX.find((l) => l.label === 'When')!.rows.map((r) => r.example)
    expect(when).toEqual(['+3 days', 'same day', '16 October, 2025', 'Thursday 16 October', 'day 412'])
  })

  it('lists the words the parser counts after a colon', () => {
    expect([...HEADER_WORDS.itemConditions]).toEqual([...ITEM_CONDITIONS])
    expect([...HEADER_WORDS.placeStatuses]).toEqual([...LOCATION_STATUSES])
  })
})
