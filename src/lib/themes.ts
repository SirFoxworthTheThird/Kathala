import type { AppTheme } from '@/store'

export interface ThemeDefinition {
  id: AppTheme
  label: string
  icon: string
  description: string
  swatch: string
}

export const APP_THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    label: 'Dark Slate',
    icon: '🌑',
    description: 'Quiet, neutral workspace',
    swatch: 'linear-gradient(135deg, #0d1727 0%, #294b73 100%)',
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    icon: '⚔️',
    description: 'Vellum, forest ink, old gold',
    swatch: 'linear-gradient(135deg, #17130d 0%, #3b452c 58%, #c79946 100%)',
  },
  {
    id: 'scifi',
    label: 'Sci-Fi',
    icon: '🚀',
    description: 'Star charts and cool telemetry',
    swatch: 'linear-gradient(135deg, #020611 0%, #0a3048 60%, #55dce8 100%)',
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    icon: '🤖',
    description: 'Electric violet and signal lime',
    swatch: 'linear-gradient(135deg, #10091c 0%, #92278f 55%, #d9f45b 100%)',
  },
  {
    id: 'horror',
    label: 'Horror',
    icon: '🩸',
    description: 'Oxblood, bone, scratched film',
    swatch: 'linear-gradient(135deg, #090707 0%, #4a1015 62%, #c8bca7 100%)',
  },
  {
    id: 'western',
    label: 'Western',
    icon: '🤠',
    description: 'Leather, dust, sunset brass',
    swatch: 'linear-gradient(135deg, #17100b 0%, #6b3e22 60%, #d39a4a 100%)',
  },
  {
    id: 'action',
    label: 'Action',
    icon: '💥',
    description: 'Gunmetal and warning orange',
    swatch: 'linear-gradient(135deg, #0c1115 0%, #35404a 55%, #ff6a1a 100%)',
  },
  {
    id: 'noir',
    label: 'Noir',
    icon: '🎬',
    description: 'Silver gelatin and darkroom red',
    swatch: 'linear-gradient(135deg, #080808 0%, #343330 70%, #a63832 100%)',
  },
  {
    id: 'gothic',
    icon: '🕯️',
    label: 'Gothic',
    description: 'Candle, cold stone, rain on glass',
    swatch: 'linear-gradient(135deg, #0f0d15 0%, #3a3049 58%, #c4788f 100%)',
  },
  {
    id: 'mystery',
    icon: '🔍',
    label: 'Mystery',
    description: 'Gaslight, fog, foolscap and brass',
    swatch: 'linear-gradient(135deg, #0e141c 0%, #26374a 55%, #d6a84e 100%)',
  },
  {
    id: 'mythic',
    icon: '🏛️',
    label: 'Mythic',
    description: 'Bronze, marble, the wine-dark sea',
    swatch: 'linear-gradient(135deg, #0b171c 0%, #21454f 55%, #c6853f 100%)',
  },
  {
    id: 'adventure',
    icon: '🧭',
    label: 'Adventure',
    description: 'Charts, brass, canvas and sea green',
    swatch: 'linear-gradient(135deg, #0c1715 0%, #1f4740 55%, #d4983e 100%)',
  },
  {
    id: 'dystopian',
    icon: '☢️',
    label: 'Dystopian',
    description: 'Ash, concrete, rust and sodium light',
    swatch: 'linear-gradient(135deg, #111310 0%, #3a3a33 55%, #b8603a 100%)',
  },
  {
    id: 'historical',
    icon: '📜',
    label: 'Historical',
    description: 'Ink, parchment, candle and oxblood',
    swatch: 'linear-gradient(135deg, #16120e 0%, #4a3d31 55%, #a04e5c 100%)',
  },
  {
    id: 'cosy',
    icon: '🫖',
    label: 'Cosy',
    description: 'Moss, cream and a lamp in the window',
    swatch: 'linear-gradient(135deg, #0f1712 0%, #2c3a30 55%, #bab85c 100%)',
  },
  {
    id: 'romance',
    label: 'Romance',
    icon: '🌹',
    description: 'Plum ink, blush, candlelight',
    swatch: 'linear-gradient(135deg, #1a0d16 0%, #743952 60%, #e4b7b2 100%)',
  },
]

export function themeClass(theme: AppTheme): string | null {
  return theme === 'default' ? null : `theme-${theme}`
}
