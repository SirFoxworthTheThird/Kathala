import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCharacter } from '@/db/hooks/useCharacters'
import { cn } from '@/lib/utils'

interface StepCharacterProps {
  worldId: string
  onComplete: (characterId: string) => void
  onSkip: () => void
}

export function StepCharacter({ worldId, onComplete, onSkip }: StepCharacterProps) {
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
      const character = await createCharacter({ worldId, name: name.trim(), description: description.trim() })
      onComplete(character.id)
    } finally {
      setLoading(false)
    }
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
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', descExpanded && 'rotate-180')} />
            Add a description (optional)
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
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded"
        >
          Skip for now →
        </button>
      </div>
    </form>
  )
}
