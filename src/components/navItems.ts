import {
  LayoutDashboard, BookOpen, StickyNote, CalendarDays, Users, Map,
  Package, Network, Spline, BookMarked, Shield, KeyRound, Settings, ListChecks,
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
   * world is in reading mode.
   */
  writingOnly?: boolean
  /**
   * What a reader calls this screen.
   *
   * Only the Manuscript has one. "Manuscript" is what an author calls their own
   * draft; someone reading *Dracula* is not writing it, and the screen is
   * theirs too — the book to read, and its chapters and scenes to set their
   * place in.
   */
  readingLabel?: string
}

/** The world-scoped navigation destinations, shared by the desktop rail and the
 *  mobile drawer. `core` items are the everyday screens; `extended` are the rest. */
export const navItems: NavItem[] = [
  { to: '',              label: 'Dashboard',  icon: LayoutDashboard, end: true,  tier: 'core' },
  { to: 'manuscript',    label: 'Manuscript', icon: BookOpen,        end: false, tier: 'core', readingLabel: 'Book' },
  { to: 'corkboard',     label: 'Corkboard',  icon: StickyNote,      end: false, tier: 'extended', writingOnly: true },
  { to: 'calendar',      label: 'Calendar',   icon: CalendarDays,    end: false, tier: 'extended' },
  { to: 'structure',     label: 'Structure',  icon: ListChecks,      end: false, tier: 'extended', writingOnly: true },
  { to: 'characters',    label: 'Characters', icon: Users,           end: false, tier: 'core' },
  { to: 'maps',          label: 'Maps',       icon: Map,             end: false, tier: 'core' },
  { to: 'items',         label: 'Items',      icon: Package,         end: false, tier: 'extended' },
  { to: 'relationships', label: 'Relations',  icon: Network,         end: false, tier: 'extended' },
  { to: 'arc',           label: 'Arc',        icon: Spline,          end: false, tier: 'extended' },
  { to: 'lore',          label: 'Lore',       icon: BookMarked,      end: false, tier: 'extended' },
  { to: 'factions',      label: 'Factions',   icon: Shield,          end: false, tier: 'extended' },
  { to: 'knowledge',     label: 'Knowledge',  icon: KeyRound,        end: false, tier: 'extended' },
  { to: 'settings',      label: 'Settings',   icon: Settings,        end: false, tier: 'extended' },
]

/**
 * The destinations a given reader or writer should see, with a reader's names.
 *
 * Shared by the desktop rail and the mobile top bar because they had the filter
 * written out twice, and a screen that appears in one and not the other is the
 * kind of difference nobody notices until someone is on a phone.
 */
export function visibleNavItems({ readingMode }: { readingMode: boolean }): NavItem[] {
  if (!readingMode) return navItems
  return navItems
    .filter((n) => !n.writingOnly)
    .map((n) => (n.readingLabel ? { ...n, label: n.readingLabel } : n))
}
