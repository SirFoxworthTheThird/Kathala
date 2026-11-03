/** Reader context for an explicitly authored retrospective passage. */
export function ReaderMomentNotice({ reading, retrospective }: { reading: boolean; retrospective: boolean }) {
  if (!reading || !retrospective) return null
  return (
    <div
      role="status"
      className="shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 text-xs text-[hsl(var(--muted-foreground))]"
      style={{ paddingLeft: 'calc(var(--pw-nav-w) + 1rem)', paddingRight: '1rem' }}
    >
      Retrospective scene · Viewing an earlier part of the story.
    </div>
  )
}
