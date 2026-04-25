import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
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
          Move through your timeline and everything updates — where characters are, what they carry,
          what&apos;s changed. Your story is now trackable.
        </p>
      </div>

      <Button onClick={onNavigate}>
        Go to my Timeline
      </Button>
    </div>
  )
}
