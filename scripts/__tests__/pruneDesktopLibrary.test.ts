import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * The desktop build strips the Library artwork out of `dist/` before packaging,
 * because shipping it put 1,045 MB into every installer and broke the Windows
 * one outright.
 *
 * Stripping too much is the quieter failure: the catalogue's own covers and the
 * world files are what let a reader browse and import with no connection, and
 * losing them would show as missing pictures on the Library screen rather than
 * as a build error. So the rule is exercised here rather than read — including
 * the case that matters most, a cover that lives in the same folder as the
 * artwork being removed around it.
 */

const SCRIPT = join(process.cwd(), 'scripts', 'prune-desktop-library.mjs')
let root: string

function file(rel: string, contents = 'x') {
  const full = join(root, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

function run(): string {
  return execFileSync('node', [SCRIPT, root], { encoding: 'utf8' })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-'))
  file('library/index.json', JSON.stringify({
    version: 1,
    entries: [
      { id: 'oz', cover: 'library/oz/art/cover.jpg' },
      { id: 'dracula', cover: 'https://example.com/remote.jpg' },
      { id: 'plain' },
    ],
  }))
  file('library/oz.pwk')
  file('library/dracula.pwb')
  file('library/oz/art/cover.jpg')          // named by the catalogue — must stay
  file('library/oz/art/places/market.png')  // artwork — must go
  file('library/oz/maps/oz.jpg')            // artwork — must go
  file('library/dracula/art/portrait.png')  // artwork — must go
})

afterEach(() => { rmSync(root, { recursive: true, force: true }) })

describe('prune-desktop-library', () => {
  it('keeps the catalogue, the world files and the covers it names', () => {
    run()
    expect(existsSync(join(root, 'library/index.json'))).toBe(true)
    expect(existsSync(join(root, 'library/oz.pwk'))).toBe(true)
    expect(existsSync(join(root, 'library/dracula.pwb'))).toBe(true)
    expect(existsSync(join(root, 'library/oz/art/cover.jpg'))).toBe(true)
  })

  it('removes the artwork around a cover without taking the cover with it', () => {
    run()
    expect(existsSync(join(root, 'library/oz/art/places/market.png'))).toBe(false)
    expect(existsSync(join(root, 'library/oz/maps/oz.jpg'))).toBe(false)
    expect(existsSync(join(root, 'library/dracula/art/portrait.png'))).toBe(false)
  })

  it('leaves no empty folders behind, but keeps one that still holds a cover', () => {
    run()
    expect(existsSync(join(root, 'library/dracula'))).toBe(false)
    expect(existsSync(join(root, 'library/oz/art'))).toBe(true)
    expect(existsSync(join(root, 'library/oz/maps'))).toBe(false)
  })

  it('reports what it did', () => {
    expect(run()).toMatch(/removed 3 files .*kept 4/)
  })

  it('fails rather than silently shipping the artwork when there is no catalogue', () => {
    rmSync(join(root, 'library/index.json'))
    expect(() => run()).toThrow()
  })

  it('fails when there was nothing to remove, since that is not a success', () => {
    for (const f of ['library/oz/art/places/market.png', 'library/oz/maps/oz.jpg', 'library/dracula/art/portrait.png']) {
      rmSync(join(root, f))
    }
    expect(() => run()).toThrow()
  })

  it('does not reach outside the library folder', () => {
    file('assets/app.js')
    file('index.html')
    run()
    expect(readdirSync(root).sort()).toEqual(['assets', 'index.html', 'library'])
    expect(existsSync(join(root, 'assets/app.js'))).toBe(true)
  })
})
