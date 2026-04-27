import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
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
  const [state, setState] = useState<WizardState>({
    step: 1,
    createdEventId: null,
    createdCharacterId: null,
  })

  function advance(patch: Partial<WizardState>) {
    setState((prev) => {
      const next = { ...prev, ...patch }
      return { ...next, step: Math.min(prev.step + 1, 4) as WizardStep }
    })
  }

  function handleStep1Complete(eventId: string) {
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
    <div className="p-6 max-w-xl space-y-8">
      {/* Step indicator */}
      <nav aria-label="Wizard progress">
        <ol className="flex items-center gap-2">
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
  )
}
