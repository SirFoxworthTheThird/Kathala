import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { keepAuditFindings } from '@/db/hooks/useAuditFindings'
import { deleteWorld } from '@/db/hooks/useWorlds'

/** What an AI audit kept: a second audit supersedes the first, and a world takes its findings with it. */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

const finding = (title: string) => ({ title, severity: 'minor' as const, why: '', quotes: [{ text: 'a quote here', eventId: 'e1' }] })

describe('keepAuditFindings', () => {
  it('keeps a new audit’s findings in place of the last one’s, for that world only, in the order given', async () => {
    await keepAuditFindings('w', [finding('First audit, one'), finding('First audit, two')])
    await keepAuditFindings('other', [finding('Another book')])
    await keepAuditFindings('w', [finding('Second audit, one'), finding('Second audit, two')])
    expect((await db.auditFindings.where('worldId').equals('w').sortBy('createdAt')).map((f) => f.title))
      .toEqual(['Second audit, one', 'Second audit, two'])
    expect((await db.auditFindings.where('worldId').equals('other').toArray()).map((f) => f.title)).toEqual(['Another book'])
  })

  it('a chapter’s audit replaces only what was found in that chapter (Part F3)', async () => {
    const at = (title: string, eventId: string) => ({ title, severity: 'minor' as const, why: '', quotes: [{ text: 'a quote here', eventId }, { text: 'and there', eventId: 'e1' }] })
    await keepAuditFindings('w', [at('In chapter 3', 'e3'), at('In chapter 5', 'e5'), at('Only chapter 1', 'e1')])
    // Chapter 5 is e5: its finding goes, the rest stand — chapter 1's too, though e1 is quoted beside e5.
    await keepAuditFindings('w', [at('Chapter 5, again', 'e5')], new Set(['e5']))
    // Which stand, not in what order: the two audits here are written in the same millisecond.
    expect((await db.auditFindings.where('worldId').equals('w').toArray()).map((f) => f.title).sort())
      .toEqual(['Chapter 5, again', 'In chapter 3', 'Only chapter 1'])
  })

  it('and an audit that kept nothing leaves nothing', async () => {
    await keepAuditFindings('w', [finding('First audit')])
    await keepAuditFindings('w', [])
    expect(await db.auditFindings.where('worldId').equals('w').count()).toBe(0)
  })
})

describe('deleteWorld', () => {
  it('deletes the world’s audit findings and no other world’s', async () => {
    await db.worlds.add({ id: 'w', name: 'Gone', description: '', coverImageId: null, createdAt: 0, updatedAt: 0 } as never)
    await keepAuditFindings('w', [finding('Goes with it')])
    await keepAuditFindings('other', [finding('Stays')])
    await deleteWorld('w')
    expect(await db.auditFindings.where('worldId').equals('w').count()).toBe(0)
    expect(await db.auditFindings.where('worldId').equals('other').count()).toBe(1)
  })
})
