import { describe, it, expect, vi, afterEach } from 'vitest'
import { canAskWhereToSave, downloadBlob } from '@/lib/download'

const fakeWindow = (picker: boolean, webdriver: boolean) =>
  ({ showSaveFilePicker: picker ? () => Promise.resolve() : undefined, navigator: { webdriver } }) as unknown as Window

describe('canAskWhereToSave', () => {
  it('asks where the picker exists and a person is there to answer it', () => {
    expect(canAskWhereToSave(fakeWindow(true, false))).toBe(true)
  })
  it('does not ask in an automated browser, nor where there is no picker', () => {
    expect(canAskWhereToSave(fakeWindow(true, true))).toBe(false)
    expect(canAskWhereToSave(fakeWindow(false, false))).toBe(false)
  })
})

describe('downloadBlob', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('clicks a link in the document and releases its URL only later', () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:test')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    let clicked: { download: string; href: string; inDocument: boolean } | null = null
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = { download: this.download, href: this.href, inDocument: document.body.contains(this) }
    })

    downloadBlob(new Blob(['x']), 'book.md')

    expect(clicked).toEqual({ download: 'book.md', href: 'blob:test', inDocument: true })
    expect(document.querySelectorAll('a[download]')).toHaveLength(0)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revoke).toHaveBeenCalledWith('blob:test')
  })
})
