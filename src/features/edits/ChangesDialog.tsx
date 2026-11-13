import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProseDiff } from '@/components/ProseDiff'
import { cn } from '@/lib/utils'
import type { DiffToken } from '@/lib/textDiff'
import { breakChange, italicsOnly, showBreaks, shownChange, withEmphasis, type Run } from '@/lib/docxEdits'
import { plural } from '@/lib/plural'
import { acceptScene, acceptSuggestion, changeCount, placePassage, rejectScene, rejectSuggestion, useEditSuggestions, type AcceptResult } from '@/db/hooks/useEditImport'
import { useWorldSceneTextsOnceRead } from '@/db/hooks/useManuscript'
import { tryChange } from '@/lib/docxImport'
import { useAllWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import type { EditSuggestion } from '@/types'

/*
  An editor's changes, decided (editorial-plan.md, R4): each one shown as its
  words before and after, with a little of the text around them, and accepted
  or rejected — one at a time, or a scene at a time. A change whose words the
  writer has since rewritten cannot be accepted, and says so; it is theirs to
  make by hand, or reject. Passages of the file no scene matched are placed
  here first.
*/

export function ChangesDialog({ worldId, open, onOpenChange, focusedId }: {
  worldId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A change clicked on the page. */
  focusedId?: string | null
}) {
  const suggestions = useEditSuggestions(open ? worldId : null)
  const events = useAllWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  // The book's scenes in its order, every timeline: for their titles, and to place a passage in one.
  const scenes = useMemo(() => {
    const number = new Map(chapters.map((c) => [c.id, c.number]))
    return events
      .map((e) => ({ id: e.id, title: e.title, chapter: number.get(e.chapterId) ?? 0, sortOrder: e.sortOrder }))
      .sort((a, b) => a.chapter - b.chapter || a.sortOrder - b.sortOrder)
  }, [events, chapters])
  // Changes that could not be made when accepted, each with why.
  const [refused, setRefused] = useState<ReadonlyMap<string, Refusal>>(new Map())
  const refuse = (more: ReadonlyMap<string, Refusal>) => setRefused((prev) => new Map([...prev, ...more]))
  /*
    And what each would do, tried against its scene's prose as it is, before
    any click (round-trip-plan-3.md, T11.1): one that cannot be made says why
    at once, and one already made by hand says so and offers to clear it.
  */
  // Undefined until read: nothing is said of any change before its scene's prose is there to try it on.
  const texts = useWorldSceneTextsOnceRead(open ? worldId : null)
  const states = useMemo(() => {
    if (!texts) return new Map<string, State>()
    const prose = new Map(texts.map((t) => [t.eventId, t.text]))
    const out = new Map<string, State>()
    for (const s of suggestions) {
      if (!s.eventId || out.has(s.id)) continue
      // A move's halves in the order they are made: the words taken out, then put where they go.
      const rows = s.move ? suggestions.filter((x) => x.move?.id === s.move!.id).sort((a, b) => (a.move!.part === 'from' ? 0 : 1) - (b.move!.part === 'from' ? 0 : 1)) : [s]
      const tried = s.move && rows.length < 2 ? { result: 'gone' as const } : tryChange(rows, (id) => prose.get(id) ?? '')
      for (const r of rows) out.set(r.id, tried.result)
    }
    return out
  }, [suggestions, texts])
  // What a change says: refused when accepted, else what trying it says.
  const stateOf = (s: EditSuggestion): State => refused.get(s.id) ?? states.get(s.id) ?? 'ok'
  const order = useMemo(() => new Map(scenes.map((s, i) => [s.id, i])), [scenes])
  const byScene = useMemo(() => {
    const groups = new Map<string, EditSuggestion[]>()
    for (const s of suggestions) if (s.eventId) groups.set(s.eventId, [...(groups.get(s.eventId) ?? []), s])
    return [...groups].sort(([a], [b]) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
  }, [suggestions, order])
  // Changes outside every scene: on the title page, or a chapter's heading. Read, and made by hand.
  const outside = useMemo(() => suggestions.filter((s) => s.outside), [suggestions])
  const passages = useMemo(() => {
    const groups = new Map<string, { text: string; rows: EditSuggestion[] }>()
    for (const s of suggestions) if (!s.eventId && s.passage) {
      const g = groups.get(s.passage.id) ?? { text: s.passage.text, rows: [] }
      g.rows.push(s)
      groups.set(s.passage.id, g)
    }
    return [...groups]
  }, [suggestions])

  const accept = async (s: EditSuggestion) => {
    const r = await acceptSuggestion(s.id)
    if (r !== 'accepted' && r !== 'cleared') refuse(new Map([[s.id, r]]))
  }
  const sceneOf = (id: string) => scenes.find((s) => s.id === id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Changes from the editor</DialogTitle>
        </DialogHeader>
        {suggestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No changes waiting. Bring in an editor&rsquo;s Word file to see theirs here.</p>
        ) : (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 text-sm">
            <p role="status" className="text-xs text-[hsl(var(--muted-foreground))]">
              {plural(changeCount(suggestions), 'change')} waiting. Accepting one writes it into the scene; what the scene said is kept in its History.
            </p>

            {outside.length > 0 && (
              <section aria-label="Changes outside the scenes" className="space-y-2 rounded-md border border-amber-500/50 p-3">
                <p className="text-xs">The title page and chapter headings are made afresh each time the book is exported, so these cannot be accepted into it. Make them by hand — in the export&rsquo;s details, or the chapter&rsquo;s title — and dismiss each when you have.</p>
                <ol className="space-y-1.5">
                  {outside.map((s) => {
                    if (s.comment) return (
                      <li key={s.id} aria-label={`A comment on the ${s.outside}: ${s.comment.text}`} className="flex items-start gap-2 rounded-md border border-[hsl(var(--border))] p-2">
                        <div className="min-w-0 flex-1 space-y-1 leading-relaxed">
                          <p><span className="mr-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{s.outside === 'heading' ? 'On a chapter heading:' : 'On the title page:'}</span>{s.before.trim() || '…'}</p>
                          <p className="whitespace-pre-wrap border-l-2 border-yellow-500/70 pl-2 text-xs"><span className="font-medium">{s.comment.author ?? 'The editor'}:</span> {s.comment.text}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { void rejectSuggestion(s.id) }}>Dismiss</Button>
                      </li>
                    )
                    const shown = shownChange(s.before, s.after)
                    return (
                      <li key={s.id} aria-label={`On the ${s.outside}: ${s.before.trim() || '…'} → ${s.after.trim() || '(removed)'}`} className="flex items-start gap-2 rounded-md border border-[hsl(var(--border))] p-2">
                        <p className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">
                          <span className="mr-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{s.outside === 'heading' ? 'A chapter heading:' : 'The title page:'}</span>
                          <span className="text-[hsl(var(--muted-foreground))]">{shown.lead}</span>
                          <ProseDiff tokens={[{ op: 'remove', text: shown.out }, { op: 'add', text: shown.in }]} />
                          <span className="text-[hsl(var(--muted-foreground))]">{shown.tail}</span>
                        </p>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { void rejectSuggestion(s.id) }}>Dismiss</Button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}

            {passages.map(([id, p]) => (
              <section key={id} aria-label="A passage no scene matched" className="space-y-2 rounded-md border border-amber-500/50 p-3">
                <p className="text-xs">No scene in the book matched this passage of the file. Say which scene it is to review its changes there.</p>
                <blockquote className="max-h-24 overflow-y-auto whitespace-pre-wrap border-l-2 border-amber-500/60 pl-2 text-xs italic">{p.text}</blockquote>
                <Field label="Its scene" className="gap-1">
                  <Select value="" onValueChange={(eventId) => { void placePassage(worldId, id, eventId) }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose a scene…" /></SelectTrigger>
                    <SelectContent>{scenes.map((s) => <SelectItem key={s.id} value={s.id}>{`Ch. ${s.chapter} · ${s.title || 'Untitled scene'}`}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Button size="sm" variant="ghost" onClick={() => { for (const r of p.rows) void rejectSuggestion(r.id) }}>Drop this passage&rsquo;s changes</Button>
              </section>
            ))}

            {byScene.map(([eventId, rows]) => {
              const scene = sceneOf(eventId)
              // Accept all makes what it can, and clears what is already made; with every change left one it could not make, there is nothing for it to do.
              const makeable = changeCount(rows.filter((x) => stateOf(x) === 'ok' || stateOf(x) === 'made'))
              const made = changeCount(rows.filter((x) => stateOf(x) === 'made'))
              const cannot = changeCount(rows) - makeable
              return (
                <section key={eventId} aria-label={`Changes to ${scene?.title || 'Untitled scene'}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="flex-1 text-xs font-semibold">{scene ? `Ch. ${scene.chapter} · ${scene.title || 'Untitled scene'}` : 'A scene no longer in the book'}</h3>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={makeable === 0} onClick={() => { void acceptScene(worldId, eventId).then((r) => refuse(r.refused)) }}>Accept all {makeable}</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { void rejectScene(worldId, eventId) }}>Reject all</Button>
                  </div>
                  {made > 0 && (
                    <p role="status" className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {made === 1 ? '1 change is' : `${made} changes are`} already in the scene: Accept all clears {made === 1 ? 'it' : 'them'} from the list.
                    </p>
                  )}
                  {cannot > 0 && (
                    <p role="status" className="text-[11px] text-amber-600 dark:text-amber-400">
                      {makeable === 0
                        ? `${cannot === 1 ? 'This change' : 'These changes'} could not be made. Make ${cannot === 1 ? 'it' : 'them'} by hand, or reject ${cannot === 1 ? 'it' : 'them'}.`
                        : `${plural(cannot, 'change')} could not be made, and ${cannot === 1 ? 'is' : 'are'} left for you.`}
                    </p>
                  )}
                  <ol className="space-y-1.5">
                    {rows.map((s) => {
                      if (!s.move) return <Change key={s.id} s={s} state={stateOf(s)} focused={s.id === focusedId} onAccept={() => accept(s)} onReject={() => rejectSuggestion(s.id)} />
                      // A move is one change: shown once in a scene that has both its halves, and in each scene where it spans two.
                      const halves = suggestions.filter((x) => x.move?.id === s.move!.id)
                      const from = halves.find((x) => x.move!.part === 'from')
                      const to = halves.find((x) => x.move!.part === 'to')
                      if (!from || !to || (s.move.part === 'to' && from.eventId === eventId)) return null
                      const other = (s.move.part === 'from' ? to : from).eventId
                      const elsewhere = other && other !== eventId ? sceneOf(other) : undefined
                      return <Move key={s.id} from={from} to={to} elsewhere={elsewhere && `Ch. ${elsewhere.chapter} · ${elsewhere.title || 'Untitled scene'}`} goingThere={s.move.part === 'from'} state={refused.get(from.id) ?? refused.get(to.id) ?? stateOf(from)} focused={halves.some((x) => x.id === focusedId)} onAccept={() => accept(s)} onReject={() => rejectSuggestion(s.id)} />
                    })}
                  </ol>
                </section>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

type Refusal = Exclude<AcceptResult, 'accepted' | 'cleared'>
/** What a change would do if accepted now (`tryChange`): be made, be cleared as already made, or be refused, and why. */
type State = 'ok' | 'made' | Refusal

const REFUSED: Record<Refusal, string> = {
  gone: 'The scene no longer has these words: you have changed them since. Make this change by hand, or reject it.',
  'runs-together': 'Made here, this would run two sentences together. Make it by hand, or reject it.',
}

/** What a change says under it, and its first button, by what accepting it would do. */
function Said({ state }: { state: State }) {
  if (state === 'ok') return null
  if (state === 'made') return <p role="status" className="text-[11px] text-emerald-700 dark:text-emerald-400">Already in the scene: it reads this way now. Clear takes it off the list.</p>
  return <p role="alert" className="text-[11px] text-amber-600 dark:text-amber-400">{REFUSED[state]}</p>
}

/** Accept, or Clear for a change already made; refused, it cannot be pressed. */
function AcceptButton({ state, onAccept }: { state: State; onAccept: () => void }) {
  const made = state === 'made'
  return (
    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onAccept} disabled={state === 'gone' || state === 'runs-together'} aria-label={made ? 'Clear' : 'Accept'}>
      <Check className="h-3 w-3" aria-hidden="true" /> {made ? 'Clear' : 'Accept'}
    </Button>
  )
}

function Change({ s, state, focused, onAccept, onReject }: { s: EditSuggestion; state: State; focused: boolean; onAccept: () => void; onReject: () => void }) {
  // One stretch out and one in, the words both sides share shown as the text around them.
  const shown = useMemo(() => shownChange(s.before, s.after), [s.before, s.after])
  // A paragraph broken in two, or two joined, is said: its whitespace alone would show nothing.
  const brk = breakChange(s.before, s.after)
  const italics = !brk && italicsOnly(s.before, s.after)
  // A little of the text either side, cut at a word.
  const before = (s.prefix + shown.lead).replace(/^.*\n/s, '')
  const after = (shown.tail + s.suffix).replace(/\n.*$/s, '')
  const lead = before.length >= 32 ? before.slice(-32).replace(/^\S*\s/, '') : before
  const tail = after.length >= 32 ? after.slice(0, 32).replace(/\s\S*$/, '') : after
  /*
    In italics where the Page has them, the marks left out (T11.4): the
    surroundings and the change read as one line, so a mark before the change
    may close after it, and the text cut off ahead of what is shown read for
    the marks it opens. As the book is, with the words that go out; with the
    words that come in, for those.
  */
  const cut = before.slice(0, before.length - lead.length)
  const [leadRuns, outRuns, tailRuns] = withEmphasis([lead, shown.out, tail], cut)
  const inRuns = withEmphasis([lead, shown.in, tail], cut)[1]
  const tokens: DiffToken[] = [
    ...outRuns.map((r) => ({ op: 'remove' as const, text: showBreaks(r.text), italic: r.italic })),
    ...inRuns.map((r) => ({ op: 'add' as const, text: showBreaks(r.text), italic: r.italic })),
  ]
  const what = brk === 'split'
    ? `a new paragraph after “${(s.prefix + shown.lead).trim().split(/\s+/).slice(-3).join(' ')}”`
    : brk === 'join'
      ? `the paragraphs joined after “${(s.prefix + shown.lead).trim().split(/\s+/).slice(-3).join(' ')}”`
      : italics
        ? `italics changed after “${(s.prefix + shown.lead).trim().split(/\s+/).slice(-3).join(' ')}”`
        : `${plain(showBreaks(s.before)).trim() || '…'} → ${plain(showBreaks(s.after)).trim() || '(removed)'}`
  return (
    <li
      aria-label={`${s.turnedBack ? 'Turned back' : s.kind === 'tracked' ? 'Tracked change' : 'Untracked edit'}: ${what}`}
      aria-current={focused || undefined}
      className={cn('flex items-start gap-2 rounded-md border border-[hsl(var(--border))] p-2', focused && 'ring-2 ring-[hsl(var(--ring))]')}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="whitespace-pre-wrap leading-relaxed">
          <span className="text-[hsl(var(--muted-foreground))]">{before.length >= 32 && '…'}<Emphasised runs={leadRuns} /></span>
          {brk
            ? <span className="mx-0.5 rounded bg-emerald-500/15 px-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">{brk === 'split' ? '¶ New paragraph' : '⌒ Paragraphs joined'}</span>
            : italics
              ? <span className="mx-0.5 rounded bg-emerald-500/15 px-1 text-xs font-medium italic text-emerald-700 dark:text-emerald-400">Italics changed</span>
              : <ProseDiff tokens={tokens} />}
          <span className="text-[hsl(var(--muted-foreground))]"><Emphasised runs={tailRuns} />{after.length >= 32 && '…'}</span>
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {s.turnedBack
            ? `${s.author ?? 'The editor'} turned back your change. Accept to take their words again; reject to keep yours.`
            : s.kind === 'tracked' ? `Tracked change${s.author ? ` by ${s.author}` : ''}` : 'Made with tracking off: found by comparing the file with the book as it went out'}
        </p>
        <Said state={state} />
      </div>
      <AcceptButton state={state} onAccept={onAccept} />
      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onReject} aria-label="Reject">
        <X className="h-3 w-3" aria-hidden="true" /> Reject
      </Button>
    </li>
  )
}

/** Prose without its italics' marks, for a name read aloud: a screen reader says *star*. */
const plain = (text: string) => withEmphasis([text])[0].map((r) => r.text).join('')

/** Prose in its italics, as the Page shows it (`withEmphasis`). */
const Emphasised = ({ runs }: { runs: readonly Run[] }) => (
  <>{runs.map((r, i) => (r.italic ? <em key={i}>{r.text}</em> : <span key={i}>{r.text}</span>))}</>
)

/** The last few words before a change, to say where it is. */
const wordsBefore = (text: string) => text.trim().split(/\s+/).slice(-4).join(' ')

/**
 * A move (round-trip-plan.md, T1.2): its words, where they were and where
 * they go, accepted or rejected as one change — its halves are never made
 * apart.
 */
function Move({ from, to, elsewhere, goingThere, state, focused, onAccept, onReject }: {
  from: EditSuggestion
  to: EditSuggestion
  /** The other half's scene, where it is not this one. */
  elsewhere?: string
  /** Whether this scene is the one the words go from. */
  goingThere: boolean
  state: State
  focused: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const out = shownChange(from.before, from.after)
  const into = shownChange(to.before, to.after)
  const words = showBreaks(out.out || into.in).trim()
  const head = words.length > 110 ? `${words.slice(0, 110).replace(/\s\S*$/, '')}…` : words
  const first = words.split(/\s+/).slice(0, 8).join(' ')
  const fromAt = wordsBefore((from.prefix + out.lead).replace(/^.*\n/s, ''))
  const toAt = wordsBefore((to.prefix + into.lead).replace(/^.*\n/s, ''))
  return (
    <li
      aria-label={`${from.kind === 'tracked' ? 'Tracked change' : 'Untracked edit'}: moved “${first}${words.length > first.length ? '…' : ''}”`}
      aria-current={focused || undefined}
      className={cn('flex items-start gap-2 rounded-md border border-[hsl(var(--border))] p-2', focused && 'ring-2 ring-[hsl(var(--ring))]')}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="leading-relaxed">
          <span className="mr-1 rounded bg-sky-500/15 px-1 text-xs font-medium text-sky-700 dark:text-sky-300">⇄ Moved</span>
          <span className="italic">“{head}”</span>
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {fromAt ? `From after “…${fromAt}”` : 'From the start'}
          {elsewhere && !goingThere ? ` in ${elsewhere}` : ''}
          {toAt ? `, to after “…${toAt}”` : ', to the start'}
          {elsewhere && goingThere ? ` in ${elsewhere}` : ''}
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{`Tracked change${from.author ? ` by ${from.author}` : ''}: accepted or rejected whole`}</p>
        <Said state={state} />
      </div>
      <AcceptButton state={state} onAccept={onAccept} />
      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onReject} aria-label="Reject">
        <X className="h-3 w-3" aria-hidden="true" /> Reject
      </Button>
    </li>
  )
}
