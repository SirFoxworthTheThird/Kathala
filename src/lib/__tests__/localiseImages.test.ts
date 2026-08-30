import { describe, it, expect } from 'vitest'
import { describeLinked, describeLocaliseResult, hostOf } from '@/lib/localiseImages'

describe('hostOf', () => {
  it('names the site a picture comes from', () => {
    expect(hostOf('https://upload.wikimedia.org/wikipedia/commons/a/b.jpg')).toBe('upload.wikimedia.org')
  })

  it('does not throw on something that is not a URL', () => {
    /*
      A stored `url` is validated on the way in, but a `.pwk` from elsewhere is
      not this app's data and should not be able to break a summary line. What
      it reports for junk is the app's own origin, and that is the honest
      answer rather than a shrug: `fetch('not a url')` goes there too, so that
      is the site that will have refused.
    */
    expect(() => hostOf('not a url')).not.toThrow()
    expect(hostOf('not a url')).toBe(hostOf('library/x.png'))
  })

  /*
    Two shipped worlds link their pictures by relative path, served from
    wherever the app is. Eighty-four of those are one site, and the failure
    mode this guards is the slice fallback making them several: the first forty
    characters of `library/alice-in-wonderland/art/…` and of
    `library/alice-in-wonderland/maps/…` differ.
  */
  it('treats relative paths as the one site the app is served from', () => {
    const art = hostOf('library/alice-in-wonderland/art/tenniel/tenniel-01.gif')
    const maps = hostOf('library/alice-in-wonderland/maps/wonderland.png')
    expect(art).toBe(maps)
    expect(art).not.toContain('library/')
    // Presence beside the absence: a real host is still read as itself.
    expect(hostOf('https://upload.wikimedia.org/a.jpg')).not.toBe(art)
  })
})

describe('describeLinked', () => {
  it('says so plainly when there is nothing to do', () => {
    expect(describeLinked([])).toContain('already saved on this device')
  })

  it('counts the pictures and the sites they come from', () => {
    const urls = [
      'https://a.example/1.jpg', 'https://a.example/2.jpg', 'https://b.example/3.jpg',
    ]
    expect(describeLinked(urls)).toBe(
      '3 pictures in this world are links rather than files kept here, '
      + 'fetched from 2 sites each time they are shown.')
  })

  it('agrees in number for one of each', () => {
    expect(describeLinked(['https://a.example/1.jpg']))
      .toBe('1 picture in this world is a link rather than a file kept here, '
        + 'fetched from 1 site each time it is shown.')
  })

  /*
    A library world is the case this feature exists for, and its pictures are
    relative paths on the app's own origin. Counting those as eighty-four
    different sites would be the line's one job done wrong.
  */
  it('counts a library world\'s relative paths as one site', () => {
    const urls = Array.from({ length: 84 }, (_, i) =>
      `library/alice-in-wonderland/art/tenniel/tenniel-${i}.gif`)
    expect(describeLinked(urls)).toContain('from 1 site each time')
  })
})

describe('describeLocaliseResult', () => {
  it('reports a clean run without inventing a caveat', () => {
    const out = describeLocaliseResult({ saved: 12, failed: [], bytes: 3_000_000 })
    expect(out).toContain('Saved 12 pictures')
    expect(out).toContain('2.9 MB')
    expect(out).not.toContain('could not')
  })

  /*
    The half this exists for. A partial run must say so, and say where — a
    writer who thinks their world is portable when it is not is worse off than
    one who never pressed the button.
  */
  it('names the sites that refused, grouped, with the rest counted', () => {
    const out = describeLocaliseResult({
      saved: 4,
      bytes: 1024,
      failed: [
        { host: 'a.example', reason: 'cors' }, { host: 'a.example', reason: 'cors' },
        { host: 'b.example', reason: 'cors' },
        { host: 'c.example', reason: 'cors' },
        { host: 'd.example', reason: 'cors' },
        { host: 'e.example', reason: 'cors' },
      ],
    })
    expect(out).toContain('6 could not be copied')
    expect(out).toContain('a.example (2)')
    expect(out).toContain('and 2 other sites')
    // The reassurance is load-bearing: nothing was lost, they are still links.
    expect(out).toContain('still appear when you are online')
  })

  it('does not claim a saving when nothing was saved', () => {
    const out = describeLocaliseResult({ saved: 0, bytes: 0, failed: [{ host: 'a.example', reason: 'cors' }] })
    expect(out).toContain('No pictures could be saved')
    expect(out).not.toContain('Saved 0')
  })

  it('says there was nothing to do rather than reporting a triumph', () => {
    expect(describeLocaliseResult({ saved: 0, failed: [], bytes: 0 })).toBe('There was nothing to save.')
  })
})
