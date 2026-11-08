/*
  Gzip in the browser, with no dependency: `CompressionStream`, fed directly
  rather than through `Blob.stream()`, which jsdom (the unit tests' browser)
  does not have.
*/

async function through(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(data); c.close() } })
  const reader = source.pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.length
  }
  const out = new Uint8Array(length)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

export function gzip(data: Uint8Array): Promise<Uint8Array> {
  return through(data, new CompressionStream('gzip'))
}

export function gunzip(data: Uint8Array): Promise<Uint8Array> {
  return through(data, new DecompressionStream('gzip'))
}
