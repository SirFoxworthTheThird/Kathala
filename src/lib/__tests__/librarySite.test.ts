import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  librarySiteUrl, libraryCatalogueUrl, bundledLibraryBase, bundledCatalogueUrl,
} from '../librarySite'
import { swapBase } from '../libraryFallback'

/**
 * Where the Library is, in the two places the app can look.
 *
 * The pairing is the part worth guarding. A fallback works by swapping one base
 * for another in a URL, so the remote base and its bundled counterpart have to
 * describe the same depth. Pairing the *catalogue* URL with the *site* root
 * asks for `./index.json` when the staged file is at `./library/index.json`,
 * and the Library silently fails to open offline while looking fine online —
 * which is exactly what this did before the test below existed.
 */
describe('where the library is', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('serves the catalogue from under the site', () => {
    expect(libraryCatalogueUrl()).toBe(`${librarySiteUrl()}library/`)
  })

  it('keeps exactly one trailing slash, whatever it is given', () => {
    vi.stubEnv('VITE_LIBRARY_BASE_URL', 'https://books.example')
    expect(librarySiteUrl()).toBe('https://books.example/')
    vi.stubEnv('VITE_LIBRARY_BASE_URL', 'https://books.example/')
    expect(librarySiteUrl()).toBe('https://books.example/')
  })

  it('bundles nothing in a build that was served over a network', () => {
    expect(bundledLibraryBase()).toBeUndefined()
    expect(bundledCatalogueUrl()).toBeUndefined()
  })

  it('pairs the bundled catalogue at the same depth as the remote one', () => {
    vi.stubEnv('VITE_LIBRARY_BUNDLED', '1')
    const bundled = bundledCatalogueUrl()
    expect(bundled).toBe('./library/')

    // The whole point: swapping one base for the other has to land on the file.
    const remote = 'https://books.example/library/'
    expect(swapBase(`${remote}index.json`, remote, bundled!)).toBe('./library/index.json')
    expect(swapBase(`${remote}dracula.pwk`, remote, bundled!)).toBe('./library/dracula.pwk')
  })
})
