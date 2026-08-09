import { useMemo, useState } from 'react'
import { Copy, Check, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { SectionMergeResult } from '@/lib/sectionImport'

export interface GenerateSectionDialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** e.g. "Generate Characters with AI" */
  title: string
  /** One-line intro shown above the steps. */
  intro: string
  /** Singular/plural noun for the thing being generated, e.g. ["character","characters"]. */
  noun: [singular: string, plural: string]
  /** The copy-to-clipboard prompt. */
  prompt: string
  /**
   * Pure parse of the pasted JSON into a typed spec, or an error message.
   * A `warning` is shown alongside a successful parse — used to say what was
   * dropped, so a spec that drifted a key does not import silently short.
   */
  parse: (text: string) => { data?: T; error?: string; warning?: string }
  /** How many entities the parsed spec holds (for the preview line). */
  count: (data: T) => number
  /** Merge the parsed spec into the current world. */
  apply: (data: T) => Promise<SectionMergeResult>
  onDone?: (result: SectionMergeResult) => void
}

const nf = new Intl.NumberFormat()

/**
 * Generic "generate one section with AI" dialog: copy a tailored prompt, run it
 * in any assistant, paste the JSON back, preview, and merge it into the world
 * you're already in. Section-specific behaviour comes entirely through props.
 */
export function GenerateSectionDialog<T>({
  open, onOpenChange, title, intro, noun, prompt, parse, count, apply, onDone,
}: GenerateSectionDialogProps<T>) {
  const [copied, setCopied] = useState(false)
  const [raw, setRaw] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SectionMergeResult | null>(null)

  const parsed = useMemo(() => (raw.trim() ? parse(raw) : null), [raw, parse])
  const data = parsed?.data
  const total = data != null ? count(data) : 0
  const [singular, plural] = noun

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * Clear the transient state on close — but not the pasted text.
   *
   * Closing used to discard it, including on an accidental Escape or a click on
   * the backdrop, which is the whole screen. A writer who pasted a long response
   * that failed to validate lost it with no confirm and no undo, and had to go
   * back to their assistant for it. A successful import already clears the box
   * in `handleImport`, so the paste only survives when it has not been used.
   */
  function reset() {
    setError(null)
    setResult(null)
  }

  async function handleImport() {
    if (data == null) return
    setImporting(true)
    setError(null)
    try {
      const res = await apply(data)
      setResult(res)
      setRaw('')
      onDone?.(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-y-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[hsl(var(--border))] px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--ring))]" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] px-6 py-4">
            <p className="text-sm text-[hsl(var(--foreground))]">{intro}</p>
            <ol className="flex flex-col gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">1.</span>Copy the prompt.</li>
              <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">2.</span>Paste it into your AI assistant, then describe your story or list what you want.</li>
              <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">3.</span>Copy the JSON it returns and paste it in the box below.</li>
              <li><span className="mr-1.5 font-semibold text-[hsl(var(--foreground))]">4.</span>Review the preview and click <span className="font-semibold text-[hsl(var(--foreground))]">Add</span>.</li>
            </ol>
          </div>

          {/* The prompt */}
          <div className="relative border-b border-[hsl(var(--border))]">
            <div className="sticky top-0 flex justify-end bg-gradient-to-b from-[hsl(var(--card))] to-transparent px-6 pt-3">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopy}>
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy prompt</>}
              </Button>
            </div>
            <pre className="max-h-64 overflow-y-auto px-6 pb-4 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))] whitespace-pre-wrap font-mono">
              {prompt}
            </pre>
          </div>

          {/* Paste the result */}
          <div className="flex flex-col gap-3 px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
              <Wand2 className="h-4 w-4 text-[hsl(var(--ring))]" />
              Paste the AI’s JSON result
            </div>
            <textarea
              aria-label={`${plural} JSON`}
              placeholder={`{\n  "${plural}": [ … ]\n}`}
              value={raw}
              onChange={(e) => { setRaw(e.target.value); setResult(null) }}
              rows={6}
              className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />

            {raw.trim() && parsed?.error && (
              <p className="text-xs text-red-400" role="alert">{parsed.error}</p>
            )}
            {data != null && (
              <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                Ready to import <span className="font-medium text-[hsl(var(--foreground))]">{nf.format(total)}</span>{' '}
                {total === 1 ? singular : plural}. New ones are added; ones that already exist are updated in place.
              </div>
            )}
            {data != null && parsed?.warning && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300" role="status">
                {parsed.warning}
              </p>
            )}
            {result && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">
                Added {nf.format(result.added)} {result.added === 1 ? singular : plural}
                {result.updated > 0 && <> · updated {nf.format(result.updated)}</>}
                {result.skipped > 0 && <> · {nf.format(result.skipped)} unchanged</>}.
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[hsl(var(--border))] px-6 py-3">
          {error ? <p className="text-xs text-red-400" role="alert">{error}</p> : <span />}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => { reset(); onOpenChange(false) }}>
              {result ? 'Done' : 'Cancel'}
            </Button>
            <Button className="gap-2" onClick={handleImport} disabled={data == null || importing}>
              <Sparkles className="h-4 w-4" />
              {importing ? 'Adding…' : `Add ${plural}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
