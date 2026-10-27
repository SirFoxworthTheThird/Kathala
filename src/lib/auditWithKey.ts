import Anthropic from '@anthropic-ai/sdk'

/*
  The AI audit, run from the app with the writer's own API key (next-plan.md,
  Part F3; decision D-2): one click for a chapter's audit, where the paste
  route is several. Paste-only stays. Nothing leaves the device unless a key
  is entered — then the prompt goes to Anthropic's API, from this browser, and
  to nowhere else; there is no server of ours in between.
*/

/** Where the key and the prompt go, and nowhere else. */
export const API_URL = 'https://api.anthropic.com'

/** The model the audit runs on. */
export const AUDIT_MODEL = 'claude-opus-5-5'

/** Why an audit did not come back with a reply, said for the writer. */
export class AuditRunError extends Error {}

/**
 * The assistant's reply to `prompt`: the text `parseAuditReply` reads. Streamed,
 * since a book so far is a long input and the reply can take minutes.
 * `fetch` is for tests.
 */
export async function runAudit(prompt: string, apiKey: string, options: { signal?: AbortSignal; fetch?: typeof fetch } = {}): Promise<string> {
  /*
    The address pinned, rather than left to the SDK's environment lookup: the
    key goes to Anthropic's API and to nothing a setting could point it at.
    Two retries at most, on the SDK's own rules (never on a refused key).
  */
  const client = new Anthropic({ apiKey, baseURL: API_URL, maxRetries: 2, dangerouslyAllowBrowser: true, ...(options.fetch ? { fetch: options.fetch } : {}) })
  try {
    const stream = client.beta.messages.stream({
      model: AUDIT_MODEL,
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      // The arithmetic of ages and dates across a book is the work: not the lowest effort.
      output_config: { effort: 'high' },
      // A request the model declines is answered by another, rather than coming back empty.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    }, { signal: options.signal })
    const message = await stream.finalMessage()
    if (message.stop_reason === 'refusal') throw new AuditRunError('The assistant declined to audit this. The prompt can still be copied and pasted into another.')
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    if (message.stop_reason === 'max_tokens') throw new AuditRunError('The reply was cut off before it finished. Try a chapter at a time.')
    return text
  } catch (e) {
    if (e instanceof AuditRunError) throw e
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AuditRunError('The key was not accepted. Check it, or copy the prompt instead.')
    if (e instanceof Anthropic.RateLimitError) throw new AuditRunError('Too many requests just now. Try again in a minute.')
    if (e instanceof Anthropic.APIUserAbortError) throw new AuditRunError('Stopped.')
    if (e instanceof Anthropic.APIConnectionError) throw new AuditRunError('Could not reach the API. Check the connection, or copy the prompt instead.')
    if (e instanceof Anthropic.APIError) throw new AuditRunError(`The API said: ${e.message}`)
    throw e
  }
}

/*
  Where the key is kept between audits, if the writer asks (it is otherwise
  held only while the audit is open):

  - **The desktop app** keeps it encrypted by the operating system's keychain,
    in the main process (`electron/secrets.cjs`), reached through a bridge that
    knows this one secret. The page never stores it. Where the system offers no
    real encryption, it is not kept.
  - **A browser** keeps it until the tab is closed (`sessionStorage`), and no
    longer: a page's storage is readable by anything running in the page and
    by anyone with a copy of the browser profile, and there is nothing in a
    browser to encrypt it with that the page could not also use to decrypt it.
    Never in `localStorage`, which would outlive the tab.
*/
interface KeyBridge {
  available: () => Promise<boolean>
  get: () => Promise<string>
  set: (value: string) => Promise<boolean>
  clear: () => Promise<boolean>
}

const bridge = (): KeyBridge | undefined =>
  (window as unknown as { electronAPI?: { anthropicKey?: KeyBridge } }).electronAPI?.anthropicKey

const TAB_KEY = 'kathala-anthropic-key'

/** Where a kept key would be: the system keychain, this tab, or nowhere (a desktop with no keychain). */
export type KeyPlace = 'keychain' | 'tab' | 'none'

export async function keyPlace(): Promise<KeyPlace> {
  const b = bridge()
  if (!b) return 'tab'
  return (await b.available()) ? 'keychain' : 'none'
}

/** The key kept from before, or empty. */
export async function keptKey(): Promise<string> {
  const b = bridge()
  if (b) return (await b.get()) ?? ''
  try { return sessionStorage.getItem(TAB_KEY) ?? '' } catch { return '' }
}

/** Keep the key, where `keyPlace` says; false where it cannot be kept. */
export async function keepKey(apiKey: string): Promise<boolean> {
  const b = bridge()
  if (b) return b.set(apiKey)
  try { sessionStorage.setItem(TAB_KEY, apiKey); return true } catch { return false }
}

/** Forget a kept key, wherever it was kept. */
export async function forgetKey(): Promise<void> {
  const b = bridge()
  if (b) await b.clear()
  try { sessionStorage.removeItem(TAB_KEY) } catch { /* nothing kept */ }
}
