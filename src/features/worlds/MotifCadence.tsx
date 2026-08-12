import { useMemo } from 'react'
import type { Chapter, WorldEvent, Motif } from '@/types'
import { useMotifs, createMotif, deleteMotif } from '@/db/hooks/useMotifs'
import { computeTagCadence, type TagCadenceRow } from '@/lib/tagCadence'
import { CadenceManager } from './CadenceManager'

const MOTIF_COLORS = ['#e11d48', '#7c3aed', '#0891b2', '#65a30d', '#2563eb', '#db2777', '#0d9488', '#ea580c']

/**
 * Motif cadence: where each recurring theme / symbol appears across the
 * chapters, so motifs that fade out or vanish for long stretches stand out.
 * Motifs are created and removed here; events are tagged with them on the
 * event card.
 */
export function MotifCadence({ worldId, chapters, events }: {
  worldId: string
  chapters: Chapter[]
  events: WorldEvent[]
}) {
  const motifs = useMotifs(worldId)

  const { rows, chapterCount } = useMemo(
    () => computeTagCadence({ entities: motifs, events, chapters, tagIdsOf: (e) => e.motifIds ?? [] }),
    [motifs, events, chapters]
  )

  function warningFor(r: TagCadenceRow<Motif>): string | null {
    if (r.eventCount === 0) return 'no scenes tagged yet'
    if (r.trailingGap >= 3) return `fades out — last seen Ch. ${r.lastChapterNumber}, absent ${r.trailingGap} chapters`
    if (r.longestDormancy >= 3) return `vanishes for ${r.longestDormancy} chapters mid-story`
    return null
  }

  return (
    <CadenceManager
      rows={rows}
      chapterCount={chapterCount}
      noun="motif"
      placeholder="Motif name (e.g. Mirrors, The colour red)…"
      onCreate={async (name) => { await createMotif({ worldId, name, color: MOTIF_COLORS[motifs.length % MOTIF_COLORS.length] }) }}
      onDelete={deleteMotif}
      warningFor={warningFor}
      field="motifIds"
      chapters={chapters}
      events={events}
    />
  )
}
