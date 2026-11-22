import { useState } from 'react'
import { FileText, Image as ImageIcon, Link2, Quote, Trash2, Pencil, X, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useBlobUrlState } from '@/db/hooks/useBlobs'
import { attachResearch, deleteResearchItem, detachResearch, updateResearchItem } from '@/db/hooks/useResearch'
import { formatBytes, isAttached, isImage, isLoose, isPdf } from '@/lib/research'
import type { ResearchItem, ResearchLink } from '@/types'
import { TARGET_WORDS, type ResearchTargetOption } from './useResearchNames'

/*
  One research item (issue #700): what it is, its note, what it is attached
  to, and the means to open, change, attach and delete it.
*/

export function kindWord(item: ResearchItem): string {
  if (item.kind === 'link') return 'Link'
  if (item.kind === 'clip') return 'Clipping'
  return isImage(item.mimeType) ? 'Image' : isPdf(item.mimeType) ? 'PDF' : 'File'
}

function KindIcon({ item }: { item: ResearchItem }) {
  const cls = 'h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]'
  if (item.kind === 'link') return <Link2 className={cls} aria-hidden="true" />
  if (item.kind === 'clip') return <Quote className={cls} aria-hidden="true" />
  return isImage(item.mimeType) ? <ImageIcon className={cls} aria-hidden="true" /> : <FileText className={cls} aria-hidden="true" />
}

/** A file's thumbnail, or why there is none. */
function Thumb({ item }: { item: ResearchItem }) {
  const { url, missing } = useBlobUrlState(item.kind === 'file' ? item.blobId ?? null : null)
  if (item.kind !== 'file') return null
  if (missing) return <span className="text-[11px] italic text-[hsl(var(--muted-foreground))]">File not in this copy</span>
  if (!isImage(item.mimeType) || !url) return null
  return <img src={url} alt="" className="h-16 w-24 shrink-0 rounded border border-[hsl(var(--border))] object-cover" />
}

export function ResearchCard({ item, targets, label, onOpen, here }: {
  item: ResearchItem
  /** Everything it may be attached to, in this book. */
  targets: ResearchTargetOption[]
  label: (l: ResearchLink) => string | undefined
  onOpen: (item: ResearchItem) => void
  /** The record a panel shows it on: not repeated among its attachments, and the one *Take off* means. */
  here?: ResearchLink
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [note, setNote] = useState(item.note)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shownOn = item.attachedTo.filter((l) => !(here && l.kind === here.kind && l.id === here.id)).map((l) => ({ l, name: label(l) })).filter((x) => !!x.name)
  const attachable = targets.filter((t) => !isAttached(item, t))

  async function save() {
    try {
      await updateResearchItem(item.id, { title: title.trim() || item.title, note })
      setEditing(false)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <article aria-label={`Research: ${item.title}`} className="flex gap-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <KindIcon item={item} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <button type="button" className="text-left text-sm font-medium hover:underline" onClick={() => onOpen(item)}
            aria-label={`Open ${item.title}`} disabled={item.kind === 'clip'}>
            {item.title}
          </button>
          <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
            {kindWord(item)}{item.size ? ` · ${formatBytes(item.size)}` : ''}{item.kind === 'link' && item.url ? ` · ${new URL(item.url).hostname}` : ''}
          </span>
        </div>
        <Thumb item={item} />
        {item.kind === 'clip' && (
          <blockquote className="whitespace-pre-wrap border-l-2 border-[hsl(var(--border))] pl-2 text-xs">
            {item.text}
            {item.source && <footer className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">— {item.source}</footer>}
          </blockquote>
        )}
        {editing ? (
          <div className="flex flex-col gap-2">
            <Field label="Title"><Input className="h-8 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Research note"><Textarea className="min-h-[3rem] text-xs" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {error && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void save()}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setTitle(item.title); setNote(item.note) }}>Cancel</Button>
            </div>
          </div>
        ) : item.note ? (
          <p className="whitespace-pre-wrap text-xs text-[hsl(var(--muted-foreground))]">{item.note}</p>
        ) : null}
        <ul aria-label="Attached to" className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {item.toWorld && (
            <li className="flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2 py-0.5">
              <Globe className="h-3 w-3" aria-hidden="true" /> The world
              <button type="button" aria-label={`Take ${item.title} off the world`} onClick={() => void updateResearchItem(item.id, { toWorld: false })}><X className="h-3 w-3" aria-hidden="true" /></button>
            </li>
          )}
          {shownOn.map(({ l, name }) => (
            <li key={`${l.kind}:${l.id}`} className="flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2 py-0.5">
              <span className="text-[hsl(var(--muted-foreground))]">{TARGET_WORDS[l.kind]}:</span> {name}
              <button type="button" aria-label={`Take ${item.title} off ${name}`} onClick={() => void detachResearch(item.id, l)}><X className="h-3 w-3" aria-hidden="true" /></button>
            </li>
          ))}
          {isLoose(item) && <li className="italic text-[hsl(var(--muted-foreground))]">Attached to nothing</li>}
        </ul>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="w-40">
          <Select value="" onValueChange={(v) => {
            if (v === 'world') void updateResearchItem(item.id, { toWorld: true })
            else { const t = attachable.find((x) => `${x.kind}:${x.id}` === v); if (t) void attachResearch(item.id, { kind: t.kind, id: t.id }) }
          }}>
            <SelectTrigger className="h-7 text-xs" aria-label={`Attach to… (${item.title})`}><SelectValue placeholder="Attach to…" /></SelectTrigger>
            <SelectContent>
              {!item.toWorld && <SelectItem value="world" className="text-xs">The world as a whole</SelectItem>}
              {attachable.map((t) => <SelectItem key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`} className="text-xs">{`${TARGET_WORDS[t.kind]}: ${t.label}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex">
          {here && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void detachResearch(item.id, here)}>Take off</Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={`Edit research ${item.title}`} onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={`Delete research ${item.title}`} onClick={() => setConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Delete “${item.title}”?`}
        description={item.kind === 'file' ? 'Its file goes with it. Undo brings both back.' : 'Undo brings it back.'}
        confirmLabel="Delete research" onConfirm={() => { void deleteResearchItem(item.id) }} />
    </article>
  )
}
