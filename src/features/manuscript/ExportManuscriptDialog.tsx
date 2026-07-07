import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { compileManuscript, type BuiltManuscript, type CompileFormat } from '@/lib/manuscriptCompile'

const FORMATS: { id: CompileFormat; label: string; ext: string; mime: string }[] = [
  { id: 'markdown', label: 'Markdown', ext: 'md', mime: 'text/markdown' },
  { id: 'html', label: 'HTML', ext: 'html', mime: 'text/html' },
  { id: 'text', label: 'Plain text', ext: 'txt', mime: 'text/plain' },
]

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'manuscript'
}

export function ExportManuscriptDialog({
  open,
  onOpenChange,
  manuscript,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  manuscript: BuiltManuscript
  title: string
}) {
  const [format, setFormat] = useState<CompileFormat>('markdown')
  const [chapterTitles, setChapterTitles] = useState(true)
  const [onlyWritten, setOnlyWritten] = useState(true)
  const [copied, setCopied] = useState(false)

  const fmt = FORMATS.find((f) => f.id === format)!
  const output = compileManuscript(manuscript, format, { chapterTitles, onlyWritten, title })

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the download button still works */
    }
  }

  function handleDownload() {
    const blob = new Blob([output], { type: `${fmt.mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(title)}.${fmt.ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
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
          </div>

          <div className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span>{new Intl.NumberFormat().format(manuscript.totalWords)} words</span>
            <span>{manuscript.writtenScenes} scenes</span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
              {copied ? <><Check className="h-4 w-4 text-green-400" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}
            </Button>
            <Button className="flex-1 gap-2" onClick={handleDownload}>
              <Download className="h-4 w-4" /> Download .{fmt.ext}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
