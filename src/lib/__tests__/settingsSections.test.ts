import { describe, it, expect } from 'vitest'
import {
  parseCollapsed, serialiseCollapsed, isSectionOpen, toggleSection,
  collapseAll, expandAll, allCollapsed,
} from '@/lib/settingsSections'

/**
 * HB-9's remaining part. The one decision worth guarding is which set is
 * stored: the **collapsed** ids, so a section nobody has heard of is open. The
 * opposite choice looks identical on the day it ships and folds every future
 * section shut for everyone who ever used the control.
 */

const PAGE = ['settings-world', 'settings-theme', 'settings-calendar']

describe('parseCollapsed', () => {
  it('reads a stored list', () => {
    expect(parseCollapsed('["settings-theme"]')).toEqual(['settings-theme'])
  })

  it('treats nothing stored as nothing collapsed', () => {
    expect(parseCollapsed(null)).toEqual([])
  })

  it('survives junk rather than throwing on a settings screen', () => {
    // localStorage is shared with other tabs, other versions and the user.
    expect(parseCollapsed('not json')).toEqual([])
    expect(parseCollapsed('{"a":1}')).toEqual([])
    expect(parseCollapsed('[1, "settings-theme", null]')).toEqual(['settings-theme'])
  })

  it('round-trips what it writes', () => {
    expect(parseCollapsed(serialiseCollapsed(PAGE))).toEqual(PAGE)
  })
})

describe('isSectionOpen', () => {
  it('opens a section nobody has collapsed', () => {
    expect(isSectionOpen([], 'settings-theme')).toBe(true)
  })

  it('and a section this store has never heard of', () => {
    // The whole reason the collapsed set is the one stored: a section added
    // next year must not arrive shut for everyone who used this before it.
    expect(isSectionOpen(['settings-theme'], 'settings-invented-later')).toBe(true)
  })

  it('closes one that is collapsed', () => {
    expect(isSectionOpen(['settings-theme'], 'settings-theme')).toBe(false)
  })
})

describe('toggleSection', () => {
  it('closes an open section and opens a closed one', () => {
    expect(toggleSection([], 'settings-theme')).toEqual(['settings-theme'])
    expect(toggleSection(['settings-theme'], 'settings-theme')).toEqual([])
  })

  it('leaves the others alone', () => {
    expect(toggleSection(['settings-world'], 'settings-theme'))
      .toEqual(['settings-world', 'settings-theme'])
  })

  it('does not mutate what it was given', () => {
    const before = ['settings-world']
    toggleSection(before, 'settings-theme')
    expect(before).toEqual(['settings-world'])
  })
})

describe('collapseAll / expandAll', () => {
  it('folds every section on the page', () => {
    expect(collapseAll([], PAGE).sort()).toEqual([...PAGE].sort())
  })

  it('without duplicating ones already folded', () => {
    expect(collapseAll(['settings-theme'], PAGE).sort()).toEqual([...PAGE].sort())
  })

  it('opens every section on the page and leaves others as they were', () => {
    // A section that is not currently rendered — reading mode hides several —
    // keeps its state rather than being silently reopened.
    const collapsed = [...PAGE, 'settings-not-on-this-page']
    expect(expandAll(collapsed, PAGE)).toEqual(['settings-not-on-this-page'])
  })

  it('and collapseAll likewise leaves absent sections untouched', () => {
    expect(collapseAll(['settings-not-on-this-page'], PAGE))
      .toContain('settings-not-on-this-page')
  })
})

describe('allCollapsed', () => {
  it('is true only when every section on the page is folded', () => {
    expect(allCollapsed(PAGE, PAGE)).toBe(true)
    expect(allCollapsed(['settings-theme'], PAGE)).toBe(false)
  })

  it('is false when there are no sections, so the button is never offered on an empty page', () => {
    expect(allCollapsed([], [])).toBe(false)
  })

  it('ignores collapsed ids that are not on the page', () => {
    // Otherwise the button would read "Expand all" because of a section that
    // reading mode is not even rendering.
    expect(allCollapsed(['settings-elsewhere'], PAGE)).toBe(false)
    expect(allCollapsed([...PAGE, 'settings-elsewhere'], PAGE)).toBe(true)
  })
})
