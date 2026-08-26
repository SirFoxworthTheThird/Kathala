import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Download, Check, X, AlertTriangle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  downloadBytes, downloadLibraryWorld, fetchLibraryIndex, formatBytes, libraryBaseUrl,
  type LibraryEntry,
} from '@/lib/library'
import { browseLibrary } from '@/lib/libraryBrowse'
import { Input } from '@/components/ui/input'

/**
 * Cover art on a catalogue card.
 *
 * A remote image on a card that has to stay readable without it, so a URL that
 * 404s or is blocked takes itself off the card rather than leaving a broken
 * frame. Lazily loaded — the list is longer than the dialog.
 */
function LibraryCover({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt={`${title} cover`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-24 w-16 shrink-0 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] object-cover"
    />
  )
}

/**
 * The library.
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
  const [query, setQuery] = useState('')

  const baseUrl = libraryBaseUrl(import.meta.env.BASE_URL)

  /*
    Escape backs out of whatever is in front of you: the replace confirm if it
    is up, the catalogue otherwise.

    Both halves were missing. This dialog is hand-rolled rather than the shared
    `Dialog`, so **X-11**'s Escape sweep passed it by exactly as it did the Help
    panel — and unlike those, it has no backdrop click either, so its close
    button was the only way out. The confirm stacked on top is hand-rolled too
    and had no key of its own, so Escape in front of it did nothing at all.

    Innermost first, in one handler, which is the rule **X-13** was filed for:
    two listeners that both fire would answer the question *and* throw away the
    catalogue behind it in a single keypress.
  */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (confirming) setConfirming(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, confirming, onClose])

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

  /*
    Alphabetical, filed past a leading article, and narrowed by the search box.
    See `lib/libraryBrowse` for why the article matters at this size.
  */
  const shown = useMemo(() => browseLibrary(entries ?? [], query), [entries, query])

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
          <h2 className="flex-1 text-sm font-semibold text-[hsl(var(--foreground))]">Library</h2>
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

          {/*
            The search box appears once the catalogue has, so it never offers to
            filter nothing. No autofocus: on a phone that throws the keyboard up
            over the list the reader came to look at.
          */}
          {entries !== null && entries.length > 0 && (
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search the library by title or author"
                placeholder="Search by title or author…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          )}

          <ul className="mt-3 flex flex-col gap-2">
            {entries === null && !error && (
              <li className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading…</li>
            )}
            {/*
              Says what was searched for, because "no results" on its own leaves
              a reader wondering whether the catalogue failed to load.
            */}
            {entries !== null && shown.length === 0 && query.trim() && (
              <li className="flex flex-col items-center gap-2 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                <span>No book here matches “{query.trim()}”.</span>
                <Button variant="outline" size="sm" onClick={() => setQuery('')}>
                  Show all {entries.length}
                </Button>
              </li>
            )}
            {shown.map((entry) => {
              const installed = installedWorldIds.has(entry.worldId)
              const busy = busyId === entry.id
              return (
                <li
                  key={entry.id}
                  className="rounded-md border border-[hsl(var(--border))] p-3"
                >
                  <div className="flex gap-3">
                    {entry.cover && <LibraryCover src={entry.cover} title={entry.title} />}

                    <div className="min-w-0 flex-1">
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
                            entry.counts.events && `${entry.counts.events} ${entry.counts.events === 1 ? 'scene' : 'scenes'}`,
                            entry.counts.locations && `${entry.counts.locations} locations`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      <p className="mt-2 text-[11px] italic text-[hsl(var(--muted-foreground))]">
                        {entry.notice}
                      </p>
                    </div>
                  </div>

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
                          onClick={() => start(entry, !!entry.images)}
                        >
                          {busy ? stage || 'Downloading…' : 'Download again'}
                        </Button>
                      </>
                    ) : (
                      <>
                        {/*
                          One button. Where a world ships an image bundle it
                          comes with the book, and the size on the button is the
                          whole of what will be fetched — which is the part that
                          matters on a phone. It used to be a second button,
                          "With images (14.6 MB)", on the reasoning that nobody
                          should start fifteen megabytes without meaning to; but
                          a reader choosing between two downloads has to know
                          what a `.pwb` is to choose, and the one they were more
                          likely to press was the one that quietly left the maps
                          blank.
                        */}
                        <Button size="sm" disabled={busy} onClick={() => start(entry, !!entry.images)}>
                          {busy ? stage || 'Downloading…' : (
                            <>
                              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Download ({formatBytes(downloadBytes(entry))})
                            </>
                          )}
                        </Button>
                        {/*
                          Said before the download rather than discovered after
                          it. Most shipped worlds keep their maps and covers as
                          links rather than bytes — Dracula's `.pwk` carries 76
                          of them — so the book arrives complete in every respect
                          except that its maps need a connection to draw. The map
                          screen says so honestly once you are there; the card
                          was offering "Download (363 KB)" and leaving you to
                          find out on a train.
                        */}
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                          {entry.images ? 'Embedded images' : 'Pictures load from the web'}
                        </span>
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
