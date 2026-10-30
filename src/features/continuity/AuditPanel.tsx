import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, ArrowLeft, Sparkles, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorld } from '@/db/hooks/useWorlds'
import { useTimelines, useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'
import { useKnowledgeFacts } from '@/db/hooks/useKnowledge'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useStory } from '@/db/hooks/useStory'
import { keepAuditFindings } from '@/db/hooks/useAuditFindings'
import { auditBookFrom, auditPrompt } from '@/lib/auditPrompt'
import { checkAudit, parseAuditReply } from '@/lib/auditReply'
import { AuditRunError, PROVIDERS, PROVIDER_IDS, forgetKey, keepKey, keptKey, keyPlace, lastChoice, listModels, rememberChoice, runAuditWith, type KeyPlace, type ProviderId } from '@/lib/auditWithKey'
import { plural } from '@/lib/plural'

type Checked = ReturnType<typeof checkAudit>

/**
 * An audit of the book by an AI assistant the writer chooses (run-10 plan,
 * Part 5): copy the prompt out, paste the reply back. Every quote in the reply
 * is looked for in the book, and a finding whose quotes are not there is
 * dropped and said to be. Nothing leaves the device except what the writer
 * copies.
 */
export function AuditPanel({ worldId, chapterId = null, onDone }: {
  worldId: string
  /** A chapter's audit, against the book so far (Part F3); the whole book's without one. */
  chapterId?: string | null
  onDone: () => void
}) {
  const world = useWorld(worldId)
  const chapters = useWorldChapters(worldId)
  const events = useWorldEvents(worldId)
  const sceneTexts = useWorldSceneTexts(worldId)
  const timelines = useTimelines(worldId)
  const facts = useKnowledgeFacts(worldId)
  const characters = useCharacters(worldId)
  const story = useStory(worldId)

  const [copied, setCopied] = useState(false)
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState<Checked | null>(null)
  /*
    Run here, with the writer's own key (decision D-2). Held while the audit is
    open, and kept beyond it only if they ask — in the system keychain on the
    desktop, until the tab closes in a browser (`auditWithKey.ts`).
  */
  const [provider, setProvider] = useState<ProviderId>(() => lastChoice().provider)
  const [model, setModel] = useState(() => PROVIDERS[lastChoice().provider].model ?? lastChoice().models[lastChoice().provider] ?? '')
  const [models, setModels] = useState<string[]>([])
  const [apiKey, setApiKey] = useState('')
  const [keepKeyAsked, setKeepKeyAsked] = useState(false)
  const [kept, setKept] = useState(false)
  const [place, setPlace] = useState<KeyPlace | null>(null)
  // The provider's key kept from before, if any: on opening, and on choosing another provider.
  useEffect(() => {
    let live = true
    void (async () => {
      const [where, key] = await Promise.all([keyPlace(), keptKey(provider)])
      if (!live) return
      setPlace(where)
      setApiKey(key)
      setKeepKeyAsked(!!key)
      setKept(!!key)
    })()
    return () => { live = false }
  }, [provider])
  function choose(next: ProviderId) {
    setProvider(next)
    setModel(PROVIDERS[next].model ?? lastChoice().models[next] ?? '')
    setModels([])
    setError(null)
  }
  async function forget() {
    await forgetKey(provider)
    setApiKey('')
    setKeepKeyAsked(false)
    setKept(false)
  }
  const [listing, setListing] = useState(false)
  async function list() {
    setListing(true)
    setError(null)
    try {
      const found = await listModels(provider, apiKey.trim())
      setModels(found)
      if (!model && found.length) setModel(found[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setListing(false)
    }
  }
  const [running, setRunning] = useState(false)
  const stopRef = useRef<AbortController | null>(null)

  const chapter = chapterId ? chapters.find((c) => c.id === chapterId) ?? null : null
  // The chapter's scenes: a finding must quote one, and a new audit of it replaces only what was found in them.
  const focus = useMemo(
    () => (chapter ? { scenes: new Set(events.filter((e) => e.chapterId === chapter.id).map((e) => e.id)), name: `chapter ${chapter.number}` } : undefined),
    [chapter, events],
  )
  const book = useMemo(
    () => (world ? auditBookFrom({ world, chapters, events, sceneTexts, timelines, facts, characters, dayOf: story.dayOf }) : null),
    [world, chapters, events, sceneTexts, timelines, facts, characters, story],
  )
  const prompt = useMemo(() => (book ? auditPrompt(book, chapter?.number) : ''), [book, chapter])
  // The words the prompt holds: the book so far, for a chapter's audit.
  const words = useMemo(() => {
    const held = chapter && book ? new Set(book.chapters.slice(0, book.chapters.findIndex((c) => c.number === chapter.number) + 1).map((c) => c.number)) : null
    const numberOf = new Map(chapters.map((c) => [c.id, c.number]))
    const chapterOf = new Map(events.map((e) => [e.id, e.chapterId]))
    return sceneTexts
      .filter((t) => !held || held.has(numberOf.get(chapterOf.get(t.eventId) ?? '') ?? -1))
      .reduce((n, t) => n + (t.wordCount ?? 0), 0)
  }, [sceneTexts, chapter, book, chapters, events])

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
  }

  function check(text = reply) {
    try {
      setChecked(checkAudit(parseAuditReply(text), sceneTexts, focus))
      setError(null)
    } catch (e) {
      setChecked(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  /** The prompt sent with the writer's key, and the reply checked as a pasted one is. */
  async function run() {
    const key = apiKey.trim()
    const using = PROVIDERS[provider].model ?? model.trim()
    if (!key || !prompt || !using) return
    if (keepKeyAsked) setKept(await keepKey(provider, key))
    else if (kept) { await forgetKey(provider); setKept(false) }
    rememberChoice(provider, PROVIDERS[provider].model ? undefined : using)
    const stop = new AbortController()
    stopRef.current = stop
    setRunning(true)
    setError(null)
    setChecked(null)
    try {
      const text = await runAuditWith(provider, using, prompt, key, { signal: stop.signal })
      setReply(text)
      check(text)
    } catch (e) {
      setError(e instanceof AuditRunError ? e.message : e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
      stopRef.current = null
    }
  }

  async function keep() {
    if (!checked) return
    await keepAuditFindings(worldId, checked.kept, focus?.scenes)
    onDone()
  }

  const step = 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[10px] font-semibold'
  return (
    <section aria-label={chapter ? `Audit chapter ${chapter.number} with AI` : 'Audit with AI'} className="space-y-4 py-1 text-xs">
      <button onClick={onDone} className="flex items-center gap-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to the checker
      </button>
      {chapter && (
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Chapter {chapter.number}{chapter.title ? `: ${chapter.title}` : ''}, against the book so far</h3>
      )}
      <p className="text-[hsl(var(--muted-foreground))]">
        An AI assistant can read the {chapter ? 'chapter, with every chapter before it,' : 'whole book'} for contradictions in numbers and time, and for facts given away early —
        what the checks here cannot read. Nothing leaves this device unless you paste it somewhere yourself, or run it here with your own key.
      </p>

      <div className="space-y-2">
        <p className="flex items-center gap-2 font-medium text-[hsl(var(--foreground))]"><span className={step}>1</span> Copy the prompt</p>
        <p className="text-[hsl(var(--muted-foreground))]">
          It holds {chapter ? 'the book so far' : 'the book'} — {plural(words, 'word')} — with each chapter’s era and dates, when the reader learns each fact, and birth dates.
          Paste it into an assistant you trust.
        </p>
        <Button size="sm" variant="outline" onClick={copy} disabled={!prompt}>
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy the audit prompt</>}
        </Button>
      </div>

      <div className="space-y-2 rounded border border-dashed border-[hsl(var(--border))] p-2">
        <p className="font-medium text-[hsl(var(--foreground))]">Or run it here, with your own API key</p>
        <label className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
          Assistant
          <select
            value={provider}
            onChange={(e) => choose(e.target.value as ProviderId)}
            disabled={running}
            className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-1 text-[hsl(var(--foreground))]"
          >
            {PROVIDER_IDS.map((id) => <option key={id} value={id}>{PROVIDERS[id].name}</option>)}
          </select>
        </label>
        <p className="text-[hsl(var(--muted-foreground))]">
          The prompt goes from here to {PROVIDERS[provider].company}’s API and nowhere else, and the reply comes back to step 2.
          It is charged to your key: best a key made for Kathala alone, with a spend limit set where you made it, so it can be revoked on its own.
        </p>
        <input
          type="password"
          aria-label={`${PROVIDERS[provider].company} API key`}
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={PROVIDERS[provider].keyHint}
          className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-1.5 font-mono text-[11px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
        {PROVIDERS[provider].model ? (
          <p className="text-[hsl(var(--muted-foreground))]">Model: <code>{PROVIDERS[provider].model}</code></p>
        ) : (
          <div className="flex items-center gap-2">
            <input
              aria-label="Model"
              list="audit-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="List the models, or type one"
              spellCheck={false}
              className="min-w-0 flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-1.5 font-mono text-[11px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
            <datalist id="audit-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
            <Button size="sm" variant="ghost" onClick={list} disabled={!apiKey.trim() || listing || running}>
              {listing ? 'Listing…' : 'List models'}
            </Button>
          </div>
        )}
        {place === 'none' ? (
          <p className="text-[hsl(var(--muted-foreground))]">This system has no keychain to keep the key in safely, so it is not kept: paste it each time.</p>
        ) : place && (
          <label className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
            <input type="checkbox" checked={keepKeyAsked} onChange={(e) => setKeepKeyAsked(e.target.checked)} />
            {place === 'keychain' ? 'Remember the key on this device, in the system keychain' : 'Keep the key until this tab is closed'}
          </label>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={run} disabled={!apiKey.trim() || !prompt || running || !(PROVIDERS[provider].model ?? model.trim())}>
            <Play className="h-4 w-4" /> Run the audit
          </Button>
          {(apiKey || kept) && !running && (
            <Button size="sm" variant="ghost" onClick={forget}>Forget the key</Button>
          )}
          {running && (
            <>
              <span role="status" className="text-[hsl(var(--muted-foreground))]">Auditing… a book can take a few minutes.</span>
              <Button size="sm" variant="ghost" onClick={() => stopRef.current?.abort()}><Square className="h-3.5 w-3.5" /> Stop</Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 font-medium text-[hsl(var(--foreground))]"><span className={step}>2</span> Paste the reply</p>
        <textarea
          aria-label="The assistant’s reply"
          value={reply}
          onChange={(e) => { setReply(e.target.value); setChecked(null); setError(null) }}
          rows={5}
          placeholder='{"findings": [ … ]}'
          className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 font-mono text-[11px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
        {error && <p role="alert" className="text-red-400">{error}</p>}
        <Button size="sm" variant="outline" onClick={() => check()} disabled={!reply.trim()}>
          <Sparkles className="h-4 w-4" /> Check the quotes
        </Button>
      </div>

      {checked && (
        <div className="space-y-2" role="status">
          <p className="font-medium text-[hsl(var(--foreground))]">
            {checked.kept.length === 0
              ? 'Nothing to keep: no finding had every quote in the book.'
              : `${plural(checked.kept.length, 'finding')} with every quote in the book.`}
            {checked.dropped.length > 0 && ` ${plural(checked.dropped.length, 'finding')} dropped.`}
          </p>
          {checked.dropped.length > 0 && (
            <ul aria-label="Dropped findings" className="space-y-1 text-[hsl(var(--muted-foreground))]">
              {checked.dropped.map(({ finding, reason }, i) => (
                <li key={i}><span className="text-[hsl(var(--foreground))]">{finding.title}</span> — {reason}</li>
              ))}
            </ul>
          )}
          <Button size="sm" onClick={keep} disabled={checked.kept.length === 0}>
            Show them in the checker
          </Button>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {chapter ? `They replace what the last audit found in chapter ${chapter.number}; what it found elsewhere stays.` : 'They replace the last audit’s findings.'}
          </p>
        </div>
      )}
    </section>
  )
}
