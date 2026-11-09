import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { EMPTY_DETAILS, keepSubmissionDetails, readSubmissionDetails } from '@/lib/submissionDetails'
import { serializeWorldForSync } from '@/lib/exportImport'
import { createWorld } from '@/db/hooks/useWorlds'

describe('the writer’s details for a Word export', () => {
  beforeEach(() => localStorage.clear())

  it('are remembered per book, and start empty', () => {
    expect(readSubmissionDetails('w1')).toEqual(EMPTY_DETAILS)
    const mine = { name: 'Ines Varga', legalName: '', contact: '12 Quay Lane', wordCount: '12,700', font: 'courier' as const, paper: 'a4' as const, layout: 'submission' as const, forEditing: true }
    keepSubmissionDetails('w1', mine)
    expect(readSubmissionDetails('w1')).toEqual(mine)
    expect(readSubmissionDetails('w2')).toEqual(EMPTY_DETAILS)
  })

  it('read what is stored as it should be, whatever else is there', () => {
    localStorage.setItem('kathala-submission:w1', JSON.stringify({ name: 7, font: 'comic sans', paper: 'a4', layout: 'poster' }))
    expect(readSubmissionDetails('w1')).toEqual({ ...EMPTY_DETAILS, paper: 'a4' })
    localStorage.setItem('kathala-submission:w1', '{not json')
    expect(readSubmissionDetails('w1')).toEqual(EMPTY_DETAILS)
  })

  it('stay out of the book’s backup, which carries what it is meant to from the same place', async () => {
    const world = await createWorld({ name: 'The Salt Ledger', description: '' })
    keepSubmissionDetails(world.id, { ...EMPTY_DETAILS, name: 'Ines Varga', contact: '12 Quay Lane\nines@example.com' })
    // A key a backup does carry from this browser: the relationship graph's positions.
    localStorage.setItem(`wb-rel-pos-${world.id}`, JSON.stringify({ a: { x: 1, y: 2 } }))
    const backup = await serializeWorldForSync(world.id)
    expect(JSON.parse(backup).relationshipPositions).toEqual({ a: { x: 1, y: 2 } })
    expect(backup).not.toContain('Quay Lane')
    expect(backup).not.toContain('ines@example.com')
  })
})
