import type { BrowserContext, Page } from '@playwright/test'

/**
 * Close the page part-way through a writing action, and check what survives
 * (next-plan.md, Part A).
 *
 * Every data loss the writer runs found had one shape: something owed was
 * held in the page, or written in a provisional form, while a slower step
 * finished — and a page closed in between lost it. W-1's first scene, run 9's
 * pasted headers, Part 6's thirty headers. Each was found by a writer, one at
 * a time. This closes the page at a chosen moment during an action, many
 * times, and checks the invariants every one of those bugs broke.
 *
 * Two ways to close:
 * - `reload`: the page goes as a tab closed by a person does, with its
 *   `pagehide` and `visibilitychange` handlers run — the app writes what it
 *   owes there.
 * - `crash`: the renderer is killed, as a browser closed by a script or a
 *   machine losing power is — no handler runs. What was not yet in IndexedDB
 *   is gone; the checks then ask only that nothing stored contradicts
 *   anything else.
 */
export type CloseMode = 'reload' | 'crash'

/**
 * Start `act`, wait `delayMs`, close the page the way `mode` says, and open
 * `url` again in a page of the same context (same storage). Returns that page.
 */
export async function closeDuring(
  context: BrowserContext,
  page: Page,
  mode: CloseMode,
  delayMs: number,
  act: (page: Page) => Promise<void>,
  url: string,
): Promise<Page> {
  await act(page)
  if (delayMs > 0) await page.waitForTimeout(delayMs)
  if (mode === 'reload') {
    await page.reload({ waitUntil: 'load' })
    return page
  }
  const cdp = await context.newCDPSession(page)
  const crashed = page.waitForEvent('crash', { timeout: 10_000 })
  // Never answered: the renderer that would answer is the one it kills.
  void cdp.send('Page.crash').catch(() => {})
  await crashed
  await page.close().catch(() => {})
  const next = await context.newPage()
  await next.goto(url, { waitUntil: 'load' })
  return next
}

/** What the store holds, for the checks. */
export interface Stored {
  chapters: Array<Record<string, unknown>>
  events: Array<Record<string, unknown>>
  texts: Array<{ eventId: string; text: string }>
  kept: Record<string, { line: string }>
  /** Each journalled record the journal has touched, with its last operation. */
  journal: Array<{ entityType: string; entityId: string; type: string; resulting: number; payload: Record<string, unknown>; record: Record<string, unknown> | null }>
}

/** The tables the operation journal writes, by entity type. */
const JOURNALLED: Record<string, string> = {
  chapter: 'chapters', character: 'characters', characterGoal: 'characterGoals', characterMovement: 'characterMovements',
  characterSnapshot: 'characterSnapshots', crossTimelineArtifact: 'crossTimelineArtifacts', event: 'events', faction: 'factions',
  factionMembership: 'factionMemberships', factionRelationship: 'factionRelationships', item: 'items', itemPlacement: 'itemPlacements',
  itemSnapshot: 'itemSnapshots', knowledgeFact: 'knowledgeFacts', knowledgeReveal: 'knowledgeReveals', location: 'locationMarkers',
  locationSnapshot: 'locationSnapshots', lorePage: 'lorePages', mapAnnotation: 'mapAnnotations', mapRegion: 'mapRegions',
  mapRegionSnapshot: 'mapRegionSnapshots', mapRoute: 'mapRoutes', motif: 'motifs', plotThread: 'plotThreads',
  relationship: 'relationships', relationshipSnapshot: 'relationshipSnapshots', timeline: 'timelines',
  timelineRelationship: 'timelineRelationships',
}

export async function stored(page: Page): Promise<Stored> {
  return page.evaluate(async (tables) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>>; get: (id: string) => Promise<Record<string, unknown> | undefined> }>
    const ops = (await db.operations.toArray()).sort((a, b) => (a.seq as number) - (b.seq as number))
    const last = new Map<string, Record<string, unknown>>()
    for (const op of ops) last.set(`${op.entityType}|${op.entityId}`, op)
    const journal = []
    for (const op of last.values()) {
      const table = tables[op.entityType as string]
      if (!table) continue
      const record = (await db[table].get(op.entityId as string)) ?? null
      journal.push({
        entityType: op.entityType as string,
        entityId: op.entityId as string,
        type: op.type as string,
        // Every operation produces its base + 1: a create is built on 0.
        resulting: (op.baseVersion as number) + 1,
        payload: op.payload as Record<string, unknown>,
        record,
      })
    }
    return {
      chapters: await db.chapters.toArray(),
      events: await db.events.toArray(),
      texts: (await db.sceneTexts.toArray()).map((t) => ({ eventId: t.eventId as string, text: t.text as string })),
      kept: JSON.parse(localStorage.getItem('kathala-kept-headers') ?? '{}'),
      journal,
    }
  }, JOURNALLED)
}

/** Wait until the store stops changing: the page reopened, and has done what it does on opening. */
export async function settleStore(page: Page, quietMs = 1500, maxMs = 30_000): Promise<Stored> {
  const start = Date.now()
  let prev = JSON.stringify(await stored(page))
  let since = Date.now()
  for (;;) {
    await page.waitForTimeout(250)
    const now = await stored(page)
    const key = JSON.stringify(now)
    if (key !== prev) { prev = key; since = Date.now() }
    else if (Date.now() - since >= quietMs) return now
    if (Date.now() - start > maxMs) return now
  }
}

/** Header text left in a scene's prose: a bracket line, or a labelled line of a header block. */
const HEADER_IN_PROSE = /^\s*\[|^\s*\]\s*$|^\s*(Place|Characters|Items|Facts|Relationships|When):/m

/**
 * The invariants. Each returns a list of what breaks it — empty when it holds —
 * so a failing sweep says which delay broke what.
 */
export const invariants = {
  /**
   * Each of `sentences` is in the stored prose at most once, and — unless
   * `mayLose` — exactly once. A sentence an action rewrites is given as its
   * forms, `[before, after]`: whichever the store holds, it holds one, once.
   */
  prose(s: Stored, sentences: ReadonlyArray<string | readonly string[]>, mayLose = false): string[] {
    const all = s.texts.map((t) => t.text).join('\n\n')
    return sentences.flatMap((x) => {
      const forms = typeof x === 'string' ? [x] : x
      const n = forms.reduce((sum, f) => sum + all.split(f).length - 1, 0)
      if (n > 1) return [`"${forms.join('" / "')}" stored ${n} times`]
      if (n === 0 && !mayLose) return [`"${forms.join('" / "')}" lost`]
      return []
    })
  },
  /** No scene's prose holds header text. */
  noHeaderInProse(s: Stored): string[] {
    return s.texts.flatMap((t) => {
      if (!HEADER_IN_PROSE.test(t.text)) return []
      const title = s.events.find((e) => e.id === t.eventId)?.title
      return [`header text in the prose of "${String(title)}": ${JSON.stringify(t.text.slice(0, 160))}`]
    })
  },
  /** No scene's prose holds a heading line, which only an unmade heading leaves. */
  noHeadingInProse(s: Stored): string[] {
    return s.texts.flatMap((t) => {
      if (!/^#{1,2} \S/m.test(t.text)) return []
      const title = s.events.find((e) => e.id === t.eventId)?.title
      return [`a heading left in the prose of "${String(title)}": ${JSON.stringify(t.text.slice(0, 160))}`]
    })
  },
  /**
   * The journal and the store agree: for every record the journal has touched,
   * its last operation is what the record shows — gone for a delete; otherwise
   * at least at the version that operation produced, and holding what it
   * wrote. At least, not exactly: a burst of typing is folded into the one
   * operation it began (`coalesceOperations`), which keeps the burst's first
   * base version while the record counts every write.
   */
  journal(s: Stored): string[] {
    return s.journal.flatMap((j) => {
      const what = `${j.entityType} ${j.entityId}`
      if (j.type === 'delete') return j.record ? [`${what}: deleted in the journal, present in the store`] : []
      if (!j.record) return [`${what}: ${j.type} in the journal, absent from the store`]
      const version = (j.record.version as number | undefined) ?? 1
      if (version < j.resulting) return [`${what}: journal says version ${j.resulting}, store has ${version}`]
      const differs = Object.entries(j.payload)
        .filter(([k]) => k !== 'version' && k !== 'updatedAt')
        .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(j.record![k]))
        .map(([k]) => k)
      return differs.length ? [`${what}: journal and store differ on ${differs.join(', ')}`] : []
    })
  },
}
