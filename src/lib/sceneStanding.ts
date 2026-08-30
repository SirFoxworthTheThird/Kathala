import type { WorldEvent } from '@/types'

/**
 * How a character stands to one scene — the *cast* ledger, which is not the
 * state ledger.
 *
 * PlotWeave keeps two separate records of "who is in this scene", and they
 * answer different questions. A `CharacterSnapshot` says **where someone is** at
 * a moment; a scene's cast says **they are in it**. Recording that Corvin is at
 * the harbour during Chapter 9 is a statement about the harbour, not an entrance
 * — and the whole delta model depends on being able to place the people who are
 * *off* stage, or "where is everyone right now" could not be answered at all.
 *
 * The distinction is right and the app has been bitten by it twice. Onboarding's
 * Place step once wrote only the snapshot, and the dashboard then greeted the
 * writer with "Ysolde Vane — never appears — 0 sc" about the character it had
 * just placed (`StepPlace.tsx` now writes both, and says why). A blind writer
 * run then recorded two characters' state by hand and read "History 2 ·
 * Appearances 0" on the character page, with nothing anywhere saying the two
 * counts measure different things.
 *
 * So this is not a reconciliation of the two ledgers — merging them would make
 * every off-stage position an entrance. It is the sentence that was missing:
 * shown where the state is recorded, so the writer learns the difference at the
 * moment it matters rather than from a count that reads like zero work done.
 */
export type SceneStanding = 'pov' | 'cast' | 'mentioned' | 'absent'

/**
 * POV outranks cast: the point-of-view character is in the scene whether or not
 * anyone remembered to list them, which is the same rule
 * `computeCharacterAppearances` and the prose checker already apply.
 */
export function sceneStanding(
  /*
    `mentionedCharacterIds` is optional here where `WorldEvent` requires it:
    records written before the field existed do not carry one, which is why
    every reader in the app — `computeCharacterAppearances`, the prose
    checker — coalesces it. The type says what the function actually accepts.
  */
  event: (Pick<WorldEvent, 'povCharacterId' | 'involvedCharacterIds'>
    & Partial<Pick<WorldEvent, 'mentionedCharacterIds'>>) | undefined,
  characterId: string,
): SceneStanding {
  if (!event) return 'absent'
  if (event.povCharacterId === characterId) return 'pov'
  if (event.involvedCharacterIds.includes(characterId)) return 'cast'
  if ((event.mentionedCharacterIds ?? []).includes(characterId)) return 'mentioned'
  return 'absent'
}

/** Whether the standing puts the character in the room. */
export function isOnStage(standing: SceneStanding): boolean {
  return standing === 'pov' || standing === 'cast'
}

/**
 * The line shown beside the state editor.
 *
 * Every standing gets one, including the two that are fine. A sentence that
 * appears only when something is missing reads as a warning, and this is not a
 * warning — recording where an absent character is standing is exactly what the
 * feature is for. Saying so in all four cases makes it a statement of fact, and
 * makes the off-stage case the only one that also offers an act.
 */
export function describeSceneStanding(standing: SceneStanding, name: string): string {
  switch (standing) {
    case 'pov':
      return `${name} is the point-of-view character for this scene.`
    case 'cast':
      return `${name} is in this scene's cast.`
    case 'mentioned':
      return `${name} is mentioned in this scene but is not in its cast.`
    case 'absent':
      return `${name} is not in this scene's cast. What you record here is where they are while it happens, not that they are in it.`
  }
}
