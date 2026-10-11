import { useId, useState } from 'react'
import { BookOpenText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { HEADER_SYNTAX, HEADER_WORDS } from '@/lib/headerSyntax'
import { cn } from '@/lib/utils'

/**
 * Everything a scene's header can say, a click from where it is typed: beside
 * the Page's key hints and under a scene card's draft. The header had grown to
 * five lines and a dozen ways of writing a token, and the hint under the box
 * named two of them; the rest were in the guide, on another screen, which is
 * the trip the header exists to save.
 */
export function HeaderCheatSheet({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('inline-flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] underline-offset-2 hover:text-[hsl(var(--foreground))] hover:underline pointer-coarse:min-h-11', className)}
      >
        <BookOpenText className="h-3 w-3" aria-hidden="true" /> Header cheat sheet
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>The scene header</DialogTitle>
            <DialogDescription>
              The first lines of a scene, between <code>[</code> and <code>]</code>. It is applied when you leave it, and drawn
              back from the records, so it never counts as prose. A line or a word taken off takes back what it said.
            </DialogDescription>
          </DialogHeader>
          <pre className="rounded-md bg-[hsl(var(--muted))] px-3 py-2 text-xs leading-relaxed">
            {'[\n  Place: #The Drowned Chapel\n  Characters: @@Sabine Varro @@Pell Okonjo\n]'}
          </pre>
          <div className="flex flex-col gap-4">
            {HEADER_SYNTAX.map((line) => (
              <section key={line.label} aria-labelledby={`${id}-${line.label}`}>
                <h3 id={`${id}-${line.label}`} className="mb-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {line.label}
                </h3>
                <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                  {line.rows.map((row) => (
                    <div key={row.example} className="contents">
                      <dt><code className="break-words text-[hsl(var(--foreground))]">{row.example}</code></dt>
                      <dd className="text-[hsl(var(--muted-foreground))]">{row.says}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <p>After a colon, only these words count — any other colon is part of the name:</p>
            <ul className="ml-4 list-disc">
              <li>Characters: {HEADER_WORDS.characters.join(', ')}</li>
              <li>Items: {HEADER_WORDS.itemConditions.join(', ')}</li>
              <li>Places: {HEADER_WORDS.placeStatuses.join(', ')}</li>
            </ul>
            <p>The labels are for you to read; the sigil decides what a token is.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
