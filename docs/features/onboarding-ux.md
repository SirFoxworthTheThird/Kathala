# Feature: Onboarding & Progressive Disclosure

## Overview

PlotWeave is powerful but dense — a first-time user opening a new world sees 10 nav tabs, an empty dashboard, and no signal about where to start. This feature makes the app intuitive from the first click without removing any functionality. The strategy is **progressive disclosure**: show what matters now, reveal complexity when the user is ready for it.

The work breaks into four independent pillars that can ship in any order.

---

## Pillar 1 — Tiered Navigation

### Problem

The TopBar nav treats "Characters" and "Factions" as peers, "Timeline" and "Arc" as equals. New users are paralysed by choice; the important things don't feel more important than the optional ones.

### Solution

Split the 10 nav items into two visual tiers:

**Core** (always prominent, full-size icons):
- Dashboard · Timeline · Characters · Maps

**Extended** (smaller or grouped, always accessible but visually secondary):
- Items · Lore · Factions · Relations · Arc · Settings

Implementation options in increasing complexity:
1. **Visual separator** — a thin `|` or slight gap between the two groups, no behaviour change. Lowest effort.
2. **Muted styling** — extended items rendered at slightly lower opacity until hovered. Still no behaviour change.
3. **Collapsible "More" group** — extended items hidden behind a `···` button that expands inline. Reduces default nav width significantly.

Recommended: start with option 1 (separator), evaluate whether option 3 is needed based on user feedback.

### Files to touch
- [src/components/TopBar.tsx](../../src/components/TopBar.tsx) — add `tier` field to `navItems` array; apply `cn()` variant based on tier.

---

## Pillar 2 — Empty-World Onboarding Wizard

### Problem

A newly created world shows an empty Dashboard with no guidance. The user doesn't know the time-cursor/snapshot model, doesn't know what to create first, and there's no on-ramp.

### Solution

When a world has **zero events**, replace the Dashboard content with a focused "Start your story" flow. This is not a modal or tooltip tour — it *is* the page for that moment.

#### Steps

```
Step 1 — Create your timeline
         "Every story needs a spine. Give your main timeline a name."
         → Input: timeline name  →  creates Timeline + first Chapter + first Event

Step 2 — Add your first character
         "Who is this story about? Add a character to start tracking their journey."
         → Input: character name, optional description  →  creates Character

Step 3 — Place them at your first event
         "Where is [Name] when your story begins?"
         → Dropdown: pick from existing events  →  creates CharacterSnapshot

Step 4 — Done ✓
         "Your world is ready. Explore the timeline, add a map, or keep adding characters."
         → CTA: "Go to Timeline"  →  normal Dashboard
```

Each step is completable in under 30 seconds. The user can **skip** at any step and access the full interface immediately — no forced flow.

#### Trigger condition

Show the wizard when:
- `timelines.length === 0` OR (`events.length === 0`)

Once any event exists the wizard never reappears (standard dashboard shows instead).

#### Component structure

```
src/features/onboarding/
  OnboardingWizard.tsx      — step controller + step renderers
  steps/
    StepTimeline.tsx        — timeline + chapter + event creation
    StepCharacter.tsx       — character creation
    StepPlace.tsx           — character snapshot placement
    StepDone.tsx            — completion screen
```

#### Files to touch
- [src/features/worlds/WorldDashboard.tsx](../../src/features/worlds/WorldDashboard.tsx) — render `<OnboardingWizard>` when trigger condition is met, normal dashboard otherwise.
- New files under `src/features/onboarding/`.

---

## Pillar 3 — Smart Empty States (per-section)

### Problem

Every section, when it has no data, shows either a blank page or a generic "nothing here yet" message. New users don't know what a section is *for* or whether they need it.

### Solution

Each section's empty state answers three questions:
1. **What is this for?** — one sentence
2. **When would I need it?** — one sentence (optional, for advanced features)
3. **How do I start?** — one primary action button

#### Target copy per section

| Section | Title | Body | Action |
|---------|-------|------|--------|
| **Maps** | "No maps yet" | "Upload an image of your world and place locations on it." | Add Map |
| **Items** | "No items yet" | "Track objects that characters carry, use, or lose over time." | Add Item |
| **Relations** | "No relationships yet" | "Define how characters know and feel about each other." | Add Relationship |
| **Arc** | "Nothing to visualize" | "The Arc view shows character states across every chapter. Add characters and events first." | Go to Timeline |
| **Lore** | "No lore pages yet" | "Document your world's history, rules, and mythology — things that don't change with time." | Add Page |
| **Factions** | "No factions yet" | "Factions are organizations characters can belong to — kingdoms, guilds, cults. Optional, but powerful for political stories." | Add Faction |

The "Optional, but powerful for…" language signals to the user that they don't *have* to use it.

#### Files to touch
- Each feature's roster/view component. Most already use `<EmptyState>` — just update the props.
- [src/features/maps/MapExplorerView.tsx](../../src/features/maps/MapExplorerView.tsx)
- [src/features/items/ItemRosterView.tsx](../../src/features/items/ItemRosterView.tsx)
- [src/features/relationships/RelationshipGraphView.tsx](../../src/features/relationships/RelationshipGraphView.tsx)
- [src/features/arc/CharacterArcView.tsx](../../src/features/arc/CharacterArcView.tsx)
- [src/features/lore/LoreView.tsx](../../src/features/lore/LoreView.tsx)
- [src/features/factions/FactionsView.tsx](../../src/features/factions/FactionsView.tsx)

---

## Pillar 4 — Dashboard as Living Guide

### Problem

The Dashboard shows static world metadata (creation date, world name). It adds no value beyond a loading screen.

### Solution

Make the Dashboard a **contextual suggestion engine** that adapts to the world's current state. As the user builds their world, the suggestions evolve and eventually disappear when everything is filled in.

#### Suggestion cards (show only when condition is true)

| Condition | Card title | Action |
|-----------|-----------|--------|
| No characters | "Add your first character" | → Characters |
| Characters exist but no events | "Add your first event" | → Timeline |
| Events exist but no character placed at any event | "Place a character on the timeline" | → Timeline |
| 2+ characters exist but no relationships | "Define how your characters relate" | → Relations |
| Events exist but no map | "Add a map to track where things happen" | → Maps |
| 5+ events exist but no lore | "Document your world's lore" (dismissible) | → Lore |
| 3+ characters exist but no factions (dismissible) | "Are there organizations in your world?" | → Factions |

Cards marked **dismissible** can be permanently hidden with an × button (stored in localStorage per world).

Below the suggestions: the existing summary stats (character count, event count, chapter count, etc.).

#### Component structure

```
src/features/worlds/WorldDashboard.tsx     — existing file, add suggestion section
src/features/worlds/DashboardSuggestion.tsx — reusable suggestion card component
```

#### Persistence

Dismissed card IDs stored in `localStorage` under key `plotweave-dismissed-suggestions-${worldId}` as a `string[]`.

---

## Implementation Order

1. **Pillar 3 — Smart empty states** — one component per section, no new architecture, highest ROI per hour of effort.
2. **Pillar 4 — Dashboard suggestions** — single file change + one new component, immediately makes the hub useful.
3. **Pillar 2 — Onboarding wizard** — biggest impact on first-run experience, moderate effort (~4 new components).
4. **Pillar 1 — Tiered navigation** — visual polish, tackle last once the flow is proven.

---

## Non-Goals

- No features are removed or hidden permanently.
- No route changes.
- No data model changes.
- No forced tutorial that blocks the user.
- The app remains fully functional with all ten nav sections accessible at all times.
