import { useMemo, useState, type ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fieldAtKey, useCustomFieldDefs, useFieldsAt } from '@/db/hooks/useCustomFields'
import { useActiveEventId } from '@/store'
import { picks } from '@/lib/customFields'
import type { CustomFieldKind, CustomValues } from '@/types'

/*
  A roster filtered by a choice field (issue #699, part 3): "Race: Elf",
  "Suspicion: Prime suspect". A field over time is read at the cursor, so the
  suspects at this scene are this scene's.
*/

const ALL = '__all__'

export function useChoiceFilter(bookId: string | null | undefined, kind: CustomFieldKind): {
  /** The control; null where the kind has no choice field to filter by. */
  control: ReactNode
  keep: (entity: { id: string; customValues?: CustomValues }) => boolean
} {
  const defs = useCustomFieldDefs(bookId, kind)
  const at = useFieldsAt(bookId, useActiveEventId())
  const [picked, setPicked] = useState(ALL)
  const choices = useMemo(
    () => defs.filter((d) => d.type === 'choice' || d.type === 'choices').flatMap((d) => (d.options ?? []).map((o) => ({ def: d, option: o, key: `${d.id}:${o.id}` }))),
    [defs],
  )
  const chosen = choices.find((c) => c.key === picked)
  const keep = (e: { id: string; customValues?: CustomValues }) => {
    if (!chosen) return true
    const value = chosen.def.overTime ? at.get(fieldAtKey(chosen.def.id, e.id))?.value : e.customValues?.[chosen.def.id]
    return picks(value, chosen.option.id)
  }
  const control = choices.length === 0 ? null : (
    <div className="w-48">
      <Select value={chosen ? picked : ALL} onValueChange={setPicked}>
        <SelectTrigger className="h-8 text-xs" aria-label={chosen ? `Filter by a field: ${chosen.def.name}: ${chosen.option.label}` : 'Filter by a field: all'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">All</SelectItem>
          {choices.map((c) => <SelectItem key={c.key} value={c.key} className="text-xs">{`${c.def.name}: ${c.option.label}`}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
  return { control, keep }
}
