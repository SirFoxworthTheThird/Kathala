import { useState } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** What went wrong, as text to paste into a report: the error, where, and the browser. */
export function errorDetails(error: unknown, where: string, agent: string): string {
  const what = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}${error.data ? `\n${String(error.data)}` : ''}`
    : error instanceof Error
      ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`
      : String(error)
  return [what, `Address: ${where}`, `Browser: ${agent}`].join('\n\n')
}

/**
 * What a screen shows when it fails (ux-expert-fixes-plan.md, Part 4; UX-1-4).
 *
 * With no boundary, a throw anywhere under a route replaced the whole app with
 * React Router's own page — "Unexpected Application Error!", a stack trace and
 * "Hey developer 👋" — and the only way out was a reload. This says what
 * happened in plain words, offers the reload, and gives the details to someone
 * who will report it. Nothing is lost by it: the work is in the browser's
 * storage, not in the screen that failed.
 *
 * Used inside the book's frame, so the top bar and the navigation stay and the
 * writer can go to another screen, and around the world list.
 */
export function RouteError({ notFound = false }: { notFound?: boolean }) {
  const error = useRouteError()
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)
  // An address that names nothing: the catch-all route says so; the router's own 404 does too.
  const missing = notFound || (isRouteErrorResponse(error) && error.status === 404)
  const details = errorDetails(error, window.location.href, navigator.userAgent)

  return (
    <div role="alert" className="flex h-full min-h-0 flex-1 items-center justify-center overflow-auto p-6">
      <div className="max-w-md space-y-3 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
        <h1 className="text-lg font-semibold">{missing ? 'There is no page here' : 'This screen stopped working'}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {missing
            ? 'The address does not name a screen. Your work is as you left it.'
            : 'Something on it failed. Your work is saved in this browser and is not lost. Reloading usually brings the screen back; another screen, from the menu, still works.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {missing
            ? <Button asChild><a href="#/">Go to your worlds</a></Button>
            : <Button onClick={() => window.location.reload()}>Reload</Button>}
          {!missing && (
            <Button
              variant="outline"
              onClick={() => {
                if (!navigator.clipboard) { setCopied('no'); return }
                navigator.clipboard.writeText(details).then(() => setCopied('yes'), () => setCopied('no'))
              }}
            >
              Copy the details
            </Button>
          )}
        </div>
        <p role="status" className="text-xs text-[hsl(var(--muted-foreground))]">
          {copied === 'yes' ? 'Copied. Paste them into a report of what you were doing.' : copied === 'no' ? 'This browser would not copy them. They are below.' : ''}
        </p>
        {!missing && (
          <details className="text-left text-xs" open={copied === 'no'}>
            <summary className="cursor-pointer text-[hsl(var(--muted-foreground))]">The details</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-[hsl(var(--muted))] p-2">{details}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
