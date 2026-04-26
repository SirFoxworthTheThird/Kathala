import { useState } from 'react'
import { X, MousePointerClick, Ruler, PanelLeft } from 'lucide-react'

const HINTS = [
  {
    icon: MousePointerClick,
    text: 'Right-click the map to quickly add locations, start routes, or draw regions.',
  },
  {
    icon: Ruler,
    text: 'Set a map scale (Scale button above) to unlock distance measurement.',
  },
  {
    icon: PanelLeft,
    text: 'Routes and Regions are in the left sidebar — expand them to draw and manage overlays.',
  },
]

export function MapHintsBar({ worldId }: { worldId: string }) {
  const key = `wb-map-hints-dismissed-${worldId}`
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === '1')

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(key, '1')
    setDismissed(true)
  }

  return (
    <div className="relative z-[1050] flex shrink-0 items-start gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--ring)/0.06)] px-4 py-2">
      <div className="flex flex-1 flex-wrap gap-x-6 gap-y-1">
        {HINTS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
            <Icon className="h-3 w-3 shrink-0 text-[hsl(var(--ring))]" />
            {text}
          </div>
        ))}
      </div>
      <button
        onClick={dismiss}
        title="Dismiss tips"
        className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
