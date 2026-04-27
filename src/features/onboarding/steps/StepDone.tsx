import { useEffect, useRef } from 'react'
import { Sparkles, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StepDoneProps {
  onNavigate: () => void
}

export function StepDone({ onNavigate }: StepDoneProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headingRef.current?.focus() }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Sparkles className="h-8 w-8 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-[hsl(var(--foreground))] focus-visible:outline-none"
        >
          Your world is alive
        </h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md">
          Your story is alive. As you add more moments to your timeline, move between them — everything
          updates: where your characters are, what they carry, what&apos;s changed.
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md">
          That&apos;s the <span className="font-semibold text-[hsl(var(--foreground))]">time cursor</span>.
          It&apos;s the heart of how PlotWeave works.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 max-w-md">
        <Map className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          When you&apos;re ready, upload a map image and pin your characters to it — their positions
          will update as you move through time, just like everything else.
        </p>
      </div>

      <Button onClick={onNavigate}>
        Go to my Timeline
      </Button>
    </div>
  )
}
