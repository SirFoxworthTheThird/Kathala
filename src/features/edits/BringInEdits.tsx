import { useRef, useState } from 'react'
import { FileInput } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'
import { importEditedFile, type ImportResult } from '@/db/hooks/useEditImport'

/*
  Bringing an editor's Word file in (editorial-plan.md, R4): chosen, read, and
  said back — how many changes in how many scenes, the comments now notes, the
  draft saved first — with the way on to deciding the changes.
*/

export function BringInEdits({ worldId, className, onReview }: { worldId: string; className?: string; onReview: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<(ImportResult & { fileName: string }) | null>(null)
  const [error, setError] = useState('')

  const bringIn = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const done = await importEditedFile(worldId, new Uint8Array(await file.arrayBuffer()), file.name)
      setResult({ ...done, fileName: file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.')
      setResult(null)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const authors = result ? [...new Set(result.plan.scenes.flatMap((s) => s.authors))] : []
  const scenes = result ? result.plan.scenes.filter((s) => s.tracked.length + s.untracked.length > 0).length : 0
  const untracked = result ? result.plan.scenes.reduce((n, s) => n + s.untracked.length, 0) : 0
  const placeable = result ? result.plan.unplaced.filter((u) => u.tracked.length > 0).length : 0
  const lost = result ? result.plan.unplaced.reduce((n, u) => n + u.comments, 0) : 0

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label="An edited Word file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void bringIn(f) }}
      />
      <Button size="sm" variant="outline" className={className} disabled={busy} onClick={() => input.current?.click()}>
        <FileInput className="h-4 w-4" /> {busy ? 'Bringing in…' : 'Bring in edits…'}
      </Button>

      <Dialog open={result !== null || error !== ''} onOpenChange={(o) => { if (!o) { setResult(null); setError('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{error ? 'The file could not be brought in' : 'Edits brought in'}</DialogTitle>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm">{error}</p>
          ) : result && (
            <div className="space-y-3 text-sm">
              <p role="status">
                {result.suggestions === 0
                  ? `No changes in ${result.fileName}.`
                  : `${plural(result.suggestions, 'change')}${scenes ? ` in ${plural(scenes, 'scene')}` : ''}${authors.length ? ` from ${authors.join(' and ')}` : ''}, waiting for you to accept or reject.`}
                {result.notes > 0 && ` ${plural(result.notes, 'comment')} ${result.notes === 1 ? 'is' : 'are'} now ${result.notes === 1 ? 'a note' : 'notes'} on the Page.`}
              </p>
              {untracked > 0 && <p className="text-xs text-[hsl(var(--muted-foreground))]">{plural(untracked, 'change')} {untracked === 1 ? 'was' : 'were'} made with tracking off, and found by comparing the file with the book as it went out.</p>}
              {!result.plan.fromDraft && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  The draft this file was made from is not on this device, so only tracked changes could be found: anything changed with tracking off is not among them.
                </p>
              )}
              {placeable > 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{plural(placeable, 'passage')} of the file matched no scene: you can say which scene in Changes.</p>}
              {lost > 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{plural(lost, 'comment')} {lost === 1 ? 'was' : 'were'} on words that matched no scene, and {lost === 1 ? 'is' : 'are'} not brought in: read {lost === 1 ? 'it' : 'them'} in the file.</p>}
              <p className="text-xs text-[hsl(var(--muted-foreground))]">The book as it was before is saved as a draft, so you can always compare with it or go back.</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setResult(null)}>Later</Button>
                {result.suggestions > 0 && <Button onClick={() => { setResult(null); onReview() }}>Review the changes</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
