import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { seenFrom } from '@/lib/seriesAppearances'
import { useReadingGate, OPEN_GATE, type ReadingGate } from './useReading'

/**
 * One reading gate per world, shared by everything that lists entities.
 *
 * Computing the gate means scanning every event and snapshot in the world, so
 * it must happen once rather than once per consumer — a dozen components each
 * calling `useCharacters` would otherwise each rerun that scan on every write.
 *
 * Outside a provider the gate is open, which is what makes it safe for the
 * entity hooks to apply unconditionally: a component rendered outside a world
 * (the world selector, a dialog) simply sees everything, as it should.
 */
const ReadingGateContext = createContext<ReadingGate>(OPEN_GATE)

export function ReadingGateProvider({
  worldId,
  children,
}: {
  worldId: string | null
  children: ReactNode
}) {
  const reading = useReadingGate(worldId)
  /*
    And what this book sees of the series' bible: a person, item or place kept to
    another book (issue #698, D-4's *in this book only*) is in no list here. On
    the gate for the reason the gate is here: every entity hook already filters
    by it, so the mark holds on screens nobody thought about.
  */
  const gate = useMemo(() => ({ ...reading, filter: <T extends { id: string }>(records: readonly T[]) => seenFrom(reading.filter(records), worldId) }), [reading, worldId])
  return <ReadingGateContext.Provider value={gate}>{children}</ReadingGateContext.Provider>
}

/**
 * The gate in force for the world being viewed.
 *
 * Entity hooks call this and filter with it, which is what makes gating hold
 * for screens nobody thought about — including ones added later. Gating each
 * view by hand would leave the next view unguarded by default, and the default
 * has to be safe.
 */
export function useGate(): ReadingGate {
  return useContext(ReadingGateContext)
}
