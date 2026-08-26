import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store'
import { useGate } from '@/db/hooks/ReadingGateContext'

// ── Section accordion ─────────────────────────────────────────────────────────

/**
 * `writerOnly` sections describe screens and tools that reading mode removes —
 * the manuscript, the corkboard, the AI generators, the continuity checker.
 * Offering a reader instructions for a Corkboard their nav does not have is
 * worse than offering nothing: it reads as a missing feature rather than an
 * absent one.
 */
function Section({ title, writerOnly, readerOnly, children }: {
  title: string
  writerOnly?: boolean
  /**
   * The mirror of `writerOnly`, and it existed only in one direction. Twenty-nine
   * sections, five of them hidden while reading, and not one about reading — so
   * a reader wondering what the ✕ beside their place does had twenty-four wrong
   * answers to choose from and no right one.
   */
  readerOnly?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const gate = useGate()
  if (writerOnly && gate.active) return null
  if (readerOnly && !gate.active) return null
  return (
    <div className="border-b border-[hsl(var(--border))] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
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

  // Escape closes this like every other overlay. It is a hand-rolled panel
  // rather than the shared Dialog, which is why it never had a handler — and
  // because it covers the screen, the missing one left the page unclickable
  // for anyone who expected the key to work.
  useEffect(() => {
    if (!helpOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelpOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [helpOpen, setHelpOpen])

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
            aria-label="Close help"
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto divide-y divide-[hsl(var(--border))]">

          <Section title="Reading a book" readerOnly>
            <P>This world is a companion to a book you are reading. It shows you only what the story has introduced by the point you have reached, so you can look something up without being told what happens next.</P>
            <P><B>Your place</B> is the chapter and scene named in the top bar. Set it with <B>Read to here</B> on a chapter row in the Timeline — the notice on the dashboard links straight there — and nudge it a scene at a time with the <B>‹</B> and <B>›</B> arrows beside it. Looking at something does not move it: opening a scene, a search result or a character's history shows it to you and leaves your place alone.</P>
            <P>The <B>✕</B> beside your place drops back to the whole world — every character, place and subplot, including the ones you have not met. It asks first, because that is not usually what you want in the middle of a book. There is one in the chapter bar along the bottom too, and it does the same thing and asks the same question.</P>
            <P><B>What is hidden</B> is counted for you on the dashboard, so you can tell the difference between a world with nothing in it and a world holding things back. A chapter you have not reached does not open, and its summary stays closed, though its title stays visible because that is printed on your own contents page.</P>
            <P><B>Knowledge</B> is the screen worth knowing about: it answers who else knows a given secret, and by which chapter they learned it — a question the book itself cannot answer without a re-read.</P>
            <P>To use this world as a writer instead — to edit it, or to see all of it at once — turn reading mode off in <B>World settings</B>.</P>
          </Section>

          <Section title="Getting started">
            <P>The world selector is your library. Create a blank world, <B>Import Manuscript</B> from Markdown or plain text, <B>Generate World from AI</B> from a synopsis, or import a PlotWeave <code>.pwk</code> backup (plus its optional <code>.pwb</code> images file).</P>
            <P>A blank world opens a short setup guide for creating a timeline and opening scene, adding a main character, and placing them at the story's starting point. Every optional step can be skipped.</P>
            <P>Use a world's menu to export it or <B>Start a sequel</B>. A sequel can carry selected characters, factions, items, maps, relationships, and lore into a new independent world.</P>
          </Section>

          <Section title="Dashboard & story planning" writerOnly>
            <P>The <B>Dashboard</B> summarises your project and links to its timeline, cast, maps, relationships, items, snapshot coverage, continuity results, recent scenes, and writing progress.</P>
            <P><B>Cast Balance</B> shows how evenly characters appear. <B>Plot Threads</B> tracks which scenes advance each storyline, while <B>Motifs & Themes</B> tracks recurring symbols and ideas. Create threads and motifs on the Dashboard, then attach them to scenes.</P>
            <P>Writing Progress records daily word-count changes from scene prose and compares the manuscript with the word target set in World Settings.</P>
          </Section>

          <Section title="Core concept: the time cursor">
            <P>PlotWeave is built around one idea: <B>every entity has a state that changes over time</B>. Time is measured in scenes, grouped into chapters.</P>
            <P>The scene selector beside the world name and the <B>timeline bar</B> at the bottom are two views of the same time cursor. Choose a scene in either one and the app shows character locations, item placements, relationship states, and other time-aware data at exactly that moment.</P>
            <P>Changing the active scene never modifies your data. It only changes what you're looking at.</P>
            <Tip>Set the time cursor before opening a character or the map to see their state at that moment in the story.</Tip>
          </Section>

          <Section title="Snapshots" writerOnly>
            <P>State changes are stored as <B>snapshot records</B> — explicit saves for a character, item, location, or relationship at a specific scene.</P>
            <P>When no snapshot exists yet for an entity at the current scene, PlotWeave looks back and shows the <B>last known state</B> — the most recent snapshot before the cursor. This is the delta model: you only record what changes.</P>
            <P>Use <B>Save State</B> while a scene is active to create or update a snapshot. Character and item History views show the saved record across story time.</P>
            <Tip>A new chapter starts from the ending state of the preceding chapter on the same timeline, so you only need to record later changes.</Tip>
          </Section>

          <Section title="Timeline & scenes">
            <P>A <B>chapter</B> is a named container (e.g. "Chapter 3"). Inside it you add <B>scenes</B> — individual moments like "The ambush" or "Arrival at the city".</P>
            <P>Scenes are the true time unit. Move through them with the timeline bar; the chapter segments group them visually. Switch between <B>Narrative</B> reading order and <B>Chronological</B> in-world order to expose flashbacks and flash-forwards.</P>
            <P>You can <B>multi-select scenes</B> with checkboxes or Shift+click, then bulk-move, bulk-delete, or bulk-tag them. Drag chapter rows to reorder them.</P>
            <P>Create additional timelines for frame narratives or alternate histories. Linked two-timeline worlds display two stacked tracks in the bottom cursor; click either track to make it active.</P>
            <P>The <B>Compare chapters</B> tool in the timeline bar shows what changed between two story points — useful for spotting continuity drift.</P>
          </Section>

          <Section title="Corkboard & manuscript" writerOnly>
            <P>The <B>Corkboard</B> displays scenes as index cards grouped by chapter. Drag cards to reorder or move scenes, change their Idea-to-Final status, and click a title to open that scene.</P>
            <P>The <B>Manuscript</B> stitches scene prose together in reading order. Draft mode shows scene controls and word goals; Reading mode hides the scaffolding for a clean read-through.</P>
            <P>Use <B>Find & Replace</B> across every scene, inspect and restore a scene's revision <B>History</B>, or export the manuscript as Markdown, HTML, plain text, Word, or EPUB.</P>
          </Section>

          <Section title="Characters">
            <P>Each character has seven tabs: <B>Overview</B>, <B>Current State</B>, <B>History</B>, <B>Appearances</B>, <B>Relationships</B>, <B>Lore</B>, and <B>Factions</B>.</P>
            <P>Current State shows the character's location, alive status, travel mode, and notes at the active scene. Hit <B>Save State</B> to create or update the snapshot.</P>
            <P>Click the avatar to upload a portrait and choose a colour for Arc cells and map journeys. When a world calendar is enabled, Overview can also store a birth date so Writer's Brief can show the character's age.</P>
            <P>Appearances collects scenes where the character is present, mentioned, or used as POV. Lore and Factions show linked reference pages and time-aware memberships.</P>
            <P><B>Generate with AI</B> adds or updates characters by name, so you can build the cast in batches without duplicates.</P>
            <P>The <B>Arc View</B> (top nav) visualises every character's location journey across the timeline as a colour-coded grid — great for spotting gaps in your tracking.</P>
          </Section>

          <Section title="Relationships">
            <P>Create relationships between any two characters with a type (allies, rivals, family…), sentiment, and strength. Relationships can be <B>bidirectional</B> or directed.</P>
            <P>The <B>Relationship Graph</B> (Relations nav item) shows all relationships as an interactive force-directed network. Drag nodes to rearrange.</P>
            <P>Relationship state also participates in the snapshot model — you can record how a relationship changes at a specific scene (e.g. trust breaks down in Chapter 5).</P>
            <P><B>Generate with AI</B> can add relationships and their scene-based changes in bulk, matching both endpoints to characters that already exist.</P>
          </Section>

          <Section title="Items">
            <P>Items live in the <B>Items</B> nav section. Each item can have a description, tags, and an image.</P>
            <P>Place an item at a map location for a specific scene using the <B>item placement</B> system — useful for tracking props, artefacts, or loot.</P>
            <P>The <B>History</B> tab on an item shows its condition and notes across all scenes, following the same snapshot/delta model as characters.</P>
            <P>A <B>Related Lore</B> section appears below the item description listing any lore pages linked to that item.</P>
            <P>Items that travel between timelines are tracked as <B>cross-timeline artifacts</B> — link them from the Timeline Relationships panel.</P>
            <P><B>Generate with AI</B> adds or updates a batch of items by name without creating duplicates.</P>
          </Section>

          <Section title="Maps">
            <P>Upload any image as a map layer. Add <B>location markers</B> by clicking the canvas, then drag characters onto locations to place them.</P>
            <P>Location markers can link to a <B>sub-map</B> (another map layer) — click the ⤵ badge to drill in. The back button returns you up the hierarchy.</P>
            <P>Use <B>Replace image</B> to swap a map's background while optionally scaling existing locations, routes, regions, and calibration to the new image size.</P>
            <P><B>Routes</B> draw persistent paths between locations (road, river, trail, sea route, border, custom). <B>Regions</B> draw filled polygons with per-scene status (active, occupied, destroyed…).</P>
            <P><B>Annotations</B> place free-text labels directly on the canvas — click the T button in the map header, then click anywhere on the map.</P>
            <P>The <B>filter bar</B> toggles journey trails, character labels, sub-map links, and label-density mode. Use the character filter to focus on one character at a time.</P>
            <Tip>Right-click the map canvas for quick actions: add location, add label, start a route or region from that point.</Tip>
          </Section>

          <Section title="Map scale & measurement">
            <P>Calibrate a map by clicking the <B>ruler icon</B> and selecting two known points. Enter the real-world distance between them to set the scale unit (km, miles, leagues…).</P>
            <P>Once calibrated, use the <B>measure tool</B> (ruler) to draw a line between any two points and read off the distance. Travel-time estimates in the Continuity checker also use this scale.</P>
            <P>Travel modes (set in <B>World Settings</B>) define speed in scale-units per in-world day, enabling realistic travel-time validation.</P>
          </Section>

          <Section title="Map levels">
            <P>Use <B>Add level</B> for floors of the same place, such as a dungeon, ground floor, upper floor, and tower. The floor switcher changes levels while preserving pan and zoom so aligned rooms stay in view.</P>
            <P>Every floor is a full map with its own locations, routes, and regions. Levels can sit inside sub-maps: drill into a castle from its grounds, then switch between the castle's floors.</P>
            <P>Characters move between floors by changing to a location on another level at a later scene. Parent maps still show them at the building's marker.</P>
          </Section>

          <Section title="Map AI tools" writerOnly>
            <P><B>AI Locations</B> creates or extends a nested tree of places, sub-maps, and optional floor levels. Existing places are matched by name, so re-running it adds detail without duplicates.</P>
            <P><B>AI Moves</B> takes a passage of travel narrative, extracts character-to-location assignments per scene, and previews them before applying. It only references existing characters and locations.</P>
          </Section>

          <Section title="Character film strip">
            <P>Click a character pin on the map to open the <B>film strip</B> — a horizontal bar at the bottom showing every location that character visited, in order.</P>
            <P>Click any stop in the film strip to jump to that scene in the timeline. Useful for quickly reviewing a character's journey without leaving the map.</P>
          </Section>

          <Section title="Playback">
            <P>Hit the <B>▶ Play</B> button in the timeline bar to animate character movement across the map scene by scene.</P>
            <P>Characters move along route geometry when a matching route exists between their previous and current location. Otherwise they travel in a straight line.</P>
            <P>When a character crosses into a sub-map, the camera zooms out, switches layers, then zooms back in on the new map.</P>
            <P>During playback a <B>story notes overlay</B> shows the chapter title, synopsis, and character status notes for the current scene.</P>
            <P>Speed can be set to Slow, Normal, or Fast. Playback always navigates to the Maps view.</P>
          </Section>

          <Section title="Timeline & chapter AI" writerOnly>
            <P>Use <B>Generate with AI</B> from the Timeline or open a chapter to generate or update it. Paste a passage of prose and the AI proposes scenes, character snapshots, relationship updates, and dramatic-tension ratings — with a review step before anything is saved.</P>
            <P>The AI uses your world's existing characters, locations, and items as context, so it only references things that actually exist.</P>
            <Tip>The review step lets you accept, adjust, or discard each suggested snapshot individually before committing.</Tip>
          </Section>

          <Section title="Arc view">
            <P>The <B>Arc</B> nav item shows a grid across story time. Choose <B>Characters</B> or <B>Factions</B> for rows and <B>Chapters</B> or <B>Scenes</B> for columns.</P>
            <P>Character cells show status, location, notes, and inherited state; faction cells show active membership. Click a column to move the time cursor and hover for details.</P>
            <P>The <B>inventory sparkline</B> in each row shows the number of item placements that character has over time — a quick visual indicator of inventory activity.</P>
            <P>Use search and timeline filters to focus the grid. Factions, scene Status, and POV overlays add extra colour cues.</P>
            <P>Click <B>Export</B> (download icon) to save the arc grid as a PNG image.</P>
          </Section>

          <Section title="World settings" writerOnly>
            <P><B>Themes</B> — each world can have its own visual theme (Fantasy, Sci-Fi, Horror, Cyberpunk, and more), set in World Settings → Theme. Overrides the global app default just for that world.</P>
            <P><B>Travel modes</B> — define movement types (on foot, horse, sailing…) with a speed in scale-units per in-world day. Travel modes are used by the Continuity checker to validate whether a character could realistically cover a distance between two scenes.</P>
            <P>Settings also holds the world name and cover, manuscript word target, continuity sensitivity, calendar, export tools, database health, and folder sync. Travel-time checks require a map calibrated with a scale.</P>
          </Section>

          <Section title="Timeline relationships" writerOnly>
            <P>Multiple timelines can be <B>linked</B> — useful for frame narratives, alternate histories, or embedded stories-within-stories.</P>
            <P>Relationship types: <B>Frame narrative</B> (outer/inner story), <B>Historical echo</B> (scenes repeat across eras), <B>Embedded fiction</B> (story-within-story), <B>Alternate timeline</B> (diverging branch).</P>
            <P>Add character, location, or document anchors. Frame narratives can also pair inner and outer scenes with <B>sync points</B> so playback keeps the framing moment aligned.</P>
            <P>On the map, frame-narrative links render <B>ghost pins</B> showing where characters are in the outer timeline. Historical echo links render <B>echo rings</B> at shared locations.</P>
            <P><B>Cross-timeline artifacts</B> track items that move between timelines — find them in the Timeline Relationships panel.</P>
          </Section>

          <Section title="Continuity checker" writerOnly>
            <P>The <B>Continuity</B> button (shield icon) runs a set of checks across your world and flags potential problems.</P>
            <P>Checks include characters alive after dying or present while dead, appearances before a first snapshot, impossible travel, destroyed locations and regions, item use or handoff problems, invalid relationship or faction timing, and unavailable POV characters.</P>
            <P>Click any issue to navigate to it. Intentional findings can be <B>suppressed</B> with a reason, reviewed later, and restored.</P>
          </Section>

          <Section title="Writer's Brief" writerOnly>
            <P>The <B>Brief</B> panel (scroll icon) is a live summary of the active scene: its chapter and in-world date, nearby scenes, present characters and their states, active relationships, item placements, and relevant lore.</P>
            <P>Carried-forward character states are labelled. If the world has a calendar and a character has a birth date, the brief also shows their age at the selected scene.</P>
            <P>The <B>Lore</B> section in the brief shows pages that are linked to any character present at the current scene, plus any page whose <B>revealed at</B> scene matches the current one (marked <B>NEW</B>). Click a lore card to open it.</P>
            <P>It updates automatically as you move through scenes. Use it as a quick reference while writing.</P>
          </Section>

          <Section title="Factions">
            <P>The <B>Factions</B> nav item (shield icon) lets you group characters by allegiance, organisation, or any other affiliation.</P>
            <P>Create a faction with a name, description, and colour. Then add <B>members</B> — each membership can record a role (e.g. Leader, Spy), a start scene, an end scene, and notes. Use start/end scenes to model characters who join or leave over time.</P>
            <P>Record allied, hostile, or other <B>faction-to-faction stances</B>. <B>Generate with AI</B> can add or update factions and merge memberships for characters that already exist.</P>
            <P>Faction membership is visible in the <B>Factions tab</B> on any character's detail page. From there you can also navigate directly to the faction.</P>
            <P><B>Owning faction</B> can be set on both <B>map regions</B> and <B>location markers</B> — open the side panel for a region or location and pick a faction from the dropdown.</P>
            <P>The <B>Territories</B> section on a faction's detail panel lists all regions and locations currently assigned to that faction.</P>
            <P>Enable the <B>Factions overlay</B> in the Relationship Graph (top-right toggle) to colour character nodes by their faction and see a legend. The same overlay is available in the <B>Arc View</B> — it adds a colour bar at the top of each cell.</P>
            <Tip>Set start and end scenes on memberships to track shifting allegiances without losing the historical record.</Tip>
          </Section>

          <Section title="Lore">
            <P>The <B>Lore</B> section (bookmark icon) is a wiki-style knowledge base for your world — magic systems, history, factions, languages, anything that doesn't belong in the timeline.</P>
            <P>Organise pages into colour-coded <B>categories</B> using the sidebar. Pages without a category appear under <B>Uncategorised</B>.</P>
            <P>Each page has a <B>markdown editor</B> with preview toggle, a tag bar, and two connection controls in the toolbar:</P>
            <P><B>Revealed at</B> (clock icon) — pick the exact scene when this lore is revealed in the story. The <B>Revealed</B> filter toggle on the Lore index then hides pages not yet revealed at the active scene.</P>
            <P><B>Link entities</B> (chain icon) — associate the page with any characters, items, or location markers. Linked pages appear in the <B>Lore tab</B> on the character/item detail page, and in the <B>Writer's Brief</B> when those characters are present.</P>
            <P><B>Generate with AI</B> adds or updates pages by title and creates their named categories automatically.</P>
            <Tip>Use the Revealed filter while writing to see only what your characters know so far — keeps you from accidentally referencing unrevealed lore.</Tip>
          </Section>

          <Section title="Knowledge">
            <P>The <B>Knowledge</B> tracker records facts, when the reader learns them, and which characters discover them at which scenes — useful for mysteries, secrets, and dramatic irony.</P>
            <P>After one character learns a fact, <B>Might also know</B> suggests characters who later shared a scene with someone who knew it. Accept only the reveals that actually happened.</P>
            <P><B>Generate with AI</B> can add facts and reveals in bulk, matching character names and scene titles that already exist.</P>
          </Section>

          <Section title="Calendar & character ages">
            <P>Enable a calendar in World Settings to turn in-world day numbers into named months, dates, years, and an optional era suffix. Scenes normally advance by elapsed travel days, but can also have an explicit date.</P>
            <P>The <B>Calendar</B> nav view lays scenes onto month grids. Click a scene to open it, or drag it to another day to pin its in-world date for fixed dates, flashbacks, or flash-forwards.</P>
            <P>Add a birth date in a character's Overview tab to calculate their age at the active scene in Writer's Brief.</P>
          </Section>

          <Section title="Search">
            <P>Press <B>Ctrl+K</B> (or <B>⌘K</B> on Mac) to search characters, factions, items, locations, chapters, scenes, timelines, relationships, routes, regions, and lore pages.</P>
            <P>Selecting a result navigates to that entity. Scenes set the time cursor, and locations focus their map marker.</P>
          </Section>

          <Section title="Database health" writerOnly>
            <P>World Settings can <B>Scan for orphans</B>: old snapshots, memberships, or map references whose parent no longer exists, often left by older imports or deleted data.</P>
            <P><B>Clean up</B> removes only the orphaned records listed by the scan; valid world data is left untouched.</P>
          </Section>

          <Section title="Folder sync & export" writerOnly>
            <P><B>Folder sync</B> (in World Settings → Folder Sync) links your world to a folder on your computer. Use <B>Save</B> to write a <code>.pwk</code> backup and <B>Load</B> to restore or merge from one.</P>
            <P>Load offers two modes: <B>Smart merge</B> (newer record wins per entity — safe for sharing edits) and <B>Replace all</B> (full overwrite).</P>
            <P><B>Export as HTML</B> generates a self-contained, shareable snapshot of your world — characters, timeline, locations, items, and relationships — readable in any browser with no app required.</P>
            <P>The world-card menu exports a complete <code>.pwk</code>, or split data and images into <code>.pwk</code> + <code>.pwb</code> files. Import both files together when restoring a split backup.</P>
          </Section>

          <Section title="Keyboard shortcuts">
            <div className="space-y-2">
              <KbdRow keys={['Ctrl', 'K']} label="Open search" />
              <KbdRow keys={['Shift', 'Click']} label="Range-select scenes in timeline" />
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
