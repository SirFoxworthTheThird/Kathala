import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The contract the four map detail panels share (PAN-1).
 *
 * Location, character, route and region open on the same edge of the same
 * screen, by the same gesture, so they have to agree on what a panel is:
 *
 *  - the header names **the thing**, not its type — *Rivendell*, not
 *    *"Location"* — with the type beneath it, and the moment being shown
 *    alongside it when the panel's content is per-chapter;
 *  - the close control is an icon button at the right of that header, labelled
 *    "Close <kind> panel";
 *  - a destructive action, where the panel has one, sits alone in the footer at
 *    the quietest weight that still reads as destructive. It is never the
 *    loudest thing on the panel (LP-1), and it never eats the last section of
 *    the body (LP-2) — hence `shrink-0`.
 *
 * The character panel has no delete, and that is the contract rather than a gap
 * in it: a character is not the map's to destroy — they outlive every marker
 * they stand on. Its footer carries the way to the screen that does own them.
 */
export function PanelHeader({
  icon: Icon,
  name,
  kind,
  moment,
  closeLabel,
  onClose,
}: {
  icon: React.ElementType
  /** The thing's own name — what the writer came here for. */
  name: string
  /** What kind of thing it is, e.g. "Location", "City", "Character". */
  kind: string
  /** The moment this panel is showing, when its content is per-chapter. */
  moment?: string | null
  closeLabel: string
  onClose: () => void
}) {
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]" title={name}>
          {name}
        </p>
        <p className="truncate text-[10px] capitalize text-[hsl(var(--muted-foreground))]">
          {moment ? `${kind} · ${moment}` : kind}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="pw-tap h-7 w-7 shrink-0"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

/** The one weight a panel's destructive action is allowed to have. */
export function PanelDangerFooter({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="shrink-0 border-t border-[hsl(var(--border))] px-4 py-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full gap-1.5 text-red-400 hover:bg-red-400/10 hover:text-red-400"
        onClick={onClick}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </Button>
    </div>
  )
}
