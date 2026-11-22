import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'
import { parkCursor } from './helpers/cursor'

/*
  A family tree (issue #702): a writer builds three generations from the
  character pages, a cycle is refused, and the tree follows the cursor across
  a birth and two deaths, with a succession moving down the line; a branch
  folds and a person opens their page. A reader sees only whom they have met
  and nobody not yet born. Someone never on stage leaves the cast. And 200
  people are drawn, timed.
*/

type Db = Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown>; update: (k: string, v: object) => Promise<unknown> }>

/** The Heights: three chapters of a scene each; Nelly in every one, as she is in the book. */
async function heights(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Heights')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    const person = (pid: string, name: string) => ({ id: pid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.bulkAdd([person('earnshaw', 'Mr Earnshaw'), person('hindley', 'Hindley'), person('frances', 'Frances'), person('hareton', 'Hareton'), person('nelly', 'Nelly Dean')])
    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null, mentionedCharacterIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, involvedItemIds: [], sortOrder: 0, createdAt: now, updatedAt: now,
    }
    const titles = ['The old man’s gift', 'A son born', 'The last of Hindley']
    const casts = [['earnshaw', 'hindley', 'nelly'], ['hindley', 'frances', 'hareton', 'nelly'], ['hindley', 'hareton', 'nelly']]
    for (const n of [1, 2, 3]) {
      await db.chapters.add({ id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: titles[n - 1], synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({ ...base, id: `ev${n}`, chapterId: `ch${n}`, title: titles[n - 1], involvedCharacterIds: casts[n - 1] })
    }
    // Mr Earnshaw dies in chapter 2, Hindley in chapter 3.
    const dies = (sid: string, who: string, ev: string, key: number) => ({ id: sid, worldId: id, characterId: who, eventId: ev, sortKey: key, isAlive: false, createdAt: now, updatedAt: now })
    await db.characterSnapshots.bulkAdd([dies('d1', 'earnshaw', 'ev2', 2), dies('d2', 'hindley', 'ev3', 3)])
  }, worldId)
  return worldId
}

/** Kinship written straight into the store, as `addParent`/`addPartner` write it. */
async function seedKin(page: Page, worldId: string) {
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
    const now = Date.now()
    const rel = (rid: string, a: string, b: string, kinship: object, startEventId: string | null) => ({
      id: rid, worldId: id, characterAId: a, characterBId: b, label: 'family', strength: 'bond', sentiment: 'neutral', description: '',
      isBidirectional: true, startEventId, kinship: { ...kinship, own: true }, createdAt: now, updatedAt: now,
    })
    await db.relationships.bulkAdd([
      rel('k1', 'earnshaw', 'hindley', { kind: 'parent', parentId: 'earnshaw', parent: 'birth', order: 0 }, null),
      rel('k2', 'hindley', 'frances', { kind: 'partner', partner: 'married' }, 'ev1'),
      rel('k3', 'hindley', 'hareton', { kind: 'parent', parentId: 'hindley', parent: 'birth', order: 0 }, 'ev2'),
      rel('k4', 'frances', 'hareton', { kind: 'parent', parentId: 'frances', parent: 'birth', order: 0 }, 'ev2'),
    ])
  }, worldId)
}

async function openCharacter(page: Page, worldId: string, id: string) {
  await page.goto(`/#/worlds/${worldId}/characters/${id}`)
  await settle(page)
  const family = page.getByRole('region', { name: 'Family' })
  await expect(family).toBeVisible({ timeout: 20_000 })
  return family
}

/** Choose `who`, `kind` and `from` in an Add form, and add. */
async function addKin(page: Page, family: ReturnType<Page['getByRole']>, role: 'a parent' | 'a partner' | 'a child', who: string, from?: string) {
  await family.getByRole('button', { name: `Add ${role}` }).click()
  const form = family.getByRole('group', { name: `Add ${role}` })
  const label = role === 'a parent' ? 'Parent' : role === 'a child' ? 'Child' : 'Partner'
  await form.getByRole('button', { name: new RegExp(`^${label}`) }).click()
  await page.getByRole('option', { name: who, exact: true }).click()
  if (from) {
    await form.getByRole('button', { name: /^(Born in|From)/ }).click()
    await page.getByRole('option', { name: from }).click()
  }
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  return form
}

const node = (page: Page, name: string) => page.getByRole('region', { name: 'Family tree' }).locator(`[data-person="${name}"]`)

test.describe('the family tree', () => {
  test.describe.configure({ timeout: 300_000 })

  test('a writer builds three generations, a cycle is refused, and the tree and the line follow the cursor', async ({ page }) => {
    const worldId = await heights(page)

    // From Hindley's page: his father, his wife from chapter 1, his son born in chapter 2.
    let family = await openCharacter(page, worldId, 'hindley')
    await expect(family.getByText('No family recorded.')).toBeVisible()
    await addKin(page, family, 'a parent', 'Mr Earnshaw')
    await expect(family.getByRole('list', { name: 'Parents' })).toContainText('Mr Earnshaw')
    await addKin(page, family, 'a partner', 'Frances', 'Ch. 1 — The old man’s gift')
    await expect(family.getByRole('list', { name: 'Partners' })).toContainText('Frances')
    await addKin(page, family, 'a child', 'Hareton', 'Ch. 2 — A son born')
    await expect(family.getByRole('list', { name: 'Children' })).toContainText('Hareton')
    // Frances is Hareton's mother too, from her page.
    family = await openCharacter(page, worldId, 'frances')
    await addKin(page, family, 'a child', 'Hareton', 'Ch. 2 — A son born')
    await expect(family.getByRole('list', { name: 'Children' })).toContainText('Hareton')

    // Mr Earnshaw made Hareton's child: refused, saying why, and nothing written.
    family = await openCharacter(page, worldId, 'earnshaw')
    const form = await addKin(page, family, 'a parent', 'Hareton')
    await expect(form.getByRole('alert')).toHaveText('Mr Earnshaw is one of Hareton’s ancestors, so Hareton cannot be their parent: someone would be their own ancestor.')
    await form.getByRole('button', { name: 'Cancel' }).click()
    await expect(family.getByRole('list', { name: 'Parents' })).toHaveCount(0)
    await expect(family.getByRole('list', { name: 'Children' })).toContainText('Hindley')

    // The tree at chapter 1: Hareton not born yet; his grandfather alive.
    await page.goto(`/#/worlds/${worldId}/family?focus=hindley`)
    await parkCursor(page, 'ev1')
    await settle(page)
    await expect(node(page, 'Hareton')).toHaveAttribute('data-state', 'not born yet', { timeout: 20_000 })
    await expect(node(page, 'Mr Earnshaw')).toHaveAttribute('data-state', 'living')
    await expect(node(page, 'Frances')).toHaveAttribute('data-state', 'living')

    // The Heights, from Mr Earnshaw: his, then Hindley's; Hareton not yet in the line.
    const succession = page.getByRole('region', { name: 'Succession' })
    await succession.getByRole('button', { name: 'Add a succession' }).click()
    const make = succession.getByRole('group', { name: 'New succession' })
    await make.getByLabel('What is inherited').fill('The Heights')
    await make.getByRole('button', { name: /^Founder/ }).click()
    await page.getByRole('option', { name: 'Mr Earnshaw', exact: true }).click()
    await make.getByRole('button', { name: 'Add succession' }).click()
    const card = succession.getByRole('article', { name: 'Succession: The Heights' })
    await expect(card.locator('[data-holder]')).toHaveText('Mr Earnshaw')
    await expect(card.getByRole('list', { name: 'Heirs to The Heights' })).toHaveText('Hindley')

    // Chapter 2: Hareton born; Mr Earnshaw dead, and the Heights Hindley's.
    await parkCursor(page, 'ev2')
    await settle(page)
    await expect(node(page, 'Hareton')).toHaveAttribute('data-state', 'living', { timeout: 20_000 })
    await expect(node(page, 'Mr Earnshaw')).toHaveAttribute('data-state', 'dead')
    await expect(node(page, 'Mr Earnshaw').getByRole('button', { name: 'Open Mr Earnshaw' })).toHaveText('Mr Earnshaw †')
    await expect(card.locator('[data-holder]')).toHaveText('Hindley')
    await expect(card.getByRole('list', { name: 'Heirs to The Heights' })).toHaveText('Hareton')

    // Chapter 3: Hindley dead, and Hareton holds it.
    await parkCursor(page, 'ev3')
    await settle(page)
    await expect(node(page, 'Hindley')).toHaveAttribute('data-state', 'dead', { timeout: 20_000 })
    await expect(card.locator('[data-holder]')).toHaveText('Hareton')
    await expect(card.getByRole('list', { name: 'Heirs to The Heights' })).toHaveCount(0)

    // Fold Hindley's branch: Hareton goes, and the fold says how many; unfold, and he is back.
    await node(page, 'Hindley').getByRole('button', { name: 'Fold Hindley’s descendants' }).click()
    await expect(node(page, 'Hareton')).toHaveCount(0)
    await expect(node(page, 'Hindley').getByRole('button', { name: 'Unfold Hindley’s descendants' })).toHaveText('+1')
    await node(page, 'Hindley').getByRole('button', { name: 'Unfold Hindley’s descendants' }).click()
    await expect(node(page, 'Hareton')).toBeVisible()

    // A writer can edit a family from the tree; and a person opens their page.
    await node(page, 'Hareton').getByRole('button', { name: 'Edit Hareton’s family' }).click()
    await expect(page.getByRole('complementary', { name: 'Beside the tree' }).getByRole('region', { name: 'Family' }).getByRole('list', { name: 'Parents' })).toContainText('Frances')
    await node(page, 'Hareton').getByRole('button', { name: 'Open Hareton' }).click()
    await expect(page).toHaveURL(new RegExp(`/characters/hareton$`))
  })

  test('a reader sees only whom they have met, and nobody not yet born; nothing to change', async ({ page }) => {
    const worldId = await heights(page)
    await seedKin(page, worldId)
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      // Hareton is in chapter 1's cast, before his birth in chapter 2 (a reveal is by appearing, not by mention): met, and still not in the tree.
      await db.events.update('ev1', { involvedCharacterIds: ['earnshaw', 'hindley', 'nelly', 'hareton'] })
      await db.worlds.update(id, { readingMode: true })
    }, worldId)

    // Met at chapter 1: the Characters screen has him.
    await page.goto(`/#/worlds/${worldId}/characters`)
    await parkCursor(page, 'ev1')
    await settle(page)
    await expect(page.getByRole('main').getByText('Hareton', { exact: true })).toBeVisible({ timeout: 20_000 })

    // Chapter 1: Mr Earnshaw and Hindley met; Frances, married to him from here, not met yet; Hareton not born.
    await page.goto(`/#/worlds/${worldId}/family?focus=hindley`)
    await settle(page)
    await expect(node(page, 'Hindley')).toBeVisible({ timeout: 20_000 })
    await expect(node(page, 'Mr Earnshaw')).toBeVisible()
    await expect(node(page, 'Frances')).toHaveCount(0)
    await expect(node(page, 'Hareton')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Edit .*family$/ })).toHaveCount(0)

    // Chapter 2: both, now.
    await parkCursor(page, 'ev2')
    await settle(page)
    await expect(node(page, 'Frances')).toBeVisible({ timeout: 20_000 })
    await expect(node(page, 'Hareton')).toHaveAttribute('data-state', 'living')

    // The character page: the family as read, and nothing to add.
    const family = await openCharacter(page, worldId, 'hindley')
    await expect(family.getByRole('list', { name: 'Children' })).toContainText('Hareton')
    await expect(family.getByRole('button', { name: 'Add a parent' })).toHaveCount(0)
    await expect(family.getByText('Never on stage')).toHaveCount(0)
  })

  test('someone never on stage leaves the cast, and is listed apart', async ({ page }) => {
    const worldId = await heights(page)
    await seedKin(page, worldId)
    const cast = async () => {
      await page.goto(`/#/worlds/${worldId}/manuscript/ch3?view=cards`)
      await settle(page)
      const main = page.getByRole('main')
      await main.getByRole('button', { name: 'Expand “The last of Hindley”' }).click({ timeout: 30_000 })
      // The scene has a cast, so its cast field is open already.
      await main.getByRole('button', { name: '+ Add character…' }).click()
      // Frances is not in this scene's cast, so she is always offered: once she is there, the list is ready to read.
      await expect(page.getByRole('option', { name: 'Frances', exact: true })).toBeVisible()
      const offered = await page.getByRole('option').allInnerTexts()
      await page.keyboard.press('Escape')
      return offered
    }
    // On stage: offered for a scene's cast.
    expect(await cast()).toContain('Mr Earnshaw')

    const family = await openCharacter(page, worldId, 'earnshaw')
    // Clicked, not `check()`: the box shows the stored record, so it changes once the write lands, which the poll below waits for.
    await family.getByLabel('Never on stage').click()
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { get: (k: string) => Promise<{ offStage?: boolean }> }>
      return (await db.characters.get('earnshaw'))?.offStage
    })).toBe(true)

    expect(await cast()).not.toContain('Mr Earnshaw')
    await page.goto(`/#/worlds/${worldId}/characters`)
    await settle(page)
    const apart = page.getByRole('region', { name: 'Never on stage' })
    await expect(apart.getByText('Mr Earnshaw')).toBeVisible({ timeout: 20_000 })
    await expect(apart.getByText('Hindley')).toHaveCount(0)
  })

  test('200 people are drawn', async ({ page }, testInfo) => {
    const worldId = await heights(page)
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const now = Date.now()
      const people = [{ id: 'p0', name: 'P0' }, { id: 'q0', name: 'Q0' }]
      const rels: object[] = []
      let made = 0
      const rel = (a: string, b: string, kinship: object) => ({ id: `r${made++}`, worldId: id, characterAId: a, characterBId: b, label: 'family', strength: 'bond', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: null, kinship, createdAt: now, updatedAt: now })
      rels.push(rel('p0', 'q0', { kind: 'partner', partner: 'married' }))
      let couples: Array<[string, string]> = [['p0', 'q0']]
      let k = 1
      while (people.length < 200) {
        const next: Array<[string, string]> = []
        for (const [a, b] of couples) {
          for (let c = 0; c < 2 && people.length < 200; c++) {
            const kid = `p${k}`, spouse = `q${k++}`
            people.push({ id: kid, name: kid.toUpperCase() }, { id: spouse, name: spouse.toUpperCase() })
            rels.push(rel(a, kid, { kind: 'parent', parentId: a, parent: 'birth' }), rel(b, kid, { kind: 'parent', parentId: b, parent: 'birth' }), rel(kid, spouse, { kind: 'partner', partner: 'married' }))
            next.push([kid, spouse])
          }
        }
        couples = next
      }
      await db.characters.bulkAdd(people.map((p) => ({ ...p, worldId: id, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })))
      await db.relationships.bulkAdd(rels)
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/family?focus=p0`)
    await settle(page)
    const tree = page.getByRole('region', { name: 'Family tree' })
    await expect(tree.locator('[data-person]').first()).toBeVisible({ timeout: 30_000 })

    // The whole family at once: every one of them drawn, timed from the click.
    const t0 = Date.now()
    await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Whole family' }).click()
    await expect(tree.locator('[data-person]')).toHaveCount(200, { timeout: 30_000 })
    const drawn = Date.now() - t0
    // Folding the root's branch and opening it again, around them a generation each way: all 200 at once are too small to press (scale 0.04).
    await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Around them' }).click()
    await page.getByRole('button', { name: /^Generations each way/ }).click()
    await page.getByRole('option', { name: '1 generation each way' }).click()
    await expect(tree.locator('[data-person]')).toHaveCount(6)
    const around = 6
    const t1 = Date.now()
    await tree.locator('[data-person="P0"]').getByRole('button', { name: 'Fold P0’s descendants' }).click()
    await expect(tree.locator('[data-person]')).toHaveCount(2)
    await tree.locator('[data-person="P0"]').getByRole('button', { name: 'Unfold P0’s descendants' }).click()
    await expect(tree.locator('[data-person]')).toHaveCount(around)
    const folded = Date.now() - t1
    testInfo.annotations.push({ type: 'timing', description: `200 drawn in ${drawn} ms; fold and unfold in ${folded} ms` })
    console.log(`FAMILY-200: drawn ${drawn} ms, fold+unfold ${folded} ms`)
    expect(drawn).toBeLessThan(3000)
  })
})
