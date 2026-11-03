import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RelatedLoreSection } from '../RelatedLoreSection'

const gate = vi.hoisted(() => ({ active: false }))
vi.mock('@/db/hooks/ReadingGateContext', () => ({ useGate: () => gate }))
vi.mock('@/db/hooks/useLore', () => ({ useLorePagesForEntity: () => [] }))

describe('empty related lore in reading mode', () => {
  it('keeps the author’s route for associating a lore page', () => {
    gate.active = false
    const html = renderToStaticMarkup(<MemoryRouter><RelatedLoreSection worldId="w" entityId="knife" entityName="The whittle" /></MemoryRouter>)
    expect(html).toContain('href="/worlds/w/lore"')
    expect(html).toContain('Open Lore')
  })
  it('does not show authoring instructions on a reader’s item page', () => {
    gate.active = true
    const html = renderToStaticMarkup(<MemoryRouter><RelatedLoreSection worldId="w" entityId="knife" entityName="The whittle" /></MemoryRouter>)
    expect(html).toBe('')
  })
})
