import type { Character } from '@/types'
import type { SortKeyOf } from './characterNames'

/**
 * Two characters who turn out to be one person.
 *
 * The book presents Hyde and Jekyll as two men until its reveal, and the app
 * keeps them as two records — each with their own whereabouts, relationships
 * and history — joined by one link on the character revealed: *Hyde is revealed
 * to be Jekyll, at Hyde Becomes Jekyll*. Jekyll is the pair's **head**.
 *
 * A group is one head and the characters revealed as them. So a character
 * cannot be revealed as themself, nor as someone who is already revealed as
 * someone else, and a head cannot be revealed in turn — no chains.
 */

type Identity = Pick<Character, 'id' | 'revealedAs'>
type Revealing = Partial<Pick<Character, 'revealedAs'>>

/** Who `id` may be revealed as: anyone but themself and anyone revealed as someone; nobody, if they are a head. */
export function revealTargets<T extends Identity>(characters: readonly T[], id: string): T[] {
  if (characters.some((c) => c.revealedAs?.characterId === id)) return []
  return characters.filter((c) => c.id !== id && !c.revealedAs)
}

/** Whether the reveal has been reached at the cursor. A reveal at a scene that cannot be placed has not. */
export function revealReached(character: Revealing, cursor: number | null, sortKeyOf: SortKeyOf): boolean {
  if (!character.revealedAs) return false
  const at = sortKeyOf(character.revealedAs.eventId)
  if (at === undefined) return false
  return cursor === null || at <= cursor
}

/**
 * The other people a character is, in a roster: who they are revealed to be,
 * and who is revealed to be them. Read from the roster handed in — for a reader
 * that is the gated one, whose links not yet reached are already gone and
 * whose unmet characters are not there to be found.
 */
export function identityLinks<T extends Identity>(roster: readonly T[], id: string): { revealedAs: T | null; alsoAs: T[] } {
  const self = roster.find((c) => c.id === id)
  const head = self?.revealedAs ? roster.find((c) => c.id === self.revealedAs!.characterId) ?? null : null
  return { revealedAs: head, alsoAs: roster.filter((c) => c.revealedAs?.characterId === id) }
}
