/**
 * Why a primary action cannot run yet (X-9).
 *
 * Actions across the app disabled themselves and said nothing: *Add Location*
 * greyed out until Name was filled (**OP-6**), *Save route* until the route had
 * both a name and two points (**RT-1**). No required marker, no helper text, no
 * message on hover — the button simply did nothing and the writer had to guess
 * which of several fields was at fault.
 *
 * The rule this encodes: state the unmet requirements, all of them, and only
 * while they are unmet. A permanent sentence under every control is its own
 * finding (**X-5**), so a satisfied requirement says nothing at all.
 */

export interface Requirement {
  /** True when this requirement is satisfied. */
  met: boolean
  /** What is still needed, as a noun phrase: "a name", "two points". */
  need: string
}

/** The unmet requirements, in the order they were declared. */
export function unmetRequirements(checks: readonly Requirement[]): string[] {
  return checks.filter((c) => !c.met).map((c) => c.need)
}

/** Joins a list the way a sentence does: "a", "a and b", "a, b and c". */
export function listPhrase(parts: readonly string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * A short sentence naming everything still missing, or null when the action can
 * run. Null is the signal to render nothing — not an empty string, which would
 * leave the layout reserving space for a message that never comes.
 */
export function blockingReason(checks: readonly Requirement[]): string | null {
  const unmet = unmetRequirements(checks)
  if (unmet.length === 0) return null
  return `Needs ${listPhrase(unmet)}.`
}
