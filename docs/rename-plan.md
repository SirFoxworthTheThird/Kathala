# Renaming PlotWeave to Kathala — a working plan

**Status:** proposed, nothing executed.
**Tagline under consideration:** *Kathala — where stories take shape across time and worlds.*

This is a plan to argue with, not a script to run. Every number in it was
measured on 2026-09-21 against `development`; none is an estimate.

---

## 1. The shape of the problem

A rename looks like one job and is two, with opposite risk profiles.

**The cosmetic layer** is ~530 text occurrences across ~160 files in two
repositories. All of it is reversible, none of it can hurt a user, and most of
it is mechanical.

**The persistence layer** is eleven identifiers. Get one wrong and existing
users lose their work, or their exports stop opening. The counter-intuitive
part, and the main argument of this plan: **most of the persistence layer should
keep the old name forever.** A database name nobody sees is not worth a
migration that can eat a novel.

There is precedent in this codebase for exactly that choice. `src/lib/exportImport.ts`
still writes `wb-rel-pos-${worldId}` — `wb` for an earlier name of this project.
It survived a previous rename, it has cost nothing in the years since, and
nobody has ever noticed. That is the model.

---

## 2. Measured surface

### Occurrences of "PlotWeave" (case-insensitive)

| Area | Files | Hits |
|---|---:|---:|
| `src/` | 53 | 86 |
| `e2e/` | 37 | 67 |
| `docs/` | 40 | 179 |
| `scripts/` | 21 | 123 |
| `.github/` | 4 | 16 |
| `electron/`, `forge.config.cjs` | 2 | 8 |
| `README.md` | 1 | 24 |
| `index.html` | 1 | 7 |
| `CLAUDE.md`, `ROADMAP.md`, `package.json` | 3 | 12 |
| **PlotWeave-Library** (text only) | — | 29 |
| **Total** | **~160** | **~550** |

### The set a `plotweave` grep does not find

This is the part that escapes a rename. **520 occurrences**, none of which
contain the string "plotweave":

| Identifier | Uses | What it is |
|---|---:|---|
| `__pwdb` | 427 | e2e Dexie seam (`window.__pwdb`) |
| `pw-tap`, `pw-tap-row` | 50 | CSS classes |
| `pw-nav-w` | 8 | CSS custom property |
| `__pwlibrary` | 8 | e2e Library install seam |
| `pw-measuring`, `pw-guiding` | 10 | CSS state classes |
| `pw-anim-*`, `pw-fade-in`, `pw-slide-in-*` | 10 | animation classes |
| `pw-folder-sync` | 1 | CSS class |
| `PW_CHROMIUM_PATH` | 3 | env var |
| `.pwk` / `.pwb` | 160 | **file extensions** — see §3 |

**Recommendation: rename none of these except by deliberate decision.** They are
invisible to users, and `__pwdb` alone is 427 edit sites for no benefit. List
them here so the choice is made rather than missed.

---

## 3. The irreversible set — decide before touching code

Eleven identifiers where the wrong move is destructive. Each needs an explicit
decision, and the recommendation is *keep* for most.

| # | Identifier | Where | If renamed carelessly | Recommend |
|---|---|---|---|---|
| 1 | `PlotWeaveDB` | `src/db/database.ts:86` | **Every existing user's world becomes invisible.** Dexie opens a new, empty database. | **Keep.** Invisible to users. |
| 2 | `.pwk` | 123 refs + every export ever made + all 41 Library books | Existing exports stop opening; the whole Library 404s | **Keep.** |
| 3 | `.pwb` | 37 refs + 3 Library bundles | As above | **Keep.** |
| 4 | `plotweave-ui` | Zustand persist key | Reading position, theme, sidebar state all reset | Keep, or migrate-on-read (§6) |
| 5 | `plotweave-device-id` | `deviceId.ts` | Device identity resets; folder-sync conflict naming affected | Keep |
| 6 | `plotweave-settings-collapsed` | `settingsSections.ts` | Cosmetic reset | Either |
| 7 | `plotweave-xray-open` | `SceneXRay.tsx` | Cosmetic reset | Either |
| 8 | `plotweave-ms-goal-${worldId}` | `ManuscriptView.tsx` | Word goals lost | Keep or migrate |
| 9 | `plotweave-session-goal-${worldId}` | `FocusMode.tsx`, `WritingProgress.tsx` | Session goals lost | Keep or migrate |
| 10 | `plotweave-structure-template-${worldId}` | `StructureView.tsx` | Structure template choice lost | Keep or migrate |
| 11 | `https://plotweave-library.netlify.app/` | `librarySite.ts:20` | **The Library stops loading for every user** until DNS and the new site exist | Change only after the new host serves the same paths |

**Good news on the file format:** the `.pwk` envelope declares
`"type": "world-export"`, not a branded string. The format is already
name-neutral inside; only the extension carries the brand.

---

## 4. What must be decided by a person

These cannot be derived from the codebase.

1. **Does the data layer get renamed at all?** Recommendation: no. If yes, it
   needs a written migration and a tested rollback, and that is its own project.
2. **Do `.pwk`/`.pwb` stay?** Recommendation: yes. A new extension would need
   dual-read support forever anyway, so it buys nothing.
3. **Is the GitHub repo renamed?** GitHub redirects old URLs indefinitely, so
   this is low-risk — but it breaks any unredirected deep links and every
   hard-coded clone URL in docs (`forge.config.cjs:47`, README, the wiki).
4. **Does the Library repo and its site rename too?** They are separate: repo
   `PlotWeave-Library`, site `plotweave-library.netlify.app`. The app depends on
   the site's URL at runtime.
5. **Name clearance.** Not done. Kathala appears free in software, but this needs
   a real USPTO/UKIPO search in classes 9 and 42, plus an Indian-market check —
   and a native-speaker check on the reported Marathi sense of *kaṭhalā*
   ("itch of cattle, scab"), which I could not verify because the source is
   blocked by this session's egress proxy.
6. **Assets.** The logo, `favicon.*`, `og-card.png` and `logo-128.png` are
   design work, not find-and-replace. The PW monogram is in all of them.

---

## 5. Sequence

Order matters; steps 1–2 gate everything else.

| Step | What | Blocked by | Reversible |
|---|---|---|---|
| 1 | Clear the name (trademark, domains, npm, GitHub org) | — | n/a |
| 2 | Decide §3 and §4 | 1 | n/a |
| 3 | New assets: logo, favicons, og-card | 1 | yes |
| 4 | **App repo cosmetic rename**, one PR | 2, 3 | yes |
| 5 | **Library repo cosmetic rename**, one PR | 2 | yes |
| 6 | New Library host serving the same paths; switch `librarySite.ts` | 5 | yes, keep old host alive |
| 7 | Rename GitHub repos | 4, 5 merged | yes (GitHub redirects) |
| 8 | Republish the wiki | 4 | yes |
| 9 | Release: `productName`, installers, release notes | 4, 7 | yes |

**Step 8 cannot be done from an agent session.** The wiki is a separate git
repo that the egress proxy refuses and that cannot be added to the authorised
set, because GitHub does not expose wikis as repositories to a GitHub App. See
`docs/wiki/README.md`.

---

## 6. Optional: migrate the storage keys without losing anything

If the `plotweave-*` keys must go, the safe shape is read-new-then-old,
write-new — no deletion, no flag day:

```ts
function readKey(next: string, previous: string): string | null {
  const found = localStorage.getItem(next)
  if (found !== null) return found
  const old = localStorage.getItem(previous)
  if (old !== null) localStorage.setItem(next, old)   // adopt, do not delete
  return old
}
```

Leaving the old key in place means a user who downgrades still has their
settings. Costs one function and a test per key; covers items 4–10 of §3.

**Not applicable to item 1.** IndexedDB cannot be renamed in place; it would
mean opening both databases and copying every table, which risks the one thing
in this app that cannot be reconstructed.

---

## 7. Traps specific to this codebase

- **`e2e/` is 37 files of brand strings**, and several assert on visible text
  (`getByRole('heading', { name: 'PlotWeave' })`). A rename that misses one
  fails the suite; a rename that "fixes" a test asserting the *world* name
  rather than the *app* name breaks the test's purpose.
- **`src/lib/__tests__/indexHtml.test.ts`** asserts on the literal string
  `PlotWeave`. It exists to catch exactly this kind of drift and will fail
  loudly — that is correct behaviour, not an obstacle.
- **`scripts/` has 123 hits** across ~21 world-generation scripts. Most are
  references to the Library or to paths, not to the app's identity. They should
  be read, not swept.
- **Six Library books still say "original PlotWeave assets"** in reader-facing
  Lore. These are provenance statements a reader sees, so they are cosmetic-layer
  work in the *Library* repo, governed by EX-010.
- **`docs/wiki/` is a staging copy of an unpublished wiki**, 32 of whose 38
  pages have never reached the live site. Renaming it here does not rename what
  the public sees.
- **`CLAUDE.md` names the app** and is read by every future agent session. If it
  is missed, agents will keep writing the old name into new code.
- **There is already a tagline in the repo**, and it is not the one under
  discussion. `index.html:12` reads *"PlotWeave — a story bible that knows what
  time it is"*, and `og:site_name`, `og:title` and the meta description carry
  the brand too. Whatever tagline is chosen has to land here as well as on the
  site, or the browser tab and every shared link disagree with the product.

---

## 8. How we prove nothing escaped

A rename is exactly the kind of change that looks complete and is not, so the
finish line should be a test rather than a feeling.

1. **A brand-drift test**, in the spirit of `docLinks`: no source file, doc or
   test may contain the old name except on an allow-list, and the allow-list is
   the §3 keep-list with a comment saying why each entry is there. This is the
   only artefact that makes the keep decisions durable — otherwise the next
   person "finishes the job" and breaks the database name.
2. `npm run build`, `npm run lint`, the unit suite, and the **full e2e suite** —
   the last matters because brand strings are in visible text.
3. **Import an old `.pwk`** exported before the rename, and confirm it opens.
4. **Open a browser profile with the old `PlotWeaveDB`** and confirm the worlds
   are still there.
5. `npm run gate` in the Library repo, and `catalogue:check`.
6. A fresh `VITE_E2E=1` build plus `scripts/capture-guide-shots.mjs`, because
   every screenshot in the guide shows the old name in the app's own top bar.
   **All 63 images need recapturing** — this is the largest single piece of work
   in the rename and is easy to underestimate. Of those, 45 already have working
   shot definitions in the capture script; 16 have never been driven by it, and
   2 (`34-scene-history`, `46-focus-mode`) are currently blocked on a question
   about `SceneDraftSection`. That blocker becomes load-bearing here: after a
   rename those two images are provably wrong rather than merely old.

---

## 9. Rough shape of the effort

| | |
|---|---|
| Decisions (§3, §4) | a conversation, not code |
| Assets | design work, external |
| App repo cosmetic rename + tests | one PR, large diff, mechanical |
| Library repo | one small PR |
| **Screenshot recapture** | **65 images** — the hidden bulk |
| Wiki republish | four commands, human, already blocked |
| Domains, GitHub renames, release | short but sequenced |

The find-and-replace is the easy part. The screenshots, the assets and the
name clearance are where the time goes.
