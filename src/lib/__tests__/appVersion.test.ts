import { describe, it, expect } from 'vitest'
import { compareVersions, needsNewerApp, APP_VERSION } from '../appVersion'

/**
 * The books are published separately from the app, so their versions drift
 * apart on purpose. A catalogue entry may name the oldest PlotWeave that can
 * open it, and a reader running something older is told on the card rather
 * than halfway through an import.
 */
describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    // The reason this is not `a < b`: as strings, "1.10.0" sorts before "1.9.0".
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0)
  })

  it('treats equal versions as equal, however many parts they carry', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
  })

  it('orders across each part', () => {
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
    expect(compareVersions('1.1.1', '1.1.2')).toBeLessThan(0)
  })
})

describe('needsNewerApp', () => {
  it('lets a book through when it asks for nothing', () => {
    // Which is nearly every book — making the field required would mean writing
    // a number into 39 entries that have no opinion.
    expect(needsNewerApp(undefined, '1.0.0')).toBe(false)
  })

  it('holds a book back from an app older than it needs', () => {
    expect(needsNewerApp('1.2.0', '1.1.0')).toBe(true)
  })

  it('lets it through on exactly the version it names, and on newer', () => {
    expect(needsNewerApp('1.2.0', '1.2.0')).toBe(false)
    expect(needsNewerApp('1.2.0', '1.3.0')).toBe(false)
  })

  it('ignores a requirement it cannot read rather than hiding the book', () => {
    // A malformed value is the catalogue's mistake. Withholding a book over it
    // would be a worse outcome than showing one that may not need anything.
    for (const bad of ['', 'latest', 'v1.2.0', 'soon']) {
      expect(needsNewerApp(bad, '1.0.0'), bad).toBe(false)
    }
  })

  it('defaults to this build, so the catalogue is judged against what is running', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/)
    expect(needsNewerApp('0.0.1')).toBe(false)
    expect(needsNewerApp('999.0.0')).toBe(true)
  })
})
