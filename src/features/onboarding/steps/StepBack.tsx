/**
 * The guide's step-back control (**NEW-5**).
 *
 * Named "Back a step" rather than "Back": the chapter detail screen already has
 * a button called Back, and `getByRole` matches names case-insensitively and by
 * substring, so two screens sharing a name makes every unscoped lookup ambiguous
 * across a navigation.
 *
 * It is navigation, not undo. Each step of the guide writes a record when it
 * completes, and stepping back does not take that back — steps 1 and 2 show
 * what they already made instead of offering the form a second time, so going
 * back and forward cannot leave a world with two opening scenes in it.
 */
export function StepBack({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="rounded text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
    >
      ← Back a step
    </button>
  )
}
