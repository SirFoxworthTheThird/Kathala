import { useEffect, useState } from 'react'
import { probeableAddress, type ImageLoad } from '@/lib/mapImageState'

/**
 * Whether a picture at this address can actually be fetched.
 *
 * A blob record that carries a `url` resolves happily whether or not the host
 * at the other end answers, so nothing downstream of `useBlobUrlState` can tell
 * a working picture from a dead link. Every image in the Library is one of
 * these, which makes this the difference between a map and a grey rectangle for
 * anyone reading offline.
 *
 * **Only a remote address is probed**, and that is not an optimisation. A blob
 * holding uploaded bytes is resolved with `URL.createObjectURL`, which mints a
 * *new* string on every call — so an effect keyed on the url of an uploaded
 * image re-runs on every render and never settles. The first version of this
 * hook did exactly that and left every map on its spinner: 77 e2e failures, all
 * of them a canvas that never drew. Local bytes also cannot fail the way a link
 * can; if they are not there, the record is absent and `mapImageState` calls
 * that `not-downloaded` before it gets here.
 *
 * `Image` is used rather than `fetch` on purpose: it is not subject to CORS for
 * the purposes of *loading*, so this answers the same question the `<img>` the
 * map actually draws will answer, rather than a stricter one.
 */
export function useImageLoad(url: string | undefined): ImageLoad {
  const remote = probeableAddress(url)
  const [state, setState] = useState<ImageLoad>('loading')

  useEffect(() => {
    if (!remote) return
    let live = true
    setState('loading')
    const img = new Image()
    img.onload = () => { if (live) setState('ok') }
    img.onerror = () => { if (live) setState('failed') }
    img.src = remote
    // An image already in the cache can settle before the handlers are wired.
    if (img.complete) setState(img.naturalWidth > 0 ? 'ok' : 'failed')
    return () => {
      live = false
      img.onload = null
      img.onerror = null
    }
  }, [remote])

  return remote ? state : 'ok'
}
