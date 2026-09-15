import { describe, it, expect } from 'vitest'

/**
 * Nothing clears the time cursor except through the guard.
 *
 * A null cursor means *all chapters* — the whole book, every character, place
 * and subplot, including the ones the story has not introduced. While reading
 * that is the single most destructive thing the app can do, and it cannot be
 * undone by putting the cursor back: what a reader has seen, they have seen.
 *
 * This has now been found three times, each time by someone reading rather than
 * by a test:
 *
 * 1. The bottom bar's ✕ called `setActiveEventId(null)` directly — 16×16px, in
 *    the phone thumb zone, beside a collapse chevron. One tap took a reader at
 *    chapter 7 of *Dracula* from 14 characters to 25.
 * 2. `useRevealAll` was written to fix that, and its note claimed there was no
 *    unguarded path left. There was: the Timeline's **Reading here** button —
 *    the control labelled as the reader's own bookmark — took *The Count of
 *    Monte Cristo* from 6 characters met to all 41, with no dialog.
 * 3. Grepping after that found a third, **Clear filter** on the Arc screen,
 *    which no reader run had clicked.
 *
 * Twice the fix was a hook and a comment saying callers must use it. A comment
 * is not a mechanism, which is why this is a test: the rule now fails the build
 * rather than waiting for a fourth reader.
 *
 * Scanning source text rather than behaviour, because behaviour cannot see a
 * control nobody thought to click — and it was exactly the unclicked control
 * that survived two rounds of fixes.
 */

const CLEARS = /setActiveEventId\(\s*null\s*\)/g

/** Everything under src, read through Vite so no node types are needed. */
const sources = import.meta.glob('../../**/*.{ts,tsx}', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/**
 * Where clearing the cursor is the point, rather than a control a reader can
 * reach.
 *
 * `useRevealAll` **is** the guard. The others clear a cursor that has stopped
 * meaning anything — the scene was deleted, the world was closed — which is
 * bookkeeping, not a reveal a reader chose.
 *
 * Playback is the exception that had to be earned rather than argued. Its clear
 * is in `handleStop`, which is somebody pressing Stop, not the timer running
 * out; this list said "playback reaching the end" and that was never what the
 * code did. It is allowed now because the Stop button — and the Play button
 * that is the only way to make Stop appear — are withheld from readers in
 * `TimelineControls`, which `e2e/readingNoPlayback.spec.ts` holds in place.
 */
const ALLOWED: { file: string; why: string }[] = [
  { file: 'components/useRevealAll.tsx', why: 'the guard itself' },
  { file: 'components/AppShell.tsx', why: 'the cursor names a scene that no longer exists' },
  { file: 'features/timeline/useTimelinePlayback.ts', why: 'Stop, whose button a reader is not offered' },
  { file: 'features/timeline/BulkActionToolbar.tsx', why: 'the active scene was just deleted' },
]

describe('clearing the time cursor', () => {
  it('has sources to scan', () => {
    // Without this the rule below passes on an empty glob, which is how a
    // fixture test quietly stops testing.
    expect(Object.keys(sources).length).toBeGreaterThan(200)
  })

  it('happens only inside the guard, or where no reader chose it', () => {
    const offenders: string[] = []
    for (const [path, text] of Object.entries(sources)) {
      if (path.includes('__tests__')) continue
      const hits = (text.match(CLEARS) ?? []).length
      if (hits === 0) continue
      // Mentions inside comments are the record of why this rule exists.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if ((code.match(CLEARS) ?? []).length === 0) continue
      if (ALLOWED.some((a) => path.endsWith(a.file))) continue
      offenders.push(path)
    }
    expect(
      offenders,
      'these clear the reading cursor without the confirm — route them through useRevealAll:\n' +
        offenders.join('\n'),
    ).toEqual([])
  })

  it('still finds the guard and the exceptions it names', () => {
    /*
      The presence beside the absence. If the glob were wrong, or the pattern
      stopped matching, the rule above would pass by finding nothing at all —
      which is precisely how it would fail to notice a fourth door.
    */
    // A fresh non-global regex per check: `String.match` with /g is fine, but
    // `RegExp.test` on a /g regex carries `lastIndex` between calls and starts
    // returning false on strings that do match. The first version of this did
    // exactly that and reported two of the four as missing.
    const clears = (t: string) => /setActiveEventId\(\s*null\s*\)/.test(t)
    const found = ALLOWED.filter(({ file }) =>
      Object.entries(sources).some(([p, t]) => p.endsWith(file) && clears(t)))
    expect(found.map((f) => f.file)).toEqual(ALLOWED.map((a) => a.file))
  })
})

/**
 * No screen offers a reader the author's row menus.
 *
 * `docs/GUIDE.md` promises "no delete buttons on cards, rows or map layers", and
 * two files broke it at once: `ChapterRow` gated six things and not the menu
 * holding Rename and Delete, and `EventCard` carried no reference to the gate at
 * all. A blind reader run found the first by renaming a chapter of *Monte
 * Cristo* from the reading view; the second it never opened, and a grep did.
 *
 * Every `<Menu>` in the app is a row or card menu of author actions, so the rule
 * is simply that the file holding one knows about the gate. That is coarse — it
 * cannot tell a guarded menu from a mentioned gate — which is why the browser
 * spec `readingNoEditing.spec.ts` checks the DOM. This catches the file that
 * never thought about it at all, which is the shape both of these had.
 */
describe('row and card menus', () => {
  /*
    By the import rather than by the tag. `<Menu` also matches lucide's
    hamburger *icon*, which is what `TopBar` renders — the first version of this
    flagged it and would have had me guard a picture.
  */
  const menuFiles = Object.entries(sources).filter(
    ([p, t]) => !p.includes('__tests__') && /from '@\/components\/ui\/menu'/.test(t),
  )

  it('are rendered in files that know about the reading gate', () => {
    expect(menuFiles.length, 'there are menus to check').toBeGreaterThan(1)
    const unaware = menuFiles
      .filter(([, t]) => !/gate\.active/.test(t))
      .map(([p]) => p)
    expect(
      unaware,
      'these render a menu without consulting the reading gate:\n' + unaware.join('\n'),
    ).toEqual([])
  })
})
