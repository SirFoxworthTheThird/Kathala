import { useMemo, useState } from 'react'
import { Replace, Users } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorldSceneTexts, setSceneText } from '@/db/hooks/useManuscript'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useCharacters, updateCharacter } from '@/db/hooks/useCharacters'
import {
  countMatches, replaceAll, matchSnippets, nameMatchesQuery, type FindOptions,
} from '@/lib/findReplace'

interface FindReplaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
}

export function FindReplaceDialog({ open, onOpenChange, worldId }: FindReplaceDialogProps) {
  const scenes     = useWorldSceneTexts(open ? worldId : null)
  const events     = useWorldEvents(open ? worldId : null)
  const chapters   = useWorldChapters(open ? worldId : null)
  const characters = useCharacters(open ? worldId : null)

  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [renameChars, setRenameChars] = useState(true)
  const [summary, setSummary] = useState<string | null>(null)

  const opts: FindOptions = useMemo(() => ({ caseSensitive, wholeWord }), [caseSensitive, wholeWord])

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events])
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])

  // Scenes with at least one match, labelled and ordered by chapter.
  const results = useMemo(() => {
    if (!find) return []
    return scenes
      .map((s) => {
        const count = countMatches(s.text, find, opts)
        if (count === 0) return null
        const ev = eventById.get(s.eventId)
        const ch = ev ? chapterById.get(ev.chapterId) : undefined
        return {
          scene: s,
          count,
          label: `Ch. ${ch?.number ?? '—'} · ${ev?.title || 'Untitled scene'}`,
          order: (ch?.number ?? 0) * 100000 + (ev?.sortOrder ?? 0),
          snippet: matchSnippets(s.text, find, opts, 32, 1)[0] ?? null,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.order - b.order)
  }, [scenes, find, opts, eventById, chapterById])

  const totalMatches = results.reduce((n, r) => n + r.count, 0)

  // Characters whose name equals the query — offer to rename them too.
  const matchedChars = useMemo(
    () => (find ? characters.filter((c) => nameMatchesQuery(c.name, find, opts)) : []),
    [characters, find, opts]
  )

  async function replaceScene(eventId: string, text: string) {
    const { text: next } = replaceAll(text, find, replace, opts)
    await setSceneText(worldId, eventId, next)
  }

  async function replaceAllScenes() {
    let scenesChanged = 0
    let total = 0
    for (const r of results) {
      const { text: next, count } = replaceAll(r.scene.text, find, replace, opts)
      if (count > 0) { await setSceneText(worldId, r.scene.eventId, next); scenesChanged++; total += count }
    }
    let renamed = 0
    if (renameChars && replace) {
      for (const c of matchedChars) {
        await updateCharacter(c.id, {
          name: replace,
          aliases: c.aliases.map((a) => replaceAll(a, find, replace, opts).text),
        })
        renamed++
      }
    }
    const parts = [`Replaced ${total} occurrence${total === 1 ? '' : 's'} in ${scenesChanged} scene${scenesChanged === 1 ? '' : 's'}`]
    if (renamed > 0) parts.push(`and renamed ${renamed} character${renamed === 1 ? '' : 's'}`)
    setSummary(parts.join(' ') + '.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="mb-3 flex items-center gap-2">
          <Replace className="h-4 w-4 text-[hsl(var(--accent-foreground))]" />
          <h2 className="text-sm font-semibold">Find &amp; replace in the manuscript</h2>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="flex-1 text-sm"
              placeholder="Find…"
              value={find}
              onChange={(e) => { setFind(e.target.value); setSummary(null) }}
              autoFocus
            />
            <Input
              className="flex-1 text-sm"
              placeholder="Replace with…"
              value={replace}
              onChange={(e) => { setReplace(e.target.value); setSummary(null) }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
              Case sensitive
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} />
              Whole word
            </label>
            {find && (
              <span className="ml-auto tabular-nums">
                {totalMatches} match{totalMatches === 1 ? '' : 'es'} in {results.length} scene{results.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {matchedChars.length > 0 && (
            <label className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs">
              <input type="checkbox" checked={renameChars} onChange={(e) => setRenameChars(e.target.checked)} />
              <Users className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              Also rename {matchedChars.map((c) => `"${c.name}"`).join(', ')}
              {replace ? <> → <span className="font-medium text-[hsl(var(--foreground))]">"{replace}"</span> (name + aliases)</> : ' (enter a replacement)'}
            </label>
          )}

          {/* Results */}
          <div className="max-h-[45vh] overflow-y-auto rounded-md border border-[hsl(var(--border))]">
            {!find ? (
              <p className="px-3 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Type a phrase to find it across every scene's prose.
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No matches.</p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--border))]">
                {results.map((r) => (
                  <li key={r.scene.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[hsl(var(--foreground))]">{r.label}</p>
                      {r.snippet && (
                        <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                          {r.snippet.before}
                          <mark className="rounded bg-amber-400/30 text-[hsl(var(--foreground))]">{r.snippet.match}</mark>
                          {r.snippet.after}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">{r.count}×</span>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => replaceScene(r.scene.eventId, r.scene.text)}>
                      Replace
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2">
            {summary && <span className="text-xs text-emerald-400">{summary}</span>}
            <Button
              size="sm"
              className="ml-auto gap-1.5"
              disabled={results.length === 0}
              onClick={replaceAllScenes}
            >
              <Replace className="h-3.5 w-3.5" /> Replace all
            </Button>
          </div>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Each changed scene is saved as a new version, so you can undo a replace from its scene history.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
