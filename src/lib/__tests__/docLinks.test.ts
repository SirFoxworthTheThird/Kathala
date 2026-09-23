import { describe, it, expect } from 'vitest'

/**
 * Every relative link and image in the shipped docs resolves.
 *
 * `README.md` pointed at `docs/EXAMPLE_AUTHORING_RULES.md` and
 * `docs/EXAMPLE_AUTHORING_CHECKLIST.md` for months after both moved to the
 * Library repository, and listed an `example/` directory that #404 deleted when
 * the books left this repo. `docs/GUIDE.md` opened by telling a new reader to
 * import a bundled *Middle Earth* world that went the same way — the first
 * orienting sentence in the document, naming something that does not exist.
 *
 * None of it was caught, because a dead link in prose fails nothing. A doc is
 * the one artefact where being wrong costs a reader more than being absent, so
 * this is the cheapest half of the guide rule in CLAUDE.md made mechanical: not
 * *is the guide current*, which no test can answer, but *does everything it
 * points at exist*.
 *
 * Read through `import.meta.glob` rather than `node:fs`, which passes vitest and
 * then fails `tsc -b` for want of node types.
 */

/*
  Four documents, not two. `ROADMAP.md` linked to twenty-one files in
  `docs/features/` and went on doing so after that folder was deleted — every
  link dead, and nothing failed, because this walk did not read it. A rule that
  covers the documents somebody remembered is a rule with the same hole in it as
  the docs.
*/
const docs = import.meta.glob('../../../{README.md,ROADMAP.md,docs/GUIDE.md,docs/README.md}', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/*
  Glob keys keep the `../../../` they were written with, on both sides, so both
  are reduced to repo-relative before they are compared — `resolve` below
  already does that for a link target.
*/
const REPO = '../../../'
const repoFiles = new Set([
  ...Object.keys(import.meta.glob('../../../{docs,e2e,electron,src,public}/**/*', { eager: false })),
  ...Object.keys(import.meta.glob('../../../*', { eager: false })),
].map((p) => (p.startsWith(REPO) ? p.slice(REPO.length) : p)))

/** `](target)` — the target of a markdown link or image. */
const LINK = /\]\(([^)\s]+)/g

/** Resolve a doc-relative target the way a reader's browser would. */
function resolve(fromDoc: string, target: string): string {
  const dir = fromDoc.slice(0, fromDoc.lastIndexOf('/'))
  const parts = `${dir}/${target}`.split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

describe('the shipped docs', () => {
  it('has both docs, with links in them', () => {
    // Without this every rule below passes on an empty glob.
    expect(Object.keys(docs).sort()).toHaveLength(4)
    for (const [path, text] of Object.entries(docs)) {
      expect(text.length, `${path} is empty`).toBeGreaterThan(1000)
      expect(text.match(LINK)?.length ?? 0, `${path} has no links`).toBeGreaterThan(0)
    }
    expect(repoFiles.size).toBeGreaterThan(200)
  })

  it('never points at a heading that is not there', () => {
    /*
      The other half of the same question. `docs/GUIDE.md` carries 72 in-page
      links and 62 headings, and a stale one lands the reader at the top of a
      2,800-line document with no clue why.

      **The slug rule is the trap.** GitHub lowercases, drops everything but word
      characters, spaces and hyphens, then maps each *remaining space* to a
      hyphen — without collapsing runs. So "Timeline & scenes" anchors as
      `timeline--scenes`, with two hyphens, because the ampersand left two
      spaces behind. A first version of this check collapsed whitespace and
      reported fourteen broken links that all work.
    */
    const slug = (heading: string) =>
      heading.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/ /g, '-')

    for (const [path, text] of Object.entries(docs)) {
      const headings = new Set(
        [...text.matchAll(/^#{2,4}\s+(.*)$/gm)].map(([, h]) => slug(h.trim())),
      )
      const targets = [...text.matchAll(/\]\(#([^)\s]+)\)/g)].map(([, t]) => t)
      if (targets.length === 0) continue
      expect(headings.size, `${path} has no headings`).toBeGreaterThan(10)
      expect(targets.length, `${path} has no in-page links`).toBeGreaterThan(10)
      const dead = targets.filter((t) => !headings.has(t))
      expect(dead, `${path} links to headings it does not have:\n${dead.join('\n')}`).toEqual([])
    }
  })

  it('never points at a file that is not here', () => {
    const dead: string[] = []
    let checked = 0
    for (const [path, text] of Object.entries(docs)) {
      for (const [, target] of text.matchAll(LINK)) {
        // An absolute URL is somebody else's to keep; an anchor is in-page.
        if (/^(https?:|mailto:|#)/.test(target)) continue
        checked += 1
        const resolved = resolve(path, target.split('#')[0])
        if (!repoFiles.has(resolved)) dead.push(`${path.replace('../../../', '')} → ${target}`)
      }
    }
    // The guide is illustrated; if this drops to nothing the walk has broken.
    expect(checked).toBeGreaterThan(40)
    expect(dead, `these name a file the repository does not have:\n${dead.join('\n')}`).toEqual([])
  })

  /*
    And the other direction: a picture nobody shows.

    `docs/images/reader-run-2026-08-26/` held eighteen screenshots, 4.3 MB, for
    a report deleted eight months earlier. Deleting a document does not delete
    what it pointed at, and nothing was looking — a dead link is at least
    visible to a reader, while an orphan is visible to nobody and grows the
    repository forever.

    Scoped to the guide's own folder. The records keep their screenshots beside
    them and are never edited again, so holding them to a rule about current
    references would be asking the past to stay tidy.
  */
  it('ships no screenshot that nothing shows', () => {
    const shots = Object.keys(
      import.meta.glob('../../../docs/images/*.png', { eager: false }),
    ).map((p) => (p.startsWith(REPO) ? p.slice(REPO.length) : p))
    expect(shots.length, 'the guide has screenshots').toBeGreaterThan(50)

    const shown = new Set<string>()
    for (const [path, text] of Object.entries(docs)) {
      for (const [, target] of text.matchAll(LINK)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue
        shown.add(resolve(path, target.split('#')[0]))
      }
    }
    const orphans = shots.filter((s) => !shown.has(s))
    expect(orphans, `nothing in the docs shows these:\n${orphans.join('\n')}`).toEqual([])
  })
})
