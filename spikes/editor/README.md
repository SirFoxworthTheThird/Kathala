# Editor spike

Step 1 of *One screen for the book* in [`ROADMAP.md`](../../ROADMAP.md): load a
whole book into a candidate editor, with each chapter and scene heading carrying
its record's id, and measure what it costs. Nothing here ships. The results and
the decision are in
[`docs/records/editor-spike-2026-09-28.md`](../../docs/records/editor-spike-2026-09-28.md).

Three candidates, behind one `window.spike` API (`main.js`):

| File | Editor | How a heading keeps its id |
|---|---|---|
| `textarea.js` | a `<textarea>`, the kind of box the app drafts in today | it cannot — the baseline |
| `codemirror.js` | CodeMirror 6 | markers beside the text, with the rules written at the top of the file |
| `prosemirror.js` | ProseMirror | an attribute on the heading node |

`compose.js` writes the book as `# Chapter` / `## Scene` / prose, and
`sceneBodies` is its exact inverse, so a round trip can be checked scene by
scene.

## Running it

The editors are not dependencies of the app, so they are installed without
saving:

```bash
npm install --no-save @codemirror/state @codemirror/view @codemirror/commands \
  prosemirror-state prosemirror-view prosemirror-model prosemirror-history \
  prosemirror-keymap prosemirror-commands prosemirror-inputrules

KATHALA_LIBRARY=../Kathala-Library node spikes/editor/extract.mjs   # → public/book.json
npx vite build spikes/editor --outDir /tmp/spike-dist --emptyOutDir
(cd /tmp/spike-dist && python3 -m http.server 5199) &
node spikes/editor/measure.mjs                     # all three; or e.g. `codemirror`
```

`RUNS` (default 3) repeats the timings; `RUNS=0` runs only the heading
scenarios. `SPIKE_OUT` names the JSON file the results are written to.
`SPIKE_CHROMIUM` points at a Chromium other than the one this environment ships.
