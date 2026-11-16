import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {EmptyMapHeader} from '../EmptyMapHeader'

describe('empty map header',()=>{
  const noop=()=>{}
  it('offers no authoring controls to a reader',()=>{
    const html=renderToStaticMarkup(<EmptyMapHeader reading onGenerate={noop} onUpload={noop}/> )
    expect(html).toContain('Maps')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('Generate with AI')
    expect(html).not.toContain('Upload Map')
  })
  it('retains both map entry points for a writer',()=>{
    const html=renderToStaticMarkup(<EmptyMapHeader reading={false} onGenerate={noop} onUpload={noop}/> )
    expect(html).toContain('Generate with AI')
    expect(html).toContain('Upload Map')
  })
})
