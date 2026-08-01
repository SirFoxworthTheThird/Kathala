import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * A picture on its own, filling as much of the screen as it can.
 *
 * Portraits and cover art are stored at up to 2048px but shown at 48px in the
 * places that matter — a header, a card, a row. There was no way to see what
 * had actually been uploaded short of exporting the world, which is a strange
 * gap in an app whose whole job is holding onto what a story looks like.
 *
 * Deliberately not `DialogContent`: that draws a card — border, padding, panel
 * background — and a card around a photograph is exactly the wrong frame. The
 * open/escape handling is the same idiom, kept in step with `ui/dialog.tsx`.
 */
export function ImageLightbox({
  url,
  alt,
  open,
  onClose,
}: {
  url: string
  alt: string
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image'}
      data-testid="image-lightbox"
      // Above the dialog layer, so a picture opened from inside a dialog still
      // lands on top of it rather than behind.
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={url}
        alt={alt}
        // Only the space around the picture dismisses it. Clicking the picture
        // itself is what someone does to look closer, not to put it away.
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-4rem)] max-w-full rounded-lg object-contain shadow-2xl"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        // Carries its own contrast: the picture behind it can be any colour, so
        // the muted foreground the rest of the app uses would vanish on half of
        // them.
        className="pw-tap absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white/90 hover:bg-black/80 hover:text-white focus:outline-none"
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  )
}
