/**
 * A minimal store-only (no compression) ZIP writer — just enough to build the
 * `.docx` and `.epub` containers in the browser with no dependency. Entries are
 * written verbatim (method 0), which also satisfies EPUB's requirement that the
 * `mimetype` entry be stored uncompressed.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

const enc = new TextEncoder()

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff])
}
function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])
}
function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

/** Build a ZIP archive (store-only) from the given entries, in order. */
export function zipStore(entries: ZipEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = concat([
      u32(0x04034b50), // local file header signature
      u16(20), u16(0), u16(0), // version needed, flags, method (0 = store)
      u16(0), u16(0), // mod time, mod date
      u32(crc), u32(size), u32(size), // crc, compressed size, uncompressed size
      u16(nameBytes.length), u16(0), // name length, extra length
      nameBytes, entry.data,
    ])
    localChunks.push(local)

    centralChunks.push(concat([
      u32(0x02014b50), // central directory header signature
      u16(20), u16(20), u16(0), u16(0), // version made by, version needed, flags, method
      u16(0), u16(0), // mod time, mod date
      u32(crc), u32(size), u32(size),
      u16(nameBytes.length), u16(0), u16(0), // name, extra, comment lengths
      u16(0), u16(0), u32(0), // disk #, internal attrs, external attrs
      u32(offset), // local header offset
      nameBytes,
    ]))

    offset += local.length
  }

  const central = concat(centralChunks)
  const eocd = concat([
    u32(0x06054b50), // end of central directory signature
    u16(0), u16(0), // disk numbers
    u16(entries.length), u16(entries.length), // entries on disk, total entries
    u32(central.length), u32(offset), // central dir size, offset
    u16(0), // comment length
  ])

  return concat([...localChunks, central, eocd])
}
