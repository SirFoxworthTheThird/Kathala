import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, X, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter } from '@/db/hooks/useTimeline'
import {
  getTutorialProgress,
  setTutorialProgress,
  advanceTutorial,
  skipTutorial,
} from './tutorialState'

// ─── Shared UI pieces ────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current
              ? 'w-4 bg-[hsl(var(--ring))]'
              : i === current
              ? 'w-4 bg-[hsl(var(--foreground))]'
              : 'w-1.5 bg-[hsl(var(--border))]'
          }`}
        />
      ))}
    </div>
  )
}

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-2xl">
        {children}
      </div>
    </div>
  )
}

interface FloatingCardProps {
  children: React.ReactNode
  /** Show an arrow pointing at the chapter bar at the bottom */
  arrowToBar?: boolean
}

function FloatingCard({ children, arrowToBar }: FloatingCardProps) {
  return (
    <div
      className="fixed right-5 z-[1010] w-80 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"
      style={{ bottom: 'calc(3.25rem + 1.25rem)' }}
    >
      {arrowToBar && (
        <div className="absolute -bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center">
          <ArrowDown className="h-5 w-5 animate-bounce text-[hsl(var(--ring))]" />
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── TutorialWelcome (steps 0-1, mounted in WorldSelectorView) ───────────────

export function TutorialWelcome() {
  const [progress, setProgress] = useState(getTutorialProgress)
  const [worldName, setWorldName] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  function refresh() { setProgress(getTutorialProgress()) }

  if (progress.done || progress.step > 1) return null

  // ── Step 0: Welcome ──────────────────────────────────────────────────────
  if (progress.step === 0) {
    return (
      <ModalOverlay>
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--accent))]">
            <BookOpen className="h-7 w-7 text-[hsl(var(--foreground))]" />
          </div>
          <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Welcome to PlotWeave</h2>
          <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            A story tracker built around one idea: every character, location, and item in your world has a state that evolves chapter by chapter.
          </p>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Let's set up your first story together — it'll take about 2 minutes.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => { advanceTutorial(); refresh() }}
          >
            Get started <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="w-full text-[hsl(var(--muted-foreground))]"
            onClick={() => { skipTutorial(); refresh() }}
          >
            Skip tutorial
          </Button>
        </div>
      </ModalOverlay>
    )
  }

  // ── Step 1: Name your world ──────────────────────────────────────────────
  async function handleCreateWorld() {
    if (!worldName.trim()) return
    setSaving(true)
    try {
      const world = await createWorld({ name: worldName.trim(), description: '' })
      advanceTutorial({ worldId: world.id })
      navigate(`/worlds/${world.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay>
      <div className="mb-1 flex items-center justify-between">
        <StepDots current={0} total={5} />
        <button
          onClick={() => { skipTutorial(); refresh() }}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <h2 className="mt-4 text-xl font-bold text-[hsl(var(--foreground))]">Name your story world</h2>
      <p className="mt-1.5 mb-5 text-sm text-[hsl(var(--muted-foreground))]">
        A world is the container for your entire story — characters, maps, timelines, and more. You can have multiple worlds for different stories.
      </p>
      <div className="mb-5 flex flex-col gap-1.5">
        <Label htmlFor="tut-world-name">World name</Label>
        <Input
          id="tut-world-name"
          placeholder="e.g. The Shattered Realms"
          value={worldName}
          onChange={(e) => setWorldName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateWorld()}
          autoFocus
        />
      </div>
      <Button
        className="w-full"
        disabled={!worldName.trim() || saving}
        onClick={handleCreateWorld}
      >
        {saving ? 'Creating...' : <>Create World <ChevronRight className="h-4 w-4" /></>}
      </Button>
    </ModalOverlay>
  )
}

// ─── TutorialWizard (steps 2-5, mounted in AppShell) ─────────────────────────

export function TutorialWizard() {
  const [progress, setProgress] = useState(getTutorialProgress)
  const [charName, setCharName] = useState('')
  const [chapterTitle, setChapterTitle] = useState('Chapter 1')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  function refresh() { setProgress(getTutorialProgress()) }

  const { step, worldId, done } = progress

  if (done || step < 2 || step > 5 || !worldId) return null

  // ── Step 2: Add your first character ────────────────────────────────────
  if (step === 2) {
    async function handleAddCharacter() {
      if (!charName.trim() || !worldId) return
      setSaving(true)
      try {
        await createCharacter({ worldId, name: charName.trim(), description: '' })
        advanceTutorial()
        refresh()
      } finally {
        setSaving(false)
      }
    }

    return (
      <FloatingCard>
        <div className="mb-3 flex items-center justify-between">
          <StepDots current={1} total={5} />
          <button
            onClick={() => { skipTutorial(); refresh() }}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <h3 className="mb-1 font-semibold text-[hsl(var(--foreground))]">Add your first character</h3>
        <p className="mb-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          Characters are the heart of your story. You'll track their state — location, status, inventory — as it changes through each chapter.
        </p>
        <div className="mb-3 flex flex-col gap-1.5">
          <Label className="text-xs" htmlFor="tut-char-name">Character name</Label>
          <Input
            id="tut-char-name"
            className="h-8 text-sm"
            placeholder="e.g. Aria Stormwind"
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCharacter()}
            autoFocus
          />
        </div>
        <Button size="sm" className="w-full" disabled={!charName.trim() || saving} onClick={handleAddCharacter}>
          {saving ? 'Adding...' : <>Add Character <ChevronRight className="h-3.5 w-3.5" /></>}
        </Button>
      </FloatingCard>
    )
  }

  // ── Step 3: Create timeline ──────────────────────────────────────────────
  if (step === 3) {
    async function handleCreateTimeline() {
      if (!chapterTitle.trim() || !worldId) return
      setSaving(true)
      try {
        const timeline = await createTimeline({
          worldId,
          name: 'Main Timeline',
          description: '',
          color: '#6366f1',
        })
        await createChapter({
          worldId,
          timelineId: timeline.id,
          number: 1,
          title: chapterTitle.trim(),
          synopsis: '',
        })
        advanceTutorial()
        navigate(`/worlds/${worldId}/timeline`)
        refresh()
      } finally {
        setSaving(false)
      }
    }

    return (
      <FloatingCard>
        <div className="mb-3 flex items-center justify-between">
          <StepDots current={2} total={5} />
          <button
            onClick={() => { skipTutorial(); refresh() }}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <h3 className="mb-1 font-semibold text-[hsl(var(--foreground))]">Create your timeline</h3>
        <p className="mb-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          A timeline is a sequence of chapters. Each chapter is a snapshot of your world's state — when you add a new one, it automatically inherits everything from the chapter before it.
        </p>
        <div className="mb-3 flex flex-col gap-1.5">
          <Label className="text-xs" htmlFor="tut-ch1-title">First chapter title</Label>
          <Input
            id="tut-ch1-title"
            className="h-8 text-sm"
            placeholder="e.g. Chapter 1"
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTimeline()}
            autoFocus
          />
        </div>
        <Button size="sm" className="w-full" disabled={!chapterTitle.trim() || saving} onClick={handleCreateTimeline}>
          {saving ? 'Creating...' : <>Create Timeline <ChevronRight className="h-3.5 w-3.5" /></>}
        </Button>
      </FloatingCard>
    )
  }

  // ── Step 4: The time cursor ──────────────────────────────────────────────
  if (step === 4) {
    return (
      <FloatingCard arrowToBar>
        <div className="mb-3 flex items-center justify-between">
          <StepDots current={3} total={5} />
          <button
            onClick={() => { skipTutorial(); refresh() }}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <h3 className="mb-1 font-semibold text-[hsl(var(--foreground))]">The chapter selector</h3>
        <p className="mb-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          See the bar at the bottom? That's the <span className="font-semibold text-[hsl(var(--foreground))]">chapter selector</span> — the heart of PlotWeave.
        </p>
        <p className="mb-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          Click any chapter dot to set the "time cursor". Everything you see — character states, map positions, inventory — reflects your story at that exact chapter.
        </p>
        <Button size="sm" className="w-full" onClick={() => { advanceTutorial(); refresh() }}>
          Got it <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </FloatingCard>
    )
  }

  // ── Step 5: Done ─────────────────────────────────────────────────────────
  return (
    <FloatingCard>
      <div className="mb-3 flex items-center justify-between">
        <StepDots current={4} total={5} />
      </div>
      <h3 className="mb-1 font-semibold text-[hsl(var(--foreground))]">You're all set!</h3>
      <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">Here's what to explore next:</p>
      <ul className="mb-4 space-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <li><span className="font-medium text-[hsl(var(--foreground))]">Maps</span> — upload a map image and place your characters on it</li>
        <li><span className="font-medium text-[hsl(var(--foreground))]">Timeline</span> — add more chapters; each inherits the state before it</li>
        <li><span className="font-medium text-[hsl(var(--foreground))]">Characters</span> — update status, location, and notes per chapter</li>
        <li><span className="font-medium text-[hsl(var(--foreground))]">Playback</span> — hit play in the timeline bar to animate your story</li>
      </ul>
      <Button
        size="sm"
        className="w-full"
        onClick={() => {
          setTutorialProgress({ done: true })
          navigate(`/worlds/${worldId}`)
          refresh()
        }}
      >
        Start exploring <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </FloatingCard>
  )
}
