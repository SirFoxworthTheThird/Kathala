import { useEffect, useMemo, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { PanelRightClose, MapPin, Package, User, Users, X, Eye } from 'lucide-react'
import { PortraitImage } from '@/components/PortraitImage'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useTimelineEvents, useChapters } from '@/db/hooks/useTimeline'
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

const OPEN_KEY = 'kathala-xray-open'

/**
 * The room the page leaves down its right-hand side for the card.
 *
 * `w-72` plus the 12px of padding on each side of it. Constant whether the card
 * is open or shut, which is the point: the reading column is centred in what is
 * left, so a gutter that changed size would move the prose sideways every time
 * the card was toggled.
 *
 * Only from `xl`. At 1280px with the nav rail pinned this leaves 772px for a
 * 672px column and its padding; at `lg` it would squeeze the measure to 516px,
 * so below `xl` the sheet takes over instead.
 */
export const XRAY_GUTTER = 'xl:pr-[19.5rem]'

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
function Row({ to, name, imageId, icon, quiet }: {
  to: string; name: string; imageId: string | null; icon: typeof User
  /** Named by someone on stage rather than present. */
  quiet?: boolean
}) {
  return (
    /*
      No hover highlight on the row.

      It had one, and the row is not a target: the picture opens full size, the
      name is text, and only the eye navigates. A blind reader run clicked the
      name twice expecting the highlight to mean something. A cue that promises
      a click the row does not have is worse than no cue, so the affordance sits
      on the one thing that does navigate.
    */
    <li className="flex items-center gap-2.5 rounded-md p-1.5">
      {/*
        Someone spoken of is drawn back a little, so being present reads at a
        glance rather than by finding which heading a row sits under.
      */}
      <PortraitImage
        imageId={imageId}
        alt=""
        zoomable
        fallbackIcon={icon}
        className={cn('h-10 w-10 shrink-0 rounded-md object-cover', quiet && 'opacity-60 saturate-50')}
        fallbackClassName="h-10 w-10 shrink-0 rounded-md"
      />
      <span className={cn(
        'min-w-0 flex-1 truncate text-sm',
        quiet ? 'italic text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]',
      )}>{name}</span>
      {/*
        An icon with no text of its own, so `aria-label` is the name rather than
        a replacement for one. It says where it goes: "Open" alone, repeated
        down a panel of five, tells a screen reader nothing about which.
      */}
      <Link
        to={to}
        aria-label={`Open ${name}`}
        // p-1.5 rather than p-1: 14px of icon inside 4px of padding is a 22px
        // target, and WCAG 2.5.8 asks for 24. Six gives 26 and costs nothing,
        // since the row is 40px tall for the portrait either way.
        className="shrink-0 rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
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
  const chapters = useChapters(timelineId)
  const characters = useCharacters(worldId)
  const items = useItems(worldId)
  const markers = useAllLocationMarkers(worldId)

  const event = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId])

  /*
    The scene's own name, as the chapter bar writes it. A scene need not have a
    title — the chapter alone is still an answer, and no chapter at all leaves
    the card with just its heading rather than a stray separator.
  */
  const where = useMemo(() => {
    if (!event) return null
    const number = chapters.find((c) => c.id === event.chapterId)?.number
    const parts = [number !== undefined ? `Ch. ${number}` : null, event.title?.trim() || null]
    return parts.filter(Boolean).join(' · ') || null
  }, [event, chapters])

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
      imageId={c.imageId} icon={User} quiet={!c.onStage} />
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
      {/*
        Floating over the page, not beside it.

        As a column in the flex row this took layout width, so showing it slid
        the reading column about 112px to the left — measured at 1440px — and
        hiding it slid the text back. Animating that only made the jump a glide;
        the text still moved, which is the wrong thing to do to someone in the
        middle of a sentence.

        Out of the flow, the prose never moves at all. The cost is that on a
        narrow desktop the card overlaps the text rather than sitting in the
        margin — at 1280px with the nav rail pinned there are only 200px of
        margin against a 288px card — which is what the shadow and the collapse
        control are for. It behaves like a panel laid on the page, and the page
        underneath is exactly where it was.

        The page keeps a gutter for it either way — see `XRAY_GUTTER` — so the
        card never lies across the text. Floating *and* reserving sounds like
        one too many, but they answer different questions: out of the flow means
        the prose cannot move, and the reserved gutter means it cannot be
        covered. Measured with the nav rail pinned at 1280px, a card with no
        gutter behind it sat 76px over the end of every line.

        `pointer-events-none` on the container and `auto` on the card itself, or
        the empty space below the card would swallow clicks and text selection
        down the whole right-hand side of the book.
      */}
      <aside
        className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden p-3 xl:block"
        aria-label="In this scene"
      >
        {/*
          A card, not a rail. This was a full-height column flush to the window
          with a hard border down its left edge, which is the shape of a tool
          panel — wrong beside a page someone is reading. The app's own card is
          `rounded-lg` with a border and `--card` behind it, and this is that,
          floated in the margin the centred reading column already leaves.

          `max-h-full` with the list scrolling inside it, because a scene can
          name seventeen things and the card must not outgrow the window.
        */}
        <div className={cn(
          'pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-lg',
          'border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg',
          'transition-[width] duration-200 ease-out motion-reduce:transition-none',
          open ? 'w-72' : 'w-12',
        )}>
          <div className={cn('flex items-start gap-1 p-2', open ? 'justify-between' : 'justify-center')}>
            {open && (
              <span className="min-w-0 pl-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  In this scene
                </span>
                {/*
                  Which scene. "In this scene" had no antecedent on a card that
                  never named one, and after a few minutes of scrolling that is
                  the first thing you want to know it is keeping up with.
                */}
                {where && (
                  <span className="mt-0.5 block truncate text-xs text-[hsl(var(--foreground))]" title={where}>
                    {where}
                  </span>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={open ? 'Hide who is in this scene' : 'Show who is in this scene'}
              className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
            >
              {/*
                Collapsed, the card is one icon, so it says what is behind it
                rather than only which way it opens.
              */}
              {open
                ? <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                : <Users className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          {open && (
            <div className="min-h-0 overflow-y-auto border-t border-[hsl(var(--border))] p-1.5">
              {list}
            </div>
          )}
        </div>
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
        /*
          Above the chapter bar, which is fixed to the bottom at `z-1000`. The
          button clears it by height today, but a shorter viewport would put it
          underneath — and a control you cannot press is worse than one that is
          not there.
        */
        className="fixed bottom-24 right-3 z-[1001] flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] shadow-md transition-colors hover:text-[hsl(var(--foreground))] xl:hidden"
      >
        <Users className="h-4 w-4" aria-hidden="true" />
      </button>

      {drawer && (
        /*
          The app's dialog layer, not `z-40`. The chapter bar is fixed to the
          bottom at `z-1000`, so a sheet rising from the bottom edge came up
          *behind* it and had its last rows covered — the Place group was cut in
          half at 390px. Same layer as the Library dialog, which is the other
          thing that covers the whole screen.
        */
        <div className="fixed inset-0 z-[2000] xl:hidden">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
          />
          {/*
            A sheet from the bottom, not a drawer from the side.

            The button that opens it is already in the bottom corner, within a
            thumb's reach, and a panel that rises to meet the thumb is the phone
            gesture; a side drawer asks the same hand to cross the screen. It is
            capped at 70vh so the page it is about stays visible above it, and
            the safe-area inset keeps the last row clear of the home indicator.
          */}
          <div
            role="dialog"
            aria-label="In this scene"
            className="absolute inset-x-0 bottom-0 flex max-h-[70vh] flex-col rounded-t-xl border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] pb-[env(safe-area-inset-bottom,0px)] shadow-lg"
          >
            <div className="flex items-start justify-between p-2">
              <span className="min-w-0 pl-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  In this scene
                </span>
                {where && (
                  <span className="mt-0.5 block truncate text-xs text-[hsl(var(--foreground))]">{where}</span>
                )}
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
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-[hsl(var(--border))] p-1.5">{list}</div>
          </div>
        </div>
      )}
    </>
  )
}
