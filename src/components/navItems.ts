import {
  LayoutDashboard, BookOpen, LayoutGrid, CalendarDays, FileText, Users, Map,
  Package, Network, TableProperties, BookMarked, Shield, KeyRound, Settings, ListChecks,
} from 'lucide-react'

export type NavTier = 'core' | 'extended'

export interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end: boolean
  tier: NavTier
  /**
   * Destinations that belong to writing rather than reading, hidden when a
   * world is in reading mode. The Manuscript is the pointed one — a library
   * world carries no prose, and for a reader following a published book it
   * would be both empty and beside the point.
   */
  writingOnly?: boolean
}

/** The world-scoped navigation destinations, shared by the desktop rail and the
 *  mobile drawer. `core` items are the everyday screens; `extended` are the rest. */
export const navItems: NavItem[] = [
  { to: '',              label: 'Dashboard',  icon: LayoutDashboard, end: true,  tier: 'core' },
  { to: 'timeline',      label: 'Timeline',   icon: BookOpen,        end: false, tier: 'core' },
  { to: 'corkboard',     label: 'Corkboard',  icon: LayoutGrid,      end: false, tier: 'extended', writingOnly: true },
  { to: 'calendar',      label: 'Calendar',   icon: CalendarDays,    end: false, tier: 'extended' },
  { to: 'structure',     label: 'Structure',  icon: ListChecks,      end: false, tier: 'extended', writingOnly: true },
  { to: 'manuscript',    label: 'Manuscript', icon: FileText,        end: false, tier: 'core', writingOnly: true },
  { to: 'characters',    label: 'Characters', icon: Users,           end: false, tier: 'core' },
  { to: 'maps',          label: 'Maps',       icon: Map,             end: false, tier: 'core' },
  { to: 'items',         label: 'Items',      icon: Package,         end: false, tier: 'extended' },
  { to: 'relationships', label: 'Relations',  icon: Network,         end: false, tier: 'extended' },
  { to: 'arc',           label: 'Arc',        icon: TableProperties, end: false, tier: 'extended' },
  { to: 'lore',          label: 'Lore',       icon: BookMarked,      end: false, tier: 'extended' },
  { to: 'factions',      label: 'Factions',   icon: Shield,          end: false, tier: 'extended' },
  { to: 'knowledge',     label: 'Knowledge',  icon: KeyRound,        end: false, tier: 'extended' },
  { to: 'settings',      label: 'Settings',   icon: Settings,        end: false, tier: 'extended' },
]
