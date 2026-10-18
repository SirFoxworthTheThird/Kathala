import type { KnowledgeFact } from '@/types'
import { toldAt, type PassFact } from '@/lib/spoilerPass'

/**
 * The spoiler pass beside the page: at the scene in view, what the reader has
 * been told so far — by era, where the book has more than one — and what is
 * still to come, with where each is told.
 */
export function SpoilerPassList({ facts, here, eraName, toldIn }: {
  facts: readonly PassFact[]
  /** The scene in view's place in the book, or null before one is in view. */
  here: number | null
  /** The timelines an era is made of, by name. */
  eraName: (era: string | null) => string
  /** Where the reader is told a fact: "Ch. 19". */
  toldIn: (fact: KnowledgeFact) => string
}) {
  const quiet = 'px-1.5 py-1 text-xs text-[hsl(var(--muted-foreground))]'
  if (facts.length === 0) {
    return <p className={quiet}>No fact has a scene where the reader learns it. Set one on the Knowledge screen.</p>
  }
  // Before the first scene is in view, nothing has been read.
  const { told, toCome } = toldAt(facts, here ?? -1)
  const eras = new Set(facts.map((f) => f.era)).size > 1
  const row = (f: PassFact) => (
    <li key={f.fact.id} className="rounded-md px-1.5 py-1 text-xs text-[hsl(var(--foreground))]">
      <span className="block">{f.fact.title}</span>
      <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">
        {toldIn(f.fact)}
        {f.terms.length === 0 && ' · no words to mark'}
      </span>
    </li>
  )
  return (
    <div className="flex flex-col gap-2">
      <section aria-label="Told so far">
        <h3 className="px-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Told so far</h3>
        {told.length === 0 ? <p className={quiet}>Nothing yet.</p> : told.map((g) => (
          <div key={g.era ?? ''}>
            {eras && <h4 className="px-1.5 pt-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{eraName(g.era)}</h4>}
            <ul>{g.facts.map(row)}</ul>
          </div>
        ))}
      </section>
      <section aria-label="Still to come">
        <h3 className="px-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Still to come</h3>
        {toCome.length === 0 ? <p className={quiet}>Nothing: every fact is told by here.</p> : <ul>{toCome.map(row)}</ul>}
      </section>
    </div>
  )
}
