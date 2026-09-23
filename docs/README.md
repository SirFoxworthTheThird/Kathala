# docs

Four things live here, and they are not the same kind of thing.

| | What it is | Kept current? |
|---|---|---|
| **[`GUIDE.md`](GUIDE.md)** | The illustrated user guide. The one document that describes Kathala as it is today. | **Yes** — every user-facing change updates it in the same pull request. |
| **`images/`** | The guide's screenshots, numbered in the order they appear. Captured at 2880×1800 by `scripts/capture-guide-shots.mjs`. | **Yes** — a change to what a screen looks like recaptures its shot. |
| **`wiki/`** | The GitHub wiki, mirrored so it can be reviewed in a pull request. Same material as the guide, organised for looking one thing up. [`wiki/README.md`](wiki/README.md) says how to publish it. | **Yes** |
| **`release-notes/`** | What shipped in a release. | Written once, per release. |
| **`records/`** | What someone saw, on a day, in a version of the app that no longer exists. Writer and reader runs, UX reviews, the [closed architecture findings](records/architecture-findings.md), the [rename plan](records/rename-plan.md). | **No, deliberately.** |

## Why `records/` is never updated

A run report says *"I opened the Library and the shelf was one long list"*. That
was true on the day it was written. Rewriting it to match today's app would make
an observation report something nobody observed, and the value of these files is
precisely that they are evidence — the fixes they prompted are traceable back to
someone's actual confusion.

So they keep their old wording, their old screenshots, and, since the rename,
the old name of the application. `src/lib/__tests__/repoName.test.ts` exempts
this folder by path and asserts that the exemption is live, so a well-meaning
sweep of the repository fails the suite rather than quietly rewriting history.

If a record is wrong about something that matters, write a new one. Do not edit
the old one.

## What is not here any more

`docs/features/` held twenty-five design notes written while each feature was
being built. Nothing linked to them, none had been meaningfully edited in months,
and at least one had gone quietly wrong — `timeline.md` gave the global sort key
as `chapter.number * 10_000 + sortOrder`, which is the comparator some views
build in memory, not the key that is stored. The guide and the wiki document
every one of those features as they actually are, so the notes were deleted
rather than kept as a second, drifting account. They remain in git history:

```
git log --oneline --diff-filter=D -- docs/features
git show <sha>^:docs/features/timeline.md
```
