import { createContext, useContext, type ReactNode } from 'react'
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
  const gate = useReadingGate(worldId)
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
