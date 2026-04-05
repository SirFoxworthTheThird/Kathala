const KEY = 'plotweave-tutorial'

export interface TutorialProgress {
  step: number   // 0=not started, 1=name world, 2=add char, 3=create timeline, 4=time cursor, 5=done
  worldId?: string
  done?: boolean
}

export function getTutorialProgress(): TutorialProgress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { step: 0 }
    return JSON.parse(raw) as TutorialProgress
  } catch {
    return { step: 0 }
  }
}

export function setTutorialProgress(updates: Partial<TutorialProgress>): void {
  const current = getTutorialProgress()
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...updates }))
}

export function advanceTutorial(updates?: Partial<Omit<TutorialProgress, 'step'>>): void {
  const current = getTutorialProgress()
  localStorage.setItem(KEY, JSON.stringify({ ...current, step: current.step + 1, ...updates }))
}

export function skipTutorial(): void {
  localStorage.setItem(KEY, JSON.stringify({ step: 0, done: true }))
}
