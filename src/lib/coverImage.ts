/**
 * A cover as an export can carry it (UX-2-14). Word, EPUB and an HTML page take
 * a JPEG or a PNG; every cover in the Library is WebP, so a book installed from
 * it failed to export with the cover box left ticked, which it is by default.
 * Anything else that decodes is drawn again as a JPEG, on white, since a JPEG
 * has no transparency and a WebP's would come out black.
 */
export const COVER_TYPES = ['image/jpeg', 'image/png'] as const

export interface ExportCover { data: Uint8Array; mimeType: string }

export async function exportableCover(image: Blob, reencode: (image: Blob) => Promise<Blob> = asJpeg): Promise<ExportCover> {
  const kept = (COVER_TYPES as readonly string[]).includes(image.type)
  const out = kept ? image : await reencode(image)
  return { data: new Uint8Array(await out.arrayBuffer()), mimeType: kept ? image.type : 'image/jpeg' }
}

/** The image drawn again as a JPEG, on white. Throws where it does not decode. */
async function asJpeg(image: Blob): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(image)
  } catch {
    throw new Error('The cover could not be read as a picture. Untick Include world cover to export without it.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const g = canvas.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The cover could not be made into a JPEG.'))), 'image/jpeg', 0.92))
}
