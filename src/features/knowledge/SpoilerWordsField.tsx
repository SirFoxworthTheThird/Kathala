import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { editSpoilerWords } from '@/db/hooks/useKnowledge'
import { parseSpoilerWords, spoilerSuggestions } from '@/lib/spoilerWords'
import type { KnowledgeFact } from '@/types'

/**
 * The words that would give a fact away before the reader is meant to learn
 * it, for the early-reveal check (`KnowledgeFact.spoilerWords`). Asked for once
 * the fact has a reveal scene: the check has nothing to look for otherwise,
 * and the Continuity screen says which facts are in that state. Suggested from
 * the people, places and items the fact names.
 */
export function SpoilerWordsField({ fact, names }: { fact: KnowledgeFact; names: readonly string[] }) {
  const [draft, setDraft] = useState('')
  const words = fact.spoilerWords ?? []
  const suggestions = spoilerSuggestions(fact, names)

  // Each change is made to the words as they are stored, so two in a row both land (`editSpoilerWords`).
  function add(text: string) {
    void editSpoilerWords(fact.id, (current) => parseSpoilerWords([...current, ...parseSpoilerWords(text)].join(',')))
    setDraft('')
  }
  function remove(word: string) {
    void editSpoilerWords(fact.id, (current) => current.filter((w) => w !== word))
  }

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        Words that give it away
      </p>
      {words.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1" aria-label="Spoiler words">
          {words.map((w) => (
            <li key={w} className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] py-0.5 pl-2 pr-1 text-xs">
              {w}
              <button
                type="button"
                aria-label={`Remove “${w}”`}
                onClick={() => remove(w)}
                className="rounded-full p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        className="h-8 text-xs"
        aria-label="Add a spoiler word"
        placeholder="A name, a nickname, an object…"
        value={draft}
        onChange={(e) => {
          const v = e.target.value
          // A comma ends a word, as in a tag list.
          if (/[,;]$/.test(v)) add(v)
          else setDraft(v)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); add(draft) } }}
        onBlur={() => { if (draft.trim()) add(draft) }}
      />
      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">It names:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`Add “${s}”`}
              onClick={() => add(s)}
              className="flex items-center gap-0.5 rounded-full border border-dashed border-[hsl(var(--border))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <Plus className="h-3 w-3" aria-hidden="true" /> {s}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
        Found in an earlier scene, whole word, any of these is listed as a possible early reveal.
      </p>
    </div>
  )
}
