import { describe, it, expect } from 'vitest'
import pkg from '../../../package.json'

/**
 * The release workflow composes a release body from
 * `docs/release-notes/<version>.md`, and releases without one — with only the
 * download table — after printing a warning nobody reads. A version bump and a
 * notes file are therefore two separate acts, and the second is the one that is
 * easy to forget: the build still goes green, the binaries are still correct,
 * and only the page people actually read is wrong.
 *
 * v1.1.0 shipped its binaries under v1.0.0's notes for exactly this family of
 * reasons, so the coupling is asserted here rather than trusted: whatever
 * `package.json` says the app is, there is a file describing that version.
 *
 * The notes for a version are written before it is cut, so this fails at the
 * bump, which is the moment to write them.
 */

const notes = import.meta.glob('../../../docs/release-notes/*.md', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

const versionOf = (path: string) => path.replace(/^.*\//, '').replace(/\.md$/, '')

describe('release notes', () => {
  it('has notes files to look at', () => {
    // A glob that matches nothing would make every assertion below vacuous.
    expect(Object.keys(notes).length).toBeGreaterThan(0)
  })

  it('describes the version the app currently claims to be', () => {
    const wanted = `v${pkg.version}`
    expect(Object.keys(notes).map(versionOf)).toContain(wanted)
  })

  it('does not ship an empty file in place of notes', () => {
    const wanted = `v${pkg.version}`
    const body = Object.entries(notes).find(([p]) => versionOf(p) === wanted)?.[1] ?? ''
    expect(body.trim().length).toBeGreaterThan(200)
  })

  it('names every file for a version, so the workflow can find it by name', () => {
    for (const path of Object.keys(notes)) {
      expect(versionOf(path)).toMatch(/^v\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/)
    }
  })
})
