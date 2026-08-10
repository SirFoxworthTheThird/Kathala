import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { StepTimeline } from './steps/StepTimeline'
import { StepCharacter } from './steps/StepCharacter'
import { StepPlace } from './steps/StepPlace'
import { StepDone } from './steps/StepDone'

type WizardStep = 1 | 2 | 3 | 4

interface WizardState {
  step: WizardStep
  createdEventId: string | null
  createdCharacterId: string | null
}

const STEP_LABELS = [
  'Begin your story',
  'Add a character',
  'Place them in the story',
  'Done',
]

interface OnboardingWizardProps {
  worldId: string
  onExit: () => void
}

export function OnboardingWizard({ worldId, onExit }: OnboardingWizardProps) {
  const navigate = useNavigate()
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  const [state, setState] = useState<WizardState>({
    step: 1,
    createdEventId: null,
    createdCharacterId: null,
  })

  /*
    NEW-1: while the guide is on screen it should be the loudest thing on it.
    The class dims the nav rail (see index.css) without removing anything from
    it — the rail stays clickable, because leaving a blank world that way is a
    supported path, not a mistake to be prevented.

    Kept on the document root rather than in the store on purpose: it lives
    exactly as long as this component, cleans itself up on unmount, and adds no
    global state that every other world would then have to be checked against.
  */
  useEffect(() => {
    document.documentElement.classList.add('pw-guiding')
    return () => document.documentElement.classList.remove('pw-guiding')
  }, [])

  function advance(patch: Partial<WizardState>) {
    setState((prev) => {
      const next = { ...prev, ...patch }
      return { ...next, step: Math.min(prev.step + 1, 4) as WizardStep }
    })
  }

  function handleStep1Complete(eventId: string) {
    // Step 1 is headed "Your story begins with a moment" and creates one, so the
    // guide has already chosen where the writer is. It used to hand back an app
    // that had forgotten: the pill read "All chapters" the instant the guide
    // ended, and everything cursor-dependent was switched off for someone who
    // had done exactly what they were asked. The later steps place a character
    // at this moment too, so setting it here makes them agree.
    setActiveEventId(eventId)
    advance({ createdEventId: eventId })
  }

  function handleStep2Complete(characterId: string) {
    advance({ createdCharacterId: characterId })
  }

  function handleStep2Skip() {
    // Skip step 2 and step 3 (no character to place)
    setState((prev) => ({ ...prev, step: 4, createdCharacterId: null }))
  }

  function handleStep3Complete() {
    advance({})
  }

  function handleNavigateToTimeline() {
    onExit()
    navigate('timeline')
  }

  return (
    // The guide is the subject of the screen, so it sits in the middle of it on
    // a card rather than as a form pinned to the top-left corner.
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-8 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl sm:p-8">
      {/*
        NEW-2: the indicator was four bare numbers. The step names existed, but
        only inside each dot's `aria-label` — so a screen reader was told what
        step 3 would ask and a sighted reader was not. They are on screen now,
        which is what answers the finding's three questions at once: what you
        are committing to, how long it is, and what is coming.

        Below `sm` only the current step keeps its name, since four labels in a
        row do not fit a phone — the numbers and the tick still carry position.
      */}
      <nav aria-label="Wizard progress">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {STEP_LABELS.map((label, i) => {
            const stepNum = (i + 1) as WizardStep
            const isActive    = state.step === stepNum
            const isCompleted = state.step > stepNum
            return (
              <li key={stepNum} className="flex items-center gap-2">
                <span
                  aria-label={`Step ${stepNum} of 4: ${label}${isCompleted ? ' (completed)' : isActive ? ' (current)' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
                    isCompleted
                      ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                      : isActive
                        ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                  )}
                >
                  {isCompleted ? '✓' : stepNum}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'text-[11px] leading-tight',
                    isActive
                      ? 'font-medium text-[hsl(var(--foreground))]'
                      : 'hidden text-[hsl(var(--muted-foreground))] sm:inline',
                  )}
                >
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-px w-6 transition-colors',
                      isCompleted ? 'bg-[hsl(var(--foreground))]' : 'bg-[hsl(var(--border))]'
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Step content */}
      {state.step === 1 && (
        <StepTimeline
          worldId={worldId}
          onComplete={handleStep1Complete}
          onSkip={onExit}
        />
      )}
      {state.step === 2 && (
        <StepCharacter
          worldId={worldId}
          onComplete={handleStep2Complete}
          onSkip={handleStep2Skip}
        />
      )}
      {state.step === 3 && (
        <StepPlace
          worldId={worldId}
          characterId={state.createdCharacterId}
          createdEventId={state.createdEventId}
          onComplete={handleStep3Complete}
          onSkip={() => advance({})}
        />
      )}
      {state.step === 4 && (
        <StepDone onNavigate={handleNavigateToTimeline} />
      )}
      </div>
    </div>
  )
}
