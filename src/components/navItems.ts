import {
  LayoutDashboard, BookOpen, StickyNote, CalendarDays, FileText, Users, Map,
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
   * What a reader calls this screen, when reading mode gives it back.
   *
   * Only the Manuscript has one. It was hidden outright on the grounds that a
   * library world carries no prose, and that stopped being true: 31 of the 38
   * shipped worlds now hold the complete text of a public-domain novel, and
   * their catalogue entries call themselves reading-mode editions. Hiding the
   * book from the reader it was assembled for is the wrong way round.
   *
   * The name changes with the reader. "Manuscript" is what an author calls
   * their own draft; someone reading *Dracula* is not writing it.
   */
  readingLabel?: string
}

/** The world-scoped navigation destinations, shared by the desktop rail and the
 *  mobile drawer. `core` items are the everyday screens; `extended` are the rest. */
export const navItems: NavItem[] = [
  { to: '',              label: 'Dashboard',  icon: LayoutDashboard, end: true,  tier: 'core' },
  { to: 'timeline',      label: 'Timeline',   icon: BookOpen,        end: false, tier: 'core' },
  { to: 'corkboard',     label: 'Corkboard',  icon: StickyNote,      end: false, tier: 'extended', writingOnly: true },
  { to: 'calendar',      label: 'Calendar',   icon: CalendarDays,    end: false, tier: 'extended' },
  { to: 'structure',     label: 'Structure',  icon: ListChecks,      end: false, tier: 'extended', writingOnly: true },
  { to: 'manuscript',    label: 'Manuscript', icon: FileText,        end: false, tier: 'core', writingOnly: true, readingLabel: 'Read' },
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
 *
 * `hasProse` only matters for a screen with a `readingLabel`: the book is
 * offered when there is a book. Everything else in reading mode is decided by
 * `writingOnly` alone.
 */
export function visibleNavItems(
  { readingMode, hasProse }: { readingMode: boolean; hasProse: boolean },
): NavItem[] {
  if (!readingMode) return navItems
  return navItems
    .filter((n) => !n.writingOnly || (n.readingLabel !== undefined && hasProse))
    .map((n) => (n.readingLabel ? { ...n, label: n.readingLabel } : n))
}
