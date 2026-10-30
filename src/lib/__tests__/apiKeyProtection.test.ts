import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import { CONTENT_SECURITY_POLICY } from '@/lib/contentSecurityPolicy'
import { API_URL, PROVIDERS, PROVIDER_IDS, forgetKey, keepKey, keptKey, keyPlace } from '@/lib/auditWithKey'

/**
 * The API key the AI audit can run with (Part F3), held as safely as a page
 * with no server can hold it:
 *
 * - the desktop app keeps it encrypted by the system keychain, and keeps
 *   nothing where the system has no real encryption (`electron/secrets.cjs`);
 * - a browser keeps it only until the tab closes, never in `localStorage`;
 * - it goes to Anthropic's API, at an address no setting can change;
 * - and the built page runs no script it did not ship (the CSP), so no stranger's
 *   script is there to read it.
 */

const require = createRequire(import.meta.url)
const { makeSecrets } = require('../../../electron/secrets.cjs') as {
  makeSecrets: (deps: { safeStorage: unknown; fs: unknown; dir: string }) => {
    available: () => boolean; get: (p: string) => string; set: (p: string, v: unknown) => boolean; clear: (p: string) => boolean
  }
}

/** A keychain that "encrypts" by reversing and tagging, and a disk in a Map: enough to see what reaches the disk. */
function fakes({ available = true, backend = 'gnome_libsecret' } = {}) {
  const disk = new Map<string, Buffer>()
  const safeStorage = {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => backend,
    encryptString: (s: string) => Buffer.from(`ENC:${[...s].reverse().join('')}`),
    decryptString: (b: Buffer) => [...b.toString().replace(/^ENC:/, '')].reverse().join(''),
  }
  const fs = {
    existsSync: (f: string) => disk.has(f),
    readFileSync: (f: string) => disk.get(f)!,
    writeFileSync: (f: string, b: Buffer) => { disk.set(f, b) },
    mkdirSync: () => {},
    rmSync: (f: string) => { disk.delete(f) },
  }
  return { disk, secrets: makeSecrets({ safeStorage, fs, dir: '/data/secrets' }) }
}

describe('the desktop app’s keychain', () => {
  it('keeps the key encrypted on disk, gives it back, and forgets it', () => {
    const { disk, secrets } = fakes()
    expect(secrets.available()).toBe(true)
    expect(secrets.set('anthropic', '  sk-ant-secret  ')).toBe(true)
    expect(secrets.set('gemini', 'AIza-secret')).toBe(true)
    // What is on the disk is the keychain's, not the key.
    const stored = [...disk.values()].map((b) => b.toString()).join('')
    expect(stored).not.toContain('sk-ant-secret')
    expect(stored).not.toContain('AIza-secret')
    // Each provider's own.
    expect(secrets.get('anthropic')).toBe('sk-ant-secret')
    expect(secrets.get('gemini')).toBe('AIza-secret')
    secrets.clear('anthropic')
    expect(secrets.get('anthropic')).toBe('')
    expect(secrets.get('gemini')).toBe('AIza-secret')
    secrets.clear('gemini')
    expect(disk.size).toBe(0)
  })

  it('answers to the four providers’ names only: a name is never a path', () => {
    const { disk, secrets } = fakes()
    for (const name of ['../../etc/passwd', 'anthropic/../x', 'other']) {
      expect(secrets.set(name, 'v')).toBe(false)
      expect(secrets.get(name)).toBe('')
      expect(secrets.clear(name)).toBe(false)
    }
    expect(disk.size).toBe(0)
  })

  it('keeps nothing where the system has no real encryption', () => {
    for (const f of [fakes({ available: false }), fakes({ backend: 'basic_text' })]) {
      expect(f.secrets.available()).toBe(false)
      expect(f.secrets.set('anthropic', 'sk-ant-secret')).toBe(false)
      expect(f.disk.size).toBe(0)
      expect(f.secrets.get('anthropic')).toBe('')
    }
    // Nor a value that is not a key.
    expect(fakes().secrets.set('anthropic', 42)).toBe(false)
  })
})

describe('the page’s side', () => {
  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    delete (window as { electronAPI?: unknown }).electronAPI
  })

  it('in a browser, keeps the key for the tab only, never in localStorage, and forgets it', async () => {
    expect(await keyPlace()).toBe('tab')
    expect(await keepKey('anthropic', 'sk-ant-tab')).toBe(true)
    expect(await keepKey('openai', 'sk-openai-tab')).toBe(true)
    expect(await keptKey('anthropic')).toBe('sk-ant-tab')
    expect(await keptKey('openai')).toBe('sk-openai-tab')
    expect(Object.values(sessionStorage)).toContain('sk-ant-tab')
    expect(JSON.stringify({ ...localStorage })).not.toMatch(/sk-ant-tab|sk-openai-tab/)
    await forgetKey('anthropic')
    expect(await keptKey('anthropic')).toBe('')
    // The other provider's stays until it is forgotten itself.
    expect(await keptKey('openai')).toBe('sk-openai-tab')
  })

  it('in the desktop app, asks the keychain, and stores nothing in the page', async () => {
    const kept = new Map<string, string>()
    const bridge = {
      available: vi.fn(async () => true),
      get: vi.fn(async (p: string) => kept.get(p) ?? ''),
      set: vi.fn(async (p: string, v: string) => { kept.set(p, v); return true }),
      clear: vi.fn(async (p: string) => { kept.delete(p); return true }),
    }
    ;(window as { electronAPI?: unknown }).electronAPI = { aiKeys: bridge }
    expect(await keyPlace()).toBe('keychain')
    expect(await keepKey('deepseek', 'sk-desk')).toBe(true)
    expect(bridge.set).toHaveBeenCalledWith('deepseek', 'sk-desk')
    expect(await keptKey('deepseek')).toBe('sk-desk')
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain('sk-desk')
    await forgetKey('deepseek')
    expect(bridge.clear).toHaveBeenCalledWith('deepseek')
    // A desktop whose system has no keychain: nowhere.
    bridge.available.mockResolvedValue(false)
    expect(await keyPlace()).toBe('none')
  })
})

describe('where the key may go, and what may run beside it', () => {
  it('goes to each provider’s own API, at a fixed address', () => {
    expect(API_URL).toBe('https://api.anthropic.com')
    expect(Object.fromEntries(PROVIDER_IDS.map((id) => [id, PROVIDERS[id].url]))).toEqual({
      anthropic: 'https://api.anthropic.com',
      openai: 'https://api.openai.com/v1',
      gemini: 'https://generativelanguage.googleapis.com',
      deepseek: 'https://api.deepseek.com',
    })
  })

  it('runs only the app’s own scripts: none inline, none from eval, none from elsewhere', () => {
    const directives = new Map(CONTENT_SECURITY_POLICY.split(';').map((d) => {
      const [name, ...values] = d.trim().split(/\s+/)
      return [name, values] as const
    }))
    expect(directives.get('script-src')).toEqual(["'self'"])
    expect(directives.get('default-src')).toEqual(["'self'"])
    expect(directives.get('object-src')).toEqual(["'none'"])
    expect(directives.get('base-uri')).toEqual(["'self'"])
    expect(directives.get('form-action')).toEqual(["'none'"])
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-eval/)
  })

  it('is stored, in the page, by one module only, and never in localStorage', () => {
    const sources = import.meta.glob(['../../**/*.ts', '../../**/*.tsx', '!../../**/__tests__/**'], { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
    const holders = Object.entries(sources).filter(([, src]) => src.includes('kathala-ai-key')).map(([p]) => p.replace(/^.*\//, ''))
    expect(holders).toEqual(['auditWithKey.ts'])
    const store = Object.entries(sources).find(([p]) => p.endsWith('/auditWithKey.ts'))![1]
    // Code, not the comment that explains why not.
    const code = store.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    // localStorage holds the provider and model chosen, never a key: every use of it is the choice's.
    const uses = [...code.matchAll(/localStorage\.(\w+)\(([^,)]*)/g)].map((m) => m[2].trim())
    expect(uses.length).toBeGreaterThan(0)
    expect(uses.every((arg) => arg === 'CHOICE')).toBe(true)
    expect(code).toMatch(/sessionStorage\.setItem\(tabKey\(provider\)/)
  })
})
