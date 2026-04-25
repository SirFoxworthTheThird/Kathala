# Architecture: Onboarding & Progressive Disclosure

**Input document:** `docs/features/onboarding-ux.md`  
**Architect:** Software Architect persona  
**Date:** 2026-04-25

---

## 1. Scope

This document covers the system design for the four pillars defined in the product requirements:

1. Tiered Navigation
2. Empty-World Onboarding Wizard
3. Smart Empty States
4. Dashboard as Living Guide

No new backend, no new database tables, no new routes.

---

## 2. Non-Functional Requirements

| ID | Requirement | Rationale |
|----|-------------|-----------|
| NFR-01 | Wizard and suggestion conditions must evaluate in < 50 ms | Derived from live Dexie queries; must not block paint |
| NFR-02 | Dismissed suggestions persist across sessions and app restarts | LocalStorage is the persistence layer; no server dependency |
| NFR-03 | Dismissal state is scoped per world | Two worlds must have independent dismissed-card sets |
| NFR-04 | All ten nav items remain keyboard-accessible at all times | No item may be reachable only by mouse |
| NFR-05 | Wizard must not create orphaned records on skip | If the user skips mid-flow, already-created records remain but no broken references |
| NFR-06 | Wizard is idempotent with respect to trigger condition | Re-evaluates on every Dashboard mount; no separate "seen" flag |
| NFR-07 | Empty state copy is the exact strings defined in the AC | Copy is product copy, not developer copy; must not drift |
| NFR-08 | Suggestion cap is exactly 3 cards | Never render more than 3, even when more conditions are true |

---

## 3. Architecture per Pillar

---

### 3.1 Pillar 1 — Tiered Navigation

#### Design Pattern
**Data-driven configuration.** The nav item list is already an array of objects in `TopBar.tsx`. Extend each object with a `tier` discriminator field. The render loop applies a CSS variant based on tier — no conditional JSX branching.

#### Component Interface

```ts
type NavTier = 'core' | 'extended'

interface NavItem {
  // ... existing fields (id, label, icon, path, etc.)
  tier: NavTier
}
```

#### Behaviour Spec

| Tier | Members | Visual treatment |
|------|---------|-----------------|
| `core` | Dashboard, Timeline, Characters, Maps | Full-size, full-opacity — developer's choice of exact implementation |
| `extended` | Items, Lore, Factions, Relations, Arc, Settings | Visually subordinate — developer's choice of separator / muted opacity / collapsible group |

The specific implementation option (separator, muted, collapsible) is left to the developer per the product requirements. The architecture requires only that:
- The `tier` field drives all visual differences declaratively.
- No item is conditionally excluded from the DOM.
- Tab order is preserved (core items first, then extended).

#### Files

| File | Change |
|------|--------|
| `src/components/TopBar.tsx` | Add `tier` to `navItems` array; apply `cn()` variant class based on `tier` |

---

### 3.2 Pillar 2 — Empty-World Onboarding Wizard

#### Design Pattern
**Linear finite state machine.** The wizard is a step controller with a single direction of travel (forward) and an escape hatch (skip). Each step is an independent component that receives callbacks and owns its own form state.

#### Trigger Condition

Evaluated on every Dashboard mount via live queries:

```
show wizard = timelines.length === 0 OR events.length === 0
```

This is derived purely from DB state. No separate "wizard seen" flag is stored. If the user later deletes all events, the wizard reappears — this is the intended behavior (the world is genuinely empty again).

> **ADR-001 — Wizard dismissal guard**  
> *Decision:* Rely solely on the DB trigger condition rather than storing a `wizardCompleted` flag in localStorage.  
> *Rationale:* Simpler, consistent with the AC which ties dismissal to event existence, and aligns with the local-first principle (DB state is truth). A world with no events *is* an empty world.  
> *Known behavior:* Deleting the last event causes the wizard to reappear. This is acceptable — the world is again in an empty state.

#### Component Tree

```
WorldDashboard.tsx
  └─ <OnboardingWizard worldId={worldId} />          ← shown when trigger is true
       ├─ <StepTimeline />                             ← step 1
       ├─ <StepCharacter />                            ← step 2
       ├─ <StepPlace characterId createdEventId />     ← step 3
       └─ <StepDone />                                 ← step 4
```

#### Ephemeral State

The wizard step and inter-step data live in local component state inside `OnboardingWizard`. They are not persisted — if the user refreshes mid-wizard, the wizard restarts from step 1 (the world still has no events).

```ts
type WizardStep = 1 | 2 | 3 | 4

interface WizardState {
  step: WizardStep
  createdEventId: string | null      // produced by step 1, consumed by step 3
  createdCharacterId: string | null  // produced by step 2, consumed by step 3
}
```

#### Component Interfaces

```ts
interface OnboardingWizardProps {
  worldId: string
}

interface StepTimelineProps {
  worldId: string
  onComplete: (eventId: string) => void
  onSkip: () => void
}

interface StepCharacterProps {
  worldId: string
  onComplete: (characterId: string) => void
  onSkip: () => void
}

interface StepPlaceProps {
  worldId: string
  characterId: string           // null-safe: if user skipped step 2, step 3 is skipped automatically
  createdEventId: string | null // pre-selects the event dropdown
  onComplete: () => void
  onSkip: () => void
}

interface StepDoneProps {
  onNavigate: () => void  // navigates to Timeline view
}
```

#### Skip Semantics

- Skip on **Step 1**: no records created. Navigate directly to standard Dashboard. (No `createdEventId` → trigger condition remains true → wizard shown on next visit until an event is created elsewhere.)
- Skip on **Step 2**: no Character created. Skip Step 3 as well (no character to place). Advance to Step 4.
- Skip on **Step 3**: no CharacterSnapshot created. Advance to Step 4.
- Skip on **Step 4**: equivalent to clicking the CTA.

#### DB Operations per Step

| Step | DB write | Uses |
|------|----------|------|
| 1 | `createTimeline` → `createChapter` → `createEvent` | existing CRUD functions in `db/hooks/` |
| 2 | `createCharacter` | existing CRUD functions |
| 3 | `createCharacterSnapshot` | existing CRUD functions |
| 4 | none | — |

#### Files

| File | Change |
|------|--------|
| `src/features/worlds/WorldDashboard.tsx` | Add trigger condition check; conditionally render `<OnboardingWizard>` |
| `src/features/onboarding/OnboardingWizard.tsx` | New — step controller |
| `src/features/onboarding/steps/StepTimeline.tsx` | New — step 1 form |
| `src/features/onboarding/steps/StepCharacter.tsx` | New — step 2 form |
| `src/features/onboarding/steps/StepPlace.tsx` | New — step 3 form |
| `src/features/onboarding/steps/StepDone.tsx` | New — completion screen |

---

### 3.3 Pillar 3 — Smart Empty States

#### Design Pattern
**Declarative prop configuration of an existing component.** The `<EmptyState>` component already exists in the codebase. This pillar is a pure content update: supply the correct `title`, `body`, and `action` props as defined in the AC. No new components, no new patterns.

#### Contract

Each empty state must pass exactly these three props:

```ts
interface EmptyStateProps {
  title: string
  body: string
  action: {
    label: string
    onClick: () => void
  }
}
```

#### Required Copy (authoritative)

| Section | title | body | action.label |
|---------|-------|------|--------------|
| Maps | "No maps yet" | "Upload an image of your world and place locations on it." | "Add Map" |
| Items | "No items yet" | "Track objects that characters carry, use, or lose over time." | "Add Item" |
| Relations | "No relationships yet" | "Define how characters know and feel about each other." | "Add Relationship" |
| Arc | "Nothing to visualize" | "The Arc view shows character states across every chapter. Add characters and events first." | "Go to Timeline" |
| Lore | "No lore pages yet" | "Document your world's history, rules, and mythology — things that don't change with time." | "Add Page" |
| Factions | "No factions yet" | "Factions are organizations characters can belong to — kingdoms, guilds, cults. Optional, but powerful for political stories." | "Add Faction" |

#### Files

| File | Change |
|------|--------|
| `src/features/maps/MapExplorerView.tsx` | Update `<EmptyState>` props |
| `src/features/items/ItemRosterView.tsx` | Update `<EmptyState>` props |
| `src/features/relationships/RelationshipGraphView.tsx` | Update `<EmptyState>` props |
| `src/features/arc/CharacterArcView.tsx` | Update `<EmptyState>` props |
| `src/features/lore/LoreView.tsx` | Update `<EmptyState>` props |
| `src/features/factions/FactionsView.tsx` | Update `<EmptyState>` props |

---

### 3.4 Pillar 4 — Dashboard as Living Guide

#### Design Pattern
**Rule engine with ordered evaluation.** A fixed-priority array of `SuggestionRule` objects is evaluated against a live `WorldSummaryData` snapshot. The first 3 rules whose conditions return `true` (and whose IDs are not in the dismissed set) are rendered. This decouples condition logic from rendering and makes the priority order explicit and auditable.

#### Data Model — Suggestion Rules

```ts
interface SuggestionRule {
  id: SuggestionId          // stable identifier used for dismissal persistence
  title: string
  dismissible: boolean
  condition: (data: WorldSummaryData) => boolean
  navigateTo: string        // route path (e.g. '/characters')
}
```

#### Stable Suggestion IDs

These IDs are stored in localStorage and must never be renamed after shipping:

```ts
type SuggestionId =
  | 'add-character'
  | 'add-first-event'
  | 'place-character'
  | 'add-relationships'
  | 'add-map'
  | 'document-lore'      // dismissible
  | 'add-factions'       // dismissible
```

#### Priority Order (index 0 = highest priority)

```ts
const SUGGESTION_RULES: SuggestionRule[] = [
  { id: 'add-character',    dismissible: false, condition: (d) => d.characterCount === 0, ... },
  { id: 'add-first-event',  dismissible: false, condition: (d) => d.characterCount > 0 && d.eventCount === 0, ... },
  { id: 'place-character',  dismissible: false, condition: (d) => d.eventCount > 0 && !d.hasCharacterAtAnyEvent, ... },
  { id: 'add-relationships',dismissible: false, condition: (d) => d.characterCount >= 2 && d.relationshipCount === 0, ... },
  { id: 'add-map',          dismissible: false, condition: (d) => d.eventCount > 0 && d.mapLayerCount === 0, ... },
  { id: 'document-lore',    dismissible: true,  condition: (d) => d.eventCount >= 5 && d.lorePageCount === 0, ... },
  { id: 'add-factions',     dismissible: true,  condition: (d) => d.characterCount >= 3 && d.factionCount === 0, ... },
]
```

> **ADR-002 — Suggestion priority ordering**  
> *Decision:* Fixed array ordered by criticality to the core story model.  
> *Rationale:* Characters → events → placement → relationships → map follows the natural world-building progression. Lore and factions are lower priority because they are explicitly optional features.  
> *Consequence:* If all 7 conditions are true simultaneously (brand-new world), the user sees the 3 most foundational suggestions first — not the dismissible ones.

#### Data Model — WorldSummaryData

This is a computed snapshot derived from live Dexie queries. It is not stored — it is recalculated on every Dashboard render via `useLiveQuery`.

```ts
interface WorldSummaryData {
  characterCount: number
  eventCount: number
  hasCharacterAtAnyEvent: boolean   // true if any CharacterSnapshot exists
  relationshipCount: number
  mapLayerCount: number
  lorePageCount: number
  factionCount: number
}
```

#### Persistence — LocalStorage Schema

```
Key:   plotweave-dismissed-suggestions-${worldId}
Value: JSON.stringify(string[])   // array of SuggestionId
```

Read on Dashboard mount. Written immediately on dismiss (no debounce). Scoped per `worldId` — clearing one world's dismissals has no effect on others.

#### Evaluation Algorithm

```
1. Read dismissedIds from localStorage for current worldId
2. Compute WorldSummaryData from live DB queries
3. Filter SUGGESTION_RULES:
     keep rule if rule.condition(data) === true
               AND rule.id NOT IN dismissedIds
4. Take first 3 from filtered list
5. Render as <DashboardSuggestion> cards
```

#### Component Interfaces

```ts
interface DashboardSuggestionProps {
  title: string
  dismissible: boolean
  onNavigate: () => void
  onDismiss?: () => void  // only provided when dismissible === true
}
```

#### Files

| File | Change |
|------|--------|
| `src/features/worlds/WorldDashboard.tsx` | Add suggestion section; compute `WorldSummaryData`; read/write localStorage |
| `src/features/worlds/DashboardSuggestion.tsx` | New — reusable suggestion card component |

---

## 4. Cross-Cutting Concerns

### 4.1 Data Flow Summary

```
IndexedDB (Dexie)
    │
    ├─ useLiveQuery → timelines.length, events.length
    │       └─ WorldDashboard: toggles OnboardingWizard vs standard view
    │
    ├─ useLiveQuery → WorldSummaryData
    │       └─ WorldDashboard: drives suggestion rule evaluation
    │
    └─ createTimeline / createChapter / createEvent / createCharacter / createCharacterSnapshot
            └─ OnboardingWizard steps: write records on completion

localStorage
    └─ plotweave-dismissed-suggestions-${worldId}
            └─ WorldDashboard: filters suggestion rule output
```

### 4.2 Interaction Between Pillar 2 and Pillar 4

When the wizard is showing (trigger condition true), the Dashboard suggestion section is not rendered — the wizard *is* the dashboard for that world. Once the trigger condition clears (at least one event exists), the standard Dashboard with suggestion cards is shown. The two components are mutually exclusive, gated by the same condition in `WorldDashboard`.

### 4.3 No New DB Tables

All four pillars operate on existing Dexie tables. The only persistence additions are:
- `plotweave-dismissed-suggestions-${worldId}` in localStorage (Pillar 4)

No schema migrations required.

### 4.4 Accessibility

- Wizard steps: each step's primary input must be focused on mount. Skip and primary action must be reachable by Tab + Enter.
- Suggestion cards: dismiss button must have an `aria-label` describing which suggestion is being dismissed (e.g. `aria-label="Dismiss: Document your world's lore"`).
- Tiered nav: all items remain in DOM and in tab order regardless of implementation choice.

---

## 5. Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Wizard reappears after user deletes all events | Low | Medium | Expected behavior per ADR-001; document it |
| `hasCharacterAtAnyEvent` query is slow on large worlds | Low | Low | CharacterSnapshot table is small; query is a simple `.count()` |
| LocalStorage key collision across worlds | None | High | Key is scoped by `worldId` (UUID) — collision probability is negligible |
| Suggestion copy drift from AC | Medium | Low | Copy is defined once in `SUGGESTION_RULES` constant; single source of truth |
| Step 3 receives `null` characterId if step 2 was skipped | Certain | High | Mitigated in design: if `createdCharacterId === null` when reaching step 3, skip step 3 automatically and advance to step 4 |

---

## 6. Architecture Decision Records (Summary)

| ID | Decision | Chosen Option |
|----|----------|---------------|
| ADR-001 | Wizard dismissal guard | Pure DB state (trigger = `events.length === 0`); no separate flag |
| ADR-002 | Suggestion priority ordering | Fixed array ordered by criticality to the core story model |
| ADR-003 | Suggestion cap enforcement | Slice first 3 from filtered rule results; priority array determines which 3 |
| ADR-004 | Wizard step state location | Ephemeral local state in `OnboardingWizard`; not persisted, not in Zustand |
| ADR-005 | Empty state implementation | Prop update on existing `<EmptyState>` component; no new component created |
