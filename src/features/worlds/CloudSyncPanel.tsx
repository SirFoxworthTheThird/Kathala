import { useState, useEffect } from 'react'
import { FolderOpen, RefreshCw, Upload, Download, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  loadFolderBinding, saveFolderBinding, clearFolderBinding,
  ensurePermission, isFolderSyncSupported,
} from '@/lib/folderSync'
import type { FolderBinding } from '@/lib/folderSync'
import { previewWorldMerge, applyWorldImport } from './cloudSyncHelpers'
import { pushWorldToFolder, markPulled, readFolderSyncState } from './folderSyncRunner'
import { FOLDER_SYNC_LABELS, needsAttention, type FolderSyncState } from '@/lib/folderSyncState'
import type { ConflictPreference, MergePreview, WorldExportFile } from './cloudSyncHelpers'
import { LoadPreviewDialog } from './LoadPreviewDialog'
import { SettingsSection } from './SettingsSection'

type SyncState = 'idle' | 'saving' | 'loading' | 'error'

export function CloudSyncPanel({ worldId, worldName }: { worldId: string; worldName: string }) {
  const [binding, setBinding]     = useState<FolderBinding | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [loadPreview, setLoadPreview] = useState<{ preview: MergePreview; parsed: WorldExportFile } | null>(null)
  const [folderState, setFolderState] = useState<FolderSyncState | null>(null)

  useEffect(() => {
    loadFolderBinding(worldId).then(setBinding)
  }, [worldId])

  // Re-check on mount and whenever the binding changes: the file may have been
  // written by another device while this tab was closed or idle.
  useEffect(() => {
    let cancelled = false
    if (!binding) { setFolderState(null); return }
    readFolderSyncState(worldId, binding)
      .then(({ state }) => { if (!cancelled) setFolderState(state) })
      .catch(() => { if (!cancelled) setFolderState(null) })
    return () => { cancelled = true }
  }, [worldId, binding])

  const supported = isFolderSyncSupported()

  async function handleChooseFolder() {
    try {
      const handle   = await window.showDirectoryPicker({ mode: 'readwrite' })
      const fileName = `${worldName.replace(/[^a-z0-9]/gi, '_')}.pwk`
      const newBinding: FolderBinding = { worldId, handle, fileName, lastSyncedAt: 0 }
      await saveFolderBinding(newBinding)
      setBinding(newBinding)
      setStatusMsg(null)
      setSyncState('idle')
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') {
        setStatusMsg((e as Error).message)
      }
    }
  }

  async function handleSave() {
    if (!binding) return
    setSyncState('saving')
    setStatusMsg(null)
    try {
      const granted = await ensurePermission(binding.handle)
      if (!granted) throw new Error('Folder access denied — click "Change folder" to re-select it')
      const updated = await pushWorldToFolder(worldId, binding)
      setBinding(updated)
      setFolderState('in-sync')
      setSyncState('idle')
      setStatusMsg(`Saved — ${new Date().toLocaleTimeString()}`)
    } catch (e) {
      setSyncState('error')
      setStatusMsg((e as Error).message)
    }
  }

  async function handleLoad() {
    if (!binding) return
    setSyncState('loading')
    setStatusMsg(null)
    try {
      const granted = await ensurePermission(binding.handle)
      if (!granted) throw new Error('Folder access denied — click "Change folder" to re-select it')
      const fileHandle = await binding.handle.getFileHandle(binding.fileName)
      const file       = await fileHandle.getFile()
      const json       = await file.text()
      // Preview diff before committing — shows LoadPreviewDialog
      const result = await previewWorldMerge(json)
      setSyncState('idle')
      setLoadPreview(result)
    } catch (e) {
      setSyncState('error')
      setStatusMsg((e as Error).message)
    }
  }

  async function handleApplyLoad(
    parsed: WorldExportFile,
    mode: 'replace' | 'merge',
    prefer: ConflictPreference = 'newer',
  ) {
    if (!binding) return
    setSyncState('loading')
    try {
      await applyWorldImport(parsed, mode, prefer)
      // The folder's copy is now what we hold, so the next auto-save must not
      // read it as the folder being ahead of us.
      const updated = await markPulled(worldId, binding)
      setBinding(updated)
      setFolderState('in-sync')
      setStatusMsg(`Loaded (${mode === 'merge' ? 'merged' : 'replaced'}) — ${new Date().toLocaleTimeString()}`)
    } catch (e) {
      setSyncState('error')
      setStatusMsg((e as Error).message)
    } finally {
      setSyncState('idle')
      setLoadPreview(null)
    }
  }

  async function handleDisconnect() {
    await clearFolderBinding(worldId)
    setBinding(null)
    setStatusMsg(null)
    setSyncState('idle')
  }

  const lastSynced = binding?.lastSyncedAt
    ? new Date(binding.lastSyncedAt).toLocaleString()
    : null

  return (
    <SettingsSection id="settings-cloud-sync" label="Cloud Sync"
      blurb={<>Save this world to a folder on your computer — your Google Drive, OneDrive, Dropbox, or any synced folder.
          PlotWeave only reads or writes when you tell it to.</>}
    >
      {!supported && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Folder sync requires Chrome or Edge. Your current browser does not support it.
        </p>
      )}

      {supported && !binding && (
        <Button variant="outline" size="sm" className="w-full gap-2 justify-start" onClick={handleChooseFolder}>
          <FolderOpen className="h-4 w-4" />
          Choose sync folder…
        </Button>
      )}

      {supported && binding && (
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 space-y-3">
          {/* Folder + file name */}
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
            <span className="text-sm font-medium truncate">{binding.handle.name}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">/ {binding.fileName}</span>
          </div>

          {lastSynced && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Last synced: {lastSynced}</p>
          )}

          {statusMsg && (
            <p className={`text-xs ${syncState === 'error' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
              {statusMsg}
            </p>
          )}

          {/* Sync state — the folder is shared with the author's other machines,
              so anything it holds that this device hasn't seen has to be shown
              rather than quietly overwritten. */}
          {folderState && (
            <div
              className={
                needsAttention(folderState)
                  ? 'rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2'
                  : 'rounded-md border border-[hsl(var(--border))] px-3 py-2'
              }
            >
              <p className={`text-xs font-semibold ${needsAttention(folderState) ? 'text-amber-400' : 'text-[hsl(var(--foreground))]'}`}>
                {FOLDER_SYNC_LABELS[folderState].label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
                {FOLDER_SYNC_LABELS[folderState].detail}
              </p>
              {binding?.conflictFileName && (
                <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                  Your changes are going to <code className="font-mono">{binding.conflictFileName}</code>.
                </p>
              )}
            </div>
          )}

          {/* Save / Load */}
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline" className="flex-1 gap-1.5"
              onClick={handleSave} disabled={syncState !== 'idle'}
            >
              {syncState === 'saving'
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : <Upload className="h-3.5 w-3.5" />}
              {folderState && needsAttention(folderState) ? 'Save over' : 'Save'}
            </Button>
            <Button
              size="sm" variant="outline" className="flex-1 gap-1.5"
              onClick={handleLoad} disabled={syncState !== 'idle'}
            >
              {syncState === 'loading'
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : <Download className="h-3.5 w-3.5" />}
              Load
            </Button>
          </div>

          {/* Change folder / Disconnect */}
          <div className="flex gap-2">
            <Button
              size="sm" variant="ghost"
              className="flex-1 gap-1.5 text-[hsl(var(--muted-foreground))]"
              onClick={handleChooseFolder}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Change folder
            </Button>
            <Button
              size="sm" variant="ghost"
              className="flex-1 gap-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
              onClick={() => setConfirmDisconnect(true)}
            >
              <Unlink className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {loadPreview && (
        <LoadPreviewDialog
          preview={loadPreview.preview}
          parsed={loadPreview.parsed}
          onMerge={(p, prefer) => handleApplyLoad(p, 'merge', prefer)}
          onReplace={(p) => handleApplyLoad(p, 'replace')}
          onCancel={() => setLoadPreview(null)}
          isApplying={syncState === 'loading'}
        />
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={(v) => { if (!v) setConfirmDisconnect(false) }}
        title="Disconnect folder sync?"
        description="This removes the link between this world and the folder. The file in the folder is not deleted. You can reconnect at any time by choosing the folder again."
        onConfirm={handleDisconnect}
      />
    </SettingsSection>
  )
}
