import { useCallback, useState, type ReactNode } from 'react'
import { ImageLightbox } from '@/components/ImageLightbox'
import { getBlobUrl } from '@/db/hooks/useBlobs'
import { isImage } from '@/lib/research'
import type { ResearchItem } from '@/types'

/**
 * Opening research (issue #700): an image full size, as a portrait opens; a
 * PDF in the browser's own viewer, in a new tab; a link in a new tab. Nothing
 * is fetched before it is opened, and a link is never fetched by the app at all.
 * Returns the opener, what it could not open, and the lightbox to render.
 */
export function useOpenResearch(): { open: (item: ResearchItem) => Promise<void>; problem: string | null; lightbox: ReactNode } {
  const [shown, setShown] = useState<{ url: string; alt: string } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const open = useCallback(async (item: ResearchItem) => {
    setProblem(null)
    if (item.kind === 'link' && item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (item.kind !== 'file' || !item.blobId) return
    const url = await getBlobUrl(item.blobId)
    if (!url) {
      setProblem(`“${item.title}” has no file in this copy of the book: it was backed up without its research files.`)
      return
    }
    if (isImage(item.mimeType)) setShown({ url, alt: item.title })
    else window.open(url, '_blank', 'noopener,noreferrer')
  }, [])
  const lightbox = shown ? <ImageLightbox url={shown.url} alt={shown.alt} open onClose={() => setShown(null)} /> : null
  return { open, problem, lightbox }
}
