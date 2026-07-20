/**
 * A small word-level diff for comparing scene drafts. Tokenises both texts into
 * words and whitespace, runs a longest-common-subsequence diff, and returns a
 * flat run of tokens tagged equal / added / removed. Pure and dependency-free.
 */

export type DiffOp = 'equal' | 'add' | 'remove'
export interface DiffToken { op: DiffOp; text: string }

/** Split into alternating word / whitespace tokens (whitespace preserved). */
export function tokenize(text: string): string[] {
  if (!text) return []
  return text.match(/\s+|\S+/g) ?? []
}

/**
 * Word-level diff of `a` → `b`. Removed tokens (in `a` only) come tagged
 * 'remove', added tokens (in `b` only) 'add', shared tokens 'equal'. Adjacent
 * tokens with the same op are merged so the result reads in runs.
 */
export function diffWords(a: string, b: string): DiffToken[] {
  const at = tokenize(a)
  const bt = tokenize(b)
  const n = at.length
  const m = bt.length

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = at[i] === bt[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  // Walk the table to emit ops.
  const raw: DiffToken[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (at[i] === bt[j]) {
      raw.push({ op: 'equal', text: at[i] }); i++; j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      raw.push({ op: 'remove', text: at[i] }); i++
    } else {
      raw.push({ op: 'add', text: bt[j] }); j++
    }
  }
  while (i < n) { raw.push({ op: 'remove', text: at[i] }); i++ }
  while (j < m) { raw.push({ op: 'add', text: bt[j] }); j++ }

  // Merge adjacent tokens sharing an op.
  const merged: DiffToken[] = []
  for (const tok of raw) {
    const last = merged[merged.length - 1]
    if (last && last.op === tok.op) last.text += tok.text
    else merged.push({ ...tok })
  }
  return merged
}

/** Count of added and removed words (whitespace-only tokens don't count). */
export function diffStats(tokens: DiffToken[]): { added: number; removed: number } {
  let added = 0, removed = 0
  for (const t of tokens) {
    if (t.op === 'equal') continue
    const words = (t.text.match(/\S+/g) ?? []).length
    if (t.op === 'add') added += words
    else removed += words
  }
  return { added, removed }
}
