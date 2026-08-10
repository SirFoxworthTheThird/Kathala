import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import type { Character, InWorldDate } from '@/types'
import { updateCharacter } from '@/db/hooks/useCharacters'
import { useWorld } from '@/db/hooks/useWorlds'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { formatInWorldDate, dateToDayNumber } from '@/lib/calendar'
import { InWorldDatePicker } from '@/components/InWorldDatePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface OverviewTabProps {
  character: Character
}

export function OverviewTab({ character }: OverviewTabProps) {
  const world = useWorld(character.worldId)
  const calendar = world?.calendar ?? null
  const gate = useGate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(character.name)
  const [description, setDescription] = useState(character.description)
  const [aliases, setAliases] = useState(character.aliases.join(', '))
  const [color, setColor] = useState(character.color ?? '')
  const [birthDate, setBirthDate] = useState<InWorldDate | null>(character.birthDate ?? null)

  async function save() {
    await updateCharacter(character.id, {
      name: name.trim(),
      description: description.trim(),
      aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
      color: color || null,
      birthDate,
    })
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {character.color && (
              <div
                className="h-3.5 w-3.5 rounded-full shrink-0 border border-black/20"
                style={{ background: character.color }}
              />
            )}
            <div>
              <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">{character.name}</h3>
              {character.aliases.length > 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Also known as: {character.aliases.join(', ')}
                </p>
              )}
            </div>
          </div>
          {!gate.active && (
            <Button size="sm" variant="outline" onClick={() => {
              setName(character.name)
              setDescription(character.description)
              setAliases(character.aliases.join(', '))
              setColor(character.color ?? '')
              setBirthDate(character.birthDate ?? null)
              setEditing(true)
            }}>
              Edit
            </Button>
          )}
        </div>
        {calendar && character.birthDate && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Born {formatInWorldDate(calendar, dateToDayNumber(calendar, character.birthDate))}
          </p>
        )}
        {character.description ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">{character.description}</p>
        ) : (
          <p className="text-sm italic text-[hsl(var(--muted-foreground))]">No description.</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Aliases (comma-separated)</Label>
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="e.g. The Shadow, Lord of Nothing" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Arc colour</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color || '#888888'}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-[hsl(var(--border))] bg-transparent p-0.5"
          />
          {color && (
            <button
              type="button"
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
              onClick={() => setColor('')}
            >
              Clear
            </button>
          )}
          {!color && (
            <span className="text-xs text-[hsl(var(--muted-foreground))] italic">No colour set</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Birth date</Label>
        {calendar ? (
          <InWorldDatePicker calendar={calendar} value={birthDate} onChange={setBirthDate} setLabel="Set birth date" />
        ) : (
          /* X-4 rule 2: a birth date needs a calendar, which cannot be made
             from here — so name the screen and go there, rather than naming it
             and leaving the reader to find it (LP-3). */
          <div className="flex flex-col items-start gap-1.5">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              A birth date needs an in-world calendar, so PlotWeave knows what a
              date means and can work out an age.
            </p>
            <Link
              to={`/worlds/${character.worldId}/settings`}
              className="pw-tap inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--foreground))] hover:border-[hsl(var(--ring))]"
            >
              Open World settings
            </Link>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={!name.trim()}>
          <Check className="h-3.5 w-3.5" /> Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      </div>
    </div>
  )
}
