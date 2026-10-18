import { INVALID_JSON_MESSAGE, stripCodeFence } from './codeFence'

/*
  The AI audit's reply (run-10 plan, Part 5). An outside model is handed the
  book (`auditPrompt.ts`) and asked for contradictions with the exact words on
  each side. What it sends back is pasted in here and every quote is checked
  against the book, as run 10's experiment checked its auditors' quotes
  (`quotes.py`): a finding whose quotes are not in the text is dropped before
  anyone sees it. The model's judgement is the writer's to weigh; its quotes
  are not taken on trust.
*/

export type AuditSeverity = 'serious' | 'minor' | 'trivial'

/** A finding as the model reported it. */
export interface AuditReplyFinding {
  title: string
  severity: AuditSeverity
  why: string
  quotes: string[]
}

/** A quote found in the book, and the scene it is in. */
export interface PlacedQuote {
  text: string
  eventId: string
}

const SEVERITIES: readonly AuditSeverity[] = ['serious', 'minor', 'trivial']

/** The reply's findings: `{ "findings": [...] }`, or the list alone. */
export function parseAuditReply(raw: string): AuditReplyFinding[] {
  let parsed: unknown
  try { parsed = JSON.parse(stripCodeFence(raw)) } catch { throw new Error(INVALID_JSON_MESSAGE) }
  const list = Array.isArray(parsed) ? parsed : (parsed as { findings?: unknown } | null)?.findings
  if (!Array.isArray(list)) throw new Error('The reply has no list of findings.')
  return list.flatMap((f): AuditReplyFinding[] => {
    if (typeof f !== 'object' || f === null) return []
    const r = f as Record<string, unknown>
    const quotes = (Array.isArray(r.quotes) ? r.quotes : [])
      .map((q) => (typeof q === 'string' ? q : typeof (q as { text?: unknown })?.text === 'string' ? (q as { text: string }).text : ''))
      .map((q) => q.trim())
      .filter(Boolean)
    const severity = SEVERITIES.find((s) => s === String(r.severity ?? '').toLowerCase()) ?? 'minor'
    return [{ title: String(r.title ?? '').trim() || 'Untitled finding', severity, why: String(r.why ?? '').trim(), quotes }]
  })
}

/**
 * Text as a quote is compared with it: case, curly quotes, dashes, emphasis
 * marks and runs of white space all set aside, as `quotes.py` set them aside.
 */
export function normalizeForQuote(s: string): string {
  return s
    .replace(/[*_]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** A quote's parts: the words either side of an elision ("…", "...", "[…]"), each long enough to mean something. */
export function quoteFragments(quote: string): string[] {
  return quote
    .split(/\.\.\.|…|\[[^\]]*\]/)
    .map((f) => normalizeForQuote(f).replace(/^[\s.,;:!?'"-]+|[\s.,;:!?'"-]+$/g, ''))
    .filter((f) => f.length > 5)
}

/** The book's scenes, normalized once for all the quotes checked against them. */
export function prepareScenes(scenes: ReadonlyArray<{ eventId: string; text: string }>): Array<{ eventId: string; text: string }> {
  return scenes.map((s) => ({ eventId: s.eventId, text: normalizeForQuote(s.text) }))
}

/**
 * The scene a quote is in — that of its first part — or null if any part of it
 * is not in the book. A quote with nothing long enough to look for is not a
 * quote.
 */
export function placeQuote(quote: string, scenes: ReadonlyArray<{ eventId: string; text: string }>): string | null {
  const parts = quoteFragments(quote)
  if (parts.length === 0) return null
  let at: string | null = null
  for (const part of parts) {
    const scene = scenes.find((s) => s.text.includes(part))
    if (!scene) return null
    at ??= scene.eventId
  }
  return at
}

/** The reply's findings checked against the book: those every quote of which is there, and those dropped, and why. */
export function checkAudit(
  findings: readonly AuditReplyFinding[],
  scenes: ReadonlyArray<{ eventId: string; text: string }>,
): {
  kept: Array<Omit<AuditReplyFinding, 'quotes'> & { quotes: PlacedQuote[] }>
  dropped: Array<{ finding: AuditReplyFinding; reason: string }>
} {
  const prepared = prepareScenes(scenes)
  const kept: Array<Omit<AuditReplyFinding, 'quotes'> & { quotes: PlacedQuote[] }> = []
  const dropped: Array<{ finding: AuditReplyFinding; reason: string }> = []
  for (const finding of findings) {
    // A contradiction has two sides, and each is quoted.
    if (finding.quotes.length < 2) { dropped.push({ finding, reason: 'It quotes only one side.' }); continue }
    const placed: PlacedQuote[] = []
    let missing: string | null = null
    for (const q of finding.quotes) {
      const eventId = placeQuote(q, prepared)
      if (!eventId) { missing = q; break }
      placed.push({ text: q, eventId })
    }
    if (missing !== null) dropped.push({ finding, reason: `“${missing.length > 80 ? `${missing.slice(0, 80)}…` : missing}” is not in the book.` })
    else kept.push({ ...finding, quotes: placed })
  }
  return { kept, dropped }
}
