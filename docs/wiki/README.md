# Staging copy of the GitHub wiki

**This directory is temporary. Delete it once the wiki is published.**

These are the pages of the project's [GitHub wiki](https://github.com/SirFoxworthTheThird/PlotWeave/wiki),
rewritten against `docs/GUIDE.md`. They live here only because the wiki is a
separate git repository (`PlotWeave.wiki.git`) that this session could not push
to, and the work would otherwise have been lost.

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
