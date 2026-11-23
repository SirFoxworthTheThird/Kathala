import { useEffect, useState } from 'react'
import { languageName, spellingBridge, type SpellingLanguages } from '@/lib/desktopSpelling'

/*
  The spell checker's languages on this device (issue #705, D-6): the desktop
  app's, chosen here and kept in its own data, not the world's. On a Mac the
  system chooses them.
*/
export function SpellingLanguagesChooser() {
  const bridge = spellingBridge()
  const [langs, setLangs] = useState<SpellingLanguages | null>(null)
  useEffect(() => {
    if (!bridge) return
    let live = true
    void bridge.languages().then((l) => { if (live) setLangs(l) })
    return () => { live = false }
  }, [bridge])
  if (!bridge) return null
  if (!langs) return <p className="text-xs text-[hsl(var(--muted-foreground))]">Reading the languages…</p>
  if (langs.system) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">On a Mac the spell checker uses the languages chosen in the system’s own settings.</p>
  }
  const toggle = async (code: string) => {
    const next = langs.chosen.includes(code) ? langs.chosen.filter((c) => c !== code) : [...langs.chosen, code]
    if (next.length === 0) return
    const chosen = await bridge.setLanguages(next)
    setLangs({ ...langs, chosen })
  }
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm">Check spelling in</legend>
      <div className="grid max-h-56 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto text-sm sm:grid-cols-2">
        {langs.available.map((code) => (
          <label key={code} className="flex items-center gap-2">
            <input type="checkbox" checked={langs.chosen.includes(code)} onChange={() => void toggle(code)} />
            {languageName(code)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
