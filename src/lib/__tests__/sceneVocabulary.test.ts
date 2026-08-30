import { describe, it, expect } from 'vitest'

/**
 * The app calls a unit of story a **scene**. The database calls it an `event`,
 * and that is deliberate — `src/lib/entityTables.ts` keeps the two apart on
 * purpose — but the word must not leak into anything a writer reads. A whole
 * writer run's worth of findings were "the app taught me a second word for the
 * thing I already had a word for", and each one was found by hand.
 *
 * Two rules, both narrow enough to be checkable:
 *
 * 1. Nothing the continuity checker says may use the word.
 * 2. No JSX text node may use the word.
 *
 * The prompt dialogs are exempt: their bodies are a JSON contract quoted to an
 * external assistant, and `"events"` there is a key the importer parses, not
 * prose. Their surrounding chrome is not covered by rule 2 as a result.
 */

const PROMPT_DIALOGS = [
  'ChapterAIDialog.tsx',
  'LLMPromptDialog.tsx',
  'GenerateKnowledgeDialog.tsx',
  'GenerateRelationshipsDialog.tsx',
]

const WORD = /\bevents?\b/i

const checkerSources = import.meta.glob('../continuity/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const viewSources = import.meta.glob(['../../features/**/*.tsx', '../../components/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Every `message:` / `detail:` / issue-kind label string in the checker. */
function checkerStrings(src: string): string[] {
  const out: string[] = []
  // `message: \`…\`` and `detail: \`…\`` — template literals, one per line,
  // and the labels in ISSUE_KIND_LABELS, which are plain quoted strings.
  for (const m of src.matchAll(/(?:message|detail):\s*(`[^`]*`|'[^']*'|"[^"]*")/g)) out.push(m[1])
  for (const m of src.matchAll(/^\s*'[a-z-]+':\s*('[^']*')/gm)) out.push(m[1])
  return out
}

/**
 * JSX text nodes: a run between `>` and `<` containing no braces, so
 * expressions, `{/* comments *\/}` and attribute values are all skipped.
 *
 * TypeScript generics produce runs too — the `>` closing `useState<Foo>` and
 * the `<` opening the next one — so a run carrying `=` or `;` is code, not
 * prose, and is dropped. No sentence the app shows a writer contains either.
 */
const CODEY = /[=;`*]|\?:/
const PROSE_START = /^[\p{L}\p{N}↑·—("#+&]/u

function jsxText(src: string): string[] {
  return [...src.matchAll(/>([^<>{}]+)</g)]
    .map((m) => m[1].trim())
    .filter((t) => t.length > 0 && !CODEY.test(t) && PROSE_START.test(t))
}

describe('the app says scene, never event', () => {
  it('has checker sources to read', () => {
    expect(Object.keys(checkerSources).length).toBeGreaterThan(1)
    expect(Object.keys(viewSources).length).toBeGreaterThan(50)
  })

  it('never says event in anything the continuity checker reports', () => {
    const offenders: string[] = []
    for (const [path, src] of Object.entries(checkerSources)) {
      for (const s of checkerStrings(src)) {
        if (WORD.test(s)) offenders.push(`${path}: ${s}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never says event in a JSX text node', () => {
    const offenders: string[] = []
    for (const [path, src] of Object.entries(viewSources)) {
      if (PROMPT_DIALOGS.some((f) => path.endsWith(f))) continue
      for (const t of jsxText(src)) {
        if (WORD.test(t)) offenders.push(`${path}: ${t}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('still finds the word when it is there, so the scan is not vacuous', () => {
    expect(checkerStrings("message: `a deleted event`").filter((s) => WORD.test(s))).toHaveLength(1)
    expect(jsxText('<button>Events</button>').filter((t) => WORD.test(t))).toEqual(['Events'])
    // …and leaves the storage word alone where it is not prose.
    expect(jsxText('<div className="pointer-events-none" />')).toEqual([])
    expect(jsxText('<div>{/* Recent Events was the old heading */}</div>')).toEqual([])
    expect(jsxText('const [a, setA] = useState<string>(events)\nconst b = <Foo>')).toEqual([])
    expect(jsxText('interface P {}\n  /** Inner events (MT-7). */\n  ids?: ReadonlySet<string>')).toEqual([])
  })
})
