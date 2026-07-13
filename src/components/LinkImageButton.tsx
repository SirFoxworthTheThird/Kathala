import { useEffect, useRef, useState } from 'react'
import { Link2, Check, X, Loader2 } from 'lucide-react'
import { storeImageLink } from '@/db/hooks/useBlobs'
import { cn } from '@/lib/utils'

interface LinkImageButtonProps {
  worldId: string
  /** Called with the new blob id and the linked image's natural dimensions. */
  onLinked: (blobId: string, width: number, height: number) => void
  triggerClassName?: string
  triggerAriaLabel?: string
}

/**
 * A small "link an image by URL" affordance: an icon trigger that opens a
 * popover with a URL field. Stores the link as a blob entry (no binary data)
 * and hands back its id. Complements file upload wherever images are set.
 */
export function LinkImageButton({ worldId, onLinked, triggerClassName, triggerAriaLabel = 'Link image by URL' }: LinkImageButtonProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  async function submit() {
    if (!url.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const entry = await storeImageLink(worldId, url)
      onLinked(entry.id, entry.width, entry.height)
      setUrl('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link that image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={triggerAriaLabel}
        title={triggerAriaLabel}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o) }}
        className={cn('flex items-center justify-center', triggerClassName)}
      >
        <Link2 className="h-3 w-3" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-[60] mt-1 w-60 max-w-[calc(100vw-2rem)] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">Paste a direct image URL</p>
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="url"
              value={url}
              placeholder="https://…/image.png"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } if (e.key === 'Escape') setOpen(false) }}
              className="h-8 flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
            <button type="button" onClick={submit} disabled={busy || !url.trim()} aria-label="Add linked image" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:text-green-400 disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null) }} aria-label="Cancel" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              <X className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
