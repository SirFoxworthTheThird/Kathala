import { describe, it, expect } from 'vitest'
import { backupSummary, EXPORTED_EVENT, lastExported, noteExported } from '@/lib/backupStanding'

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
  /*
    The first version of this module rendered *nothing* for a browser without
    the folder picker, on the reasoning that there was nothing to offer. Brave
    blocks the API with no flag to re-enable it and no Chromium on Android has
    it, so that put the writers with the fewest routes to a second copy in the
    group told least about it — the very mistake the `unbacked` case exists to
    undo, repeated one group along.
  */
  it('gives a browser that cannot keep a folder the same standing', () => {
    const noFolder = backupSummary({ state: 'unsupported', now: AT })
    expect(noFolder.short).toBe(backupSummary({ state: 'unbacked', now: AT }).short)
    expect(noFolder.tone).toBe('muted')
  })

  it('and a remedy it can actually follow', () => {
    // The pair: the same sentence, different advice. A browser that *can*
    // choose a folder is told to; one that cannot is told to export instead,
    // rather than to go and find a feature it will never be offered.
    expect(backupSummary({ state: 'unbacked', now: AT }).detail).toContain('Choose a folder')
    const noFolder = backupSummary({ state: 'unsupported', now: AT }).detail
    expect(noFolder).not.toContain('Choose a folder')
    expect(noFolder).toContain('Export a .pwk')
  })

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
    const warns = (['unbacked', 'unsupported', 'in-sync', 'local-ahead', 'never-synced', 'remote-ahead', 'conflict', 'no-permission'] as const)
      .filter((state) => backupSummary({ state, lastSyncedAt: AT, now: AT }).tone === 'warn')
    expect(warns.sort()).toEqual(['conflict', 'no-permission', 'remote-ahead'])
  })
})

/*
  A copy exported by hand (round-trip-plan-3.md, T13, S3). The second loop's
  writer exported a .pwk copy and the chip still said "Not backed up", with
  its detail saying the world existed only in this browser.
*/
describe('a copy exported by hand, with no folder', () => {
  const now = new Date('2026-11-14T12:00:00Z').getTime()

  it('says when the copy was taken, and that what is written since is only here; never that it is backed up', () => {
    const s = backupSummary({ state: 'unbacked', exportedAt: now - 2 * 3_600_000, now })
    expect(s.short).toBe('Copy exported 2h ago')
    expect(s.detail).toContain('Anything written since is only in this browser.')
    expect(s.detail).toContain('Choose a folder')
    expect(s.detail).not.toContain('exists only in this browser')
    expect(s.tone).toBe('muted')
    // Where no folder can be chosen, the remedy is another export.
    const u = backupSummary({ state: 'unsupported', exportedAt: now - 60_000, now })
    expect(u.short).toBe('Copy exported 1m ago')
    expect(u.detail).toContain('export again from World Settings')
  })

  it('with none, as before; with a folder, the folder’s standing and not the copy', () => {
    expect(backupSummary({ state: 'unbacked', now }).short).toBe('Not backed up')
    expect(backupSummary({ state: 'unbacked', exportedAt: 0, now }).detail).toContain('exists only in this browser')
    expect(backupSummary({ state: 'in-sync', lastSyncedAt: now - 240_000, exportedAt: now - 60_000, now }).short).toBe('Backed up 4m ago')
  })

  it('noteExported keeps the time on this device and says so at once; lastExported reads it back', () => {
    localStorage.removeItem('kathala-exported-w1')
    expect(lastExported('w1')).toBe(0)
    const heard: string[] = []
    const listen = (e: Event) => heard.push((e as CustomEvent).detail)
    window.addEventListener(EXPORTED_EVENT, listen)
    noteExported('w1', 1234)
    window.removeEventListener(EXPORTED_EVENT, listen)
    expect(lastExported('w1')).toBe(1234)
    expect(lastExported('w2')).toBe(0)
    expect(heard).toEqual(['w1'])
  })
})
