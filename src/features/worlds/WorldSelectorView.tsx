import { useState, useRef, useMemo } from 'react'
import faviconUrl from '/favicon.png'
import { Plus, Scroll, Upload, Sparkles, AlertCircle, FileText, BookOpen } from 'lucide-react'
import { useWorlds } from '@/db/hooks/useWorlds'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { WorldCard } from './WorldCard'
import { CreateWorldDialog } from './CreateWorldDialog'
import { ImportManuscriptDialog } from './ImportManuscriptDialog'
import { LibraryDialog } from './LibraryDialog'
import { LLMPromptDialog } from './LLMPromptDialog'
import { useNavigate } from 'react-router-dom'
import { importWorld, importWorldImages } from '@/lib/exportImport'
import { partitionWorlds } from '@/lib/worldShelves'
import { importCollision, type ImportCollision } from '@/lib/importCollision'
import { ConfirmDialog } from '@/components/ConfirmDialog'

/** A chosen file set, parked while the writer decides whether to overwrite. */
interface PendingImport {
  files: File[]
  dataIdx: number
  imagesIdx: number
  collision: ImportCollision
}

declare global {
  interface Window {
    electronAPI?: {
      openFiles: () => Promise<Array<{ name: string; content: string }> | null>
    }
  }
}

export default function WorldSelectorView() {
  const worlds = useWorlds()
  const { drafts, reading } = useMemo(() => partitionWorlds(worlds), [worlds])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [manuscriptOpen, setManuscriptOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  /*
    The file formats used to be explained permanently in the header — an action
    nobody had started, described with two extensions a new user has never seen.
    It is the same sentence, asked for at the one moment it is useful: just
    before the picker opens, when "select both files together" is still
    something you can act on.
  */
  const [importPromptOpen, setImportPromptOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const isElectron = typeof window.electronAPI !== 'undefined'

  /** A selection held back because importing it would overwrite a local world. */
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)

  async function processFiles(files: File[]) {
    const texts = await Promise.all(files.map((f) => f.text()))
    const parsed = texts.map((t) => JSON.parse(t) as Record<string, unknown>)
    const imagesIdx = parsed.findIndex((p) => p.type === 'images')
    const dataIdx = parsed.findIndex((_, i) => i !== imagesIdx)

    if (dataIdx === -1) {
      // Images only. Nothing to warn about: this path adds blobs to a world
      // that already exists rather than replacing one.
      if (imagesIdx === -1) throw new Error('No data file found. Select the .pwk data file.')
      const worldId = await importWorldImages(files[imagesIdx])
      navigate(`/worlds/${worldId}`)
      return
    }

    /*
      Ask first when the file lands on a world that is already here.

      `importWorld` replaces: it deletes every record for the incoming world's
      id before writing the file's. Re-importing a backup over a day's writing
      took the day's writing with it, with no confirm and nothing said
      afterwards. The Library has asked this question before replacing a
      downloaded copy for a long time — the same question, on the door writers
      use for their own exports.
    */
    const collision = importCollision(parsed[dataIdx], worlds)
    if (collision) {
      setPendingImport({ files, dataIdx, imagesIdx, collision })
      return
    }
    await runImport(files, dataIdx, imagesIdx)
  }

  async function runImport(files: File[], dataIdx: number, imagesIdx: number) {
    const worldId = await importWorld(files[dataIdx])
    if (imagesIdx !== -1) await importWorldImages(files[imagesIdx])
    navigate(`/worlds/${worldId}`)
  }

  async function confirmPendingImport() {
    const pending = pendingImport
    if (!pending) return
    setPendingImport(null)
    setImporting(true)
    setImportError(null)
    try {
      await runImport(pending.files, pending.dataIdx, pending.imagesIdx)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
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
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={faviconUrl} alt="PlotWeave" className="h-10 w-10 rounded object-cover" />
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">PlotWeave</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">A story bible for fiction writers</p>
            </div>
          </div>
          {/*
            Five equal-weight buttons in a row meant a newcomer had to read all
            five to find themselves. Two of them mean "I am starting fresh" and
            three mean "I already have something"; the headings say so, and the
            groups are real `role="group"`s so the split reaches a screen reader
            rather than only the eye. Nothing is buried in a menu — Library is
            the best first run this app has, and hiding it would cost more than
            the row of five did.
          */}
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <div role="group" aria-labelledby="start-fresh-heading" className="flex flex-col gap-1.5">
              <span id="start-fresh-heading" className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Start something new
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New World
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPromptOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate World from AI
                </Button>
              </div>
            </div>

            <div aria-hidden="true" className="hidden w-px self-stretch bg-[hsl(var(--border))] sm:block" />

            <div role="group" aria-labelledby="bring-in-heading" className="flex flex-col gap-1.5">
              <span id="bring-in-heading" className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Bring something in
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLibraryOpen(true)}
                >
                  <BookOpen className="h-4 w-4" />
                  Library
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setImportPromptOpen(true)}
                  disabled={importing}
                >
                  <Upload className="h-4 w-4" />
                  {importing ? 'Importing...' : 'Import World'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setManuscriptOpen(true)}
                >
                  <FileText className="h-4 w-4" />
                  Import Manuscript
                </Button>
              </div>
            </div>

            <input
              ref={importRef}
              type="file"
              aria-label="Import world file"
              accept=".pwk,.pwb,application/json"
              multiple
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>
        {importError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {importError}
          </p>
        )}
      </header>

      <main className="flex-1 p-6">
        {worlds.length === 0 ? (
          /*
            No buttons here on purpose.

            Three of the five entry points used to sit in this space, ungrouped,
            directly under the header's two labelled groups — a second, competing
            hierarchy, with a different label for the same thing ("Create World"
            for what the header calls "New World") and no mention of the Library
            at all, which is the best first run this app has.

            Repeating a button that is already on screen and already grouped is
            what caused that, so the empty state names the routes in prose and
            points up at them instead. It also keeps every entry point to exactly
            one control: two buttons reading "New World" on one screen is an
            ambiguity for anyone navigating by name, not only for a test.
          */
          <EmptyState
            icon={Scroll}
            title="No worlds yet"
            description="Use New World at the top of the screen to start from scratch, or the Library to open a world built from a published book. You can also bring in a .pwk export or a manuscript draft from there."
          />
        ) : (
          /*
            Two shelves, not one.

            A book downloaded from the library and a draft being written are
            different things that happen to share a card, and they sort
            together, so a reader with half the library loses their own two
            drafts among eight other people's books. The cards already differ —
            a reading world carries "Chapter 5 of 17" and a draft does not — and
            the actions do too: you export and sequel a draft, you resume a book.

            This used to say the sort date "for a download is whenever it was
            fetched". It is not: `applyWorldImport` writes the world record
            straight out of the `.pwk`, so a downloaded book keeps the date the
            fixture was authored on. That is why the split alone was not enough
            — see W19-5 on the ordering in `useWorlds`.

            Your own work leads, because this is a writing tool. Either shelf is
            dropped when empty rather than standing there as an empty heading.
          */
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              {reading.length > 0 && (
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Your worlds
                </h2>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {drafts.map((world) => (
                  <WorldCard key={world.id} world={world} />
                ))}
                {/*
                  Stays with the drafts: it makes a world to write, not to read.

                  SEL-5: it read "New World", the same as the header button, so
                  the screen offered the same thing under one name in two places
                  with nothing saying they were the same thing. The empty state
                  above already refuses to do that, and its comment says why —
                  but the populated case did it anyway.

                  Named for what it is instead, in the app's own words: the
                  empty state calls this route "start from scratch". Deliberately
                  not "Start a new world", which still *contains* "new world" —
                  `getByRole` matches names by substring, so that would leave the
                  ambiguity exactly where it was. The title states the relation
                  the finding asked for.
                */}
                <button
                  onClick={() => setDialogOpen(true)}
                  title="Start from scratch — the same as New World, at the top of the screen"
                  className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]"
                >
                  <Plus className="h-6 w-6" />
                  <span className="text-sm">Start from scratch</span>
                </button>
              </div>
            </section>

            {reading.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Reading
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {reading.map((world) => (
                    <WorldCard key={world.id} world={world} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <CreateWorldDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/worlds/${id}`)}
      />
      <ImportManuscriptDialog
        open={manuscriptOpen}
        onOpenChange={setManuscriptOpen}
        onImported={(id) => navigate(`/worlds/${id}`)}
      />
      <LLMPromptDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        onImported={(id) => navigate(`/worlds/${id}`)}
      />
      <ConfirmDialog
        open={importPromptOpen}
        onOpenChange={setImportPromptOpen}
        title="Import a world"
        description="Choose the .pwk file you exported. If you exported with split files, select both the .pwk and its .pwb images file together."
        confirmLabel="Choose file…"
        destructive={false}
        onConfirm={() => { setImportPromptOpen(false); handleImportClick() }}
      />

      {/*
        Names the world being overwritten and says what is lost, because "this
        will replace the existing world" does not tell you whether the existing
        world is the one you spent this morning in.
      */}
      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(v) => { if (!v) setPendingImport(null) }}
        title={`Replace your copy of “${pendingImport?.collision.localName ?? ''}”?`}
        description={
          [
            /*
              Reachable: the file carries the name the world had when it was
              exported, so renaming a world afterwards makes the two disagree —
              and then "a world you already have" is the confusing half, since
              the writer is looking for a name that is no longer on screen.
            */
            pendingImport && pendingImport.collision.incomingName !== pendingImport.collision.localName
              ? `The file calls it “${pendingImport.collision.incomingName}”, but it is the same world.`
              : 'This file is an export of a world you already have.',
            'Importing it restores the file’s version and discards anything you have written in that world since it was exported. Your other worlds are untouched.',
          ].join(' ')
        }
        confirmLabel="Replace"
        onConfirm={() => void confirmPendingImport()}
      />

      <LibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onOpenWorld={(worldId) => { setLibraryOpen(false); navigate(`/worlds/${worldId}`) }}
        installedWorldIds={new Set(worlds.map((w) => w.id))}
      />
    </div>
  )
}
