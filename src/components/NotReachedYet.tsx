import { BookLock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useGate } from '@/db/hooks/ReadingGateContext'

/**
 * What a reader sees where a detail page would be for something they have not
 * reached yet.
 *
 * Every index screen filters through the reading gate, so nothing unmet is ever
 * *listed*. The detail pages behind them did not: opening one by URL, by search
 * result, or — for a chapter — by the open icon on a timeline row rendered it in
 * full. A reader run walked in through the chapter one and found Quirrell and
 * Voldemort at chapter 4.
 *
 * Shared rather than repeated, because four routes need it and the next one
 * should not have to invent its own wording. It says where the reader is, so
 * "nothing here" cannot be mistaken for a fault or an empty record — which is
 * the distinction that reader run said it could not make on the map.
 */
export function NotReachedYet({ what, title }: { what: string; title?: string }) {
  const navigate = useNavigate()
  const gate = useGate()
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{title ?? what}</h2>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <BookLock className="h-8 w-8 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            You have not reached this {what} yet
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {gate.chapterNumber !== null
              ? `You are reading at chapter ${gate.chapterNumber}. This page fills in when the story gets here — nothing from it is shown before then.`
              : 'This page fills in when the story gets here — nothing from it is shown before then.'}
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    </div>
  )
}
