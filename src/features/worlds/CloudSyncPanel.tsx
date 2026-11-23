import { useState, useEffect } from 'react'
import { FolderOpen, RefreshCw, Upload, Download, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  saveFolderBinding, clearFolderBinding,
  ensurePermission, isFolderSyncSupported,
} from '@/lib/folderSync'
import type { FolderBinding } from '@/lib/folderSync'
import { exportWorld } from '@/lib/exportImport'
import { useBookDrafts } from '@/db/hooks/useBookDrafts'
import { useWorld } from '@/db/hooks/useWorlds'
import { useResearchItems } from '@/db/hooks/useResearch'
import { EXPORT_FILES_SOFT_LIMIT, filesTotal, formatBytes } from '@/lib/research'
import { previewSyncFile } from './cloudSyncHelpers'
import { pushWorldToFolder, markPulled, readFolderSyncState, loadSyncBinding, seriesFileName } from './folderSyncRunner'
import { FOLDER_SYNC_LABELS, needsAttention, type FolderSyncState } from '@/lib/folderSyncState'
import type { ConflictPreference, MergePreview } from './cloudSyncHelpers'
import { LoadPreviewDialog } from './LoadPreviewDialog'
import { SettingsSection } from './SettingsSection'

type SyncState = 'idle' | 'saving' | 'loading' | 'error'

export function CloudSyncPanel({ worldId, worldName }: { worldId: string; worldName: string }) {
  const [binding, setBinding]     = useState<FolderBinding | null>(null)
  const [exportingFallback, setExportingFallback] = useState(false)
  const drafts = useBookDrafts(worldId)
  const [includeDrafts, setIncludeDrafts] = useState(false)
  /*
    Research files (#700, D-3): in the copy unless the writer says not, and
    not by default once they are so many that the copy might not open again.
  */
  const researchBytes = filesTotal(useResearchItems(worldId))
  const filesTooMany = researchBytes > EXPORT_FILES_SOFT_LIMIT
  const [researchChoice, setResearchChoice] = useState<boolean | null>(null)
  const withResearchFiles = researchChoice ?? !filesTooMany
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [loadPreview, setLoadPreview] = useState<{ preview: MergePreview; apply: (mode: 'replace' | 'merge', prefer?: ConflictPreference) => Promise<string> } | null>(null)
  const [folderState, setFolderState] = useState<FolderSyncState | null>(null)
  /*
    A book of a series is kept in its folder as its series is (#698): one file,
    the series and every book in it. So the folder here is the series'.
  */
  const world = useWorld(worldId)
  const series = useWorld(world?.seriesId ?? null)
  const key = world?.seriesId ?? worldId
  const known = world !== undefined

  useEffect(() => {
    // Read once the book is known, so a book of a series reads its series' folder.
    if (!known) return
    loadSyncBinding(worldId).then(setBinding)
  }, [worldId, key, known])

  // Re-check on mount and whenever the binding changes: the file may have been
  // written by another device while this tab was closed or idle.
  useEffect(() => {
    let cancelled = false
    if (!binding) { setFolderState(null); return }
    readFolderSyncState(binding.worldId, binding)
      .then(({ state }) => { if (!cancelled) setFolderState(state) })
      .catch(() => { if (!cancelled) setFolderState(null) })
    return () => { cancelled = true }
  }, [worldId, binding])

  const supported = isFolderSyncSupported()

  async function handleChooseFolder() {
    try {
      const handle   = await window.showDirectoryPicker({ mode: 'readwrite' })
      const fileName = series ? seriesFileName(series.name) : `${worldName.replace(/[^a-z0-9]/gi, '_')}.pwk`
      const newBinding: FolderBinding = { worldId: key, handle, fileName, lastSyncedAt: 0 }
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
      const updated = await pushWorldToFolder(binding.worldId, binding)
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
      const result = await previewSyncFile(binding.worldId, json)
      setSyncState('idle')
      setLoadPreview(result)
    } catch (e) {
      setSyncState('error')
      setStatusMsg((e as Error).message)
    }
  }

  async function handleApplyLoad(
    mode: 'replace' | 'merge',
    prefer: ConflictPreference = 'newer',
  ) {
    if (!binding || !loadPreview) return
    setSyncState('loading')
    try {
      await loadPreview.apply(mode, prefer)
      // The folder's copy is now what we hold, so the next auto-save must not
      // read it as the folder being ahead of us.
      const updated = await markPulled(binding.worldId, binding)
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
    await clearFolderBinding(key)
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
          Kathala only reads or writes when you tell it to.</>}
    >
      {/*
        Not a browser check — `isFolderSyncSupported` asks whether
        `showDirectoryPicker` exists. Naming Chrome and Edge, as this used to,
        was wrong in both directions: Opera, Vivaldi and the desktop app have
        the API, while Brave blocks it with no flag to re-enable it and no
        Chromium on Android exposes it at all. So a reader on Brave was told
        Kathala required a browser they were arguably already using, and given
        nothing to do about it.

        The one-off export at the foot of this panel is that something:
        `exportWorld` falls back to a plain download link when the picker is
        missing, so it works everywhere.
      */}
      {!supported && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          This browser does not offer the folder picker, so Kathala cannot keep a copy
          in a folder for you. Brave blocks it, and no mobile browser has it;
          Chrome, Edge, Opera, Vivaldi and the desktop app all do. You can still keep
          a copy yourself, below.
        </p>
      )}

      {supported && series && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {`This book is kept with its series. The folder holds “${series.name}” as one file: the shared cast and world, and every book in it.`}
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

      {/*
        A copy you keep yourself, on every browser.

        This panel is where the backup chip and the dashboard nudge now land,
        and until this button existed the only export here was *Export as HTML*
        — a read-only snapshot that cannot be imported. A writer with eleven
        thousand words followed the warning about their only copy, arrived here,
        and left believing the app had no world export at all; the `.pwk` was on
        the world card's menu, two screens back.

        A bound folder is still the better answer, because it keeps itself up to
        date. This is the one that always works.
      */}
      <div className="space-y-2 border-t border-[hsl(var(--border))] pt-3">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {binding
            ? 'Or take a copy by hand — the whole world, pictures included, as one file you can put anywhere.'
            : 'Or take a copy now — the whole world, pictures included, as one file you can put anywhere. Unlike Export as HTML, this one can be imported again.'}
        </p>
        {/*
          Named drafts (R3) stay on this device unless asked for: a .pwk is
          what goes to a reader, and they need not see the book's history.
        */}
        {drafts.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-[hsl(var(--foreground))]">
            <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} className="accent-[hsl(var(--ring))]" />
            Include the book&rsquo;s {drafts.length === 1 ? 'draft' : `${drafts.length} drafts`}
          </label>
        )}
        {researchBytes > 0 && (
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-[hsl(var(--foreground))]">
              <input type="checkbox" checked={withResearchFiles} onChange={(e) => setResearchChoice(e.target.checked)} className="accent-[hsl(var(--ring))]" />
              Include research files ({formatBytes(researchBytes)})
            </label>
            {filesTooMany && (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                More than {formatBytes(EXPORT_FILES_SOFT_LIMIT)} of research files: a copy that size may not open again in a browser. Without them, the research comes along without its files, and loading the copy here keeps the files you have.
              </p>
            )}
          </div>
        )}
        <Button
          variant="outline" size="sm" className="w-full gap-2 justify-start"
          disabled={exportingFallback}
          onClick={async () => {
            setExportingFallback(true)
            try { await exportWorld(worldId, undefined, { includeDrafts: includeDrafts && drafts.length > 0, withoutResearchFiles: researchBytes > 0 && !withResearchFiles }) } finally { setExportingFallback(false) }
          }}
        >
          <Download className="h-4 w-4" />
          {exportingFallback ? 'Exporting…' : 'Export a .pwk copy…'}
        </Button>
      </div>

      {loadPreview && (
        <LoadPreviewDialog
          preview={loadPreview.preview}
          seriesName={series?.name}
          onMerge={(prefer) => handleApplyLoad('merge', prefer)}
          onReplace={() => handleApplyLoad('replace')}
          onCancel={() => setLoadPreview(null)}
          isApplying={syncState === 'loading'}
        />
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={(v) => { if (!v) setConfirmDisconnect(false) }}
        title="Disconnect folder sync?"
        description={series
          ? `This removes the link between the series “${series.name}” and the folder, for every book in it. The file in the folder is not deleted. You can reconnect at any time by choosing the folder again.`
          : 'This removes the link between this world and the folder. The file in the folder is not deleted. You can reconnect at any time by choosing the folder again.'}
        onConfirm={handleDisconnect}
      />
    </SettingsSection>
  )
}
