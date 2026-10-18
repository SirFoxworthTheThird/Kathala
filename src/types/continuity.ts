export interface ContinuitySuppression {
  id: string
  worldId: string
  issueId: string
  note: string
}

/**
 * A contradiction an AI audit found, kept because every quote in it was in the
 * book when it was pasted back (`auditReply.ts`). Kept on this device only:
 * nothing about the audit leaves it unless the writer pastes it somewhere.
 */
export interface AuditFinding {
  id: string
  worldId: string
  title: string
  severity: 'serious' | 'minor' | 'trivial'
  why: string
  /** Each quote, and the scene it was found in. */
  quotes: Array<{ text: string; eventId: string }>
  createdAt: number
}
