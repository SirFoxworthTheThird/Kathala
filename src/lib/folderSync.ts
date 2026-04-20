/**
 * Persists a FileSystemDirectoryHandle per world in a dedicated IndexedDB store.
 * The handle lets the app re-access the chosen folder across page reloads without
 * prompting the user to pick it again (though permission may need re-granting).
 */

export interface FolderBinding {
  worldId: string
  handle: FileSystemDirectoryHandle
  fileName: string   // e.g. "My_World.pwk"
  lastSyncedAt: number // epoch ms, 0 if never synced
}

const DB_NAME    = 'pw-folder-sync'
const STORE_NAME = 'bindings'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'worldId' })
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function saveFolderBinding(binding: FolderBinding): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(binding)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror    = () => { db.close(); reject(tx.error) }
  })
}

export async function loadFolderBinding(worldId: string): Promise<FolderBinding | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(worldId)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror   = () => { db.close(); reject(req.error) }
  })
}

export async function clearFolderBinding(worldId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(worldId)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror    = () => { db.close(); reject(tx.error) }
  })
}

/** Returns true if readwrite permission is already granted (no prompt). Safe to call without a user gesture. */
export async function checkPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const perm = await handle.queryPermission({ mode: 'readwrite' })
  return perm === 'granted'
}

/** Returns true if readwrite permission is granted (requests it if needed). Must be called from a user gesture. */
export async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const current = await handle.queryPermission({ mode: 'readwrite' })
  if (current === 'granted') return true
  const result = await handle.requestPermission({ mode: 'readwrite' })
  return result === 'granted'
}

export function isFolderSyncSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}
