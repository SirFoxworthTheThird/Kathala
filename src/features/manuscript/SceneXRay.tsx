import { useEffect, useMemo, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { PanelRightClose, PanelRightOpen, MapPin, Package, User, Users, X, Eye } from 'lucide-react'
import { PortraitImage } from '@/components/PortraitImage'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useTimelineEvents } from '@/db/hooks/useTimeline'
import { sceneCast, type CastMember, type CastThing } from '@/lib/sceneCast'
import { cn } from '@/lib/utils'

/**
 * Who is in the scene you are reading, with their faces.
 *
 * *The Count of Monte Cristo* has forty-one people in it and a reader meets them
 * across a thousand pages; "who is this again" is the question this app exists
 * to answer, and until now answering it meant leaving the book. This is the
 * answer beside the page — the scene's cast, its place and the things in it,
 * drawn from the same illustrations the rest of the app uses.
 *
 * **It follows the scene on screen, not the reading cursor.** The cursor is a
 * high-water mark and never moves backwards, by design: it is where you have
 * read *to*. Keying the panel on it would mean scrolling back to chapter two
 * and being shown chapter forty's cast.
 *
 * **It owns that tracking**, like `ReadingProgress` beside it, so the book is
 * not re-rendered as the reader moves through it.
 *
 * Nothing here consults the reading gate, and nothing needs to: the three entity
 * hooks filter, so a character the reader has not met is not in the list and
 * cannot be drawn. That is what makes a mention safe to show — `sceneCast`
 * carries the name through only when the person is already known.
 */

const OPEN_KEY = 'plotweave-xray-open'

function readOpen(): boolean {
  try {
    const raw = localStorage.getItem(OPEN_KEY)
    return raw === null ? true : raw === '1'
  } catch {
    // Private windows and blocked site data throw rather than return null.
    return true
  }
}

/** The scene whose text is in front of the reader, or null before one is. */
function useSceneInView(scrollRef: RefObject<HTMLDivElement | null>, sceneCount: number): string | null {
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-scene-event-id]'))
    if (nodes.length === 0) return

    /*
      The topmost intersecting scene, not the furthest: `ManuscriptView`'s own
      observer wants the furthest because it is advancing a bookmark, and this
      one wants whatever the reader is looking at. The same margins, so the two
      agree about when a scene counts as being read.
    */
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length === 0) return
        const top = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b)
        const next = top.target.getAttribute('data-scene-event-id')
        if (next) setId(next)
      },
      { root, rootMargin: '-25% 0px -60% 0px', threshold: 0 },
    )
    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [scrollRef, sceneCount])

  return id
}

/**
 * One entry: the picture, the name, and a way to go there.
 *
 * The picture is the subject here, not a label for a control — these are
 * Tenniel's engravings and Doré's plates at 40px — so it opens full size, which
 * is what `zoomable` does everywhere else the image is the point. That is only
 * safe because going to the entity is now its own button: the whole row used to
 * be a link, and a zoomable image inside it would have stolen the click, which
 * `imageLightbox.spec.ts` exists to prevent.
 *
 * `alt=""` on the picture, because the name is right beside it. Naming the
 * image as well made the old link announce "White Rabbit White Rabbit", and a
 * lookup for the character also matched *The White Rabbit's House* and *White
 * Rabbit's Pocket Watch*.
 */
function Row({ to, name, imageId, icon }: {
  to: string; name: string; imageId: string | null; icon: typeof User
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--accent)/0.4)]">
      <PortraitImage
        imageId={imageId}
        alt=""
        zoomable
        fallbackIcon={icon}
        className="h-10 w-10 shrink-0 rounded-md object-cover"
        fallbackClassName="h-10 w-10 shrink-0 rounded-md"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-[hsl(var(--foreground))]">{name}</span>
      {/*
        An icon with no text of its own, so `aria-label` is the name rather than
        a replacement for one. It says where it goes: "Open" alone, repeated
        down a panel of five, tells a screen reader nothing about which.
      */}
      <Link
        to={to}
        aria-label={`Open ${name}`}
        className="shrink-0 rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </li>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {title}
      </h3>
      <ul>{children}</ul>
    </section>
  )
}

export function SceneXRay({
  worldId,
  timelineId,
  scrollRef,
  sceneCount,
}: {
  worldId: string
  timelineId: string | null
  scrollRef: RefObject<HTMLDivElement | null>
  /** Re-observe when the book changes, not when the reader moves. */
  sceneCount: number
}) {
  const [open, setOpen] = useState(readOpen)
  const [drawer, setDrawer] = useState(false)
  const eventId = useSceneInView(scrollRef, sceneCount)

  const events = useTimelineEvents(timelineId)
  const characters = useCharacters(worldId)
  const items = useItems(worldId)
  const markers = useAllLocationMarkers(worldId)

  const event = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId])
  const cast = useMemo(
    () => sceneCast({ event, characters, items, markers }),
    [event, characters, items, markers],
  )

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(OPEN_KEY, next ? '1' : '0') } catch { /* private window */ }
  }

  const onStage = cast.characters.filter((c) => c.onStage)
  const named = cast.characters.filter((c) => !c.onStage)
  const person = (c: CastMember) => (
    <Row key={c.id} to={`/worlds/${worldId}/characters/${c.id}`} name={c.name}
      imageId={c.imageId} icon={User} />
  )
  const thing = (t: CastThing, to: string, icon: typeof User) => (
    <Row key={t.id} to={to} name={t.name} imageId={t.imageId} icon={icon} />
  )

  const list = cast.empty ? (
    /*
      Reachable, twice over: a scene need not name anyone, four in five name no
      items, and before the first observer callback no scene is in view at all.
    */
    <p className="px-1.5 py-1 text-xs text-[hsl(var(--muted-foreground))]">
      Nothing recorded for this scene yet.
    </p>
  ) : (
    <>
      {onStage.length > 0 && <Group title="Here">{onStage.map(person)}</Group>}
      {named.length > 0 && <Group title="Spoken of">{named.map(person)}</Group>}
      {cast.location && (
        <Group title="Place">{thing(cast.location, `/worlds/${worldId}/maps`, MapPin)}</Group>
      )}
      {cast.items.length > 0 && (
        <Group title="Things">
          {cast.items.map((i) => thing(i, `/worlds/${worldId}/items/${i.id}`, Package))}
        </Group>
      )}
    </>
  )

  return (
    <>
      {/*
        Beside the page where there is room for it. The reading column is
        centred and capped at `max-w-2xl`, so on a wide screen this takes space
        that was margin.
      */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-l border-[hsl(var(--border))] lg:flex',
          open ? 'w-64' : 'w-10',
        )}
        aria-label="In this scene"
      >
        <div className={cn('flex items-center gap-1 p-1.5', open && 'justify-between')}>
          {open && (
            <span className="pl-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              In this scene
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? 'Hide who is in this scene' : 'Show who is in this scene'}
            className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--foreground))]"
          >
            {open
              ? <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {open && <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">{list}</div>}
      </aside>

      {/*
        A drawer below `lg`, opened from a small floating button.

        Not a fourth control in the reading row: that row already wraps at
        320px, and crowding it is what produced the dangling separator and the
        vanished line-spacing buttons a blind reader run found.
      */}
      <button
        type="button"
        onClick={() => setDrawer(true)}
        aria-label="Show who is in this scene"
        className="fixed bottom-24 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] shadow-md transition-colors hover:text-[hsl(var(--foreground))] lg:hidden"
      >
        <Users className="h-4 w-4" aria-hidden="true" />
      </button>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
          />
          <div
            role="dialog"
            aria-label="In this scene"
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))]"
          >
            <div className="flex items-center justify-between p-1.5">
              <span className="pl-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                In this scene
              </span>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Hide who is in this scene"
                className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">{list}</div>
          </div>
        </div>
      )}
    </>
  )
}
