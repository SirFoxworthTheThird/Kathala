import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { guideKey, hasGuideProgress, readGuide, type GuideProgress, type GuideStep } from '@/lib/guideProgress'
import { StepTimeline } from './steps/StepTimeline'
import { StepCharacter } from './steps/StepCharacter'
import { StepPlace } from './steps/StepPlace'
import { StepDone } from './steps/StepDone'

type WizardStep = GuideStep

/** What steps 1 and 2 made is kept so stepping back can show it (**NEW-5**),
 *  and so a reload can resume where the writer was (**N14**). */
type WizardState = GuideProgress

const STEP_LABELS = [
  'Begin your story',
  'Add a character',
  'Place them in the story',
  'Done',
]

/** localStorage throws outright in some private-browsing modes. */
function safeRead(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

interface OnboardingWizardProps {
  worldId: string
  onExit: () => void
}

export function OnboardingWizard({ worldId, onExit }: OnboardingWizardProps) {
  const navigate = useNavigate()
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  /*
    N14: this was component state, and the condition that summons the guide is
    "this world has no timeline" — which step 1 makes false. So a reload between
    step 1 and step 2 dropped the writer on the dashboard with the rest of the
    guide skipped and no way back in.
  */
  const storageKey = guideKey(worldId)
  const [state, setState] = useState<WizardState>(() => {
    const stored = readGuide(safeRead(storageKey))
    if (stored && stored !== 'done') return stored
    return {
      step: 1,
      createdEventId: null,
      createdCharacterId: null,
      createdEventTitle: null,
      createdCharacterName: null,
    }
  })

  /*
    Written on every change rather than at each of the six places that make one,
    so a step added later cannot forget to record itself — but only once there
    is something to come back to. This effect runs on mount too, and storing the
    pristine step 1 would mean the sight of the guide counted as being part-way
    through it. See `hasGuideProgress`.

    A layout effect, so the write lands before the new step is painted. As a
    passive effect it ran *after* paint, leaving a window where the guide was
    visibly on step 2 and storage still said step 1 — reload inside it and the
    progress was gone. The e2e caught it as a flake, which is what that window
    looks like from the outside; a writer who finishes a step and reloads at
    once is in the same window.
  */
  useLayoutEffect(() => {
    if (!hasGuideProgress(state)) return
    try { localStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* private mode */ }
  }, [storageKey, state])

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

  /*
    NEW-5: the guide had a forward action and a way out, and nothing between —
    once you were past step 1 you could not look at it again.

    Back is navigation, not undo. Every step writes a record when it completes,
    and none of that is taken back; steps 1 and 2 show what they already made
    rather than offering the form a second time, so a walk back and forward
    cannot leave a world with two opening scenes in it.

    From the last step it skips step 3 when there is nobody to place — that is
    the state `handleStep2Skip` jumps over, and landing on "place a character"
    with no character would be a worse dead end than the one being fixed.
  */
  function back() {
    setState((prev) => {
      if (prev.step === 4 && !prev.createdCharacterId) return { ...prev, step: 2 }
      return { ...prev, step: Math.max(1, prev.step - 1) as WizardStep }
    })
  }

  function goTo(step: WizardStep) {
    setState((prev) => ({ ...prev, step }))
  }

  function handleStep1Complete(eventId: string, sceneTitle: string) {
    // Step 1 is headed "Your story begins with a moment" and creates one, so the
    // guide has already chosen where the writer is. It used to hand back an app
    // that had forgotten: the pill read "All chapters" the instant the guide
    // ended, and everything cursor-dependent was switched off for someone who
    // had done exactly what they were asked. The later steps place a character
    // at this moment too, so setting it here makes them agree.
    setActiveEventId(eventId)
    advance({ createdEventId: eventId, createdEventTitle: sceneTitle })
  }

  function handleStep2Complete(characterId: string, name: string) {
    advance({ createdCharacterId: characterId, createdCharacterName: name })
  }

  function handleStep2Skip() {
    // Skip step 2 and step 3 (no character to place)
    setState((prev) => ({ ...prev, step: 4, createdCharacterId: null, createdCharacterName: null }))
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
          doneTitle={state.createdEventTitle}
          onContinue={() => goTo(2)}
        />
      )}
      {state.step === 2 && (
        <StepCharacter
          worldId={worldId}
          onComplete={handleStep2Complete}
          onSkip={handleStep2Skip}
          onBack={back}
          doneName={state.createdCharacterName}
          onContinue={() => goTo(3)}
        />
      )}
      {state.step === 3 && (
        <StepPlace
          worldId={worldId}
          characterId={state.createdCharacterId}
          createdEventId={state.createdEventId}
          onComplete={handleStep3Complete}
          onSkip={() => advance({})}
          onBack={back}
        />
      )}
      {state.step === 4 && (
        <StepDone onNavigate={handleNavigateToTimeline} onBack={back} />
      )}
      </div>
    </div>
  )
}
