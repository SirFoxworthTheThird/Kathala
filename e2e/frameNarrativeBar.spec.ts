import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * MT-1: in the frame-narrative bar the outer track lost its chapter titles
 * while the inner kept them. The top track read `0 1 2 3 4 5 6 13 17 25 …` —
 * bare numbers — directly above an inner track reading *8 · Thie…*,
 * *12 · Puz…*. The same component rendered at two densities side by side,
 * because segment width follows event count and the compact floor was 2.5rem:
 * enough for a digit and nothing else. So the *frame* of a frame narrative was
 * the half you could not read.
 *
 * This is a layout property — how much of a title survives at a given segment
 * width, and whether the rail draws through it — so it is measured in the
 * browser rather than asserted against `textContent`, which a CSS ellipsis does
 * not change.
 */

/** Enough width for the number, the separator and a few characters of title. */
const READABLE_PX = 56

test.describe('The frame-narrative bar reads the same on both tracks', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the outer track carries chapter titles, clear of its own rail', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Frame')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await page.waitForTimeout(1200)

    // A frame narrative: one event per frame chapter (the review's case, which
    // is what drove the outer segments down to their floor) and three per
    // chapter of the tale.
    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { toArray: () => Promise<{ id: string }[]> }
        timelines: {
          where: (k: string) => { equals: (v: string) => { toArray: () => Promise<{ id: string }[]> } }
          add: (v: unknown) => Promise<unknown>
        }
        chapters: { add: (v: unknown) => Promise<unknown> }
        events: { add: (v: unknown) => Promise<unknown> }
        timelineRelationships: { add: (v: unknown) => Promise<unknown> }
      }
      const worldId = (await db.worlds.toArray())[0].id
      const now = Date.now()
      const existing = await db.timelines.where('worldId').equals(worldId).toArray()
      const outerId = existing[0]?.id ?? 'tl-outer'
      if (!existing.length) {
        await db.timelines.add({ id: outerId, worldId, name: 'The Frame', description: '', color: '#f59e0b', createdAt: now })
      }
      await db.timelines.add({ id: 'tl-inner', worldId, name: 'The Tale', description: '', color: '#60a5fa', createdAt: now })

      const build = async (timelineId: string, titles: string[], prefix: string, perChapter: number) => {
        for (let i = 0; i < titles.length; i++) {
          const chapterId = `${prefix}-ch-${i}`
          await db.chapters.add({
            id: chapterId, worldId, timelineId, number: i + 1, title: titles[i],
            synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
          })
          for (let j = 0; j < perChapter; j++) {
            await db.events.add({
              id: `${chapterId}-e${j}`, worldId, chapterId, timelineId,
              title: `${titles[i]} ${j + 1}`, description: '', locationMarkerId: null,
              involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
              tags: [], sortOrder: j, travelDays: null, inWorldTime: null, tension: null,
              structureBeat: null, threadIds: [], status: 'idea', povCharacterId: null,
              isFlashback: false, createdAt: now, updatedAt: now,
            })
          }
        }
      }
      await build(outerId, ['The Attic', 'Thieves in the Night', 'Puzzle Box'], 'o', 1)
      await build('tl-inner', ['Sailing South', 'The Reef', 'Landfall at Dusk'], 'i', 3)

      await db.timelineRelationships.add({
        id: 'rel-frame', worldId,
        sourceTimelineId: outerId, targetTimelineId: 'tl-inner',
        type: 'frame_narrative', anchors: [], syncPoints: [],
        createdAt: now, updatedAt: now,
      })
      return true
    })
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(true)

    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settle(page)

    const tracks = await page.evaluate(() => {
      const segments = [...document.querySelectorAll<HTMLElement>('[title^="Ch. "]')]
      return segments.map((seg) => {
        // The label is the only text child; the rail and its ticks are the
        // absolutely-positioned siblings above it.
        const label = [...seg.children].find(
          (c) => (c.textContent ?? '').trim().length > 0,
        ) as HTMLElement | undefined
        const rail = [...seg.children].find((c) => c !== label) as HTMLElement | undefined
        const lr = label?.getBoundingClientRect()
        /*
          The rail box itself is the wrong thing to measure: its rail line, fill
          and ticks are all absolutely positioned, so when it collapses to zero
          height they keep their size and paint outside it — which is the whole
          defect. Take the union of what is actually drawn instead. Only the
          `div`s: each tick's <button> is a 24px hit area around a much shorter
          mark, and it overlaps whatever sits below either way.
        */
        const drawn = [...(rail?.querySelectorAll('div') ?? [])]
          .map((d) => d.getBoundingClientRect())
          .filter((r) => r.height > 0)
        const inkTop = Math.min(...drawn.map((r) => r.top))
        const inkBottom = Math.max(...drawn.map((r) => r.bottom))
        return {
          title: seg.getAttribute('title') ?? '',
          text: (label?.textContent ?? '').trim(),
          // How much of the title the segment actually gives the label.
          visiblePx: Math.round(label?.clientWidth ?? 0),
          // Frame segments are the short ones; the tale's are taller.
          height: Math.round(seg.getBoundingClientRect().height),
          drawnParts: drawn.length,
          railOverlapsLabel: !!lr && drawn.length > 0
            && lr.top < inkBottom - 0.5 && inkTop < lr.bottom - 0.5,
        }
      })
    })

    const frame = tracks.filter((t) => t.height < 45)
    const tale = tracks.filter((t) => t.height >= 45)

    // Presence: both tracks rendered, and the tale's segments read the way they
    // always did. Without this the assertions below could pass on an empty bar.
    expect(tale.map((t) => t.text)).toEqual([
      '1 · Sailing South', '2 · The Reef', '3 · Landfall at Dusk',
    ])
    expect(frame.length, 'the frame track should have rendered its chapters').toBe(3)

    // The finding: the frame track says what the tale track says.
    expect(frame.map((t) => t.text)).toEqual([
      '1 · The Attic', '2 · Thieves in the Night', '3 · Puzzle Box',
    ])

    // …and is wide enough that a title survives, which `textContent` alone
    // cannot show — a CSS ellipsis leaves the text in the DOM untouched.
    const cramped = frame.filter((t) => t.visiblePx < READABLE_PX)
    expect(cramped,
      `frame segments too narrow for a title: ${JSON.stringify(cramped)}`).toEqual([])

    // And the rail no longer draws straight through the label it sits above —
    // invisible while that label was a bare digit, obvious once it is a title.
    // Presence first: there is ink to collide with, so the absence is not
    // passing on a segment that drew no rail at all.
    expect(Math.min(...frame.map((t) => t.drawnParts)),
      'each frame segment should draw a rail and its ticks').toBeGreaterThan(1)
    const collided = frame.filter((t) => t.railOverlapsLabel).map((t) => t.title)
    expect(collided, `rail drawn over the label: ${collided.join(', ')}`).toEqual([])

    // The full title is on hover wherever it is truncated.
    expect(frame.map((t) => t.title)).toEqual([
      'Ch. 1 — The Attic', 'Ch. 2 — Thieves in the Night', 'Ch. 3 — Puzzle Box',
    ])
  })
})
