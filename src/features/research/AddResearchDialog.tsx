import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { addResearchClip, addResearchFile, addResearchLink } from '@/db/hooks/useResearch'
import { formatBytes, MAX_FILE_BYTES } from '@/lib/research'
import type { ResearchKind, ResearchLink } from '@/types'

/*
  Adding research (issue #700): a file (an image or a PDF), a link, or a
  clipping, with a title and a note. Opened from the Research screen it goes
  on the world; from a scene, place, character or item, on that.
*/

const KINDS: Array<{ kind: ResearchKind; label: string }> = [
  { kind: 'file', label: 'File' },
  { kind: 'link', label: 'Link' },
  { kind: 'clip', label: 'Clipping' },
]

export function AddResearchDialog({ open, onOpenChange, worldId, attachTo, attachLabel }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  /** What it is added to: absent, the world. */
  attachTo?: ResearchLink
  /** What `attachTo` is called, for the dialog to say. */
  attachLabel?: string
}) {
  const [kind, setKind] = useState<ResearchKind>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setFile(null); setUrl(''); setText(''); setSource(''); setTitle(''); setNote(''); setError(null)
  }

  async function add() {
    setError(null)
    setBusy(true)
    const n = { title, note, attachedTo: attachTo ? [attachTo] : [], toWorld: !attachTo }
    try {
      if (kind === 'file') {
        if (!file) throw new Error('Choose a file: an image or a PDF.')
        await addResearchFile(worldId, file, n)
      } else if (kind === 'link') await addResearchLink(worldId, url, n)
      else await addResearchClip(worldId, text, source, n)
      reset()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add research</DialogTitle>
          <DialogDescription>
            {attachTo ? `It goes on ${attachLabel ?? 'this'}.` : 'It goes on the world as a whole; attach it to scenes, places, characters or items from its card.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Kind of research" className="flex w-fit overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs">
            {KINDS.map((k) => (
              <button key={k.kind} type="button" aria-pressed={kind === k.kind} onClick={() => { setKind(k.kind); setError(null) }}
                className={`px-3 py-1 ${kind === k.kind ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                {k.label}
              </button>
            ))}
          </div>
          {kind === 'file' && (
            <Field label={`Image or PDF, up to ${formatBytes(MAX_FILE_BYTES)}`}>
              <Input type="file" accept="image/*,application/pdf" className="text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
          )}
          {kind === 'link' && (
            <Field label="Address">
              <Input className="text-xs" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
          )}
          {kind === 'link' && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Nothing is fetched from it: a link opens in a new tab when you open it.</p>
          )}
          {kind === 'clip' && (
            <>
              <Field label="Clipping">
                <Textarea className="min-h-[6rem] text-xs" value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
              <Field label="Source (optional)">
                <Input className="text-xs" placeholder="A book and page, an archive, an address" value={source} onChange={(e) => setSource(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Title (optional)">
            <Input className="text-xs" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Research note (optional)">
            <Textarea className="min-h-[3rem] text-xs" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void add()} disabled={busy}>Add research</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
