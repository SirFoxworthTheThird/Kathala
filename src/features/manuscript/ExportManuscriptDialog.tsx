import { useEffect, useMemo, useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { compileManuscript, exportExtent, type BuiltManuscript, type CompileFormat } from '@/lib/manuscriptCompile'
import { compileDocx, compileEpub, roundedWordCount } from '@/lib/manuscriptExport'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { readSubmissionDetails, keepSubmissionDetails, type SubmissionDetails } from '@/lib/submissionDetails'
import { freshSentDraftName, openBookDraft, saveBookDraft, useLatestSentBack } from '@/db/hooks/useBookDrafts'
import { useProseNotes } from '@/db/hooks/useProseNotes'
import { markedPlan } from '@/lib/markedDocx'
import type { DraftBook } from '@/lib/bookDraft'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EventStatus } from '@/types'
import { plural } from '@/lib/plural'
import { manuscriptFileName } from '@/lib/manuscriptFileName'
import { downloadBlob } from '@/lib/download'
import { CHAPTER_HEADING_STYLES, headingExample, type ChapterHeadingStyle } from '@/lib/chapterHeading'

type ExportFormat = CompileFormat | 'docx' | 'epub'

const FORMATS: { id: ExportFormat; label: string; ext: string; mime: string; binary?: boolean }[] = [
  { id: 'markdown', label: 'Markdown', ext: 'md', mime: 'text/markdown' },
  { id: 'html', label: 'HTML', ext: 'html', mime: 'text/html' },
  { id: 'text', label: 'Plain text', ext: 'txt', mime: 'text/plain' },
  { id: 'docx', label: 'Word', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', binary: true },
  { id: 'epub', label: 'EPUB', ext: 'epub', mime: 'application/epub+zip', binary: true },
]

export function ExportManuscriptDialog({
  worldId,
  open,
  onOpenChange,
  manuscript,
  title,
  timelineName,
  timelineCount,
  coverUrl,
  chapterHeading = 'ch-title',
  onChapterHeading,
}: {
  /** The book: what the writer's details are remembered against (`submissionDetails`). */
  worldId: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  manuscript: BuiltManuscript
  /** The book's title — the world's name, which is what goes on the page. */
  title: string
  /** Only reaches the file name, and only when there is more than one (N11). */
  timelineName: string | undefined
  timelineCount: number
  /** Resolved URL for the world's cover, whether uploaded or linked. */
  coverUrl?: string
  /** How chapters are headed, remembered on the book: see `chapterHeading`. */
  chapterHeading?: ChapterHeadingStyle
  onChapterHeading?: (style: ChapterHeadingStyle) => void
}) {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [chapterTitles, setChapterTitles] = useState(true)
  /*
    Markdown's alone: it is the format that comes back into Kathala, and with
    each scene under its `## Title` an import rebuilds the same chapters and
    scenes. The formats made for readers — Word, EPUB, HTML — keep the break.
  */
  const [sceneTitles, setSceneTitles] = useState(true)
  const [onlyWritten, setOnlyWritten] = useState(true)
  /*
    Which scenes are finished enough to send.

    A threshold rather than tick-boxes, because the five statuses are a
    progression: "revised and final" is one choice, not two, and it keeps
    meaning the same thing if a stage is ever added between them. `none` is the
    default, so an export that nobody configured is the whole written draft, as
    it has always been.
  */
  const [minStatus, setMinStatus] = useState<'none' | EventStatus>('none')
  /*
    The writer's details, and Word's layout: remembered per book, on this
    device (`submissionDetails`), and read again each time the dialog opens.
    The byline's name is the author line of every book format too.
  */
  const [details, setDetails] = useState<SubmissionDetails>(() => readSubmissionDetails(worldId ?? ''))
  useEffect(() => { if (open && worldId) setDetails(readSubmissionDetails(worldId)) }, [open, worldId])
  const change = (patch: Partial<SubmissionDetails>) => setDetails((d) => {
    const next = { ...d, ...patch }
    if (worldId) keepSubmissionDetails(worldId, next)
    return next
  })
  const author = details.name
  const submission = format === 'docx' && details.layout === 'submission'
  /*
    The revision going back marked (round-trip-plan-2.md, T5.4): once an
    editor's file has come back, the changes since it, as tracked changes signed
    with the byline, and that editor's threads with the writer's replies.
  */
  const sentBack = useLatestSentBack(worldId ?? null)
  const notes = useProseNotes(worldId ?? null)
  const [sentBackBook, setSentBackBook] = useState<DraftBook | null>(null)
  useEffect(() => {
    let live = true
    setSentBackBook(null)
    if (open && sentBack) void openBookDraft(sentBack).then((b) => { if (live) setSentBackBook(b) })
    return () => { live = false }
  }, [open, sentBack])
  const [markBack, setMarkBack] = useState(true)
  const marking = useMemo(() => (sentBack && sentBackBook
    ? markedPlan({
      sentBack, base: sentBackBook, notes, author: details.name, now: Date.now(),
      scenes: manuscript.chapters.flatMap((c) => c.scenes.map((sc) => ({ eventId: sc.eventId, text: sc.text }))),
    })
    : null), [sentBack, sentBackBook, notes, details.name, manuscript])
  const [copied, setCopied] = useState(false)
  const [includeCover, setIncludeCover] = useState(true)
  const [coverError, setCoverError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const fmt = FORMATS.find((f) => f.id === format)!
  const opts = {
    chapterTitles, chapterHeading, sceneTitles, onlyWritten, title, author, minStatus: minStatus === 'none' ? null : minStatus,
    submission: submission ? { name: details.name, legalName: details.legalName, contact: details.contact, wordCount: details.wordCount, font: details.font, paper: details.paper } : undefined,
  }
  const extent = exportExtent(manuscript, opts)
  async function loadCover() {
    if (!includeCover || !coverUrl || format === 'text' || submission) return undefined
    const response = await fetch(coverUrl)
    if (!response.ok) throw new Error(`Cover request failed (${response.status})`)
    const image = await response.blob()
    if (!['image/jpeg', 'image/png'].includes(image.type)) throw new Error('Cover must be a JPEG or PNG image')
    const data = new Uint8Array(await image.arrayBuffer())
    return { data, mimeType: image.type }
  }

  function dataUrl(cover: { data: Uint8Array; mimeType: string }): string {
    let binary = ''
    for (const byte of cover.data) binary += String.fromCharCode(byte)
    return `data:${cover.mimeType};base64,${btoa(binary)}`
  }

  async function handleCopy() {
    try {
      setCoverError('')
      const cover = await loadCover()
      const copyOutput = compileManuscript(manuscript, format as CompileFormat, {
        ...opts,
        coverDataUrl: cover ? dataUrl(cover) : undefined,
      })
      await navigator.clipboard.writeText(copyOutput)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'The manuscript could not be copied')
    }
  }

  async function handleDownload() {
    setDownloading(true)
    setCoverError('')
    try {
      const cover = await loadCover()
      const fileName = manuscriptFileName({ worldName: title, timelineName, timelineCount, ext: fmt.ext })
      /*
        For an editor (R4): a draft of the book saved as the file is made, and
        each scene marked with its place in it, so their changes can come back
        to the right scenes, and edits made with tracking off can be found.
      */
      let forEditing
      if (format === 'docx' && details.forEditing && worldId) {
        const marked = markBack && marking ? marking.marked : undefined
        const draft = await saveBookDraft(worldId, await freshSentDraftName(worldId, fileName, Date.now(), marked ? 'Sent marked' : undefined), Date.now(), { sentAs: fileName })
        const index = new Map((await openBookDraft(draft)).chapters.flatMap((c) => c.scenes).map((s, i) => [s.id, i]))
        forEditing = { draftId: draft.id, worldId, sceneIndex: (id: string) => index.get(id), ...(marked ? { marked } : {}) }
      }
      const exportOpts = { ...opts, cover, coverDataUrl: cover ? dataUrl(cover) : undefined, forEditing }
      const textOutput = fmt.binary ? '' : compileManuscript(manuscript, format as CompileFormat, exportOpts)
      const blob = fmt.binary
      ? new Blob(
          [(format === 'docx' ? compileDocx(manuscript, exportOpts) : compileEpub(manuscript, exportOpts)) as BlobPart],
          { type: fmt.mime },
        )
        : new Blob([textOutput], { type: `${fmt.mime};charset=utf-8` })
      downloadBlob(blob, fileName)
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'The cover could not be added')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export manuscript</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">Format</p>
            <div className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-sm">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  aria-pressed={format === f.id}
                  className={cn(
                    'flex-1 border-l border-[hsl(var(--border))] px-3 py-1.5 transition-colors first:border-l-0',
                    format === f.id ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              <input type="checkbox" checked={chapterTitles} onChange={(e) => setChapterTitles(e.target.checked)} className="accent-[hsl(var(--ring))]" />
              Include chapter titles
            </label>
            {/* Not Markdown's: it keeps "Ch. N — Title", which is what an import reads back. */}
            {chapterTitles && format !== 'markdown' && (
              <Field label="Chapter headings" className="gap-1 pl-6">
                <Select value={chapterHeading} onValueChange={(v) => onChapterHeading?.(v as ChapterHeadingStyle)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAPTER_HEADING_STYLES.map((id) => <SelectItem key={id} value={id}>{headingExample(id, manuscript.chapters)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {format === 'markdown' && (
              <label className="flex items-center gap-2 text-[hsl(var(--foreground))]">
                <input type="checkbox" checked={sceneTitles} onChange={(e) => setSceneTitles(e.target.checked)} className="accent-[hsl(var(--ring))]" />
                Scene titles as ## headings, so an import gets the same scenes back
              </label>
            )}
            <label className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              <input type="checkbox" checked={onlyWritten} onChange={(e) => setOnlyWritten(e.target.checked)} className="accent-[hsl(var(--ring))]" />
              Only written scenes
            </label>
            <Field label="Scenes to include" className="gap-1 pt-1">
              <Select value={minStatus} onValueChange={(v) => setMinStatus(v as 'none' | EventStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Every scene</SelectItem>
                  {/*
                    Not "Revised and final only": that contains "Final only"
                    whole, so every lookup by name matches both and the app's
                    own rule is to grep before naming a control.
                  */}
                  <SelectItem value="revised">Revised and final</SelectItem>
                  <SelectItem value="final">Final only</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <label className="flex items-center gap-2 text-[hsl(var(--foreground))]">
              <input type="checkbox" checked={includeCover && !submission} disabled={!coverUrl || format === 'text' || submission} onChange={(e) => setIncludeCover(e.target.checked)} className="accent-[hsl(var(--ring))]" />
              Include world cover{format === 'text' ? ' (not supported by plain text)' : submission ? ' (not on a submission)' : ''}
            </label>
          </div>

          {coverError && <p role="alert" className="text-xs text-red-400">{coverError}</p>}

          {format === 'docx' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Layout</p>
              <div role="group" aria-label="Layout" className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-sm">
                {(['book', 'submission'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => change({ layout: l })}
                    aria-pressed={details.layout === l}
                    className={cn(
                      'flex-1 border-l border-[hsl(var(--border))] px-3 py-1.5 transition-colors first:border-l-0',
                      details.layout === l ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]',
                    )}
                  >
                    {l === 'book' ? 'Book' : 'Submission'}
                  </button>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm text-[hsl(var(--foreground))]">
                <input type="checkbox" checked={details.forEditing} onChange={(e) => change({ forEditing: e.target.checked })} className="mt-1 accent-[hsl(var(--ring))]" />
                <span>
                  For an editor
                  <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                    Marks each scene, and saves a draft of the book, so that their tracked changes and comments can come back with Bring in edits.
                  </span>
                </span>
              </label>
              {details.forEditing && sentBack && (
                <label className="ml-6 flex items-start gap-2 text-sm text-[hsl(var(--foreground))]">
                  <input type="checkbox" checked={markBack} onChange={(e) => setMarkBack(e.target.checked)} className="mt-1 accent-[hsl(var(--ring))]" />
                  <span>
                    Show my changes since {sentBack.editors?.length ? `${sentBack.editors.join(' and ')}’s` : 'the editor’s'} file ({sentBack.sentBack})
                    <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                      {marking
                        ? `${plural(marking.changes, 'change')} and ${plural(marking.threads, 'comment thread')}, signed ${marking.marked.author}: what you changed of their version, and their comments with your replies.`
                        : 'Reading what came back…'}
                    </span>
                  </span>
                </label>
              )}
              {submission && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Standard manuscript format, for an agent or an editor: double-spaced, a running header with your surname, the title and the page, and a title page with your contact details and the word count.
                </p>
              )}
            </div>
          )}

          {fmt.binary && (
            <div className="space-y-2">
              <Field label={submission ? 'Name on the byline' : 'Author (optional)'} className="gap-1">
                <Input value={details.name} onChange={(e) => change({ name: e.target.value })} placeholder="Author name" className="h-9" />
              </Field>
              {submission && (
                <>
                  <Field label="Legal name, if not the byline’s" className="gap-1">
                    <Input value={details.legalName} onChange={(e) => change({ legalName: e.target.value })} className="h-9" />
                  </Field>
                  <Field label="Contact details" className="gap-1">
                    <Textarea rows={3} value={details.contact} onChange={(e) => change({ contact: e.target.value })} placeholder={'Address, email, telephone: a line each'} />
                  </Field>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Your name is put above these lines.</p>
                  <Field label="Word count on the title page" className="gap-1">
                    <Input value={details.wordCount} onChange={(e) => change({ wordCount: e.target.value })} placeholder={roundedWordCount(extent.words)} className="h-9" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Font" className="gap-1">
                      <Select value={details.font} onValueChange={(v) => change({ font: v as SubmissionDetails['font'] })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="times">Times New Roman</SelectItem>
                          <SelectItem value="courier">Courier New</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Paper" className="gap-1">
                      <Select value={details.paper} onValueChange={(v) => change({ paper: v as SubmissionDetails['paper'] })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="letter">US Letter</SelectItem>
                          <SelectItem value="a4">A4</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </>
              )}
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Kept on this device for this book, for the next export. It goes into the file you download and nowhere else — not into the book’s backups.
              </p>
            </div>
          )}

          {/*
            What this export contains, not what the book contains.

            These were the whole manuscript's totals, which was true while the
            only option was "only written scenes" and would have become a lie
            the moment a status threshold could drop written ones — the figure
            beside the button describing a different document from the one the
            button produces.
          */}
          <div data-export-extent
            className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span>{plural(extent.words, 'word')}</span>
            <span>{plural(extent.scenes, 'scene')}</span>
          </div>

          {submission && !details.name.trim() && <p className="text-xs text-[hsl(var(--muted-foreground))]">A submission needs the name on its byline.</p>}
          <div className="flex gap-2">
            {!fmt.binary && (
              <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
                {copied ? <><Check className="h-4 w-4 text-green-400" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}
              </Button>
            )}
            <Button className="flex-1 gap-2" onClick={handleDownload} disabled={downloading || (submission && !details.name.trim())}>
              <Download className="h-4 w-4" /> {downloading ? 'Preparing…' : `Download .${fmt.ext}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
