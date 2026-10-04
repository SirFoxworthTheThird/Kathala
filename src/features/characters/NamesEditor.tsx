import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import type { DraftNameChange } from '@/lib/characterNames'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldName } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SceneOptions } from './useSceneOptions'

/**
 * The names a character goes by over the book — what the Overview's editor
 * shows under the aliases.
 *
 * **Names over the book**: from a scene, the book calls them something else —
 * Gandalf the Grey, then the White. **When each alias is learned**: an alias
 * the reader is given partway through — Elessar, in Lothlórien. A reader is
 * shown the name and aliases in effect at their place (`gate.names`); a writer
 * sees the character's own name, and these.
 */
export function NamesEditor({ ownName, changes, onChanges, aliases, aliasesFrom, onAliasesFrom, scenes }: {
  ownName: string
  changes: DraftNameChange[]
  onChanges: (next: DraftNameChange[]) => void
  aliases: string[]
  aliasesFrom: Record<string, string>
  onAliasesFrom: (next: Record<string, string>) => void
  scenes: SceneOptions
}) {
  const id = useId()
  const set = (key: string, patch: Partial<DraftNameChange>) =>
    onChanges(changes.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-labelledby={`${id}-names`} className="flex flex-col gap-1.5">
        <FieldName id={`${id}-names`}>Names over the book</FieldName>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          From a scene on, the book calls them something else. A reader sees the name in effect where they are;
          you see {ownName.trim() || 'their own name'} everywhere.
        </p>
        {changes.map((c, i) => (
          <div key={c.key} className="flex flex-wrap items-center gap-2 text-xs">
            <FieldName id={`${id}-${c.key}-from`} className="text-[hsl(var(--muted-foreground))]">From</FieldName>
            <Select value={c.eventId ?? undefined} onValueChange={(v) => set(c.key, { eventId: v })}>
              <SelectTrigger
                id={`${id}-${c.key}-scene`}
                className="h-8 w-56 text-xs"
                aria-labelledby={`${id}-${c.key}-from ${id}-${c.key}-scene`}
              ><SelectValue placeholder="choose a scene" /></SelectTrigger>
              <SelectContent>
                {scenes.events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id} className="text-xs">{scenes.label(ev)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldName id={`${id}-${c.key}-called`} className="text-[hsl(var(--muted-foreground))]">called</FieldName>
            <Input
              className="h-8 w-48 text-xs"
              value={c.name}
              aria-labelledby={`${id}-${c.key}-called`}
              placeholder="e.g. Gandalf the White"
              onChange={(e) => set(c.key, { name: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Remove name change ${i + 1}${c.name.trim() ? `, ${c.name.trim()}` : ''}`}
              onClick={() => onChanges(changes.filter((x) => x.key !== c.key))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => onChanges([...changes, { key: `${Date.now()}-${changes.length}`, eventId: null, name: '' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add a name change
        </Button>
      </div>

      {aliases.length > 0 && (
        <div role="group" aria-labelledby={`${id}-learned`} className="flex flex-col gap-1.5">
          <FieldName id={`${id}-learned`}>When each alias is learned</FieldName>
          {aliases.map((alias, i) => (
            <div key={alias} className="flex flex-wrap items-center gap-2 text-xs">
              <FieldName id={`${id}-alias-${i}`} className="min-w-24 text-[hsl(var(--foreground))]">{alias}</FieldName>
              <FieldName id={`${id}-alias-${i}-from`} className="text-[hsl(var(--muted-foreground))]">known from</FieldName>
              <Select
                value={aliasesFrom[alias] ?? '__start__'}
                onValueChange={(v) => {
                  const next = { ...aliasesFrom }
                  if (v === '__start__') delete next[alias]
                  else next[alias] = v
                  onAliasesFrom(next)
                }}
              >
                <SelectTrigger
                  id={`${id}-alias-${i}-scene`}
                  className="h-8 w-56 text-xs"
                  aria-labelledby={`${id}-alias-${i} ${id}-alias-${i}-from ${id}-alias-${i}-scene`}
                ><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__start__" className="text-xs">The start</SelectItem>
                  {scenes.events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id} className="text-xs">{scenes.label(ev)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
