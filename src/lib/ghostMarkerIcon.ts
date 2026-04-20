import L from 'leaflet'

function resolveV() {
  const s = getComputedStyle(document.documentElement)
  const r = (n: string) => s.getPropertyValue(n).trim()
  return {
    bg:     `hsl(${r('--leaflet-card')})`,
    border: `hsl(${r('--ring')})`,
    frame:  `hsl(${r('--leaflet-border')})`,
    fg:     `hsl(${r('--leaflet-fg')})`,
    muted:  `hsl(${r('--leaflet-muted')})`,
    font:   r('--font-body') || 'sans-serif',
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface GhostPin {
  characterId: string
  name: string
  /** Hex or CSS color string — used for the dashed ring accent */
  color: string
  portraitUrl?: string | null
  x: number
  y: number
  /** Name of the outer (frame/narrator) timeline shown in the tooltip */
  outerTimelineName: string
  /** Title of the outer-timeline event the narrator is currently at */
  outerEventTitle: string
}

/**
 * Creates a Leaflet DivIcon for a ghost pin — a dimmed, grayscale, dashed-border
 * variant of the regular character group icon. Ghost pins represent outer-timeline
 * characters shown as a fixed context overlay when the inner track is active.
 */
export function makeGhostIcon(pin: GhostPin, zoom: number): L.DivIcon {
  const V = resolveV()
  const size     = Math.max(20, Math.min(80, Math.round(36 * Math.pow(2, zoom))))
  const fontSize = Math.round(size * 0.36)
  const labelW   = 110

  const avatarContent = pin.portraitUrl
    ? `<img src="${escapeHtml(pin.portraitUrl)}" style="width:100%;height:100%;object-fit:cover;display:block;">`
    : `<span style="color:${V.border};font-size:${fontSize}px;font-weight:bold;font-family:${V.font};line-height:1;user-select:none;">${escapeHtml(pin.name.slice(0, 2).toUpperCase())}</span>`

  const avatarInner = `<div style="width:${size}px;height:${size}px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:${V.bg};">${avatarContent}</div>`
  const avatarWrap  = `<div style="position:relative;flex-shrink:0;width:${size}px;height:${size}px;">${avatarInner}</div>`
  const divider     = `<div style="width:1px;height:${Math.round(size * 0.65)}px;align-self:center;background:${V.frame};opacity:0.6;flex-shrink:0;"></div>`

  const fsPrimary = Math.max(10, Math.round(size * 0.3))
  const fsSub     = Math.max(8,  Math.round(size * 0.24))
  const labelBox  = `<div style="display:flex;flex-direction:column;justify-content:center;padding:0 8px;min-width:${labelW}px;height:${size}px;overflow:hidden;">
    <div style="color:${V.fg};font-size:${fsPrimary}px;font-family:${V.font};line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(pin.name)}</div>
    <div style="color:${V.muted};font-size:${fsSub}px;font-family:${V.font};line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(pin.outerTimelineName)}</div>
  </div>`

  const r    = Math.round(size / 2) + 1
  const ring = pin.color || V.border
  const pill = `<div style="display:inline-flex;align-items:stretch;border:2px dashed ${ring};border-radius:${r}px 4px 4px ${r}px;background:${V.bg};overflow:hidden;">${avatarWrap}${divider}${labelBox}</div>`
  const html = `<div style="display:inline-block;opacity:0.45;filter:grayscale(0.85);cursor:default;">${pill}</div>`

  const totalW = size + 1 + labelW + 4
  const totalH = size + 4

  return L.divIcon({
    html, className: '',
    iconSize:   [totalW, totalH],
    iconAnchor: [1 + Math.round(size / 2), Math.round(totalH / 2)],
  })
}
