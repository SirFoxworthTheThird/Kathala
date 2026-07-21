import type { ReactNode } from 'react'

/**
 * Flatten arbitrary React children into their plain-text content.
 *
 * The custom <Select> resolves what to show in the trigger by looking up a
 * label registered by each <SelectItem>. Items are frequently more than a bare
 * string — `Ch. {n} — {title}` (an array), `{name} <span>…</span>` (mixed
 * JSX) — so a naive `typeof children === 'string'` check registers an empty
 * label and the trigger renders blank after selecting or when editing.
 *
 * This walks strings, numbers, fragments/arrays and elements' `children`,
 * ignoring nulls/booleans, and collapses whitespace so the trigger shows the
 * same readable text the option did.
 */
export function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props
    return nodeText(props?.children)
  }
  return ''
}

/** As {@link nodeText}, but trimmed and with internal whitespace collapsed. */
export function selectItemLabel(node: ReactNode): string {
  return nodeText(node).replace(/\s+/g, ' ').trim()
}
