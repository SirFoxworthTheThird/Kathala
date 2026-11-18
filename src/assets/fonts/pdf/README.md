# Fonts bundled for the PDF export

Embedded, as subsets, in the PDFs the Export dialog makes (issue #701). They are loaded only when a PDF is made, and
never fetched from anywhere: see `docs/records/pdf-export-measure.md`, D-3.

| File | Font | Source | Licence |
| --- | --- | --- | --- |
| `EBGaramond-Regular.ttf`, `EBGaramond-Italic.ttf` | EB Garamond, static instances | `octaviopardo/EBGaramond12`, `fonts/ttf/` on `master` | SIL OFL 1.1, `OFL-EBGaramond.txt` |
| `LiberationSerif-Regular.ttf`, `LiberationSerif-Italic.ttf`, `LiberationMono-Regular.ttf`, `LiberationMono-Italic.ttf` | Liberation 2.1.5 | Debian `fonts-liberation` 1:2.1.5-3 | SIL OFL 1.1, `LICENSE-Liberation.txt` |
| `DejaVuSans.ttf` | DejaVu Sans 2.37 | Debian `fonts-dejavu-core` | Bitstream Vera licence and public domain, `LICENSE-DejaVu.txt` |

All are unmodified. EB Garamond sets the reading copy and the print interior. Liberation Serif and Mono set the
submission, being metric-compatible with Times New Roman and Courier New. DejaVu Sans is the fallback for a character
the main font lacks.

Each must be a **static** font, not a variable one: pdf-lib's subsetting of a variable font loses most of its glyphs
(measured).
