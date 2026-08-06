import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const assignments = [
  {
    files: [
      path.join(root, 'example', 'The Name of the Wind.pwk'),
      path.join(root, 'public', 'library', 'the-name-of-the-wind.pwk'),
    ],
    coverImageId: 'notw-location-image-worldRoad',
  },
  {
    files: [
      path.join(root, 'example', "The Wise Man's Fear.pwk"),
      path.join(root, 'public', 'library', 'the-wise-man-s-fear.pwk'),
    ],
    coverImageId: 'wmf-illustration-wmf01',
  },
]

for (const { files, coverImageId } of assignments) {
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const cover = (data.blobs ?? []).find(({ id }) => id === coverImageId)
    if (!cover?.url) throw new Error(`Missing linked world image ${coverImageId} in ${file}`)

    data.world.coverImageId = coverImageId
    data.world.updatedAt = Date.UTC(2026, 7, 6)

    fs.writeFileSync(file, JSON.stringify(data))
    console.log(`${path.relative(root, file)}: world image -> ${coverImageId}`)
  }
}
