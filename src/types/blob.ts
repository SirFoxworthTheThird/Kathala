export interface BlobEntry {
  id: string
  worldId: string
  mimeType: string
  /** Binary data for an uploaded image. Absent when this is a linked image
   *  (see `url`). Exactly one of `data` / `url` is set. */
  data?: Blob
  /** External image URL for a linked image. Absent for uploaded images. */
  url?: string
  createdAt: number
}
