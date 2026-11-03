import { useId, useState } from 'react'
import { X } from 'lucide-react'
import { db } from '@/db/database'
import { updateCharacter } from '@/db/hooks/useCharacters'
import { addAliases } from '@/lib/characterNames'
import { stillToAsk, type PendingName } from '@/lib/pendingNames'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Under the writing, once the "@" picker has made somebody: the other names
 * they go by, asked for there rather than on the Characters screen.
 *
 * The picker makes a character from one name, mid-sentence, and that is all
 * they had — so a book where Strider is Aragorn needed a trip to the
 * character's Overview for every alias, and until then the prose's *Aragorn*
 * was nobody the page knew. This asks, and only asks: it takes no focus, and
 * the writer can go on writing and leave it, or close it.
 */
export function NewCharacterNames({ character, onDone, of }: {
  character: { id: string; name: string }
  onDone: () => void
  /** Others waiting behind this one: their count, and the way to close them all. */
  of?: { count: number; dismissAll: () => void }
}) {
  const id = useId()
  const [typed, setTyped] = useState('')
  async function save() {
    const now = await db.characters.get(character.id)
    if (!now) { onDone(); return }
    const aliases = addAliases(now.aliases ?? [], now.name, typed)
    if (aliases.length !== (now.aliases ?? []).length) await updateCharacter(character.id, { aliases })
    onDone()
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"
      onSubmit={(e) => { e.preventDefault(); void save() }}
    >
      <label htmlFor={id}>
        <span className="text-[hsl(var(--foreground))]">{character.name}</span> is new{of ? ` (1 of ${of.count})` : ''}. Other names they go by:
      </label>
      <Input
        id={id}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="e.g. Aragorn, Elessar"
        className="h-7 w-56 text-xs"
      />
      <Button type="submit" variant="outline" size="sm" className="h-7 px-2 text-[11px] pointer-coarse:h-11" disabled={!typed.trim()}>
        Add names
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11"
        aria-label={`Not now: no other names for ${character.name}`}
        onClick={onDone}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      {of && (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] pointer-coarse:h-11" onClick={of.dismissAll}>
          Not now, for all {of.count}
        </Button>
      )}
    </form>
  )
}

/**
 * The people still to be asked, one at a time: the first, with how many wait
 * behind it. Each used to have a line of its own, and three of them stood above
 * the page for dozens of sessions, about 96px of it (writer run 11).
 */
export function PendingNamesPrompt({ pending, characters, onDone, className }: {
  pending: readonly PendingName[]
  characters: ReadonlyArray<{ id: string; aliases?: readonly string[] }>
  /** These have been answered or closed. */
  onDone: (ids: string[]) => void
  className?: string
}) {
  const asking = stillToAsk(pending, characters)
  if (asking.length === 0) return null
  const [first] = asking
  return (
    <div className={className}>
      <NewCharacterNames
        key={first.id}
        character={first}
        onDone={() => onDone([first.id])}
        of={asking.length > 1 ? { count: asking.length, dismissAll: () => onDone(asking.map((c) => c.id)) } : undefined}
      />
    </div>
  )
}
