import { describe, it, expect, vi } from 'vitest'
import {
  formatBytes, libraryBaseUrl, parseLibraryIndex, fetchLibraryIndex,
  type LibraryEntry,
} from '@/lib/library'

function entry(over: Partial<LibraryEntry> = {}): Record<string, unknown> {
  return {
    id: 'the-name-of-the-wind',
    worldId: 'world-1',
    title: 'The Name of the Wind',
    author: 'Patrick Rothfuss',
    blurb: 'A telling.',
    data: 'the-name-of-the-wind.pwk',
    dataBytes: 1234,
    notice: 'Unofficial, fan-made reference.',
    ...over,
  }
}

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response
}

describe('libraryBaseUrl', () => {
  it('sits under the app base, so it works on a project Pages path', () => {
    expect(libraryBaseUrl('/PlotWeave/')).toBe('/PlotWeave/library/')
  })

  it('copes with a base that has no trailing slash', () => {
    expect(libraryBaseUrl('/PlotWeave')).toBe('/PlotWeave/library/')
  })

  it('handles the root base used in development', () => {
    expect(libraryBaseUrl('/')).toBe('/library/')
  })
})

describe('a catalogue cover', () => {
  const parseOne = (over: Record<string, unknown>) =>
    parseLibraryIndex({ version: 1, entries: [entry() as never] as never[] }) && parseLibraryIndex({
      version: 1, entries: [{ ...entry(), ...over }],
    }).entries[0]

  it('is kept when it is an absolute http(s) URL', () => {
    expect(parseOne({ cover: 'https://example.com/a.jpg' }).cover).toBe('https://example.com/a.jpg')
    expect(parseOne({ cover: 'http://example.com/a.jpg' }).cover).toBe('http://example.com/a.jpg')
  })

  it('is dropped rather than handed to an <img> when it is not one', () => {
    // The catalogue is a file on disk, but it still ends up as a src
    // attribute, and "the manifest said so" is not a reason to load it.
    for (const bad of [
      'javascript:alert(1)',
      'data:image/svg+xml,<svg onload=alert(1)>',
      '/library/local.png',
      '//example.com/protocol-relative.jpg',
      '',
      42,
      null,
    ]) {
      expect(parseOne({ cover: bad }).cover, String(bad)).toBeUndefined()
    }
  })

  it('is optional — an entry without one still parses', () => {
    expect(parseOne({}).cover).toBeUndefined()
  })
})

describe('parseLibraryIndex', () => {
  it('accepts a well-formed catalogue', () => {
    const index = parseLibraryIndex({ version: 1, entries: [entry()] })
    expect(index.entries).toHaveLength(1)
    expect(index.entries[0].title).toBe('The Name of the Wind')
  })

  it('keeps the optional image bundle when present', () => {
    const index = parseLibraryIndex({
      version: 1,
      entries: [entry({ images: 'x.pwb', imagesBytes: 999 })],
    })
    expect(index.entries[0].images).toBe('x.pwb')
    expect(index.entries[0].imagesBytes).toBe(999)
  })

  it.each(['id', 'worldId', 'title', 'author', 'blurb', 'data', 'notice'])(
    'refuses an entry missing %s rather than half-rendering it',
    (field) => {
      const broken = entry()
      delete broken[field]
      expect(() => parseLibraryIndex({ version: 1, entries: [broken] })).toThrow(field)
    },
  )

  it('requires the attribution notice to be non-empty', () => {
    // Every entry describes someone else's work, so the card must be able to
    // say so — an empty string would render a blank line instead.
    expect(() => parseLibraryIndex({ version: 1, entries: [entry({ notice: '' })] }))
      .toThrow('notice')
  })

  it('refuses a catalogue with no version or no entries', () => {
    expect(() => parseLibraryIndex({ entries: [] })).toThrow('version')
    expect(() => parseLibraryIndex({ version: 1 })).toThrow('entries')
    expect(() => parseLibraryIndex(null)).toThrow()
  })
})

describe('fetchLibraryIndex', () => {
  it('reads index.json from the library folder', async () => {
    const fetcher = vi.fn(async () => res({ version: 1, entries: [entry()] }))
    const index = await fetchLibraryIndex('/PlotWeave/library/', fetcher)
    expect(fetcher).toHaveBeenCalledWith('/PlotWeave/library/index.json')
    expect(index.entries).toHaveLength(1)
  })

  it('reports the status when the catalogue is missing', async () => {
    const fetcher = vi.fn(async () => res(null, false, 404))
    await expect(fetchLibraryIndex('/library/', fetcher)).rejects.toThrow('404')
  })
})

describe('formatBytes', () => {
  it('reads sensibly across the range a download spans', () => {
    // The point is that nobody starts a 15 MB fetch on cellular unaware.
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(540_611)).toBe('528 KB')
    expect(formatBytes(15_352_825)).toBe('14.6 MB')
  })
})
