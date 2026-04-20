import { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store'

// ── Section accordion ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[hsl(var(--border))] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
      >
        {title}
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        }
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-2.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          {children}
        </div>
      )}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-[hsl(var(--foreground))]">{children}</span>
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[hsl(var(--ring)/0.3)] bg-[hsl(var(--accent))] px-3 py-2 text-[hsl(var(--foreground))]">
      <span className="font-semibold">Tip: </span>{children}
    </div>
  )
}

function KbdRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i}>
            <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--foreground))]">{k}</kbd>
            {i < keys.length - 1 && <span className="mx-0.5 text-[hsl(var(--muted-foreground))]">+</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function HelpPanel() {
  const { helpOpen, setHelpOpen } = useAppStore()

  if (!helpOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setHelpOpen(false)}>
      <div
        className="relative flex h-full w-full max-w-sm flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Help</h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto divide-y divide-[hsl(var(--border))]">

          <Section title="Core concept: the time cursor">
            <P>PlotWeave is built around one idea: <B>every entity has a state that changes over time</B>. Time is measured in events, grouped into chapters.</P>
            <P>The <B>timeline bar</B> at the bottom is your time cursor. Click any event dot to set it — everything in the app (character locations, item placements, relationship states) reflects your world at exactly that point in time.</P>
            <P>Changing the active event never modifies your data. It only changes what you're looking at.</P>
            <Tip>Set the time cursor before opening a character or the map to see their state at that moment in the story.</Tip>
          </Section>

          <Section title="Snapshots">
            <P>State changes are stored as <B>snapshot records</B> — explicit saves for a character, item, location, or relationship at a specific event.</P>
            <P>When no snapshot exists yet for an entity at the current event, PlotWeave looks back and shows the <B>last known state</B> — the most recent snapshot before the cursor. This is the delta model: you only record what changes.</P>
            <P>Snapshots are created automatically when you update an entity while an event is active. You can also edit them in the History tab on any character or item.</P>
            <Tip>New chapters inherit all snapshots from the last chapter of the same timeline — you don't need to re-enter everything.</Tip>
          </Section>

          <Section title="Timeline & events">
            <P>A <B>chapter</B> is a named container (e.g. "Chapter 3"). Inside it you add <B>events</B> — individual moments like "The ambush" or "Arrival at the city".</P>
            <P>Events are the true time unit. Move through them with the timeline bar; the chapter segments group them visually.</P>
            <P>You can <B>multi-select events</B> with checkboxes or Shift+click, then bulk-move, bulk-delete, or bulk-tag them. Drag chapter rows to reorder them.</P>
            <P>The <B>Chapter Diff</B> tool (⊕ icon in the timeline bar) compares any two chapters side-by-side — useful for spotting continuity drift.</P>
          </Section>

          <Section title="Characters">
            <P>Each character has five tabs: <B>Overview</B> (bio, aliases, tags), <B>Current State</B> (live snapshot at the active event), <B>History</B> (all past snapshots), <B>Relationships</B>, and <B>Lore</B>.</P>
            <P>Current State shows the character's location, alive status, travel mode, and notes at the active event. Hit <B>Save State</B> to create or update the snapshot.</P>
            <P>The <B>Lore</B> tab lists every lore page that has been linked to this character — click any card to open the page in the lore editor.</P>
            <P>The <B>Arc View</B> (top nav) visualises every character's location journey across the timeline as a colour-coded grid — great for spotting gaps in your tracking.</P>
          </Section>

          <Section title="Relationships">
            <P>Create relationships between any two characters with a type (allies, rivals, family…), sentiment, and strength. Relationships can be <B>bidirectional</B> or directed.</P>
            <P>The <B>Relationship Graph</B> (Relations nav item) shows all relationships as an interactive force-directed network. Drag nodes to rearrange.</P>
            <P>Relationship state also participates in the snapshot model — you can record how a relationship changes at a specific event (e.g. trust breaks down in Chapter 5).</P>
          </Section>

          <Section title="Characters (portraits & colour)">
            <P>Open a character and click the avatar circle to <B>upload a portrait image</B>. Portraits appear on the character card, Arc View, and map pins.</P>
            <P>Each character can have a <B>colour</B> — set it in the Overview tab. The colour is used in the Arc View grid and for the character's movement trail on the map.</P>
            <P>The <B>Current State</B> tab has an <B>inventory notes</B> field alongside location and alive status — use it to jot down what a character is carrying at that event.</P>
          </Section>

          <Section title="Items">
            <P>Items live in the <B>Items</B> nav section. Each item can have a description, tags, and an image.</P>
            <P>Place an item at a map location for a specific event using the <B>item placement</B> system — useful for tracking props, artefacts, or loot.</P>
            <P>The <B>History</B> tab on an item shows its condition and notes across all events, following the same snapshot/delta model as characters.</P>
            <P>A <B>Related Lore</B> section appears below the item description listing any lore pages linked to that item.</P>
            <P>Items that travel between timelines are tracked as <B>cross-timeline artifacts</B> — link them from the Timeline Relationships panel.</P>
          </Section>

          <Section title="Maps">
            <P>Upload any image as a map layer. Add <B>location markers</B> by clicking the canvas, then drag characters onto locations to place them.</P>
            <P>Location markers can link to a <B>sub-map</B> (another map layer) — click the ⤵ badge to drill in. The back button returns you up the hierarchy.</P>
            <P><B>Routes</B> draw persistent paths between locations (road, river, trail, sea route, border, custom). <B>Regions</B> draw filled polygons with per-event status (active, occupied, destroyed…).</P>
            <P><B>Annotations</B> place free-text labels directly on the canvas — click the T button in the map header, then click anywhere on the map.</P>
            <P>The <B>filter bar</B> toggles journey trails, character labels, sub-map links, and label-density mode. Use the character filter to focus on one character at a time.</P>
            <Tip>Right-click the map canvas for quick actions: add location, add label, start a route or region from that point.</Tip>
          </Section>

          <Section title="Map scale & measurement">
            <P>Calibrate a map by clicking the <B>ruler icon</B> and selecting two known points. Enter the real-world distance between them to set the scale unit (km, miles, leagues…).</P>
            <P>Once calibrated, use the <B>measure tool</B> (ruler) to draw a line between any two points and read off the distance. Travel-time estimates in the Continuity checker also use this scale.</P>
            <P>Travel modes (set in <B>World Settings</B>) define speed in scale-units per in-world day, enabling realistic travel-time validation.</P>
          </Section>

          <Section title="Map AI dialog">
            <P>Click the <B>Sparkles ✦</B> button in the map header to open the Map AI dialog. Paste a passage of travel narrative and the AI extracts character→location assignments per event and previews them before applying.</P>
            <P>This mirrors the Chapter AI dialog in the Timeline — both send your world's existing data as context so the AI only references locations and characters that actually exist.</P>
          </Section>

          <Section title="Character film strip">
            <P>Click a character pin on the map to open the <B>film strip</B> — a horizontal bar at the bottom showing every location that character visited, in order.</P>
            <P>Click any stop in the film strip to jump to that event in the timeline. Useful for quickly reviewing a character's journey without leaving the map.</P>
          </Section>

          <Section title="Playback">
            <P>Hit the <B>▶ Play</B> button in the timeline bar to animate character movement across the map event by event.</P>
            <P>Characters move along route geometry when a matching route exists between their previous and current location. Otherwise they travel in a straight line.</P>
            <P>When a character crosses into a sub-map, the camera zooms out, switches layers, then zooms back in on the new map.</P>
            <P>During playback a <B>story notes overlay</B> shows the chapter title, synopsis, and character status notes for the current event.</P>
            <P>Speed can be set to Slow, Normal, or Fast. Playback always navigates to the Maps view.</P>
          </Section>

          <Section title="Timeline & chapter AI">
            <P>The <B>AI button</B> (✦ sparkles) on any chapter in the Timeline view opens the Chapter AI dialog. Paste a passage of prose and the AI generates a list of events, character snapshots, and relationship updates — with a review step before anything is saved.</P>
            <P>The AI uses your world's existing characters, locations, and items as context, so it only references things that actually exist.</P>
            <Tip>The review step lets you accept, adjust, or discard each suggested snapshot individually before committing.</Tip>
          </Section>

          <Section title="Arc view">
            <P>The <B>Arc</B> nav item shows a grid of every character's location journey across all events — one row per character, one column per event, coloured by location.</P>
            <P>Each cell is clickable: click a cell to jump to that character at that event. Hover for a tooltip with location name and notes.</P>
            <P>The <B>inventory sparkline</B> in each row shows the number of item placements that character has over time — a quick visual indicator of inventory activity.</P>
            <P>Use the <B>search box</B> to filter character rows by name, and the <B>timeline selector</B> to focus on a single timeline.</P>
            <P>Click <B>Export</B> (download icon) to save the arc grid as a PNG image.</P>
          </Section>

          <Section title="World settings">
            <P><B>Themes</B> — each world can have its own visual theme (Fantasy, Sci-Fi, Horror, Cyberpunk, and more), set in World Settings → Theme. Overrides the global app default just for that world.</P>
            <P><B>Travel modes</B> — define movement types (on foot, horse, sailing…) with a speed in scale-units per in-world day. Travel modes are used by the Continuity checker to validate whether a character could realistically cover a distance between two events.</P>
            <P>Travel mode requires the map to be <B>calibrated</B> with a scale (see Map scale & measurement).</P>
          </Section>

          <Section title="Timeline relationships">
            <P>Multiple timelines can be <B>linked</B> — useful for frame narratives, alternate histories, or embedded stories-within-stories.</P>
            <P>Relationship types: <B>Frame narrative</B> (outer/inner story), <B>Historical echo</B> (events repeat across eras), <B>Embedded fiction</B> (story-within-story), <B>Alternate timeline</B> (diverging branch).</P>
            <P>On the map, frame-narrative links render <B>ghost pins</B> showing where characters are in the outer timeline. Historical echo links render <B>echo rings</B> at shared locations.</P>
            <P><B>Cross-timeline artifacts</B> track items that move between timelines — find them in the Timeline Relationships panel.</P>
          </Section>

          <Section title="Continuity checker">
            <P>The <B>Continuity</B> button (shield icon) runs a set of checks across your world and flags potential problems.</P>
            <P>Current checks: character at a destroyed location, character inside an occupied/destroyed region, item used before it was acquired, travel time exceeding realistic limits, and route traversal through impassable regions.</P>
            <P>Click any issue to navigate to it. Issues can be individually <B>suppressed</B> if they're intentional.</P>
          </Section>

          <Section title="Writer's Brief">
            <P>The <B>Brief</B> panel (scroll icon) is a live summary of the active event: which characters are present, their states, active relationships, item placements, and relevant lore.</P>
            <P>The <B>Lore</B> section in the brief shows pages that are linked to any character present at the current event, plus any page whose <B>revealed at</B> event matches the current one (marked <B>NEW</B>). Click a lore card to open it.</P>
            <P>It updates automatically as you move through events. Use it as a quick reference while writing.</P>
          </Section>

          <Section title="Lore">
            <P>The <B>Lore</B> section (bookmark icon) is a wiki-style knowledge base for your world — magic systems, history, factions, languages, anything that doesn't belong in the timeline.</P>
            <P>Organise pages into colour-coded <B>categories</B> using the sidebar. Pages without a category appear under <B>Uncategorised</B>.</P>
            <P>Each page has a <B>markdown editor</B> with preview toggle, a tag bar, and two connection controls in the toolbar:</P>
            <P><B>Revealed at</B> (clock icon) — pick the exact event when this lore is revealed in the story. The <B>Revealed</B> filter toggle on the Lore index then hides pages not yet revealed at the active event.</P>
            <P><B>Link entities</B> (chain icon) — associate the page with any characters, items, or location markers. Linked pages appear in the <B>Lore tab</B> on the character/item detail page, and in the <B>Writer's Brief</B> when those characters are present.</P>
            <Tip>Use the Revealed filter while writing to see only what your characters know so far — keeps you from accidentally referencing unrevealed lore.</Tip>
          </Section>

          <Section title="Search">
            <P>Press <B>Ctrl+K</B> (or <B>⌘K</B> on Mac) to open the search palette. It searches across characters, items, locations, events, chapters, routes, regions, and lore pages.</P>
            <P>Selecting a result navigates to that entity and, for events, sets the time cursor to that event.</P>
          </Section>

          <Section title="Folder sync & export">
            <P><B>Folder sync</B> (in World Settings → Folder Sync) links your world to a folder on your computer. Use <B>Save</B> to write a <code>.pwk</code> backup and <B>Load</B> to restore or merge from one.</P>
            <P>Load offers two modes: <B>Smart merge</B> (newer record wins per entity — safe for sharing edits) and <B>Replace all</B> (full overwrite).</P>
            <P><B>Export as HTML</B> generates a self-contained, shareable snapshot of your world — characters, timeline, locations, items, and relationships — readable in any browser with no app required.</P>
          </Section>

          <Section title="Keyboard shortcuts">
            <div className="space-y-2">
              <KbdRow keys={['Ctrl', 'K']} label="Open search" />
              <KbdRow keys={['Shift', 'Click']} label="Range-select events in timeline" />
              <KbdRow keys={['Esc']} label="Close panel or dialog" />
              <KbdRow keys={['↑', '↓']} label="Navigate search results / continuity issues" />
              <KbdRow keys={['Enter']} label="Confirm selection in search / continuity" />
              <KbdRow keys={['Enter']} label="Save inline edits (name, description fields)" />
              <KbdRow keys={['Esc']} label="Cancel inline edits" />
            </div>
          </Section>

        </div>
      </div>
    </div>
  )
}
