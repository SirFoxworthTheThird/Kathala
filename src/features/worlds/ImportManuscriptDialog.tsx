import { useMemo, useRef, useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseManuscript, manuscriptStats } from '@/lib/manuscriptImport'
import { createWorldFromManuscript } from '@/db/hooks/useManuscript'
import { readDraftDocx, DraftDocxError, type DraftDocx } from '@/lib/docxDraft'
import { plural } from '@/lib/plural'

interface ImportManuscriptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: (worldId: string) => void
}

/** Strip a file extension for use as a default world name. */
function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim()
}

const isDocx = (file: File) => /\.docx$/i.test(file.name)
const isText = (file: File) => /\.(md|markdown|txt|text)$/i.test(file.name) || /^text\//.test(file.type)

/** What a Word draft's preview says beyond its counts: what came in other than as text, and what did not come in. */
function draftLines(d: DraftDocx): string[] {
  const out: string[] = []
  if (d.tracked) out.push(`${plural(d.tracked, 'tracked change')} taken as accepted.`)
  if (d.comments.length) out.push(`${plural(d.comments.length, 'comment')} brought in as notes on their words.`)
  if (d.parts.length) out.push(`${plural(d.parts.length, 'part')} (${d.parts.map((p) => p.name).join(', ')}): each named in the notes of the chapter it begins.`)
  const { images, tables, footnotes, endnotes, formatting } = d.leftOut
  const counted = [
    images && plural(images, 'image'),
    tables && plural(tables, 'table'),
    footnotes && plural(footnotes, 'footnote'),
    endnotes && plural(endnotes, 'endnote'),
  ].filter(Boolean)
  if (counted.length) out.push(`Left out: ${counted.join(', ')}.`)
  if (formatting) out.push('Bold and underlining come in as plain words; italics are kept.')
  return out
}


export function ImportManuscriptDialog({ open, onOpenChange, onImported }: ImportManuscriptDialogProps) {
  const [raw, setRaw] = useState('')
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A Word draft, read: it stands in for the text while it is chosen.
  const [docx, setDocx] = useState<{ name: string; draft: DraftDocx } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const textParsed = useMemo(() => parseManuscript(raw), [raw])
  const parsed = docx ? docx.draft.manuscript : textParsed
  const stats = useMemo(() => manuscriptStats(parsed), [parsed])

  // The effective name: manual edit wins, else the detected book title.
  const effectiveName = nameEdited ? name : (name || parsed.title || '')

  function reset() {
    setRaw('')
    setName('')
    setNameEdited(false)
    setError(null)
    setDocx(null)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await takeFile(file)
  }

  async function takeFile(file: File) {
    setError(null)
    if (isDocx(file)) {
      try {
        const draft = await readDraftDocx(new Uint8Array(await file.arrayBuffer()))
        setDocx({ name: file.name, draft })
        setRaw('')
        if (!nameEdited) setName(draft.manuscript.title || baseName(file.name))
      } catch (err) {
        setError(err instanceof DraftDocxError ? err.message : 'Could not read that Word file.')
      }
      return
    }
    if (!isText(file)) {
      setError('That file is not one Import Manuscript reads: choose a .docx, .md or .txt file.')
      return
    }
    try {
      const text = await file.text()
      setDocx(null)
      setRaw(text)
      if (!nameEdited) {
        const detected = parseManuscript(text).title
        setName(detected || baseName(file.name))
      }
    } catch {
      setError('Could not read that file.')
    }
  }

  async function handleImport() {
    if (parsed.chapters.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const worldId = await createWorldFromManuscript(parsed, effectiveName, docx?.draft)
      reset()
      onOpenChange(false)
      onImported?.(worldId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const previewChapters = parsed.chapters.slice(0, 8)
  const shown = docx !== null || raw.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import a Manuscript</DialogTitle>
        </DialogHeader>

        <div
          className={`flex flex-col gap-4 rounded-md ${dragging ? 'outline outline-2 outline-offset-4 outline-[hsl(var(--ring))]' : ''}`}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }}
          onDrop={(e) => {
            const file = e.dataTransfer.files[0]
            setDragging(false)
            if (!file) return
            e.preventDefault()
            void takeFile(file)
          }}
        >
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Bring in an existing draft as a new world: a Word
            <code className="mx-1 rounded bg-[hsl(var(--muted))] px-1 py-0.5">.docx</code>
            file, read by its heading styles, or Markdown or plain-text
            <code className="mx-1 rounded bg-[hsl(var(--muted))] px-1 py-0.5">.md</code>/
            <code className="mx-1 rounded bg-[hsl(var(--muted))] px-1 py-0.5">.txt</code>
            works best: <code className="rounded bg-[hsl(var(--muted))] px-1 py-0.5">#</code>/
            <code className="rounded bg-[hsl(var(--muted))] px-1 py-0.5">##</code> or
            “Chapter …” headings become chapters, and lines like
            <code className="mx-1 rounded bg-[hsl(var(--muted))] px-1 py-0.5">* * *</code>
            split scenes.
          </p>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Choose file…
            </Button>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">drop one here, or paste your text below</span>
            <input
              ref={fileRef}
              type="file"
              aria-label="Choose manuscript file"
              accept=".docx,.md,.markdown,.txt,.text,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {docx ? (
            <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate text-[hsl(var(--foreground))]">{docx.name}</span>
              <span className="text-[hsl(var(--muted-foreground))]">· a Word draft</span>
              <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 px-1.5" aria-label={`Put ${docx.name} back`} onClick={() => { setDocx(null); if (!nameEdited) setName('') }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
          <textarea
            aria-label="Manuscript text"
            placeholder={'# My Novel\n\n## Chapter 1\n\nIt was a dark and stormy night…'}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={7}
            className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          )}

          {shown && (
            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
              {parsed.chapters.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No chapters or scenes detected yet — add a heading or a
                  <code className="mx-1 rounded bg-[hsl(var(--muted))] px-1 py-0.5">* * *</code>
                  break.
                </p>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[hsl(var(--foreground))]">
                    <FileText className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    {plural(stats.chapters, 'chapter')} ·{' '}
                    {plural(stats.scenes, 'scene')} ·{' '}
                    {plural(stats.words, 'word')}
                  </div>
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-[hsl(var(--muted-foreground))]">
                    {previewChapters.map((c, i) => (
                      <li key={i} className="flex items-baseline gap-2">
                        <span className="tabular-nums text-[hsl(var(--muted-foreground))]">Ch. {i + 1}</span>
                        <span className="truncate text-[hsl(var(--foreground))]">{c.title || 'Untitled'}</span>
                        <span className="ml-auto shrink-0 tabular-nums">{c.scenes.length} scene{c.scenes.length !== 1 ? 's' : ''}</span>
                      </li>
                    ))}
                    {parsed.chapters.length > previewChapters.length && (
                      <li className="italic">…and {parsed.chapters.length - previewChapters.length} more</li>
                    )}
                  </ul>
                  {docx && (
                    <ul aria-label="From the Word draft" className="mt-2 space-y-0.5 border-t border-[hsl(var(--border))] pt-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {draftLines(docx.draft).map((line) => <li key={line}>{line}</li>)}
                      {docx.draft.leftOut.lines.length > 0 && (
                        <li>
                          Lines left out: {docx.draft.leftOut.lines.map((l, i) => (
                            <span key={i}>{i > 0 && ' · '}<span className="text-[hsl(var(--foreground))]">{l}</span></span>
                          ))}
                        </li>
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ms-world-name">World name</Label>
            <Input
              id="ms-world-name"
              placeholder="Imported Manuscript"
              value={effectiveName}
              onChange={(e) => { setName(e.target.value); setNameEdited(true) }}
            />
          </div>

          {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
            Cancel
          </Button>
          <Button type="button" onClick={handleImport} disabled={parsed.chapters.length === 0 || importing}>
            {importing
              ? 'Importing…'
              : `Import ${stats.chapters > 0 ? plural(stats.chapters, 'chapter') : ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
