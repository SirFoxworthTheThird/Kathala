# Robinson Crusoe asset manifest

## Text

- Full manuscript: Project Gutenberg ebook 521, *The Life and Adventures of Robinson Crusoe* by Daniel Defoe: <https://www.gutenberg.org/ebooks/521>
- Local source copy: `source/pg521.txt`
- The generator preserves the normalized narrative text exactly once across 99 scene drafts. The source verifier and scene audit check word count, order, and complete paragraph coverage.

## Historical illustrations

- The world cover plus character and location artwork use distinct illustrations from the 1891 Walter Paget edition collected by Wikimedia Commons: <https://commons.wikimedia.org/wiki/Category:Robinson_Crusoe_(1891)_-_illustrated_by_Walter_Paget>
- Repository filenames use the form `paget-NNN.jpg`; the explicit entity-to-file mapping lives in `asset-data.mjs`.

## Original generated artwork

- `public/library/robinson-crusoe/maps/atlantic-world.png`: an original seventeenth-century-inspired Atlantic chart made for the example.
- `public/library/robinson-crusoe/maps/crusoes-island.png`: an original seventeenth-century-inspired illustrated survey of Crusoe's island made for the example.
- `public/library/robinson-crusoe/art/item-*.png`: twelve original object-specific engravings made for this example. Each depicts the named item rather than reusing a map, portrait, photograph, or generic scene.

The generated assets share a mature hand-colored copperplate and wood-engraving treatment: aged paper, restrained sepia and muted natural color, historically plausible seventeenth-century materials, no modern objects, no logos, and no cartoon styling.

## Validation requirements

- Every character, item, and location references its own image blob.
- Character and location artwork is not reused between entities.
- Every item uses a semantically specific illustration.
- Map images are maps; entity images are illustrations, not maps.
- All repository-local image paths must exist and load before publication.
