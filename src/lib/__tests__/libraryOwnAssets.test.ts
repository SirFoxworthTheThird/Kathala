import { describe, it, expect } from 'vitest'

/**
 * The library's own artwork is named by the path this app serves it from, and
 * that path leads to a file that is really there.
 *
 * W23-7: four books referenced their own art as
 * `https://raw.githubusercontent.com/…/development/public/library/<book>/…` —
 * **246 URLs** pointing at a branch of a public repository, for **146 MB** of
 * files already in `dist/` and already served by the app at that very path.
 * A commit fixing GitHub Pages did it, because a root-absolute `/library/…`
 * breaks under a Pages subpath — but `vite.config.ts` already sets
 * `base: './'`, so resolving against the base was the fix.
 *
 * The cost was not only bytes. Offline, every one of them failed, under a
 * banner reading *"This map's picture could not be loaded — it is kept on the
 * web rather than in the book"* — true about what the record said, and wrong
 * about the book: the picture was in the folder beside the `.pwk`.
 *
 * Read through `import.meta.glob` rather than `node:fs`, which passes vitest
 * and then fails `tsc -b` for want of node types. This project has been caught
 * by that twice.
 */

/** Every shipped `.pwk`, as text. */
const worldFiles = import.meta.glob('../../../public/library/*.pwk', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/** Every file under `public/library/`, by URL, so a named path can be checked. */
const shipped = import.meta.glob('../../../public/library/**/*', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>

const shippedPaths = new Set(
  Object.keys(shipped)
    .map((k) => k.slice(k.indexOf('/public/library/') + '/public/'.length))
    .filter(Boolean),
)

interface Blob { id: string; url?: string }
const blobsOf = (text: string): Blob[] => (JSON.parse(text).blobs ?? []) as Blob[]

describe("the library's own artwork", () => {
  it('has books to check, and files to check them against', () => {
    // Without this the rules below pass on an empty glob, which is how a
    // source-read test quietly stops testing.
    expect(Object.keys(worldFiles).length).toBeGreaterThan(20)
    expect(shippedPaths.size).toBeGreaterThan(200)
  })

  it('is never fetched from the repository it is already shipped in', () => {
    const offenders: string[] = []
    for (const [file, text] of Object.entries(worldFiles)) {
      for (const b of blobsOf(text)) {
        if (b.url?.includes('raw.githubusercontent.com')) offenders.push(`${file} — ${b.url}`)
      }
    }
    expect(offenders, `these ship in dist/ and should be named by their served path:\n${offenders.slice(0, 5).join('\n')}`)
      .toEqual([])
  })

  it('names files that are actually there', () => {
    /*
      The half that makes the rule above worth having. Rewriting a URL to a path
      is only an improvement if the path resolves — otherwise it trades a dead
      link for a dead link that cannot even be diagnosed.
    */
    const missing: string[] = []
    let checked = 0
    for (const [file, text] of Object.entries(worldFiles)) {
      for (const b of blobsOf(text)) {
        const u = b.url
        if (!u || /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('/')) continue
        checked++
        if (!shippedPaths.has(u)) missing.push(`${file} — ${u}`)
      }
    }
    expect(checked).toBeGreaterThan(200)
    expect(missing, `named but not shipped:\n${missing.slice(0, 5).join('\n')}`).toEqual([])
  })
})
