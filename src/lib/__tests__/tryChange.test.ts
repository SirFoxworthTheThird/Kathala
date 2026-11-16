import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx } from '@/lib/docxRead'
import { alreadyMade, planImport, tryChange } from '@/lib/docxImport'
import type { DraftBook } from '@/lib/bookDraft'

/*
  A change says before the click whether it can be made (round-trip-plan-3.md,
  T11.1). In the second loop the writer typed one of the editor's changes in by
  hand — "four hours in the rain" made "all morning, and the last of it in the
  rain," — and the change then waited in the list for ever: Accept refused it,
  since its old words were gone, and only Reject cleared it (the writer's F6).
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-12-loop2')
const draft = (n: string) => (JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as { book: DraftBook }).book
const textOf = (n: string, id: string) => draft(n).chapters.flatMap((c) => c.scenes).find((s) => s.id === id)!.text

describe('tryChange: what accepting a change would do', () => {
  it('the run’s "four hours in the rain": made, as it went; already made, as the writer had it by then; gone, rewritten again', async () => {
    const read = await readEditedDocx(new Uint8Array(readFileSync(path.join(F, 'round1-from-editor.docx'))))
    const plan = planImport(read, draft('sent-1'), draft('sent-1'))
    const scene = plan.scenes.find((s) => s.tracked.some((h) => h.before.includes('four hours')))!
    const change = scene.tracked.find((h) => h.before.includes('four hours'))!
    expect([change.before.trim(), change.after.trim()]).toEqual(['four hours in the rain', 'all morning, and the last of it in the rain,'])
    const row = { ...change, eventId: scene.eventId }
    // As the book went out: it can be made, and made it reads as the editor's file does.
    const asItWent = tryChange([row], () => textOf('sent-1', scene.eventId))
    expect(asItWent.result).toBe('ok')
    expect(asItWent.result === 'ok' && asItWent.after.get(scene.eventId)).toContain('all morning, and the last of it in the rain,')
    // As the writer had it by the next round, the editor's words typed in by hand: already made.
    expect(tryChange([row], () => textOf('marked-2', scene.eventId)).result).toBe('made')
    // Those words rewritten again: neither.
    const again = textOf('marked-2', scene.eventId).replace('all morning, and the last of it in the rain,', 'since the tide turned,')
    expect(tryChange([row], () => again).result).toBe('gone')
  })

  it('already made: its new words where its old ones were, with the words around them; not the same words somewhere else', () => {
    const hunk = { before: 'dawn.', after: 'dawn in the rain.', prefix: 'Mira left before ', suffix: '\n\nThe road was hers.' }
    expect(alreadyMade('Mira left before dawn in the rain.\n\nThe road was hers.', hunk)).toBe(true)
    // Its words, elsewhere in the scene: not this change made.
    expect(alreadyMade('Mira left at noon.\n\nIt was dawn in the rain.', hunk)).toBe(false)
    const row = { ...hunk, eventId: 'e' }
    expect(tryChange([row], () => 'Mira left at noon.\n\nIt was dawn in the rain.').result).toBe('gone')
    // A cut: made where the words either side now meet.
    const cut = { before: ' twice', after: '', prefix: 'Mira counted', suffix: ' the crates.' }
    expect(tryChange([{ ...cut, eventId: 'e' }], () => 'Mira counted the crates.').result).toBe('made')
    expect(tryChange([{ ...cut, eventId: 'e' }], () => 'Mira counted twice the crates.').result).toBe('ok')
  })

  it('a move is made whole or not at all: both halves already made is made; one half alone is neither', () => {
    // As bringing a file in makes a move's halves: each with a word either side of what moved (editImport.test.ts).
    const from = { before: 'left. The road was long.', after: 'left.', prefix: 'Mira ', suffix: ' She went.', eventId: 'e' }
    const to = { before: 'went.', after: 'went. The road was long.', prefix: 'She ', suffix: ' Then home.', eventId: 'e' }
    const made = tryChange([from, to], () => 'Mira left. The road was long. She went. Then home.')
    expect(made.result === 'ok' && made.after.get('e')).toBe('Mira left. She went. The road was long. Then home.')
    expect(tryChange([from, to], () => 'Mira left. She went. The road was long. Then home.').result).toBe('made')
    // Taken out by hand and not put in again.
    expect(tryChange([from, to], () => 'Mira left. She went. Then home.').result).toBe('gone')
  })

  it('a change with no scene is gone', () => {
    expect(tryChange([{ before: 'a', after: 'b', prefix: '', suffix: '', eventId: null }], () => 'a').result).toBe('gone')
  })
})
