import type { DiffToken } from '@/lib/textDiff'
import { splitEdges } from '@/lib/textDiff'

/**
 * Prose with what changed marked: added words green, removed ones red and
 * struck through. Scene history's diff (`SceneHistoryDialog`), and a draft's
 * comparison with the book (R3), which opens each scene in it.
 */
export function ProseDiff({ tokens }: { tokens: readonly DiffToken[] }) {
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.op === 'equal') return <span key={i} className={tok.italic ? 'italic' : undefined}>{tok.text}</span>
        // A deletion is very often followed immediately by the
        // insertion replacing it, with no whitespace between —
        // "years, and it showed." then "years." ran together as
        // one unreadable string. The padding and margin give the
        // two blocks their own edges; splitEdges keeps the
        // highlight off the surrounding spaces so they stay
        // tight around the words that changed.
        const { lead, core, trail } = splitEdges(tok.text)
        const tone = tok.op === 'add'
          ? 'bg-emerald-500/20 text-emerald-300'
          : 'bg-red-500/20 text-red-300 line-through'
        return (
          <span key={i}>
            {lead}
            {core && <span data-diff={tok.op} className={`mx-0.5 rounded px-1 ${tone}${tok.italic ? ' italic' : ''}`}>{core}</span>}
            {trail}
          </span>
        )
      })}
    </>
  )
}
