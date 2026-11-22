import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResearchPanel } from './ResearchPanel'
import { useResearchTargets } from './useResearchNames'

/*
  The Page's research (issue #700): the scene the caret is in, its mood board
  and its sources, beside the prose as the Notes panel is.
*/
export function SceneResearchPanel({ bookId, sceneId, onClose }: {
  bookId: string
  sceneId: string | null
  onClose: () => void
}) {
  const targets = useResearchTargets(bookId)
  const here = sceneId ? { kind: 'scene' as const, id: sceneId } : null
  return (
    <aside aria-label="Scene research" className="flex min-h-0 w-full flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
          {here ? targets.label(here) ?? 'This scene' : 'No scene'}
        </span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label="Close research" onClick={onClose}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {here
          ? <ResearchPanel bookId={bookId} here={here} hereLabel={targets.label(here) ?? 'this scene'} />
          : <p className="text-xs italic text-[hsl(var(--muted-foreground))]">Put the caret in a scene to see its research.</p>}
      </div>
    </aside>
  )
}
