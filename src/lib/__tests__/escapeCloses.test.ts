import { describe, it, expect } from 'vitest'
import { escapeCloses } from '../escapeCloses'

const key = (key: string, target: Element | null, defaultPrevented = false) => ({ key, target, defaultPrevented }) as unknown as KeyboardEvent

describe('escapeCloses', () => {
  it('closes from a button, a checkbox, or the panel itself', () => {
    const panel = document.createElement('div')
    panel.innerHTML = '<button>Close</button><input type="checkbox"><span>text</span>'
    expect(escapeCloses(key('Escape', panel.querySelector('button')))).toBe(true)
    expect(escapeCloses(key('Escape', panel.querySelector('input')))).toBe(true)
    expect(escapeCloses(key('Escape', panel.querySelector('span')))).toBe(true)
    expect(escapeCloses(key('Escape', panel))).toBe(true)
  })

  it('leaves a text field its own Escape, so words typed there are not lost', () => {
    const panel = document.createElement('div')
    panel.innerHTML = '<input type="text"><textarea></textarea><div contenteditable="true"><b>x</b></div><select></select>'
    expect(escapeCloses(key('Escape', panel.querySelector('input')))).toBe(false)
    expect(escapeCloses(key('Escape', panel.querySelector('textarea')))).toBe(false)
    expect(escapeCloses(key('Escape', panel.querySelector('b')))).toBe(false)
    expect(escapeCloses(key('Escape', panel.querySelector('select')))).toBe(false)
  })

  it('only Escape, and not one a list or a menu already took', () => {
    const button = document.createElement('button')
    expect(escapeCloses(key('Enter', button))).toBe(false)
    expect(escapeCloses(key('Escape', button, true))).toBe(false)
  })
})
