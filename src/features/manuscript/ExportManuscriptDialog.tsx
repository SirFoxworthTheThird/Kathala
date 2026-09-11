import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { compileManuscript, type BuiltManuscript, type CompileFormat } from '@/lib/manuscriptCompile'
import { compileDocx, compileEpub } from '@/lib/manuscriptExport'
import { Input } from '@/components/ui/input'
import { plural } from '@/lib/plural'
import { manuscriptFileName } from '@/lib/manuscriptFileName'

type ExportFormat = CompileFormat | 'docx' | 'epub'

const FORMATS: { id: ExportFormat; label: string; ext: string; mime: string; binary?: boolean }[] = [
  { id: 'markdown', label: 'Markdown', ext: 'md', mime: 'text/markdown' },
  { id: 'html', label: 'HTML', ext: 'html', mime: 'text/html' },
  { id: 'text', label: 'Plain text', ext: 'txt', mime: 'text/plain' },
  { id: 'docx', label: 'Word', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', binary: true },
  { id: 'epub', label: 'EPUB', ext: 'epub', mime: 'application/epub+zip', binary: true },
]

export function ExportManuscriptDialog({
  open,
  onOpenChange,
  manuscript,
  title,
  timelineName,
  timelineCount,
  coverUrl,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  manuscript: BuiltManuscript
  /** The book's title — the world's name, which is what goes on the page. */
  title: string
  /** Only reaches the file name, and only when there is more than one (N11). */
  timelineName: string | undefined
  timelineCount: number
  /** Resolved URL for the world's cover, whether uploaded or linked. */
  coverUrl?: string
}) {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [chapterTitles, setChapterTitles] = useState(true)
  const [onlyWritten, setOnlyWritten] = useState(true)
  const [author, setAuthor] = useState('')
  const [copied, setCopied] = useState(false)
  const [includeCover, setIncludeCover] = useState(true)
  const [coverError, setCoverError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const fmt = FORMATS.find((f) => f.id === format)!
  const opts = { chapterTitles, onlyWritten, title, author }
  async function loadCover() {
    if (!includeCover || !coverUrl || format === 'text') return undefined
    const response = await fetch(coverUrl)
    if (!response.ok) throw new Error(`Cover request failed (${response.status})`)
    const image = await response.blob()
    if (!['image/jpeg', 'image/png'].includes(image.type)) throw new Error('Cover must be a JPEG or PNG image')
    const data = new Uint8Array(await image.arrayBuffer())
    return { data, mimeType: image.type }
  }

  function dataUrl(cover: { data: Uint8Array; mimeType: string }): string {
    let binary = ''
    for (const byte of cover.data) binary += String.fromCharCode(byte)
    return `data:${cover.mimeType};base64,${btoa(binary)}`
  }

  async function handleCopy() {
    try {
      setCoverError('')
      const cover = await loadCover()
      const copyOutput = compileManuscript(manuscript, format as CompileFormat, {
        ...opts,
        coverDataUrl: cover ? dataUrl(cover) : undefined,
      })
      await navigator.clipboard.writeText(copyOutput)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'The manuscript could not be copied')
    }
  }

  async function handleDownload() {
    setDownloading(true)
    setCoverError('')
    try {
      const cover = await loadCover()
      const exportOpts = { ...opts, cover, coverDataUrl: cover ? dataUrl(cover) : undefined }
      const textOutput = fmt.binary ? '' : compileManuscript(manuscript, format as CompileFormat, exportOpts)
      const blob = fmt.binary
      ? new Blob(
          [(format === 'docx' ? compileDocx(manuscript, exportOpts) : compileEpub(manuscript, exportOpts)) as BlobPart],
          { type: fmt.mime },
        )
        : new Blob([textOutput], { type: `${fmt.mime};charset=utf-8` })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = manuscriptFileName({
        worldName: title, timelineName, timelineCount, ext: fmt.ext,
      })
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'The cover could not be added')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export manuscript</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">Format</p>
            <div className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-sm">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  aria-pressed={format === f.id}
                  className={cn(
                    'flex-1 border-l border-[hsl(var(--border))] px-3 py-1.5 transition-colors first:border-l-0',
                    format === f.id ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              <input type="checkbox" checked={chapterTitles} onChange={(e) => setChapterTitles(e.target.checked)} className="accent-[hsl(var(--ring))]" />
              Include chapter titles
            </label>
            <label className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              <input type="checkbox" checked={onlyWritten} onChange={(e) => setOnlyWritten(e.target.checked)} className="accent-[hsl(var(--ring))]" />
              Only written scenes
            </label>
            <label className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              <input type="checkbox" checked={includeCover} disabled={!coverUrl || format === 'text'} onChange={(e) => setIncludeCover(e.target.checked)} className="accent-[hsl(var(--ring))]" />
              Include world cover{format === 'text' ? ' (not supported by plain text)' : ''}
            </label>
          </div>

          {coverError && <p role="alert" className="text-xs text-red-400">{coverError}</p>}

          {fmt.binary && (
            <div className="space-y-1">
              <label htmlFor="export-author" className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Author (optional)</label>
              <Input id="export-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" className="h-9" />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span>{plural(manuscript.totalWords, 'word')}</span>
            <span>{plural(manuscript.writtenScenes, 'scene')}</span>
          </div>

          <div className="flex gap-2">
            {!fmt.binary && (
              <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
                {copied ? <><Check className="h-4 w-4 text-green-400" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}
              </Button>
            )}
            <Button className="flex-1 gap-2" onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4" /> {downloading ? 'Preparing…' : `Download .${fmt.ext}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
