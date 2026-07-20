import { describe, it, expect } from 'vitest'
import { crc32, zipStore } from '@/lib/zip'

const enc = new TextEncoder()
const dec = new TextDecoder('latin1')

describe('crc32', () => {
  it('matches the standard check value', () => {
    // The canonical CRC-32 check string "123456789" → 0xCBF43926.
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926)
  })
  it('is 0 for empty input', () => {
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('zipStore', () => {
  it('produces a well-formed archive with the right signatures and entry count', () => {
    const out = zipStore([
      { name: 'mimetype', data: enc.encode('application/epub+zip') },
      { name: 'a/b.txt', data: enc.encode('hello world') },
    ])
    const s = dec.decode(out)
    // Local file header, central directory, and end-of-central-directory signatures.
    expect(s.startsWith('PK\x03\x04')).toBe(true)
    expect(s.includes('PK\x01\x02')).toBe(true)
    expect(s.includes('PK\x05\x06')).toBe(true)
    // Entry count is encoded in the EOCD (2 entries).
    const eocd = out.slice(out.length - 22)
    expect(eocd[10]).toBe(2) // total entries (low byte)
  })

  it('stores content verbatim (uncompressed), so names and bytes are recoverable', () => {
    const out = zipStore([{ name: 'word/document.xml', data: enc.encode('CHAPTER ONE prose') }])
    const s = dec.decode(out)
    expect(s.includes('word/document.xml')).toBe(true)
    expect(s.includes('CHAPTER ONE prose')).toBe(true)
  })

  it('keeps the mimetype entry first (required by EPUB)', () => {
    const out = zipStore([
      { name: 'mimetype', data: enc.encode('application/epub+zip') },
      { name: 'META-INF/container.xml', data: enc.encode('<container/>') },
    ])
    const s = dec.decode(out)
    // The first local entry name appears right after the 30-byte header.
    expect(s.indexOf('mimetype')).toBeLessThan(s.indexOf('META-INF/container.xml'))
  })
})
