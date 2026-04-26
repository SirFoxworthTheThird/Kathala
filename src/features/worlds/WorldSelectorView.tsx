import { useState, useRef } from 'react'
import faviconUrl from '/favicon.png'
import { Plus, Scroll, Upload, Sparkles } from 'lucide-react'
import { useWorlds } from '@/db/hooks/useWorlds'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { WorldCard } from './WorldCard'
import { CreateWorldDialog } from './CreateWorldDialog'
import { LLMPromptDialog } from './LLMPromptDialog'
import { useNavigate } from 'react-router-dom'
import { importWorld, importWorldImages } from '@/lib/exportImport'

declare global {
  interface Window {
    electronAPI?: {
      openFiles: () => Promise<Array<{ name: string; content: string }> | null>
    }
  }
}

export default function WorldSelectorView() {
  const worlds = useWorlds()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const isElectron = typeof window.electronAPI !== 'undefined'

  async function processFiles(files: File[]) {
    if (files.length === 1) {
      const text = await files[0].text()
      const parsed = JSON.parse(text) as Record<string, unknown>
      if (parsed.type === 'images') {
        const worldId = await importWorldImages(files[0])
        navigate(`/worlds/${worldId}`)
      } else {
        const worldId = await importWorld(files[0])
        navigate(`/worlds/${worldId}`)
      }
    } else {
      // Two files: one data file + one images file (order doesn't matter)
      const texts = await Promise.all(files.map((f) => f.text()))
      const parsed = texts.map((t) => JSON.parse(t) as Record<string, unknown>)
      const imagesIdx = parsed.findIndex((p) => p.type === 'images')
      const dataIdx   = parsed.findIndex((_, i) => i !== imagesIdx)
      if (dataIdx === -1) throw new Error('No data file found. Select the .pwk data file.')
      const worldId = await importWorld(files[dataIdx])
      if (imagesIdx !== -1) await importWorldImages(files[imagesIdx])
      navigate(`/worlds/${worldId}`)
    }
  }

  async function handleImportClick() {
    if (isElectron) {
      // Use Electron's native file dialog — avoids hidden-input unreliability
      setImporting(true)
      setImportError(null)
      try {
        const results = await window.electronAPI!.openFiles()
        if (!results || results.length === 0) return
        const files = results.map((r) => new File([r.content], r.name, { type: 'application/json' }))
        await processFiles(files)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Import failed')
      } finally {
        setImporting(false)
      }
    } else {
      importRef.current?.click()
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      await processFiles(files)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={faviconUrl} alt="PlotWeave" className="h-10 w-10 rounded object-cover" />
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">PlotWeave</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Story Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPromptOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              Generate from AI
            </Button>
            <Button
              variant="outline"
              onClick={handleImportClick}
              disabled={importing}
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Importing...' : 'Import World'}
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".pwk,.pwb,application/json"
              multiple
              className="hidden"
              onChange={handleImport}
            />
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New World
            </Button>
          </div>
        </div>
        {importError && (
          <p className="mt-2 text-xs text-red-400">{importError}</p>
        )}
        {importing && !importError && (
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Select a <code className="font-mono">.pwk</code> file to import.
            If you exported with split files, select both the <code className="font-mono">.pwk</code> and the <code className="font-mono">.pwb</code> images file together.
          </p>
        )}
      </header>

      <main className="flex-1 p-6">
        {worlds.length === 0 ? (
          <EmptyState
            icon={Scroll}
            title="No worlds yet"
            description="Create your first world or story to start tracking characters, locations, and events."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleImportClick}>
                  <Upload className="h-4 w-4" />
                  Import World
                </Button>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create World
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {worlds.map((world) => (
              <WorldCard key={world.id} world={world} />
            ))}
            <button
              onClick={() => setDialogOpen(true)}
              className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm">New World</span>
            </button>
          </div>
        )}
      </main>

      <CreateWorldDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/worlds/${id}`)}
      />
      <LLMPromptDialog open={promptOpen} onOpenChange={setPromptOpen} />
    </div>
  )
}
