const path = require('path')

/*
  The AI audit's API keys, kept by the desktop app (next-plan.md, Part F3):
  encrypted with the operating system's own keychain (Electron's `safeStorage`
  — the macOS Keychain, Windows' DPAPI, or the Linux secret service) before
  they touch the disk, in the app's own data folder. Never in the page's
  storage, where any script in the page, or anyone copying the browser
  profile, could read them.

  Where the system offers no real encryption — Linux with no secret service,
  where `safeStorage` would fall back to a fixed key — nothing is kept at all:
  `set` says so, and the writer pastes the key each time.

  One key per provider, by a fixed name: the bridge cannot be asked for any
  other file, and a name is never a path.
*/
const PROVIDERS = ['anthropic', 'openai', 'gemini', 'deepseek']

function makeSecrets({ safeStorage, fs, dir }) {
  const file = (provider) => (PROVIDERS.includes(provider) ? path.join(dir, `${provider}-key.bin`) : null)
  const encrypted = () => {
    if (!safeStorage.isEncryptionAvailable()) return false
    // On Linux, 'basic_text' is a fixed key: not encryption worth the name.
    if (typeof safeStorage.getSelectedStorageBackend === 'function' && safeStorage.getSelectedStorageBackend() === 'basic_text') return false
    return true
  }
  return {
    /** Whether a key can be kept here at all. */
    available: () => encrypted(),
    get: (provider) => {
      const f = file(provider)
      try {
        if (!f || !encrypted() || !fs.existsSync(f)) return ''
        return safeStorage.decryptString(fs.readFileSync(f))
      } catch {
        return ''
      }
    },
    set: (provider, value) => {
      const f = file(provider)
      if (!f || typeof value !== 'string' || !value.trim() || !encrypted()) return false
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(f, safeStorage.encryptString(value.trim()), { mode: 0o600 })
      return true
    },
    clear: (provider) => {
      const f = file(provider)
      if (!f) return false
      try { fs.rmSync(f, { force: true }) } catch { /* nothing kept */ }
      return true
    },
  }
}

module.exports = { makeSecrets, PROVIDERS }
