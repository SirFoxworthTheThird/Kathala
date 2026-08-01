import { useState } from 'react'
import { useBlobUrl } from '@/db/hooks/useBlobs'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ImageLightbox } from '@/components/ImageLightbox'

interface PortraitImageProps {
  imageId: string | null | undefined
  alt?: string
  className?: string
  fallbackClassName?: string
  fallbackIcon?: LucideIcon
  /**
   * Let the picture be opened full size.
   *
   * Off by default, because most of these are small avatars inside something
   * that is already clickable — a character card that navigates, a graph node,
   * a row in a list. Opening a lightbox there would steal the click that people
   * actually want. It is turned on where the image is the subject rather than a
   * label for one, which in practice means the detail and settings screens.
   */
  zoomable?: boolean
}

export function PortraitImage({
  imageId,
  alt,
  className,
  fallbackClassName,
  fallbackIcon: Icon = User,
  zoomable,
}: PortraitImageProps) {
  const url = useBlobUrl(imageId ?? null)
  const [zoomed, setZoomed] = useState(false)

  if (!url) {
    return (
      <div className={cn('flex items-center justify-center bg-[hsl(var(--muted))]', fallbackClassName ?? className)}>
        <Icon className="h-1/2 w-1/2 text-[hsl(var(--muted-foreground))]" />
      </div>
    )
  }

  if (!zoomable) {
    return <img src={url} alt={alt ?? ''} className={cn('object-cover', className)} />
  }

  return (
    <>
      {/*
        The <img> stays the element it was, with role and tabIndex added rather
        than a <button> wrapped around it. Sizing, rounding and object-fit all
        arrive through `className` from twenty-seven call sites; a wrapper would
        have to reproduce them to avoid collapsing the layout. `alt` is what
        names the control for a screen reader, so a zoomable image needs a real
        one.
      */}
      <img
        src={url}
        alt={alt ?? ''}
        role="button"
        tabIndex={0}
        onClick={() => setZoomed(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setZoomed(true)
          }
        }}
        className={cn('cursor-zoom-in object-cover', className)}
      />
      <ImageLightbox url={url} alt={alt ?? ''} open={zoomed} onClose={() => setZoomed(false)} />
    </>
  )
}
