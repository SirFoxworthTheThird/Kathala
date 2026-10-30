import { describe, it, expect } from 'vitest'
import { accountedFor, speakers, suggestCast, withCast, SPEAKS_MIN } from '@/lib/headerSuggest'
import { parseSceneHeader, splitSceneHeader } from '@/lib/sceneHeader'

/**
 * A header line suggested from the prose (Part D1): who is in the scene, read
 * from who speaks in it, twice or more — the one kind that was right often
 * enough on the Library's books to offer (`scripts/suggest-probe.ts`).
 */

const people = [
  { id: 'bruno', name: 'Bruno Vale', aliases: [] },
  { id: 'ann', name: 'Ann Bell', aliases: [] },
  { id: 'cass', name: 'Cass Orrin', aliases: [] },
]

const prose = [
  '“The tide is turning,” said Bruno.',
  'Ann looked at the water. “Then we go now,” she said.',
  '“Not yet,” Bruno replied.',
  'Ann asked whether the boat would hold.',
  'They thought of Cass, who was in Lisbon, and Cass would have known.',
].join('\n')

describe('who speaks in a scene', () => {
  it('counts speech said of somebody named beside it, and not a name alone', () => {
    const said = speakers(prose, people)
    expect(said.get('bruno')).toBe(2)
    // "Ann looked … she said" is not said of Ann by name; "Ann asked" is.
    expect(said.get('ann')).toBe(1)
    // Named twice, said to speak never: talked about, not there.
    expect(said.has('cass')).toBe(false)
  })

  it(`offers whoever speaks ${SPEAKS_MIN} times or more, and the header does not account for`, () => {
    expect(suggestCast(prose, people, [])).toEqual(['bruno'])
    // In the cast, mentioned or there from elsewhere: accounted for, and not offered again.
    expect(suggestCast(prose, people, ['bruno'])).toEqual([])
    const more = `${prose}\n“Hold on,” Ann cried.`
    expect(suggestCast(more, people, [])).toEqual(['bruno', 'ann'])
  })
})

describe('whom the header accounts for', () => {
  const scene = { involvedCharacterIds: ['a'], mentionedCharacterIds: ['b'], remoteCharacterIds: ['c'], povCharacterId: 'd' }
  it('is the cast, the mentioned, those there from elsewhere, the point of view, and those set aside', () => {
    expect(accountedFor(scene, [], people, ['e']).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('and whoever the line names, applied or not, by name in any case', () => {
    expect(accountedFor({ involvedCharacterIds: [] }, ['bruno vale', 'Nobody Known'], people)).toEqual(['bruno'])
    // So typing them on the line takes the offer away before the line is left.
    expect(suggestCast(prose, people, accountedFor({ involvedCharacterIds: [] }, ['Bruno Vale'], people))).toEqual([])
    expect(suggestCast(prose, people, accountedFor({ involvedCharacterIds: [] }, [], people))).toEqual(['bruno'])
  })
})

describe('adding the suggestion to the header', () => {
  const names = ['Bruno Vale', 'Ann Bell']
  const cast = (header: string) => parseSceneHeader(splitSceneHeader(`${header}\n\nProse.`).header!).characters

  it('makes a line where there is no header', () => {
    expect(withCast(null, names)).toBe('[@@Bruno Vale @@Ann Bell]')
    expect(cast(withCast(null, names))).toEqual(names)
  })

  it('adds to a one-line header, keeping what it said', () => {
    const line = withCast('[#The Quay @@Cass Orrin ^The Ledger]', names)
    expect(line).toBe('[#The Quay @@Cass Orrin ^The Ledger @@Bruno Vale @@Ann Bell]')
    const read = parseSceneHeader(splitSceneHeader(`${line}\n\nProse.`).header!)
    expect(read.place).toBe('The Quay')
    expect(read.characters).toEqual(['Cass Orrin', ...names])
    expect(read.items?.map((i) => i.name)).toEqual(['The Ledger'])
  })

  it('adds to a block’s Characters line, or makes one after its Place', () => {
    const withLine = withCast('[\n  Place: #The Quay\n  Characters: @@Cass Orrin\n]', names)
    expect(withLine).toBe('[\n  Place: #The Quay\n  Characters: @@Cass Orrin @@Bruno Vale @@Ann Bell\n]')
    expect(cast(withLine)).toEqual(['Cass Orrin', ...names])
    const without = withCast('[\n  Place: #The Quay\n  Items: ^The Ledger\n]', names)
    expect(without).toBe('[\n  Place: #The Quay\n  Characters: @@Bruno Vale @@Ann Bell\n  Items: ^The Ledger\n]')
    expect(cast(without)).toEqual(names)
  })
})
