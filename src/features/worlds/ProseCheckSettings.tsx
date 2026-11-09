import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { setProseCheckSettings } from '@/db/hooks/useProseChecks'
import { updateWorld } from '@/db/hooks/useWorlds'
import { PROSE_CHECK_DEFAULTS, proseSettings, type ProseCheckSettings } from '@/lib/proseChecks'
import { plural } from '@/lib/plural'
import type { World } from '@/types'

/*
  The prose checks' settings (editorial-plan.md, R6): every threshold, each
  with the default the Library run set, for this book. Kept on the world.
*/

type NumberKey = { [K in keyof ProseCheckSettings]: ProseCheckSettings[K] extends number ? K : never }[keyof ProseCheckSettings]
type FlagKey = { [K in keyof ProseCheckSettings]: ProseCheckSettings[K] extends boolean ? K : never }[keyof ProseCheckSettings]

const input = 'w-16 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-0.5 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]'

export function ProseCheckSettingsForm({ world }: { world: World }) {
  const s = proseSettings(world.proseChecks)
  const set = (patch: Partial<ProseCheckSettings>) => void setProseCheckSettings(world.id, patch)

  /** A number in a sentence: its label is the sentence. `scale` shows a share as a percentage. */
  const num = (key: NumberKey, label: string, min: number, step = 1, scale = 1) => (
    <input
      type="number"
      aria-label={label}
      className={input}
      min={min}
      step={step}
      value={Math.round(s[key] * scale * 100) / 100}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isFinite(n) && n >= min) set({ [key]: n / scale })
      }}
    />
  )
  const check = (key: FlagKey, label: string, children: ReactNode) => (
    <fieldset className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="accent-[hsl(var(--ring))]" checked={s[key]} onChange={(e) => set({ [key]: e.target.checked })} />
        {label}
      </label>
      <div className={`flex flex-wrap items-center gap-1.5 pl-6 text-xs text-[hsl(var(--muted-foreground))] ${s[key] ? '' : 'opacity-50'}`}>{children}</div>
    </fieldset>
  )
  const changed = Object.keys(world.proseChecks ?? {}).some((k) => (world.proseChecks as Record<string, unknown>)[k] !== (PROSE_CHECK_DEFAULTS as unknown as Record<string, unknown>)[k])
  const dismissed = world.proseDismissed?.length ?? 0

  return (
    <div className="space-y-3">
      {check('echoes', 'Echoes', <>
        A word said again within {num('echoSpan', 'Words between a word and its echo', 1)} words — twice and three times as far for a rarer word;
        three words said again within {num('phraseSpan', 'Words between a phrase and its echo', 1)} words.
      </>)}
      {check('petWords', 'Pet words', <>
        A word or phrase editors call a crutch, used {num('petRatio', 'Times as often as books in general', 1, 0.5)}× as often as books in general
        and at least {num('petMinCount', 'Times in the book, at the least', 1)} times; the book’s worst {num('petMax', 'Pet words, at the most', 1)}.
      </>)}
      {check('rhythm', 'Sentence rhythm', <>
        {num('rhythmRun', 'Sentences in a row', 2)} sentences in a row within {num('rhythmSpread', 'Words between the longest and shortest', 0)} words of each other;
        a scene whose sentences are {num('sceneSentenceFactor', 'Times longer or shorter than the book’s sentences', 1.1, 0.1)}× longer or shorter than the book’s.
      </>)}
      {check('tags', 'Dialogue tags', <>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-[hsl(var(--ring))]" checked={s.tagAdverbs} onChange={(e) => set({ tagAdverbs: e.target.checked })} />
          Adverbs on tags (“said softly”);
        </label>
        more than {num('tagShare', 'Per cent of a scene’s tags other than said and asked', 0, 5, 100)}% of a scene’s tags other than said and asked.
      </>)}
      {check('lengths', 'Lengths', <>
        A scene or chapter {num('lengthFactor', 'Times longer or shorter than the book’s usual', 1.5, 0.5)}× longer or shorter than the book’s usual.
      </>)}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" disabled={!changed} onClick={() => void setProseCheckSettings(world.id, null)}>Back to the defaults</Button>
        {dismissed > 0 && (
          <Button size="sm" variant="outline" onClick={() => void updateWorld(world.id, { proseDismissed: [] })}>
            Bring back {plural(dismissed, 'dismissed finding')}
          </Button>
        )}
      </div>
    </div>
  )
}
