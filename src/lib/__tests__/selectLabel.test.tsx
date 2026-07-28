import { describe, it, expect } from 'vitest'
import { createElement, Fragment } from 'react'
import { nodeText, selectItemLabel } from '@/lib/selectLabel'

describe('nodeText', () => {
  it('returns a plain string unchanged', () => {
    expect(nodeText('Aragorn')).toBe('Aragorn')
  })

  it('stringifies numbers', () => {
    expect(nodeText(42)).toBe('42')
  })

  it('ignores null, undefined and booleans', () => {
    expect(nodeText(null)).toBe('')
    expect(nodeText(undefined)).toBe('')
    expect(nodeText(false)).toBe('')
    expect(nodeText(true)).toBe('')
  })

  it('joins an interpolated array of strings, numbers and expressions', () => {
    // The `Ch. {n} — {title}` shape that used to register a blank label.
    expect(nodeText(['Ch. ', 3, ' — ', 'The gate'])).toBe('Ch. 3 — The gate')
  })

  it('recurses into element children', () => {
    const node = createElement('span', null, 'Longclaw ', createElement('em', null, '(rare)'))
    expect(nodeText(node)).toBe('Longclaw (rare)')
  })

  it('flattens fragments and mixed JSX children', () => {
    const node = createElement(Fragment, null, 'Sting', createElement('span', null, ' — ', 'a blade'))
    expect(nodeText(node)).toBe('Sting — a blade')
  })
})

describe('selectItemLabel', () => {
  it('collapses internal whitespace and trims', () => {
    const node = createElement('span', null, '  Ch. 3', '\n  ·  ', 'The gate  ')
    expect(selectItemLabel(node)).toBe('Ch. 3 · The gate')
  })

  it('is empty for empty content', () => {
    expect(selectItemLabel(null)).toBe('')
  })
})
