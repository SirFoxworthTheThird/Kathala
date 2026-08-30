import { useEffect, useMemo, useState } from 'react'
import type { Chapter, WorldEvent } from '@/types'
import { updateEvent } from '@/db/hooks/useTimeline'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'

/** Which list on the scene this dialog edits. */
export type TagField = 'threadIds' | 'motifIds'

interface AttachScenesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The thread or motif being attached. */
  entityId: string
  entityName: string
  /** "thread" or "motif", for the copy. */
  noun: string
  field: TagField
  chapters: Chapter[]
  events: WorldEvent[]
}

/**
 * Attach a plot thread or motif to scenes, from the dashboard.
 *
 * HB-8 filed the empty state as *"no scenes tagged yet"* with no action and no
 * explanation of how to populate it, so the feature read as unfinished the
 * moment it was created. Its recommendation also asked for *"a stable entity
 * link over relying on matching free-text tags"* — that part was already true:
 * a scene carries `threadIds` and `motifIds`, assigned on the scene card. The
 * gap was only ever reaching them from here.
 *
 * Routing to the Timeline would have been the smaller change and the wrong one:
 * the thing can be done here, and **WB-1** settled that argument once already.
 * So this lists every scene in the world in the same order the timeline reads
 * them, and writes only the scenes whose membership actually changed.
 */
export function AttachScenesDialog({
  open, onOpenChange, entityId, entityName, noun, field, chapters, events,
}: AttachScenesDialogProps) {
  const ordered = useMemo(() => {
    const numberById = new Map(chapters.map((c) => [c.id, c.number]))
    return [...chapters]
      .sort((a, b) => a.number - b.number)
      .map((chapter) => ({
        chapter,
        scenes: events
          .filter((e) => e.chapterId === chapter.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((g) => g.scenes.length > 0 || numberById.has(g.chapter.id))
  }, [chapters, events])

  const attachedNow = useMemo(
    () => new Set(events.filter((e) => (e[field] ?? []).includes(entityId)).map((e) => e.id)),
    [events, field, entityId],
  )

  const [selected, setSelected] = useState<Set<string>>(attachedNow)
  const [saving, setSaving] = useState(false)

  // Re-seed each time it opens: the world may have changed underneath, and a
  // stale selection here would silently un-tag scenes on save.
  useEffect(() => { if (open) setSelected(new Set(attachedNow)) }, [open, attachedNow])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      for (const ev of events) {
        const has = (ev[field] ?? []).includes(entityId)
        const want = selected.has(ev.id)
        if (has === want) continue
        const ids = (ev[field] ?? []).filter((id) => id !== entityId)
        await updateEvent(ev.id, { [field]: want ? [...ids, entityId] : ids })
      }
    } finally {
      setSaving(false)
    }
    onOpenChange(false)
  }

  const sceneCount = events.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach “{entityName}” to scenes</DialogTitle>
        </DialogHeader>

        {sceneCount === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            There are no scenes yet. Add one on the Timeline and this {noun} can be attached to it.
          </p>
        ) : (
          <>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Tick the scenes this {noun} runs through. The same list is on each scene card,
              under <em>Plot Threads</em> and <em>Motifs</em>.
            </p>
            <div className="max-h-80 overflow-y-auto rounded-md border border-[hsl(var(--border))]">
              {ordered.map(({ chapter, scenes }) => (
                <div key={chapter.id}>
                  <p className="sticky top-0 bg-[hsl(var(--card))] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Ch. {chapter.number} — {chapter.title}
                  </p>
                  {scenes.map((scene) => (
                    <label
                      key={scene.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted)/0.5)]"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 shrink-0 accent-[hsl(var(--ring))]"
                        checked={selected.has(scene.id)}
                        onChange={() => toggle(scene.id)}
                      />
                      <span className="truncate">{scene.title || 'Untitled'}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {plural(selected.size, 'scene')} selected of {sceneCount}.
            </p>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => void save()} disabled={saving || sceneCount === 0}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
