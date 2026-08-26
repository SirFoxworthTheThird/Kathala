import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImageDown, Loader2 } from 'lucide-react'
import { db } from '@/db/database'
import { Button } from '@/components/ui/button'
import { saveWorldImagesLocally } from '@/db/hooks/useBlobs'
import { describeLinked, describeLocaliseResult } from '@/lib/localiseImages'

/**
 * Take a copy of every picture this world links to.
 *
 * PlotWeave's first promise is that a story never leaves the device, and
 * pictures are the documented exception: a picture is either bytes you uploaded
 * or a **link** to somewhere else. That is why *Alice in Wonderland* downloads
 * as a 347,498-byte `.pwk` when its pictures are 28 MB, and it is also why a
 * downloaded book's maps do not draw on a train — and why a `.pwk` kept as a
 * backup slowly stops matching what it looked like, as links rot.
 *
 * So the copy is offered rather than assumed. It is the choice of whoever is
 * about to get on a plane, and the count is shown before anything is fetched.
 *
 * The size is not shown beforehand, because it is not known: a linked picture's
 * bytes are only measurable once fetched, and a number invented from the image
 * count would be a guess wearing a number's clothes. What can be said honestly
 * is how many pictures and how many sites, and that is what is said.
 */
export function LocalPicturesSection({ worldId }: { worldId: string }) {
  const linked = useLiveQuery(
    async () => {
      const all = await db.blobs.where('worldId').equals(worldId).toArray()
      return all.filter((b) => !!b.url && !b.data).map((b) => b.url!)
    },
    [worldId],
    [],
  )
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<string | null>(null)

  async function run() {
    setReport(null)
    setBusy({ done: 0, total: linked.length })
    try {
      const result = await saveWorldImagesLocally(worldId, (done, total) => setBusy({ done, total }))
      setReport(describeLocaliseResult(result))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{describeLinked(linked)}</p>
      {linked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void run()}>
            {busy
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving {busy.done} of {busy.total}…</>
              : <><ImageDown className="h-4 w-4" aria-hidden="true" /> Save pictures to this device</>}
          </Button>
        </div>
      )}
      {/*
        Not every site allows its pictures to be copied, and the ones that do
        not are named in the report rather than left to be discovered. Said
        before the button as well as after it: a writer deciding whether to press
        it is entitled to know it may not finish the job.
      */}
      {linked.length > 0 && !busy && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Some sites do not allow their pictures to be copied. Those stay as links and still
          appear when you are online. Copying a picture into your world is not the same as
          linking to it, so keep an eye on what you are allowed to reuse.
        </p>
      )}
      {report && (
        <p role="status" className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 text-xs text-[hsl(var(--foreground))]">
          {report}
        </p>
      )}
    </div>
  )
}
