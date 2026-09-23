# Renaming PlotWeave to Kathala — a working plan

**Status:** executed and merged, except the four items a person owns —
trademark clearance, the two repository renames, the two host moves, and the
wiki publish.
**Tagline:** *Kathala — where stories take shape across time and worlds.*
Adopted, and now the single line the product uses to describe itself: the world
selector, the page and `og:title`, and the README all carry it. It replaced *a
story bible for fiction writers*, which was accurate until reading mode gave
the app a second audience — the reason this wording was chosen over the others.

This is a plan to argue with, not a script to run. Every number in it was
measured on 2026-09-21 against `development`; none is an estimate.

> **Revised 2026-09-21, and the revision matters more than the plan.**
> The first draft assumed an installed base. There isn't one — the author is
> currently the only user. That does not make the rename smaller, but it moves
> every decision in §3 from *dangerous* to merely *tedious*, and it flips the
> recommendation from **keep the old identifiers forever** to **rename them now
> or accept them forever**. A rename of the data layer gets strictly more
> expensive with every user, and is close to free today. The sections below are
> written in their corrected form; §3.1 records what the reasoning was before,
> because it becomes true again the moment somebody else installs this.

---

## 1. The shape of the problem

A rename looks like one job and is two, with opposite risk profiles.

**The cosmetic layer** is ~530 text occurrences across ~160 files in two
repositories. All of it is reversible, none of it can hurt a user, and most of
it is mechanical.

**The persistence layer** is eleven identifiers. With an installed base, getting
one wrong loses somebody's work. With one user who can export first, the same
eleven are a morning's work and a re-import.

So the real question is not *is this safe* — today it is — but **is it worth
doing at all, and if so it has to be now.** Every one of these decisions is
cheap exactly once. `src/lib/exportImport.ts` still writes
`wb-rel-pos-${worldId}` — `wb` for an earlier name of this project — because
the last rename declined to pay this cost while it was still small. It has
cost nothing since, which is the argument for leaving well alone; it is also
the reason a third name would inherit two layers of residue rather than one.

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

**DECIDED: keep all of them**, and the reason is a consequence of keeping
`.pwk`. Once the extension stays, `pw` is no longer residue to be swept out —
it is the project's permanent internal prefix, and it is used consistently.
Renaming `__pwdb` to `__kdb` while a user is still saving `.pwk` files would
replace one convention with two, which is worse than either.

This is the largest saving in the whole rename: **427 edit sites for `__pwdb`
alone**, plus the CSS classes and custom properties, all left alone with a
reason rather than by oversight. None of it is persisted, none of it is visible,
and all of it now matches the file a user types.

The one to watch is `PW_CHROMIUM_PATH` — an env var in the capture tooling. It
is fine to keep, but it is the only one that a person reads while debugging, so
it is the only one where the old initials might puzzle somebody.

---

## 3. The persisted set — decide before touching code

Eleven identifiers that outlive a deploy. **With one user these are cheap to
change and will never be cheaper.** The "if renamed carelessly" column describes
what happens with no migration and no export — which is recoverable today and
is not recoverable later.

| # | Identifier | Where | If renamed carelessly | Recommend |
|---|---|---|---|---|
| 1 | `KathalaDB` | `src/db/database.ts:86` | Dexie opens a new, empty database and the old worlds are still on disk, unreferenced. | **Rename now.** Export first, re-import after. Never cheaper. |
| 2 | `.pwk` | 123 refs + all 41 Library books + the catalogue | — | **DECIDED: keep.** |
| 3 | `.pwb` | 37 refs + 3 Library bundles | — | **DECIDED: keep.** |
| 4 | `plotweave-ui` | Zustand persist key | Reading position, theme, sidebar state reset once | **Rename.** One reset, yours. |
| 5 | `plotweave-device-id` | `deviceId.ts` | Device identity resets; folder-sync conflict naming affected | **Rename.** Check folder sync after. |
| 6 | `plotweave-settings-collapsed` | `settingsSections.ts` | Cosmetic reset | **Rename.** |
| 7 | `plotweave-xray-open` | `SceneXRay.tsx` | Cosmetic reset | **Rename.** |
| 8 | `plotweave-ms-goal-${worldId}` | `ManuscriptView.tsx` | Word goals lost | **Rename.** |
| 9 | `plotweave-session-goal-${worldId}` | `FocusMode.tsx`, `WritingProgress.tsx` | Session goals lost | **Rename.** |
| 10 | `plotweave-structure-template-${worldId}` | `StructureView.tsx` | Structure template choice lost | **Rename.** |
| 11 | `https://plotweave-library.netlify.app/` | `librarySite.ts:20` | The Library stops loading until the new host serves the same paths | **Rename, last.** Keep the old host alive through the switch. |
| 12 | `https://plotweave.netlify.app/` | `index.html` og:url and og:image, README, `deploy-dev.yml` | Every shared link shows a broken preview card, because og:image 404s | **Rename, last**, with 11. Missed in the source pass and reverted. |

**Good news on the file format:** the `.pwk` envelope declares
`"type": "world-export"`, not a branded string. The format is already
name-neutral inside; only the extension carries the brand.

### 3.1 What this said before, and when it becomes true again

The first draft of this table recommended **keep** for nine of the eleven, on
the reasoning that a database name nobody sees is not worth a migration that can
eat a novel. That reasoning was sound and the premise was wrong: it assumed
people other than the author had worlds in their browsers.

It is worth keeping on the page because it is not wrong forever — it is wrong
*today*. The moment a second person installs this, every row above reverts to
**keep**, and the window closes without an announcement. If the rename is going
to touch the data layer at all, that is an argument for doing it before the
first release under the new name, not after.

---

---

## 4. What must be decided by a person

These cannot be derived from the codebase.

1. **Does the data layer get renamed at all?** Recommendation: **yes, and only
   now.** With one user it is an export, a rename and a re-import. With ten it
   needs a written migration and a tested rollback, and becomes its own project.
   The cost of this decision only ever goes up.
2. **Do `.pwk`/`.pwb` stay?** **DECIDED: yes, they stay.** The format already
   calls itself `world-export` inside, the 41 Library books keep working, and
   the two repositories no longer have to ship in step. Nothing in the guide
   glosses what the letters stand for, so no prose reads oddly afterwards.

   **Three labels around the extension still change**, because they name the
   application rather than the file: `HelpPanel.tsx:134` (*"a PlotWeave `.pwk`
   backup"*), `exportImport.ts:357` (`description: 'PlotWeave Export'`, the
   browser file picker) and `electron/main.cjs:55` (`name: 'PlotWeave Files'`,
   the OS dialog). Miss these and the file chooser still says the old name
   while the extension is silent about it.
3. **Is the GitHub repo renamed?** GitHub redirects old URLs indefinitely, so
   this is low-risk — but it breaks any unredirected deep links and every
   hard-coded clone URL in docs (`forge.config.cjs:47`, README, the wiki).
4. **Does the Library repo and its site rename too?** They are separate: repo
   `PlotWeave-Library`, site `plotweave-library.netlify.app`. The app depends on
   the site's URL at runtime.
5. **Name clearance.** Split in two, and half of it is now done.

   **Linguistic check: DONE, and the name passes.** A lexicon aggregator had
   reported a Marathi sense of *kaṭhalā* meaning "the itch of cattle, or scab".
   It was relayed here as unverified — the source is blocked by this session's
   egress proxy — and it does not survive a proper check. The real neighbours
   are:

   - **कठला** *kaṭhalā* — a beaded necklace, choker or torque, the heavy collar
     seen on deity idols in Maharashtra. The closest genuine match, and a benign
     one: a made object, worn, traditional.
   - **खटला** *khaṭalā* — a lawsuit or court case. Further away than Latin script
     suggests: aspirated **kha-** with a retroflex **ṭ**, against our **ka-**.
   - **कटहल** *kathal* — jackfruit, and Hindi rather than Marathi, where the word
     is *phanas*.

   Nothing embarrassing, nothing that blocks. Worth knowing: the name derives
   from **कथा**, with the *dental* थ, while the necklace is **कठला** with the
   *retroflex* ठ — different words in Devanagari, identical in Latin. Set in
   Devanagari for a logo or an Indian market, the story reading is unambiguous.

   **Trademark clearance: NOT done.** Still needs a real USPTO/UKIPO search in
   classes 9 and 42, and a look at the Indian market specifically, since that is
   where a collision would most likely sit. Usage searches found nothing in
   software; usage is not registrability.
6. **Assets. RESOLVED, and there is nothing to do.** An earlier draft of this
   plan said the logo, favicons and `og-card.png` were design work carrying a
   "PW monogram". That was written without opening a single one of them, and it
   is wrong.

   The mark is **abstract** — a ribbon weaving through an archway with a
   four-pointed star at its centre, called the *Story Gate mark* in
   `index.html`'s own comment. There are **no letters in it**, and `strings`
   finds no name in `favicon.ico`, `favicon.icns`, `favicon-32.png` or
   `logo-128.png`. A mark that never said the old name does not need to stop
   saying it, and an arch you pass through suits Kathala as well as it suited
   what came before.

   The one asset that *did* carry the name was `og-card.png`, because it is a
   **screenshot of the dashboard** rather than artwork — the picture shown when
   a link is pasted into Slack, Discord or a tweet. Regenerated from the
   recaptured dashboard shot. Nothing else in `public/` needs a designer.

---

## 5. Sequence

Order matters; steps 1–2 gate everything else.

| Step | What | Blocked by | Reversible |
|---|---|---|---|
| 1 | Clear the name (trademark, domains, npm, GitHub org) | — | n/a |
| 2 | Decide §3 and §4 | 1 | n/a |
| 3 | ~~New assets~~ — nothing to do; see §4.6 | — | n/a |
| 4 | **App repo cosmetic rename**, one PR | 2 | yes |
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

Two decisions are now made, and together they take the largest mechanical chunk
off the table: **`.pwk`/`.pwb` stay**, and therefore **every `pw-` identifier
stays too** — 520 occurrences, 427 of them `__pwdb`. What is left is text, and
pictures.

| | |
|---|---|
| Remaining decisions (§4: 1, 3, 4, 5, 6) | a conversation, not code |
| Assets | none — the mark carries no name |
| App repo cosmetic rename + tests | one PR, large diff, mechanical |
| Library repo | one small PR |
| **Screenshot recapture** | **65 images** — the hidden bulk |
| Wiki republish | four commands, human, already blocked |
| Domains, GitHub renames, release | short but sequenced |

The find-and-replace is the easy part. The screenshots, the assets and the
name clearance are where the time goes.
