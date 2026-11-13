import { describe, it, expect } from 'vitest'
import { shownChange, withEmphasis, type Run } from '@/lib/docxEdits'

/*
  A change's surroundings in Changes, with their italics as the Page shows them
  (round-trip-plan-3.md, T11.4). In the second loop they showed the marks:
  *Heron — 6th —…, the note Tamsin writes, in italics on the Page.
*/

const shown = (runs: Run[]) => runs.map((r) => (r.italic ? `<${r.text}>` : r.text)).join('')

describe('withEmphasis', () => {
  it('the run’s sentence: its mark opens before the shown stretch ends, and the words after it are in italics', () => {
    const line = 'she tore a scrap off the corner of the abstract and wrote on it *Heron — 6th — inner basin — ask Pell*, and folded it small'
    // As Changes cut it: the words before a change, ending inside the italics.
    const lead = line.slice(0, line.indexOf(' inner basin'))
    expect(withEmphasis([lead]).map(shown)).toEqual(['she tore a scrap off the corner of the abstract and wrote on it <Heron — 6th —>'])
    // The surroundings and the change read together: a mark before the change closes after it.
    const before = 'wrote on it *Heron — 6th — inner basin — ask Pell*, and folded'
    const after = before.replace('inner basin', 'the inner basin')
    const c = shownChange(before, after)
    const [l, out, tail] = withEmphasis([c.lead, c.out, c.tail])
    const [, into] = withEmphasis([c.lead, c.in, c.tail])
    expect([shown(l), shown(out), shown(into), shown(tail)]).toEqual(['wrote on it <Heron — 6th — >', '', '<the >', '<inner basin — ask Pell>, and folded'])
  })

  it('a stretch cut inside italics: a first mark that can only close says it began in them', () => {
    expect(withEmphasis(['6th — inner basin — ask Pell*, and folded it small']).map(shown)).toEqual(['<6th — inner basin — ask Pell>, and folded it small'])
    // Known from the text cut off before it, which is read and not returned.
    expect(withEmphasis(['6th — ask Pell*, and folded'], 'wrote on it *Heron — ').map(shown)).toEqual(['<6th — ask Pell>, and folded'])
    expect(withEmphasis(['and folded it small'], 'wrote on it *Heron*, ').map(shown)).toEqual(['and folded it small'])
    // No mark in the stretch at all: only the text cut off says it is in italics.
    expect(withEmphasis(['6th — inner basin'], 'wrote on it *Heron — ').map(shown)).toEqual(['<6th — inner basin>'])
    expect(withEmphasis(['6th — inner basin']).map(shown)).toEqual(['6th — inner basin'])
  })

  it('underscores too, a mark closed only by its own kind, and a mark inside a word a character', () => {
    expect(withEmphasis(['She read _The Constance_ twice.']).map(shown)).toEqual(['She read <The Constance> twice.'])
    // An underscore that could close, inside a star's italics: a character.
    expect(withEmphasis(['a *one_ two* b']).map(shown)).toEqual(['a <one_ two> b'])
    expect(withEmphasis(['the snake_case name, 2*3 = 6']).map(shown)).toEqual(['the snake_case name, 2*3 = 6'])
    // A mark with space both sides is a character.
    expect(withEmphasis(['five * six']).map(shown)).toEqual(['five * six'])
    // Several italics in one line, and a stop before a closing mark.
    expect(withEmphasis(['*Heron* and *Gull.* Both lost.']).map(shown)).toEqual(['<Heron> and <Gull.> Both lost.'])
  })

  it('pieces empty or wholly marks come back empty, and the pieces keep their own text', () => {
    expect(withEmphasis(['', 'plain', '']).map(shown)).toEqual(['', 'plain', ''])
    expect(withEmphasis(['the ', '*', 'Heron', '*', ' sank']).map(shown)).toEqual(['the ', '', '<Heron>', '', ' sank'])
  })
})
