import { describe, it, expect } from 'vitest'
import { backupSummary } from '@/lib/backupStanding'

/**
 * The sentences the app says about the only copy of somebody's book.
 *
 * The state machine underneath is tested in `folderSyncState.test.ts`; this is
 * about what a writer is told, which is the half that was missing — the chip
 * said nothing at all until a folder was already bound.
 */

const AT = Date.parse('2026-09-24T12:00:00Z')

describe('backupSummary', () => {
  it('says so when a world has no backup at all', () => {
    const s = backupSummary({ state: 'unbacked', now: AT })
    expect(s.short).toBe('Not backed up')
    expect(s.detail).toContain('only in this browser')
  })

  /*
    Deliberately not amber. Most worlds are in this state, and an alarm that is
    always on is an alarm nobody reads; the sentence does the work.
  */
  it('does not raise an alarm about it', () => {
    expect(backupSummary({ state: 'unbacked', now: AT }).tone).toBe('muted')
  })

  /**
   * **The time is the point.** "Saved" on its own is a claim with no date on
   * it: a backup that stopped three days ago says the same word as one written
   * a minute ago.
   */
  it('says when the last copy was written', () => {
    expect(backupSummary({ state: 'in-sync', lastSyncedAt: AT - 4 * 60_000, now: AT }).short)
      .toBe('Backed up 4m ago')
    expect(backupSummary({ state: 'in-sync', lastSyncedAt: AT - 3 * 3_600_000, now: AT }).short)
      .toBe('Backed up 3h ago')
  })

  it('leaves the time out rather than inventing one', () => {
    // The pair: a binding written before timestamps existed has no `lastSyncedAt`,
    // and "Backed up just now" would be a lie rather than a rounding.
    expect(backupSummary({ state: 'in-sync', lastSyncedAt: 0, now: AT }).short).toBe('Backed up')
  })

  it('says a save is in flight, and when the last one landed', () => {
    expect(backupSummary({ state: 'local-ahead', lastSyncedAt: AT - 90_000, now: AT }).short)
      .toBe('Saving — last 1m ago')
  })

  /*
    Lost permission is the quiet failure this whole module exists for: auto-save
    becomes a no-op and every screen carries on as though it were working. It is
    one of the three states that earn amber.
  */
  it('warns when access to the folder has lapsed, and dates the silence', () => {
    const s = backupSummary({ state: 'no-permission', lastSyncedAt: AT - 2 * 86_400_000, now: AT })
    expect(s.tone).toBe('warn')
    expect(s.detail).toContain('nothing has been saved since 2d ago')
  })

  it('warns about the three states a writer has to resolve, and about nothing else', () => {
    const warns = (['unbacked', 'in-sync', 'local-ahead', 'never-synced', 'remote-ahead', 'conflict', 'no-permission'] as const)
      .filter((state) => backupSummary({ state, lastSyncedAt: AT, now: AT }).tone === 'warn')
    expect(warns.sort()).toEqual(['conflict', 'no-permission', 'remote-ahead'])
  })
})
