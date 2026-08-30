import { defaultCalendar } from '@/lib/calendar'
import type { WorldCalendar } from '@/types'

/**
 * Ready-made calendar shapes.
 *
 * HB-9, from an outside review: configuring a calendar overwhelms Settings.
 * Part of that is bulk — twelve month rows in the middle of a settings page —
 * and part is that the only way to a calendar unlike Earth's was to edit those
 * twelve rows one at a time, renaming and re-numbering as you went.
 *
 * **The shape is the tedious part, not the names.** A writer will rename
 * *Month 1* in a moment; what they will not enjoy is typing thirty into twelve
 * boxes and then working out where the extra five days go. So these presets
 * commit to day counts and to which entries fall outside the months, and leave
 * the naming alone wherever there is no name everybody already agrees on.
 *
 * Offered only when there is no calendar yet. Applying one to a calendar
 * somebody has already edited would throw their work away, and a preset is not
 * worth a confirm dialog.
 */
export interface CalendarPreset {
  id: string
  label: string
  /** One line, shown under the button. */
  description: string
  build: () => WorldCalendar
}

export const CALENDAR_PRESETS: CalendarPreset[] = [
  {
    id: 'earth',
    label: 'Earth',
    description: 'The Gregorian year — twelve named months, 365 days.',
    // The same value the plain "Enable calendar" button uses, so there is one
    // definition of Earth rather than two that can drift.
    build: defaultCalendar,
  },
  {
    id: 'seasons',
    label: 'Four seasons',
    description: 'Spring, Summer, Autumn and Winter of 91 days each — 364 days.',
    build: () => ({
      startYear: 1,
      yearSuffix: '',
      months: [
        { name: 'Spring', days: 91 },
        { name: 'Summer', days: 91 },
        { name: 'Autumn', days: 91 },
        { name: 'Winter', days: 91 },
      ],
    }),
  },
  {
    id: 'twelve-thirty',
    label: 'Twelve months of thirty',
    description: 'Twelve even months and five festival days outside them — 365 days.',
    build: () => ({
      startYear: 1,
      yearSuffix: '',
      months: [
        ...Array.from({ length: 12 }, (_, i) => ({ name: `Month ${i + 1}`, days: 30 })),
        // Outside the months, which is the part that is fiddly to build by hand.
        { name: 'Festival Days', days: 5, intercalary: true },
      ],
    }),
  },
]
