/*
  What a sprint remembers on this device (issue #706): the length last chosen,
  and whether to sound at the end, which is off until turned on (D-1). Kept in
  this browser's storage, which may be refused: then the defaults.
*/

const MINUTES_KEY = 'kathala-sprint-minutes'
const SOUND_KEY = 'kathala-sprint-sound'

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* this run only */ }
}

export function lastMinutes(): number | null {
  const n = Number(read(MINUTES_KEY))
  return Number.isInteger(n) && n > 0 ? n : null
}
export function keepMinutes(minutes: number) { write(MINUTES_KEY, String(minutes)) }

export function soundOn(): boolean { return read(SOUND_KEY) === '1' }
export function setSound(on: boolean) { write(SOUND_KEY, on ? '1' : null) }

/** A short tone, made in the page: no file to load. Nothing where the browser has no audio. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const t = ctx.currentTime
    for (const [freq, start] of [[880, 0], [660, 0.18]] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t + start)
      gain.gain.exponentialRampToValueAtTime(0.2, t + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t + start)
      osc.stop(t + start + 0.45)
    }
    setTimeout(() => { void ctx.close() }, 1000)
  } catch { /* no sound, then */ }
}
