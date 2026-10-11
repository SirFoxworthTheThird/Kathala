/**
 * The colours plot threads and motifs are given as they are made, in turn —
 * from the dashboard's lists and from a scene's own fields alike, so a thread
 * made while writing looks like one made on the dashboard.
 */
export const THREAD_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899', '#14b8a6', '#f97316']
export const MOTIF_COLORS = ['#e11d48', '#7c3aed', '#0891b2', '#65a30d', '#2563eb', '#db2777', '#0d9488', '#ea580c']

/** The colour the next one gets, after `made` already exist. */
export const nextColor = (palette: readonly string[], made: number) => palette[made % palette.length]
