# Robinson Crusoe asset manifest

## Text

- Full manuscript: Project Gutenberg ebook 521, *The Life and Adventures of Robinson Crusoe* by Daniel Defoe: <https://www.gutenberg.org/ebooks/521>
- Local source copy: `source/pg521.txt`
- The generator preserves the normalized narrative text exactly once across 99 scene drafts. The source verifier and scene audit check word count, order, and complete paragraph coverage.

## Historical illustration

- The world cover uses an illustration from the 1891 Walter Paget edition collected by Wikimedia Commons: <https://commons.wikimedia.org/wiki/Category:Robinson_Crusoe_(1891)_-_illustrated_by_Walter_Paget>
- Its repository filename uses the form `paget-NNN.jpg`; the explicit cover mapping lives in `asset-data.mjs`.

## Original generated artwork

- `public/library/robinson-crusoe/maps/atlantic-world.png`: an original seventeenth-century-inspired Atlantic chart made for the example.
- `public/library/robinson-crusoe/maps/crusoes-island.png`: an original seventeenth-century-inspired illustrated survey of Crusoe's island made for the example.
- `public/library/robinson-crusoe/art/character-*.jpg`: twenty-four original, character-specific portraits and group scenes grounded in each figure's role, culture, age, and period.
- `public/library/robinson-crusoe/art/location-*.jpg`: thirty-five original, location-specific environmental illustrations based on the corresponding setting descriptions.
- `public/library/robinson-crusoe/art/item-*.png`: twelve original object-specific engravings made for this example. Each depicts the named item rather than reusing a map, portrait, photograph, or generic scene.

The generated assets share a mature, painterly historical-book treatment with restrained natural colour, historically plausible seventeenth-century materials, no modern objects, no logos, and no cartoon styling. Character portraits and location scenes use distinct prompts documented by their stable semantic filenames.

## Validation requirements

- Every character, item, and location references its own image blob.
- Character and location artwork is not reused between entities.
- Every item uses a semantically specific illustration.
- Map images are maps; entity images are illustrations, not maps.
- All repository-local image paths must exist and load before publication.
