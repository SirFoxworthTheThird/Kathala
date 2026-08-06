import { test, expect, type Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { resetDB } from './helpers/reset'

/**
 * Opening a world PlotWeave did not write.
 *
 * `validateImport` checks structure — arrays are arrays, the world has an id —
 * and never inspects an enum value. So every `status`, `type` and `sentiment`
 * in an imported world is whatever the file said, and the TypeScript types
 * claiming otherwise are exactly what made this easy to miss.
 *
 * The shipped Dracula example carried a goal typed "escape" for months. Reading
 * it did not fail loudly; `GOAL_TYPE_CONFIG[goal.type].label` threw, and the
 * Goals tab went blank. The values below are that class of thing: plausible,
 * wrong, and the sort a hand-written or AI-generated `.pwk` produces.
 */

const WORLD = 'hostile-world'
const now = 1_700_000_000_000

/** A structurally valid world carrying enum values the app has never heard of. */
function hostileWorld() {
  return {
    version: 2,
    exportedAt: now,
    world: {
      id: WORLD, name: 'Hostile World', description: 'Written by something else.',
      coverImageId: null, theme: null, continuityStaleThreshold: 5,
      createdAt: now, updatedAt: now,
    },
    timelines: [{ id: 'tl', worldId: WORLD, name: 'Main', description: '', color: null, isPrimary: true, dayOffset: 0, createdAt: now, updatedAt: now }],
    chapters: [{ id: 'ch', worldId: WORLD, timelineId: 'tl', number: 1, title: 'One', summary: '', createdAt: now, updatedAt: now }],
    events: [
      // Not one of idea/outline/draft/revised/final.
      { id: 'ev-1', worldId: WORLD, chapterId: 'ch', timelineId: 'tl', title: 'A Scene', description: '', sortOrder: 1, involvedCharacterIds: ['c-1'], mentionedCharacterIds: [], involvedItemIds: [], tags: [], threadIds: [], povCharacterId: null, locationMarkerId: null, status: 'published', createdAt: now, updatedAt: now },
      // An inherited key, which a membership test written with `in` would treat
      // as a real status and hand back a function.
      { id: 'ev-2', worldId: WORLD, chapterId: 'ch', timelineId: 'tl', title: 'Another Scene', description: '', sortOrder: 2, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], tags: [], threadIds: [], povCharacterId: null, locationMarkerId: null, status: 'toString', createdAt: now, updatedAt: now },
    ],
    characters: [
      { id: 'c-1', worldId: WORLD, name: 'Ana', description: '', aliases: [], tags: [], color: null, portraitImageId: null, isAlive: true, birthDate: null, createdAt: now, updatedAt: now },
      { id: 'c-2', worldId: WORLD, name: 'Bo', description: '', aliases: [], tags: [], color: null, portraitImageId: null, isAlive: true, birthDate: null, createdAt: now, updatedAt: now },
    ],
    // "escape" is the value that actually shipped in Dracula.pwk.
    characterGoals: [
      { id: 'g-1', worldId: WORLD, characterId: 'c-1', type: 'escape', text: 'Get out of the castle.', startEventId: null, endEventId: null, createdAt: now, updatedAt: now },
      { id: 'g-2', worldId: WORLD, characterId: 'c-1', type: 'want', text: 'A known type, for contrast.', startEventId: null, endEventId: null, createdAt: now, updatedAt: now },
    ],
    relationships: [
      { id: 'r-1', worldId: WORLD, characterAId: 'c-1', characterBId: 'c-2', label: 'rivals', sentiment: 'ambivalent', strength: 'moderate', createdAt: now, updatedAt: now },
    ],
    mapLayers: [], locationMarkers: [], items: [], characterSnapshots: [],
    characterMovements: [], itemPlacements: [], locationSnapshots: [], itemSnapshots: [],
    relationshipSnapshots: [], blobs: [], travelModes: [], timelineRelationships: [],
    crossTimelineArtifacts: [], mapRoutes: [], mapRegions: [], mapRegionSnapshots: [],
    mapAnnotations: [], loreCategories: [], lorePages: [], factions: [],
    factionMemberships: [], factionRelationships: [], knowledgeFacts: [],
    knowledgeReveals: [], motifs: [], plotThreads: [], relationshipPositions: [],
    sceneRevisions: [], sceneTexts: [], writingLogs: [], continuitySuppressions: [],
    suppressedIssueIds: [], tombstones: [],
  }
}

/** Fail the test on any uncaught React/JS error, not just a visibly empty page. */
function trackCrashes(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function importHostile(page: Page) {
  const file = path.join(os.tmpdir(), `hostile-${Date.now()}.pwk`)
  fs.writeFileSync(file, JSON.stringify(hostileWorld()))
  await page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]').setInputFiles(file)
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 30_000 })
}

test.describe('a world written by something else', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
  })

  test('imports and opens without throwing', async ({ page }) => {
    const errors = trackCrashes(page)
    await importHostile(page)
    await expect(page.getByRole('heading', { name: 'Hostile World' })).toBeVisible()
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('shows the goals screen that used to go blank', async ({ page }) => {
    const errors = trackCrashes(page)
    await importHostile(page)
    const world = new URL(page.url()).hash.replace('#', '').split('/').slice(0, 3).join('/')

    await page.goto(`/#${world}/characters`)
    await page.getByText('Ana').first().click()
    await page.getByRole('tab', { name: /goals/i }).click()

    // Goal text lives in an editable field, so it is read as a value.
    await expect(page.getByRole('textbox', { name: /what drives them/i }).first())
      .toHaveValue('Get out of the castle.')
    // The unknown type keeps its own name rather than being relabelled…
    await expect(page.getByText('escape', { exact: true })).toBeVisible()
    // …and a known one still renders beside it, so this cannot pass by
    // rendering nothing at all.
    await expect(page.getByText('Want', { exact: true })).toBeVisible()
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('shows a timeline whose events carry unknown statuses', async ({ page }) => {
    const errors = trackCrashes(page)
    await importHostile(page)
    const world = new URL(page.url()).hash.replace('#', '').split('/').slice(0, 3).join('/')

    await page.goto(`/#${world}/timeline`)
    // Chapters render collapsed, so the events (and their status badges, which
    // are what this is about) are behind the chapter.
    await page.getByTitle('Open chapter detail').first().click()

    await expect(page.getByText('A Scene', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Another Scene', { exact: true }).first()).toBeVisible()
    // The unrecognised statuses are shown as themselves rather than crashing or
    // being silently relabelled as one of the five the app knows.
    await expect(page.getByText('published', { exact: true }).first()).toBeVisible()
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('shows the dashboard, whose status bar counts every event', async ({ page }) => {
    const errors = trackCrashes(page)
    await importHostile(page)

    // Both events have an unrecognised status; neither may turn a count into NaN.
    await expect(page.getByRole('heading', { name: 'Hostile World' })).toBeVisible()
    await expect(page.locator('[style*="NaN"]')).toHaveCount(0)
    expect(errors, errors.join('\n')).toEqual([])
  })
})
