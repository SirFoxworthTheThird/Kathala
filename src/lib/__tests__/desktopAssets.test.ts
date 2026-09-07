import { describe, it, expect } from 'vitest'
import { desktopAssetBaseUrl } from '../desktopAssets'
import pkg from '../../../package.json'

/**
 * The desktop build fetches the Library's artwork from a CDN copy of this
 * repository rather than shipping it, because shipping it put 1,045 MB into
 * every installer and silently broke the Windows one.
 *
 * Two things about that URL matter enough to hold here. It is built from
 * `package.json` rather than typed out, so the owner and repo cannot drift from
 * the project they name; and it is **pinned to the version's tag**, because an
 * installed build asks for these URLs for as long as it exists and a moving
 * branch would let a later commit change the artwork underneath it.
 */
describe('desktopAssetBaseUrl', () => {
  it('builds a tag-pinned jsDelivr URL from a repository url and version', () => {
    expect(desktopAssetBaseUrl('https://github.com/acme/Thing.git', '2.3.4'))
      .toBe('https://cdn.jsdelivr.net/gh/acme/Thing@v2.3.4/public/')
  })

  it('accepts a repository url without the .git suffix or with a trailing slash', () => {
    expect(desktopAssetBaseUrl('https://github.com/acme/Thing', '1.0.0'))
      .toBe('https://cdn.jsdelivr.net/gh/acme/Thing@v1.0.0/public/')
    expect(desktopAssetBaseUrl('https://github.com/acme/Thing/', '1.0.0'))
      .toBe('https://cdn.jsdelivr.net/gh/acme/Thing@v1.0.0/public/')
  })

  it('pins a version, never a branch', () => {
    const url = desktopAssetBaseUrl(pkg.repository.url, pkg.version)
    expect(url).toContain(`@v${pkg.version}/`)
    // The two names a moving reference would take here.
    expect(url).not.toContain('@main')
    expect(url).not.toContain('@development')
  })

  it('names this repository, taken from package.json rather than written out', () => {
    expect(desktopAssetBaseUrl(pkg.repository.url, pkg.version))
      .toBe(`https://cdn.jsdelivr.net/gh/SirFoxworthTheThird/PlotWeave@v${pkg.version}/public/`)
  })

  it('ends in a slash, so joining a stored path needs no separator', () => {
    expect(desktopAssetBaseUrl(pkg.repository.url, pkg.version).endsWith('/')).toBe(true)
  })

  it('refuses a url it cannot read, rather than inventing a host', () => {
    expect(() => desktopAssetBaseUrl('git@gitlab.com:acme/thing.git', '1.0.0')).toThrow(/GitHub/)
    expect(() => desktopAssetBaseUrl('', '1.0.0')).toThrow(/GitHub/)
  })
})
