import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import {
  useGoalsForCharacter, createCharacterGoal, updateCharacterGoal, deleteCharacterGoal,
} from '@/db/hooks/useCharacterGoals'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useAppStore } from '@/store'
import { GOAL_TYPE_CONFIG, eventPositions, isGoalActiveAt } from '@/lib/characterGoals'
import { CHARACTER_GOAL_TYPES, type Character, type CharacterGoal, type CharacterGoalType } from '@/types'
import { cn } from '@/lib/utils'

/** Chapter-qualified label for the event pickers, e.g. "Ch. 2 — The Ambush". */
function useEventOptions(worldId: string) {
  const events = useWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const ordered = [...events].sort((a, b) => {
    const ca = chapterById.get(a.chapterId)?.number ?? 0
    const cb = chapterById.get(b.chapterId)?.number ?? 0
    return ca !== cb ? ca - cb : a.sortOrder - b.sortOrder
  })
  return {
    events: ordered,
    chapters,
    label: (ev: { id: string; chapterId: string; title: string }) =>
      `Ch. ${chapterById.get(ev.chapterId)?.number ?? '?'} — ${ev.title || 'untitled'}`,
  }
}

function GoalRow({ goal, isActive, options, onDelete }: {
  goal: CharacterGoal
  isActive: boolean
  options: ReturnType<typeof useEventOptions>
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cfg = GOAL_TYPE_CONFIG[goal.type]

  return (
    <div
      className={cn(
        'rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5',
        isActive ? 'border-[hsl(var(--border))]' : 'border-[hsl(var(--border))] opacity-60',
      )}
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: `${cfg.color}22`, color: cfg.color }}
          title={cfg.hint}
        >
          {cfg.label}
        </span>
        <Input
          className="h-7 flex-1 text-sm"
          defaultValue={goal.text}
          placeholder="What drives them…"
          onBlur={(e) => {
            const text = e.target.value.trim()
            if (text !== goal.text) updateCharacterGoal(goal.id, { text })
          }}
        />
        {!isActive && (
          <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]" title="Not held at the current time cursor">
            inactive here
          </span>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          aria-label={`Delete ${cfg.label.toLowerCase()} "${goal.text}"`}
          className="shrink-0 text-[hsl(var(--muted-foreground))] transition-colors hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Optional time scoping */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Label className="text-[hsl(var(--muted-foreground))]">From</Label>
        <Select
          value={goal.startEventId ?? '__none__'}
          onValueChange={(v) => updateCharacterGoal(goal.id, { startEventId: v === '__none__' ? null : v })}
        >
          <SelectTrigger className="h-7 w-52 text-xs"><SelectValue placeholder="the beginning" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">The beginning</SelectItem>
            {options.events.map((ev) => (
              <SelectItem key={ev.id} value={ev.id} className="text-xs">{options.label(ev)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-[hsl(var(--muted-foreground))]">until</Label>
        <Select
          value={goal.endEventId ?? '__none__'}
          onValueChange={(v) => updateCharacterGoal(goal.id, { endEventId: v === '__none__' ? null : v })}
        >
          <SelectTrigger className="h-7 w-52 text-xs"><SelectValue placeholder="the end" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">The end</SelectItem>
            {options.events.map((ev) => (
              <SelectItem key={ev.id} value={ev.id} className="text-xs">{options.label(ev)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete this ${cfg.label.toLowerCase()}?`}
        onConfirm={onDelete}
      />
    </div>
  )
}

/**
 * A character's inner life: wants, needs, fears, and flaws, each optionally
 * scoped to a stretch of the story. Goals not held at the current time cursor
 * are dimmed rather than hidden, so the whole arc stays visible while editing.
 */
export function GoalsTab({ character }: { character: Character }) {
  const { worldId } = useParams<{ worldId: string }>()
  const stored = useGoalsForCharacter(character.id)
  // Same want → need → fear → flaw order the Brief and Arc View use, so a
  // character's inner life reads identically everywhere.
  const goals = [...stored].sort((a, b) => {
    const byType = CHARACTER_GOAL_TYPES.indexOf(a.type) - CHARACTER_GOAL_TYPES.indexOf(b.type)
    return byType !== 0 ? byType : a.createdAt - b.createdAt
  })
  const options = useEventOptions(worldId ?? '')
  const activeEventId = useAppStore((s) => s.activeEventId)
  const positions = eventPositions(options.events, options.chapters)

  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<CharacterGoalType>('want')
  const [newText, setNewText] = useState('')

  async function addGoal() {
    const text = newText.trim()
    if (!text || !worldId) return
    await createCharacterGoal({ worldId, characterId: character.id, type: newType, text })
    setNewText('')
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {goals.length === 0 && !adding ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Track what this character wants, needs, fears, and what flaw holds them back — the inner life behind their scenes."
          action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add a goal</Button>}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                isActive={isGoalActiveAt(goal, activeEventId, positions)}
                options={options}
                onDelete={() => deleteCharacterGoal(goal.id)}
              />
            ))}
          </div>

          {adding ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
              <Select value={newType} onValueChange={(v) => setNewType(v as CharacterGoalType)}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHARACTER_GOAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{GOAL_TYPE_CONFIG[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-8 flex-1 text-sm"
                placeholder={GOAL_TYPE_CONFIG[newType].hint}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addGoal()
                  if (e.key === 'Escape') { setAdding(false); setNewText('') }
                }}
                autoFocus
              />
              <Button size="sm" onClick={addGoal} disabled={!newText.trim()}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewText('') }}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5 self-start" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" /> Add a goal
            </Button>
          )}
        </>
      )}
    </div>
  )
}
