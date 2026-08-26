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
import { Field, FieldName } from '@/components/ui/field'
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
    /*
      CH-1 was filed as "the Overview shows the name and biography only —
      aliases, colour and birth date live behind Edit". Measured, two of the
      three were already here: aliases rendered as "Also known as", and the
      colour was the dot beside the name. What was true is the birth date, which
      the read view dropped whenever the world had no calendar — the value was
      stored, and the screen said nothing at all about it. A read view may omit
      a field that is unset; it may not omit one that is set.

      So: the birth date is shown either way, formatted where a calendar can
      name the month and raw where none exists, and the colour is a labelled row
      rather than a bare dot that says nothing about what the colour is *for*.

      Aliases moved the other way. They are identity, they were already in the
      page header beside the portrait, and repeating them here is the same
      mistake as CH-2 one field over — so the header owns name and aliases, and
      this tab owns everything else.

      Absent rows still mean "unset" — no "Born: —" here. That is X-4's rule 3
      and X-14's finding about the ambiguous em-dash, and a row per unset field
      on every character would cost far more than it tells.
    */
    const born = character.birthDate
      ? (calendar
          ? formatInWorldDate(calendar, dateToDayNumber(calendar, character.birthDate))
          // No calendar to name the month, so the stored numbers stand in — and
          // `month` is 0-based in storage, which no reader should have to know.
          : `year ${character.birthDate.year}, month ${character.birthDate.month + 1}, day ${character.birthDate.day}`)
      : null

    return (
      <div className="flex flex-col gap-4">
        {/* CH-2: the name used to be repeated here as a heading, directly under
            the tabs and a few pixels below the same name in the page header. */}
        <div className="flex items-start justify-between gap-3">
          <dl className="flex min-w-0 flex-col gap-1.5 text-xs">
            {born && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-[hsl(var(--muted-foreground))]">Born</dt>
                <dd className="text-[hsl(var(--foreground))]">{born}</dd>
              </div>
            )}
            {/*
              The author's own field, and it was the first line of the page — a
              reader opening a character to remember who they are met "Colour ●
              on the map and the Arc grid" above the description they came for.
              It says where *this app* draws them, which is a fact about the
              tool rather than about the person.
            */}
            {character.color && !gate.active && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-[hsl(var(--muted-foreground))]">Colour</dt>
                <dd className="flex items-center gap-1.5 text-[hsl(var(--foreground))]">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-black/20"
                    style={{ background: character.color }}
                  />
                  <span className="text-[hsl(var(--muted-foreground))]">on the map and the Arc grid</span>
                </dd>
              </div>
            )}
          </dl>
          {!gate.active && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => {
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
      <Field label="Name" className="flex flex-col gap-1.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Aliases (comma-separated)" className="flex flex-col gap-1.5">
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="e.g. The Shadow, Lord of Nothing" />
      </Field>
      <Field label="Arc colour" className="flex flex-col gap-1.5">
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
      </Field>
      <div className="flex flex-col gap-1.5">
        <FieldName>Birth date</FieldName>
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
      <Field label="Description" className="flex flex-col gap-1.5">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
      </Field>
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
