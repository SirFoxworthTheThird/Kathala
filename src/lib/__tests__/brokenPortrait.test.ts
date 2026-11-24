import { afterEach, describe, expect, it } from 'vitest'
import { dropBrokenPortrait } from '../brokenPortrait'

afterEach(() => { document.body.innerHTML = '' })

describe('dropBrokenPortrait', () => {
  it('takes out a pin portrait that failed, leaving the initials under it, and nothing else', () => {
    document.body.innerHTML = `
      <div id="pin"><span>JH</span><img data-pin-portrait src="x"></div>
      <img id="other" src="y">`
    document.addEventListener('error', dropBrokenPortrait, true)
    try {
      document.querySelector('[data-pin-portrait]')!.dispatchEvent(new Event('error'))
      document.getElementById('other')!.dispatchEvent(new Event('error'))
    } finally {
      document.removeEventListener('error', dropBrokenPortrait, true)
    }
    expect(document.querySelector('[data-pin-portrait]')).toBeNull()
    expect(document.getElementById('pin')!.textContent).toBe('JH')
    // An image that is not a pin's portrait is left as it is.
    expect(document.getElementById('other')).not.toBeNull()
  })
})
