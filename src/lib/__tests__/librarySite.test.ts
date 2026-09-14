import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  librarySiteUrl, libraryCatalogueUrl, bundledLibraryBase, bundledCatalogueUrl,
  libraryCoverUrl,
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

/**
 * Covers, which broke and said nothing.
 *
 * Twelve of the shipped books name their cover as a path under `library/`
 * rather than an absolute URL. Rendered as-is they resolve against the document
 * — the *app's* origin — which has had no `library/` since the books moved out,
 * so all twelve silently lost their cover: `LibraryCover` hides an image that
 * fails rather than showing a broken frame, and the card just appeared without
 * one.
 *
 * No end-to-end test could have caught it. The suite stages the books into the
 * preview server's own `dist/library`, so a relative cover resolves there and
 * works — the staging that lets the suite test the real catalogue is exactly
 * what made it blind. This asks without a server in the way.
 */
describe('library covers', () => {
  it('leaves somebody else\'s host alone', () => {
    for (const url of [
      'https://upload.wikimedia.org/wikipedia/commons/x.jpg',
      'http://www.gutenberg.org/files/1184/0009m.jpg',
    ]) {
      expect(libraryCoverUrl(url)).toBe(url)
    }
  })

  it('sends a shipped cover to the library site, not to the app', () => {
    expect(libraryCoverUrl('library/alice-in-wonderland/art/tenniel/tenniel-01.gif'))
      .toBe(`${librarySiteUrl()}library/alice-in-wonderland/art/tenniel/tenniel-01.gif`)
  })

  it('never hands back a path that would resolve against the app', () => {
    // The shape of the bug: anything not absolute, rendered as given, asks the
    // app's own origin for a directory it does not have.
    const resolved = libraryCoverUrl('library/moby-dick/art/world.png')
    expect(resolved.startsWith('http')).toBe(true)
  })
})

/*
  There was a third block here that read the real catalogue out of a copy kept
  in this repository, on the grounds that it could not drift from what is
  published. A copy is precisely what drifts, and the library repository's own
  CLAUDE.md says not to make a second one — so it is not here.

  The division instead: the library repository guarantees the *shape* of every
  cover (absolute http(s), or a path under `library/`, enforced when a catalogue
  is published), and this guarantees that both shapes resolve to something an
  `<img>` can load. Neither repository has to hold the other's data to do its
  half.
*/
