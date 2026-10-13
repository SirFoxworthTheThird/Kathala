import type { Faction, FactionMembership, WorldEvent } from '@/types'

type Cast = Pick<WorldEvent, 'involvedCharacterIds' | 'remoteCharacterIds' | 'povCharacterId'>

/** The scene's own cast — on stage, on the phone, its point of view — less anybody dead by then. */
export function livingCast(event: Cast | undefined, dead: ReadonlySet<string>): Set<string> {
  if (!event) return new Set()
  const ids = [...event.involvedCharacterIds, ...(event.remoteCharacterIds ?? []), ...(event.povCharacterId ? [event.povCharacterId] : [])]
  return new Set(ids.filter((id) => !dead.has(id)))
}

/**
 * The sides in a scene, for the Writer's Brief: each faction with somebody in
 * the scene's living cast (`livingCast`) in it, and who — not everybody the
 * brief carries forward to show where they are. Writer run 9's Union Hall had
 * two people in it and the section named five factions, three of them for
 * people elsewhere or dead.
 */
export function sceneFactions(
  cast: ReadonlySet<string>,
  factions: readonly Faction[],
  memberships: readonly FactionMembership[],
): { faction: Faction; memberIds: string[] }[] {
  return factions.flatMap((faction) => {
    const memberIds = [...new Set(memberships.filter((m) => m.factionId === faction.id && cast.has(m.characterId)).map((m) => m.characterId))]
    return memberIds.length ? [{ faction, memberIds }] : []
  })
}
