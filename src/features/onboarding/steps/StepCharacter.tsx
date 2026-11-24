import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { characterNamed } from '@/db/hooks/useCharacters'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { StepBack } from './StepBack'

interface StepCharacterProps {
  worldId: string
  onComplete: (characterId: string, name: string) => void
  onSkip: () => void
  onBack: () => void
  /** The character this step already made, when stepped back into (**NEW-5**). */
  doneName?: string | null
  onContinue?: () => void
  /**
   * A book of a series: how many of the series' cast it opens with. The step
   * asked a later book for "the first character" and made a second Anna Brisk
   * beside the series' own (UX-1-6, D-7); with a cast, it says so instead.
   */
  seriesCast?: number
}

export function StepCharacter({ worldId, onComplete, onSkip, onBack, doneName, onContinue, seriesCast = 0 }: StepCharacterProps) {
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [descExpanded, setDescExp] = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const headingRef                 = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headingRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Give your character a name.'); return }
    setLoading(true)
    try {
      // In a series, a name its cast already has is that person (D-7).
      const { character } = await characterNamed({ worldId, name: name.trim(), description: description.trim() })
      onComplete(character.id, character.name)
    } finally {
      setLoading(false)
    }
  }

  if (doneName && onContinue) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold text-[hsl(var(--foreground))] focus-visible:outline-none"
          >
            Every story needs someone to follow
          </h2>
          <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
            Done — <strong className="text-[hsl(var(--foreground))]">{doneName}</strong> is in your cast.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <Button onClick={onContinue}>Continue</Button>
          <StepBack onBack={onBack} />
        </div>
      </div>
    )
  }

  if (seriesCast > 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold text-[hsl(var(--foreground))] focus-visible:outline-none"
          >
            Your series’ cast is here — {plural(seriesCast, 'character')}
          </h2>
          <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
            This book opens with the people of the books before it, where the last one left them. Add anyone new from Characters as they come in.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <Button onClick={onSkip}>Continue</Button>
          <StepBack onBack={onBack} />
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-[hsl(var(--foreground))] focus-visible:outline-none"
        >
          Every story needs someone to follow
        </h2>
        <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          Who are we watching? Add the first character whose life will change.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wizard-char-name" className="text-sm">
            Character name
          </Label>
          <Input
            id="wizard-char-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder="Kira Ashvale, The Wanderer, Brother Cael…"
            aria-describedby={error ? 'wizard-char-error' : undefined}
            aria-invalid={!!error}
            className="max-w-md"
            disabled={loading}
            autoFocus
          />
          {error && (
            <p id="wizard-char-error" role="alert" className="text-xs text-red-500">
              {error}
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setDescExp((v) => !v)}
            className={cn(
              'flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded'
            )}
            aria-expanded={descExpanded}
          >
            {/*
              OP-4: this read "Add a description (optional)" and sat directly
              above the primary "Add them to the story". Two adjacent buttons
              both starting with "Add", one of which submits the step and one of
              which expands a field — pressing the wrong one looked like nothing
              happening. A disclosure is named for what it reveals, not for an
              action, so it is a noun now and the collision is gone.
            */}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', descExpanded && 'rotate-180')} />
            Description (optional)
          </button>
          {descExpanded && (
            <Textarea
              id="wizard-char-desc"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="A brief note about who they are…"
              className="mt-2 max-w-md resize-none text-sm"
              rows={3}
              disabled={loading}
              aria-label="Character description (optional)"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button type="submit" disabled={loading} aria-busy={loading}>
          {loading ? 'Adding…' : 'Add them to the story'}
        </Button>
        <div className="flex items-center gap-3">
          <StepBack onBack={onBack} />
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded"
          >
            Skip for now →
          </button>
        </div>
      </div>
    </form>
  )
}
