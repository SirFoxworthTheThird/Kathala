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
