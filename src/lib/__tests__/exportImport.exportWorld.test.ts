import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { exportWorld } from '@/lib/exportImport'

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL
// We mock them so exportWorld can run end-to-end without crashing.
beforeEach(async () => {
  await db.delete()
  await db.open()

  // Stub out the browser-only URL methods
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  })
})

// ── exportWorld — error paths ─────────────────────────────────────────────────

describe('exportWorld — error handling', () => {
  it('throws when the world id does not exist', async () => {
    await expect(exportWorld('no-such-world')).rejects.toThrow('World not found')
  })
})

// ── exportWorld — happy path ──────────────────────────────────────────────────

describe('exportWorld — happy path', () => {
  async function seedWorld() {
    await db.worlds.add({
      id: 'world-export-1',
      name: 'Exportable World',
      description: 'For testing',
      coverImageId: null,
      theme: null,
      continuityStaleThreshold: 5,
      createdAt: 1000,
      updatedAt: 1000,
    })
  }

  it('resolves without throwing for a world with no related data', async () => {
    await seedWorld()
    await expect(exportWorld('world-export-1')).resolves.toBeUndefined()
  })

  it('triggers a download (createElement + click) with .pwk extension', async () => {
    await seedWorld()

    const clickSpy = vi.fn()
    const mockAnchor = { href: '', download: '', click: clickSpy }
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement)

    await exportWorld('world-export-1')

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(mockAnchor.download).toMatch(/\.pwk$/)
    expect(clickSpy).toHaveBeenCalledTimes(1)

    createElementSpy.mockRestore()
  })

  it('sanitizes the world name in the download filename', async () => {
    await db.worlds.add({
      id: 'world-special',
      name: 'World: Special / Characters!',
      description: '',
      coverImageId: null,
      theme: null,
      continuityStaleThreshold: 5,
      createdAt: 1000,
      updatedAt: 1000,
    })

    const mockAnchor = { href: '', download: '', click: vi.fn() }
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement)

    await exportWorld('world-special')

    // Non-alphanumeric chars should be replaced with underscores
    expect(mockAnchor.download).toMatch(/^World__Special___Characters_\.pwk$/)

    createElementSpy.mockRestore()
  })

  it('reads relationshipPositions from localStorage when present', async () => {
    await seedWorld()
    const positions = { 'rel-1': { x: 10, y: 20 } }
    localStorage.setItem('wb-rel-pos-world-export-1', JSON.stringify(positions))

    const mockAnchor = { href: '', download: '', click: vi.fn() }
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement)

    // Capture the blob data to verify relationshipPositions is included
    let capturedJson = ''
    const origBlob = globalThis.Blob
    vi.stubGlobal('Blob', class extends origBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options)
        if (options?.type === 'application/json') {
          capturedJson = parts[0] as string
        }
      }
    })

    await exportWorld('world-export-1')

    const parsed = JSON.parse(capturedJson)
    expect(parsed.relationshipPositions).toEqual(positions)

    createElementSpy.mockRestore()
    vi.stubGlobal('Blob', origBlob)
    localStorage.removeItem('wb-rel-pos-world-export-1')
  })

  it('revokes the object URL after triggering the download', async () => {
    await seedWorld()

    const mockAnchor = { href: '', download: '', click: vi.fn() }
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement)

    const revokeUrlSpy = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url-2'),
      revokeObjectURL: revokeUrlSpy,
    })

    await exportWorld('world-export-1')

    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock-url-2')

    createElementSpy.mockRestore()
  })

})
