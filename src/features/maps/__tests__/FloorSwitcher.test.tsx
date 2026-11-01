import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import type {MapLayer} from '@/types'
import {FloorSwitcher} from '../FloorSwitcher'

describe('floor switcher in reading mode',()=>{
  const noop=()=>{}
  const floors=[{id:'lower',levelLabel:'Hall and gallery',levelIndex:0},{id:'upper',levelLabel:'Prison-side rooms',levelIndex:1}] as MapLayer[]
  const props={floors,activeId:'upper',onSwitch:noop,onAddLevel:noop,onDeleteFloor:noop,onRenameFloor:noop}
  it('keeps both floor navigation buttons and omits mutation controls and rename hints',()=>{
    const html=renderToStaticMarkup(<FloorSwitcher {...props} readOnly />)
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html).toContain('title="Hall and gallery"')
    expect(html).toContain('title="Prison-side rooms" aria-current="true"')
    for(const text of ['Add a level','Rename this level','Delete this level','double-click to rename','Rename level'])expect(html).not.toContain(text)
  })
  it('preserves add, rename and delete controls for a writer',()=>{
    const html=renderToStaticMarkup(<FloorSwitcher {...props} />)
    expect(html).toContain('Add a level above')
    expect(html).toContain('Rename this level')
    expect(html).toContain('Delete this level')
    expect(html).toContain('double-click to rename')
  })
})
