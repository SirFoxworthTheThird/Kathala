import { useEffect, useState } from 'react'
import { BookOpen, Download, Check, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  downloadLibraryWorld, fetchLibraryIndex, formatBytes, libraryBaseUrl,
  type LibraryEntry,
} from '@/lib/library'

/**
 * The example library.
 *
 * These worlds double as a reading companion: because every view reads state
 * relative to the time cursor, a reader can set it to the chapter they have
 * reached and ask where everyone is without being told anything that happens
 * later. That is the reason to ship them, and it only works if the reader
 * controls the cursor — so they land as ordinary local worlds rather than
 * anything remote or read-through.
 */
export function LibraryDialog({
  open,
  onClose,
  onOpenWorld,
  installedWorldIds,
}: {
  open: boolean
  onClose: () => void
  onOpenWorld: (worldId: string) => void
  installedWorldIds: ReadonlySet<string>
}) {
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [stage, setStage] = useState<string>('')
  const [imagesWarning, setImagesWarning] = useState<string | null>(null)
  /** Entry awaiting confirmation that replacing the local copy is intended. */
  const [confirming, setConfirming] = useState<{ entry: LibraryEntry; withImages: boolean } | null>(null)

  const baseUrl = libraryBaseUrl(import.meta.env.BASE_URL)

  useEffect(() => {
    if (!open || entries) return
    let cancelled = false
    fetchLibraryIndex(baseUrl)
      .then((index) => { if (!cancelled) setEntries(index.entries) })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the library')
      })
    return () => { cancelled = true }
  }, [open, entries, baseUrl])

  if (!open) return null

  /**
   * Import reuses the world id in the file and replaces whatever is under it,
   * so re-downloading a world the reader already has would throw away any
   * notes they had made in it. Ask first.
   */
  function start(entry: LibraryEntry, withImages: boolean) {
    if (installedWorldIds.has(entry.worldId)) {
      setConfirming({ entry, withImages })
      return
    }
    void download(entry, withImages)
  }

  async function download(entry: LibraryEntry, withImages: boolean) {
    setConfirming(null)
    setBusyId(entry.id)
    setError(null)
    setImagesWarning(null)
    try {
      const result = await downloadLibraryWorld(baseUrl, entry, {
        withImages,
        onStage: (s) => setStage(s === 'images' ? 'Fetching images…' : 'Downloading…'),
      })
      if (result.imagesFailed) {
        setImagesWarning(`${entry.title} downloaded, but its images could not be fetched.`)
      }
      onOpenWorld(result.worldId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setBusyId(null)
      setStage('')
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
          <BookOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          <h2 className="flex-1 text-sm font-semibold text-[hsl(var(--foreground))]">Example library</h2>
          <button
            onClick={onClose}
            aria-label="Close library"
            className="pw-tap rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 py-3">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Worlds built from published books, to explore how PlotWeave fits together — and to
            read alongside. Set the chapter cursor to where you are and the app will only tell
            you what is true by then.
          </p>

          {error && (
            <p className="mt-3 rounded-md border border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.1)] px-3 py-2 text-sm text-[hsl(var(--foreground))]">
              {error}
            </p>
          )}
          {imagesWarning && (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {imagesWarning}
            </p>
          )}

          <ul className="mt-3 flex flex-col gap-2">
            {entries === null && !error && (
              <li className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading…</li>
            )}
            {entries?.map((entry) => {
              const installed = installedWorldIds.has(entry.worldId)
              const busy = busyId === entry.id
              return (
                <li
                  key={entry.id}
                  className="rounded-md border border-[hsl(var(--border))] p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{entry.title}</h3>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{entry.author}</span>
                  </div>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{entry.blurb}</p>

                  {entry.counts && (
                    <p className="mt-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                      {[
                        entry.counts.characters && `${entry.counts.characters} characters`,
                        entry.counts.chapters && `${entry.counts.chapters} chapters`,
                        entry.counts.events && `${entry.counts.events} events`,
                        entry.counts.locations && `${entry.counts.locations} locations`,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <p className="mt-2 text-[11px] italic text-[hsl(var(--muted-foreground))]">
                    {entry.notice}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {installed ? (
                      <>
                        <Button size="sm" onClick={() => onOpenWorld(entry.worldId)}>
                          <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => start(entry, false)}
                        >
                          {busy ? stage || 'Downloading…' : 'Download again'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => start(entry, false)}>
                          {busy ? stage || 'Downloading…' : (
                            <>
                              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Download ({formatBytes(entry.dataBytes)})
                            </>
                          )}
                        </Button>
                        {entry.images && (
                          // A separate button rather than a checkbox: the image
                          // bundle is often twenty times the data, and nobody on
                          // a phone should start that without meaning to.
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => start(entry, true)}
                          >
                            With images ({formatBytes(entry.imagesBytes ?? 0)})
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Replace your copy of “{confirming.entry.title}”?
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              You already have this world. Downloading it again restores the original and
              discards anything you have changed or added in it.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => void download(confirming.entry, confirming.withImages)}
              >
                Replace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
