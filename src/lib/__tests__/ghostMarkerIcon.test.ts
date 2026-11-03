import {afterEach,describe,expect,it} from 'vitest'
import {makeGhostIcon} from '../ghostMarkerIcon'

afterEach(()=>document.documentElement.style.removeProperty('--font-body'))

describe('map label font families',()=>{
  it('keeps quoted historical-theme fonts inside one style attribute',()=>{
    document.documentElement.style.setProperty('--font-body','"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif')
    const icon=makeGhostIcon({characterId:'c',name:'Rebecca',color:'#8a5040',x:0,y:0,outerTimelineName:'Outer story',outerEventTitle:'A scene'},0)
    const container=document.createElement('div')
    container.innerHTML=String(icon.options.html)
    const label=Array.from(container.querySelectorAll('div')).find(node=>node.textContent==='Rebecca')!
    expect(label.style.fontFamily).toContain('Palatino Linotype')
    expect(label.style.fontFamily).toContain('Book Antiqua')
    expect(label.style.lineHeight).toBe('1.3')
    expect(label.getAttributeNames()).toEqual(['style'])
  })
})
