const path = require('path')

/*
  The AI audit's API key, kept by the desktop app (next-plan.md, Part F3):
  encrypted with the operating system's own keychain (Electron's `safeStorage`
  — the macOS Keychain, Windows' DPAPI, or the Linux secret service) before it
  touches the disk, in the app's own data folder. Never in the page's storage,
  where any script in the page, or anyone copying the browser profile, could
  read it.

  Where the system offers no real encryption — Linux with no secret service,
  where `safeStorage` would fall back to a fixed key — it is not kept at all:
  `set` says so, and the writer pastes it each time.

  One secret, by one name: the bridge cannot be asked for anything else.
*/
function makeSecrets({ safeStorage, fs, dir }) {
  const file = path.join(dir, 'anthropic-key.bin')
  const encrypted = () => {
    if (!safeStorage.isEncryptionAvailable()) return false
    // On Linux, 'basic_text' is a fixed key: not encryption worth the name.
    if (typeof safeStorage.getSelectedStorageBackend === 'function' && safeStorage.getSelectedStorageBackend() === 'basic_text') return false
    return true
  }
  return {
    /** Whether a key can be kept here at all. */
    available: () => encrypted(),
    get: () => {
      try {
        if (!encrypted() || !fs.existsSync(file)) return ''
        return safeStorage.decryptString(fs.readFileSync(file))
      } catch {
        return ''
      }
    },
    set: (value) => {
      if (typeof value !== 'string' || !value.trim() || !encrypted()) return false
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file, safeStorage.encryptString(value.trim()), { mode: 0o600 })
      return true
    },
    clear: () => {
      try { fs.rmSync(file, { force: true }) } catch { /* nothing kept */ }
      return true
    },
  }
}

module.exports = { makeSecrets }
