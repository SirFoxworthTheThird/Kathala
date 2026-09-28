import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Download, BookOpen, PencilLine, Replace } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useTimelines } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { useReadingMode } from '@/db/hooks/useReading'
import { cn } from '@/lib/utils'
import { ExportManuscriptDialog } from './ExportManuscriptDialog'
import { FindReplaceDialog } from './FindReplaceDialog'
import { plural } from '@/lib/plural'
import { useBlobUrl } from '@/db/hooks/useBlobs'
import { useManuscriptBook } from './useManuscriptBook'
import { ManuscriptBook, ReaderRow, BookGoal } from './ManuscriptBook'

const nf = new Intl.NumberFormat()

export default function ManuscriptView() {
  const { worldId } = useParams<{ worldId: string }>()
  const world = useWorld(worldId ?? null)
  const coverUrl = useBlobUrl(world?.coverImageId ?? null)
  const timelines = useTimelines(worldId ?? null)
  const ordered = useMemo(() => [...timelines].sort((a, b) => a.createdAt - b.createdAt), [timelines])
  const [timelineId, setTimelineId] = useState<string | null>(null)
  const activeTimelineId = timelineId ?? ordered[0]?.id ?? null
  const book = useManuscriptBook(worldId ?? null, activeTimelineId)
  const { manuscript } = book

  /*
    In reading mode this screen *is* the book, so the presentation is not a
    choice the reader makes — the draft view shows synopses, scene numbers and
    unwritten placeholders, which is the author's scaffolding and none of a
    reader's business. The toggle below is hidden to match.
  */
  const readingMode = useReadingMode(worldId ?? null)
  const [draftMode, setDraftMode] = useState<'draft' | 'reading'>('draft')
  const mode = readingMode ? 'reading' : draftMode
  const scrollRef = useRef<HTMLDivElement>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const hasProse = manuscript.writtenScenes > 0

  return (
    <div className="flex h-full flex-col">
      {/*
        MS-2: this carried `count={totalWords}` — a bare pill reading `0`, or
        `48,000`, beside the word "Manuscript". The pill works on the rosters
        because the title names what is being counted: "Characters 45" needs no
        label. "Manuscript 0" needs one, and the subtitle a line below was
        already giving the same number with its unit attached.
      */}
      <PageHeader
        icon={FileText}
        title={readingMode ? 'Read' : 'Manuscript'}
        // A reader is told how far *they* have got, by the chapter bar and the
        // time cursor. How much of the book is "written" is a fact about an
        // author's progress, and there is no author here.
        description={readingMode
          ? undefined
          : `${nf.format(manuscript.writtenScenes)} of ${nf.format(manuscript.totalScenes)} scenes written · ${plural(manuscript.totalWords, 'word')}`}
        actions={readingMode ? undefined : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setFindOpen(true)} disabled={!hasProse}>
              <Replace className="h-4 w-4" /> Find &amp; replace
            </Button>
            <Button size="sm" onClick={() => setExportOpen(true)} disabled={!hasProse}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        )}
      >
        {/* Toolbar row: timeline picker, reading/draft toggle, word goal */}
        {ordered.length > 1 && (
          <select
            value={activeTimelineId ?? ''}
            onChange={(e) => setTimelineId(e.target.value)}
            className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))]"
            aria-label="Timeline"
          >
            {ordered.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {!readingMode && (
        <div className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs" role="group" aria-label="View mode">
          <button
            onClick={() => setDraftMode('draft')}
            aria-pressed={mode === 'draft'}
            className={cn('flex items-center gap-1 px-2 py-1 transition-colors', mode === 'draft' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
          >
            <PencilLine className="h-3.5 w-3.5" /> Draft
          </button>
          <button
            onClick={() => setDraftMode('reading')}
            aria-pressed={mode === 'reading'}
            className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors', mode === 'reading' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
          >
            <BookOpen className="h-3.5 w-3.5" /> Reading
          </button>
        </div>
        )}
        {!readingMode && <BookGoal worldId={worldId!} words={manuscript.totalWords} />}
        {readingMode && hasProse && (
          /*
            The reader's row. Not the header's `actions` slot, which PageHeader
            withholds from a reader on purpose — those are authoring controls
            without exception, and the blanket rule is what keeps a screen added
            later right by default. Reading controls are a different thing that
            happens to sit nearby.
          */
          <ReaderRow book={book} scrollRef={scrollRef} />
        )}
      </PageHeader>

      <ManuscriptBook
        worldId={worldId!}
        timelineId={activeTimelineId}
        book={book}
        mode={mode}
        readingMode={readingMode}
        scrollRef={scrollRef}
      />

      <ExportManuscriptDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        manuscript={manuscript}
        /* The book is the world. The timeline named the file and the title
           page both, so a novel exported as its own internal grouping (N11). */
        title={world?.name ?? 'Manuscript'}
        timelineName={ordered.find((t) => t.id === activeTimelineId)?.name}
        timelineCount={ordered.length}
        coverUrl={coverUrl}
      />
      {worldId && <FindReplaceDialog open={findOpen} onOpenChange={setFindOpen} worldId={worldId} />}
    </div>
  )
}
