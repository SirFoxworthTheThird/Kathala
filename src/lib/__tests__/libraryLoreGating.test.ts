import { describe, it, expect } from 'vitest'

/**
 * Every shipped world's lore waits for a scene.
 *
 * **R4a.** A blind reader run opened *Dracula*'s Lore screen at chapter 7 and
 * was told that victims rise as vampires, that garlic and consecrated wafers
 * work, and that there would be a group of hunters — chapters 10, 12–16 and 22.
 * All fourteen of that world's pages had `visibleFromEventId: null`, and
 * `hasReached(null)` is `true`, so the only thing holding lore back was
 * `linksRevealed`: a proxy asking whether the characters a page *happens* to
 * link to have been met. In the one place a reader goes to ask what the rules
 * of this world are, it failed open.
 *
 * The gate cannot fix this on its own. A page with no reveal point is not a
 * page the app can be careful about — it is a page nobody said anything about,
 * and defaulting such a page to *hidden* would be worse, since it would silently
 * bury a writer's own lore the moment they wrote it. So the fix is in the data,
 * and this is the rule that keeps it there.
 *
 * Read through `import.meta.glob` rather than `node:fs`, which passes vitest and
 * then fails `tsc -b` for want of node types. This project has been caught by
 * that twice.
 */

const worldFiles = import.meta.glob('../../../public/library/*.pwk', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

interface Lore { id: string; title: string; visibleFromEventId: string | null }
interface Event { id: string; chapterId: string }
interface Chapter { id: string; number: number }
interface World { lorePages?: Lore[]; events?: Event[]; chapters?: Chapter[] }

const parsed = Object.entries(worldFiles).map(([path, text]) =>
  [path.slice(path.lastIndexOf('/') + 1), JSON.parse(text) as World] as const)

describe('lore in the shipped worlds', () => {
  it('has worlds to check, and lore inside them', () => {
    // Without this the rules below pass on an empty glob, which is how a
    // fixture test quietly stops testing.
    expect(parsed.length).toBeGreaterThan(20)
    expect(parsed.reduce((n, [, w]) => n + (w.lorePages?.length ?? 0), 0)).toBeGreaterThan(400)
  })

  it('never leaves a page with no scene to wait for', () => {
    const open: string[] = []
    for (const [file, w] of parsed) {
      for (const p of w.lorePages ?? []) {
        if (!p.visibleFromEventId) open.push(`${file} — ${p.title}`)
      }
    }
    expect(open, `these are shown from chapter one whatever they say:\n${open.slice(0, 8).join('\n')}`)
      .toEqual([])
  })

  it('points every page at a scene that is really in its world', () => {
    /*
      The half that makes the rule above worth having. A reveal point naming an
      event that does not exist is not a gate — `hasReached` cannot place it, and
      a page that waits for a scene the world does not contain is a different
      bug wearing the same field.
    */
    const dangling: string[] = []
    let checked = 0
    for (const [file, w] of parsed) {
      const ids = new Set((w.events ?? []).map((e) => e.id))
      for (const p of w.lorePages ?? []) {
        if (!p.visibleFromEventId) continue
        checked++
        if (!ids.has(p.visibleFromEventId)) dangling.push(`${file} — ${p.title} → ${p.visibleFromEventId}`)
      }
    }
    expect(checked).toBeGreaterThan(400)
    expect(dangling, `these name a scene their world does not have:\n${dangling.slice(0, 8).join('\n')}`)
      .toEqual([])
  })
})
