import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTimeline } from '@/db/hooks/useTimeline'
import { createChapter } from '@/db/hooks/useTimeline'
import { createEvent } from '@/db/hooks/useTimeline'

interface StepTimelineProps {
  worldId: string
  onComplete: (eventId: string, sceneTitle: string) => void
  onSkip: () => void
  /**
   * The opening scene this step already made, when the guide has been stepped
   * back into it (**NEW-5**). Set means the form is done with: offering it
   * again would build a second timeline, chapter and scene.
   */
  doneTitle?: string | null
  onContinue?: () => void
}

export function StepTimeline({ worldId, onComplete, onSkip, doneTitle, onContinue }: StepTimelineProps) {
  const [name, setName]       = useState('')
  const [scene, setScene]     = useState('')
  // Which field is complaining, so the message and `aria-invalid` land on the
  // one that is actually empty rather than on whichever renders the error node.
  const [error, setError]     = useState<{ field: 'name' | 'scene'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError({ field: 'name', message: 'Give your timeline a name before we begin.' })
      return
    }
    if (!scene.trim()) {
      setError({ field: 'scene', message: 'Name the first scene — this is the moment your story opens on.' })
      return
    }
    setLoading(true)
    try {
      const timeline = await createTimeline({ worldId, name: name.trim(), description: '', color: '#6366f1' })
      const chapter  = await createChapter({ worldId, timelineId: timeline.id, number: 1, title: 'Chapter 1', synopsis: '' })
      const event    = await createEvent({
        worldId,
        timelineId: timeline.id,
        chapterId: chapter.id,
        title: scene.trim(),
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: 0,
      })
      onComplete(event.id, scene.trim())
    } finally {
      setLoading(false)
    }
  }

  if (doneTitle && onContinue) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            Your story begins with a moment
          </h2>
          <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
            Done — your story opens on <strong className="text-[hsl(var(--foreground))]">{doneTitle}</strong>,
            in Chapter 1 of your new timeline. Rename any of the three whenever you like, from the
            Timeline screen.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <Button onClick={onContinue}>Continue</Button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            Skip and explore on my own →
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          Your story begins with a moment
        </h2>
        <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          Name the stretch of time your story runs over, and the scene it opens on.
          The timeline can be as grand as an age or as intimate as a single journey.
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
          onChange={(e) => { setName(e.target.value); setError(null) }}
          placeholder="The Age of Embers, The Long Road, Act One…"
          aria-describedby={error?.field === 'name' ? 'wizard-timeline-error' : undefined}
          aria-invalid={error?.field === 'name'}
          className="max-w-md"
          disabled={loading}
        />
        {error?.field === 'name' && (
          <p id="wizard-timeline-error" role="alert" className="text-xs text-red-500">
            {error.message}
          </p>
        )}
      </div>

      {/*
        OP-3: this step asked for a timeline name and silently made three
        records — a timeline, "Chapter 1", and a scene that took the timeline's
        own name, so the writer met a moment they had not named and a chapter
        nobody had mentioned. The heading promises a moment, so the step now
        asks for one, and says what it is about to build.
      */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wizard-first-scene" className="text-sm">
          The first scene
        </Label>
        <Input
          id="wizard-first-scene"
          value={scene}
          onChange={(e) => { setScene(e.target.value); setError(null) }}
          placeholder="The wreck, A letter arrives, The gate opens…"
          aria-describedby={error?.field === 'scene' ? 'wizard-scene-error' : 'wizard-creates'}
          aria-invalid={error?.field === 'scene'}
          className="max-w-md"
          disabled={loading}
        />
        <p id="wizard-creates" className="text-xs text-[hsl(var(--muted-foreground))]">
          This makes your timeline, a <strong>Chapter 1</strong> inside it, and that
          scene inside the chapter. All three can be renamed later.
        </p>
        {error?.field === 'scene' && (
          <p id="wizard-scene-error" role="alert" className="text-xs text-red-500">
            {error.message}
          </p>
        )}
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button type="submit" disabled={loading} aria-busy={loading}>
          {/*
            NEW-3: this read "Begin", which is what the wizard has already done.
            It makes the timeline the field above names and moves the guide on,
            so it says both.

            Deliberately not "Create timeline": the Timeline screen's own empty
            state already has a "Create Timeline" button, and re-using the name
            made the two indistinguishable to any lookup that is not screen-
            scoped — `getByRole` matches names case-insensitively. Two specs
            began failing intermittently, clicking the wizard's button while a
            navigation to the Timeline was still settling.
          */}
          {loading ? 'Creating…' : 'Create and continue'}
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
