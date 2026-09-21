# Staging copy of the GitHub wiki

**This directory is temporary. Delete it once the wiki is published.**

These are the pages of the project's [GitHub wiki](https://github.com/SirFoxworthTheThird/PlotWeave/wiki),
rewritten against `docs/GUIDE.md`. They live here only because the wiki is a
separate git repository (`PlotWeave.wiki.git`) that an agent session cannot push
to, and the work would otherwise have been lost.

**The publish is still blocked, and it is not a permissions setting somebody
forgot.** A second session tried again on 2026-09-20: the wiki repository
*clones* fine anonymously, but pushing is refused by the proxy — *"PlotWeave.wiki
is not in this session's authorized repository set"* — and it cannot be added to
that set, because GitHub does not expose a wiki as a repository the GitHub App
can be granted access to. `add_repo` answers *"you don't have access to
sirfoxworththethird/kathala.wiki"*. So this is a human's five-minute job with
the commands below, not something the next agent should spend an hour
rediscovering.

`docs/GUIDE.md` remains the source of truth for user documentation. Two full
prose descriptions of the same app in one repository is exactly how the wiki
came to be four months stale in the first place, so this copy should not
outlive the publish.

## Publishing

```bash
git clone https://github.com/SirFoxworthTheThird/PlotWeave.wiki.git
cp docs/wiki/*.md PlotWeave.wiki/          # not this README
rm PlotWeave.wiki/README.md
cd PlotWeave.wiki
git add -A && git commit -m "Rewrite the wiki against the current user guide"
git push
```

Then remove `docs/wiki/` from this repository.

## Contents

37 pages plus `_Sidebar.md`. Every page is reachable from `Home.md`, and every
internal link resolves to a page in this directory.

## What is unpublished

The live wiki was last touched on **16 August 2026**. This copy was rewritten on
26 August and **32 of its 38 pages have never been published**. On 20 September
two further errors were corrected here, both introduced by reading-mode work
that landed after the rewrite:

- **`Library.md`** said the worlds *"carry no text from the books"*. 34 of the
  41 are complete public-domain novels; seven carry no text. The page now says
  which is which.
- **`Reading-Mode.md`** and **`Manuscript.md`** both said the Manuscript screen
  steps aside for a reader and closes its address. It does not — on a world with
  prose it stays, renamed **Read**, and becomes the book. Only Structure and the
  Corkboard close.

`Reading-Mode.md` also gained the **Read** screen it never described: progress,
Contents and *Back to your place*, the type controls, the cursor following the
reader, and the *In this scene* panel.
