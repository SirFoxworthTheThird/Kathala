import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { BlobEntry } from '@/types'
import { generateId } from '@/lib/id'

/** Returns a stable map of blobId → object URL for all blobs in a world.
 *  The Map reference only changes when the underlying Dexie data changes. */
export function useWorldBlobUrls(worldId: string | null): Map<string, string> {
  const entries = useLiveQuery(
    () => (worldId ? db.blobs.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
  return useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      map.set(e.id, URL.createObjectURL(e.data))
    }
    return map
  }, [entries])
}

export function useBlobUrl(id: string | null): string | undefined {
  const entry = useLiveQuery(() => (id ? db.blobs.get(id) : undefined), [id])
  if (!entry) return undefined
  return URL.createObjectURL(entry.data)
}

async function compressImage(
  file: File,
  maxDimension = 2048,
  quality = 0.88,
): Promise<{ blob: Blob; width: number; height: number; mimeType: string }> {
  // Skip compression for SVG and non-image files
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    const dims = await getImageDimensions(file)
    return { blob: file, ...dims, mimeType: file.type }
  }

  const bitmap = await createImageBitmap(file)
  const srcW = bitmap.width
  const srcH = bitmap.height
  const scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
  const width = Math.round(srcW * scale)
  const height = Math.round(srcH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve({ blob: blob ?? file, width, height, mimeType: 'image/jpeg' }),
      'image/jpeg',
      quality,
    )
  })
}

export async function storeBlob(
  worldId: string,
  file: File,
): Promise<BlobEntry & { width: number; height: number }> {
  const { blob, width, height, mimeType } = await compressImage(file)
  const entry: BlobEntry = {
    id: generateId(),
    worldId,
    mimeType,
    data: blob,
    createdAt: Date.now(),
  }
  await db.blobs.add(entry)
  return { ...entry, width, height }
}

export async function deleteBlob(id: string) {
  await db.blobs.delete(id)
}

export async function getBlobUrl(id: string): Promise<string | undefined> {
  const entry = await db.blobs.get(id)
  if (!entry) return undefined
  return URL.createObjectURL(entry.data)
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = reject
    img.src = url
  })
}
