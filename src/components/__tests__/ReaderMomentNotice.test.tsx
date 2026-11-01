import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReaderMomentNotice } from '../ReaderMomentNotice'

describe('reader retrospective context',()=>{
  it('explains the earlier scene without disclosing another identity or outcome',()=>{
    const html=renderToStaticMarkup(<ReaderMomentNotice reading retrospective />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Retrospective scene')
    expect(html).toContain('Viewing an earlier part of the story.')
  })
  it('does not label an ordinary scene retrospective',()=>{
    expect(renderToStaticMarkup(<ReaderMomentNotice reading retrospective={false} />)).toBe('')
  })
  it('leaves the existing writer scene controls responsible for writer context',()=>{
    expect(renderToStaticMarkup(<ReaderMomentNotice reading={false} retrospective />)).toBe('')
  })
})
