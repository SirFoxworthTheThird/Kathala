import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTimeline } from '@/db/hooks/useTimeline'
import { createChapter } from '@/db/hooks/useTimeline'
import { createEvent } from '@/db/hooks/useTimeline'

interface StepTimelineProps {
  worldId: string
  onComplete: (eventId: string) => void
  onSkip: () => void
}

export function StepTimeline({ worldId, onComplete, onSkip }: StepTimelineProps) {
  const [name, setName]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Give this moment a name before we begin.'); return }
    setLoading(true)
    try {
      const timeline = await createTimeline({ worldId, name: name.trim(), description: '', color: '#6366f1' })
      const chapter  = await createChapter({ worldId, timelineId: timeline.id, number: 1, title: 'Chapter 1', synopsis: '' })
      const event    = await createEvent({
        worldId,
        timelineId: timeline.id,
        chapterId: chapter.id,
        title: name.trim(),
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
      })
      onComplete(event.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          Your story begins with a moment
        </h2>
        <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          Give your timeline a name — it can be as grand as an age or as intimate as a single journey.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wizard-timeline-name" className="text-sm">
          Timeline name
        </Label>
        <Input
          id="wizard-timeline-name"
          ref={inputRef}
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
          placeholder="The Age of Embers, The Long Road, Act One…"
          aria-describedby={error ? 'wizard-timeline-error' : undefined}
          aria-invalid={!!error}
          className="max-w-md"
          disabled={loading}
        />
        {error && (
          <p id="wizard-timeline-error" role="alert" className="text-xs text-red-500">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button type="submit" disabled={loading} aria-busy={loading}>
          {loading ? 'Creating…' : 'Begin'}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded"
        >
          Skip and explore on my own →
        </button>
      </div>
    </form>
  )
}
