import { describe, it, expect } from 'vitest'
import {
  resolveFolderSyncState, canAutoPush, needsAttention, conflictCopyName, MODIFIED_TOLERANCE_MS,
} from '@/lib/folderSyncState'

// A world that has been pushed once: 10 operations, file written at t=1000.
const pushed = { lastSyncedSeq: 10, lastPushedFileModified: 1000 }

describe('resolveFolderSyncState', () => {
  it('is never-synced before the first write', () => {
    expect(resolveFolderSyncState({ localSeq: 5 })).toBe('never-synced')
  })

  it('is never-synced when the file has been removed from the folder', () => {
    expect(resolveFolderSyncState({ localSeq: 10, ...pushed, fileModified: undefined }))
      .toBe('never-synced')
  })

  it('is in-sync when neither side moved', () => {
    expect(resolveFolderSyncState({ localSeq: 10, ...pushed, fileModified: 1000 }))
      .toBe('in-sync')
  })

  it('is local-ahead when we have edits the folder lacks', () => {
    expect(resolveFolderSyncState({ localSeq: 14, ...pushed, fileModified: 1000 }))
      .toBe('local-ahead')
  })

  it('is remote-ahead when the folder moved on and we have not', () => {
    expect(resolveFolderSyncState({ localSeq: 10, ...pushed, fileModified: 9000 }))
      .toBe('remote-ahead')
  })

  it('is a conflict when both moved on', () => {
    expect(resolveFolderSyncState({ localSeq: 14, ...pushed, fileModified: 9000 }))
      .toBe('conflict')
  })

  it('treats a reset journal as dirty, not as clean', () => {
    // markJournalDiscontinuity clears the journal after a bulk import, so seq
    // restarts below the last synced value. Everything changed — the one thing
    // this must not conclude is "nothing to do".
    expect(resolveFolderSyncState({ localSeq: 1, ...pushed, fileModified: 1000 }))
      .toBe('local-ahead')
    expect(resolveFolderSyncState({ localSeq: 1, ...pushed, fileModified: 9000 }))
      .toBe('conflict')
  })

  it('ignores sub-second timestamp jitter from the filesystem', () => {
    // Some filesystems and sync clients round lastModified, which would
    // otherwise look like a remote write every time.
    expect(resolveFolderSyncState({
      localSeq: 10, ...pushed, fileModified: 1000 + MODIFIED_TOLERANCE_MS,
    })).toBe('in-sync')
    expect(resolveFolderSyncState({
      localSeq: 10, ...pushed, fileModified: 1000 + MODIFIED_TOLERANCE_MS + 1,
    })).toBe('remote-ahead')
  })

  it('does not treat an older file as a remote change', () => {
    // Clock skew between machines can make the file look older than our push.
    expect(resolveFolderSyncState({ localSeq: 10, ...pushed, fileModified: 500 }))
      .toBe('in-sync')
  })
})

describe('canAutoPush', () => {
  it('allows writing only when nothing can be destroyed', () => {
    expect(canAutoPush('never-synced')).toBe(true)
    expect(canAutoPush('local-ahead')).toBe(true)
    expect(canAutoPush('in-sync')).toBe(false)
    expect(canAutoPush('remote-ahead')).toBe(false)
    expect(canAutoPush('conflict')).toBe(false)
  })

  it('never allows an automatic write over another device work', () => {
    // The property that matters: any state where the folder holds something we
    // have not seen must block the automatic path.
    for (const state of ['remote-ahead', 'conflict'] as const) {
      expect(canAutoPush(state)).toBe(false)
      expect(needsAttention(state)).toBe(true)
    }
  })
})

describe('conflictCopyName', () => {
  const at = new Date(2026, 6, 29, 3, 15) // 2026-07-29 03:15 local

  it('keeps the extension and marks the copy', () => {
    expect(conflictCopyName('Middle Earth.pwk', at))
      .toBe('Middle Earth (conflict copy 2026-07-29 0315).pwk')
  })

  it('handles a name with dots in it', () => {
    expect(conflictCopyName('Book 2.draft.pwk', at))
      .toBe('Book 2.draft (conflict copy 2026-07-29 0315).pwk')
  })

  it('handles a name with no extension', () => {
    expect(conflictCopyName('World', at)).toBe('World (conflict copy 2026-07-29 0315)')
  })

  it('never returns the original name — the bound file must not be touched', () => {
    for (const name of ['a.pwk', 'World', 'x.y.z']) {
      expect(conflictCopyName(name, at)).not.toBe(name)
    }
  })
})
